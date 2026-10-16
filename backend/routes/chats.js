import { Router } from "express";
import mongoose from "mongoose";
import { Chat } from "../models/Chat.js";
import { Attachment } from "../models/Attachment.js";
import { sendGeminiMessage, streamGeminiMessage, GeminiError } from "../services/gemini.js";
import { buildContents, deriveTitle } from "../services/prompt.js";
import { messageRateLimiter } from "../middleware/rateLimit.js";

const router = Router();

const MAX_MESSAGE_LENGTH = 4000; // Security S2 / API_SPEC 2.7
const MAX_MESSAGES_PER_CHAT = 500; // DATABASE_SCHEMA.pdf Section 5

function makeMessageId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function findChatQuery(clientId, id) {
  const conditions = [{ chatId: id }, { _id: id }];
  if (mongoose.isValidObjectId(id)) {
    conditions.push({ _id: new mongoose.Types.ObjectId(id) });
  }
  return { clientId, $or: conditions };
}

/**
 * Normalize MongoDB Binary BSON object or Node Buffer into a standard Buffer.
 */
function ensureBuffer(data) {
  if (!data) return Buffer.alloc(0);
  if (Buffer.isBuffer(data)) return data;
  if (typeof data.value === "function") return Buffer.from(data.value(true));
  if (data.buffer && Buffer.isBuffer(data.buffer)) return data.buffer;
  if (data.buffer && data.buffer instanceof ArrayBuffer) return Buffer.from(data.buffer);
  return Buffer.from(data);
}

/**
 * Retrieve all persistent attachments for given messages in a chat from MongoDB attachments collection.
 * Converts binary buffers to Base64 strings for Gemini multimodal context.
 */
async function loadAttachmentsMap(clientId, chatId, messages = [], extraId = null) {
  const ids = new Set();
  if (extraId) ids.add(extraId);
  for (const m of messages) {
    if (m?.attachment?.id) {
      ids.add(m.attachment.id);
    }
  }

  if (ids.size === 0) return new Map();

  const docs = await Attachment.find({
    clientId,
    chatId,
    attachmentId: { $in: Array.from(ids) },
  })
    .select("attachmentId mimeType data")
    .lean();

  const map = new Map();
  for (const doc of docs) {
    if (doc?.data) {
      const buf = ensureBuffer(doc.data);
      map.set(doc.attachmentId, {
        mimeType: doc.mimeType,
        data: buf.toString("base64"),
      });
    }
  }
  return map;
}

/**
 * GET /api/chats
 * List chats for the current client. Omits messages array (API_SPEC 2.2).
 */
router.get("/", async (req, res, next) => {
  try {
    const chats = await Chat.find({ clientId: req.clientId })
      .select("chatId title createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = [];
    const seen = new Set();
    for (const c of chats) {
      const id = c.chatId || c._id?.toString();
      if (id && !seen.has(id)) {
        seen.add(id);
        formatted.push({
          id,
          title: c.title || "New chat",
          createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
          updatedAt: c.updatedAt ? new Date(c.updatedAt).getTime() : Date.now(),
        });
      }
    }

    // API_SPEC 2.2 returns { chats: [...] }
    res.json({ chats: formatted });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chats
 * Create a new chat session. Accepts client-generated id (API_SPEC 2.3).
 */
router.post("/", async (req, res, next) => {
  try {
    const { id, title } = req.body || {};
    const chatTitle = typeof title === "string" && title.trim() ? title.trim().slice(0, 100) : "New chat";

    if (id && typeof id === "string") {
      const chat = await Chat.findOneAndUpdate(
        { clientId: req.clientId, chatId: id },
        {
          $setOnInsert: {
            chatId: id,
            clientId: req.clientId,
            title: chatTitle,
            messages: [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const responseObj = {
        id: chat.chatId,
        title: chat.title,
        createdAt: new Date(chat.createdAt).getTime(),
        updatedAt: new Date(chat.updatedAt).getTime(),
        messages: [],
      };

      // API_SPEC 2.3 returns { chat: { ... } }
      return res.status(201).json({ chat: responseObj, id: chat.chatId });
    }

    const chat = await Chat.create({
      clientId: req.clientId,
      title: chatTitle,
      messages: [],
    });

    const responseObj = {
      id: chat.chatId,
      title: chat.title,
      createdAt: new Date(chat.createdAt).getTime(),
      updatedAt: new Date(chat.updatedAt).getTime(),
      messages: [],
    };

    res.status(201).json({ chat: responseObj, id: chat.chatId });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ id: req.body?.id, chat: { id: req.body?.id } });
    }
    next(err);
  }
});

const ALLOWED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function validateImageAttachment(image) {
  if (!image) return { validatedImage: null, attachmentMeta: null };

  if (typeof image !== "object") {
    const error = new Error("Invalid image attachment payload.");
    error.status = 400;
    throw error;
  }

  const mimeType = (image.mimeType || image.type || "").toLowerCase().trim();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    const error = new Error("Only PNG, JPEG, and WebP images are supported.");
    error.status = 400;
    throw error;
  }

  const rawData = typeof image.data === "string" ? image.data : "";
  if (!rawData || !rawData.trim()) {
    const error = new Error("Image data is required.");
    error.status = 400;
    throw error;
  }

  // Strip data:image/...;base64, prefix if present
  const cleanData = rawData.replace(/^data:image\/[a-z]+;base64,/, "").trim();

  // Validate Base64 size limit (5MB)
  const approximateBytes = Math.round((cleanData.length * 3) / 4);
  if (approximateBytes > MAX_IMAGE_BYTES) {
    const error = new Error("Image exceeds the maximum allowed size of 5MB.");
    error.status = 400;
    throw error;
  }

  const validatedImage = {
    mimeType,
    data: cleanData,
  };

  const attachmentMeta = {
    name: typeof image.name === "string" && image.name.trim() ? image.name.trim().slice(0, 120) : "image",
    mimeType,
    size: typeof image.size === "number" && image.size > 0 ? image.size : approximateBytes,
  };

  return { validatedImage, attachmentMeta };
}

/**
 * GET /api/chats/:id
 * Retrieve a specific chat with all its messages (API_SPEC 2.4).
 */
router.get("/:id", async (req, res, next) => {
  try {
    const chat = await Chat.findOne(findChatQuery(req.clientId, req.params.id)).lean();

    if (!chat) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Chat does not exist for this client ID" },
      });
    }

    const responseChat = {
      id: chat.chatId || chat._id.toString(),
      title: chat.title || "New chat",
      createdAt: chat.createdAt ? new Date(chat.createdAt).getTime() : Date.now(),
      updatedAt: chat.updatedAt ? new Date(chat.updatedAt).getTime() : Date.now(),
      messages: (chat.messages || []).map((m) => {
        const chatIdStr = chat.chatId || chat._id.toString();
        return {
          id: m.id || m._id?.toString() || makeMessageId(),
          role: m.role,
          content: m.content,
          attachment: m.attachment
            ? {
                id: m.attachment.id,
                name: m.attachment.name,
                mimeType: m.attachment.mimeType,
                size: m.attachment.size,
                url: m.attachment.id
                  ? `/api/chats/${chatIdStr}/attachments/${m.attachment.id}`
                  : null,
              }
            : null,
          status: m.status || "complete",
          timestamp: m.timestamp || (m.createdAt ? new Date(m.createdAt).getTime() : Date.now()),
        };
      }),
    };

    res.json({ chat: responseChat, ...responseChat });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/chats/:id
 * Rename a chat (API_SPEC 2.5).
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const { title } = req.body || {};
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Title: 1 to 100 characters after trimming." },
      });
    }

    const trimmedTitle = title.trim().slice(0, 100);

    const chat = await Chat.findOneAndUpdate(
      findChatQuery(req.clientId, req.params.id),
      { title: trimmedTitle },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Chat does not exist for this client ID" },
      });
    }

    res.json({
      chat: {
        id: chat.chatId || chat._id.toString(),
        title: chat.title,
        updatedAt: new Date(chat.updatedAt).getTime(),
      },
      success: true,
      title: chat.title,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/chats/:id/attachments/:attachmentId
 * Serve raw image binary for an attachment with client/chat ownership verification.
 */
router.get("/:id/attachments/:attachmentId", async (req, res, next) => {
  try {
    const chat = await Chat.findOne(findChatQuery(req.clientId, req.params.id))
      .select("chatId")
      .lean();

    if (!chat) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Chat does not exist for this client ID" },
      });
    }

    const attachment = await Attachment.findOne({
      clientId: req.clientId,
      chatId: chat.chatId,
      attachmentId: req.params.attachmentId,
    }).lean();

    if (!attachment || !attachment.data) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Attachment not found" },
      });
    }

    const binaryData = ensureBuffer(attachment.data);

    res.setHeader("Content-Type", attachment.mimeType || "image/png");
    res.setHeader("Content-Length", binaryData.length);
    res.setHeader("Cache-Control", "private, max-age=86400, immutable");
    return res.end(binaryData);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/chats/:id
 * Delete a chat and clean up associated attachments from MongoDB. Idempotent (API_SPEC 2.6).
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const chat = await Chat.findOne(findChatQuery(req.clientId, req.params.id))
      .select("chatId")
      .lean();
    const targetChatId = chat?.chatId || req.params.id;

    await Chat.deleteMany(findChatQuery(req.clientId, req.params.id));
    await Attachment.deleteMany({
      clientId: req.clientId,
      chatId: { $in: [targetChatId, req.params.id] },
    });

    res.json({ ok: true, success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chats/:id/messages
 * Send message in chat, invoke Gemini, persist turns (API_SPEC 2.7).
 */
router.post("/:id/messages", messageRateLimiter, async (req, res, next) => {
  try {
    const { id: userMsgId, content, text, model, image } = req.body || {};
    const { validatedImage, attachmentMeta } = validateImageAttachment(image);

    const rawContent = typeof content === "string" ? content : typeof text === "string" ? text : "";
    const trimmed = rawContent.trim() || (validatedImage ? "Describe this image." : "");

    if (!trimmed) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Message content or image attachment is required" },
      });
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: `Message is too long (maximum ${MAX_MESSAGE_LENGTH} characters).`,
        },
      });
    }

    let chat = await Chat.findOne(findChatQuery(req.clientId, req.params.id));

    // Auto-create chat if it does not exist yet (handles race conditions gracefully)
    if (!chat) {
      try {
        chat = await Chat.create({
          chatId: req.params.id,
          clientId: req.clientId,
          title: deriveTitle(trimmed),
          messages: [],
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          chat = await Chat.findOne(findChatQuery(req.clientId, req.params.id));
        } else {
          throw createErr;
        }
      }
    }

    // Check message cap (DATABASE_SCHEMA Section 5)
    if (chat.messages.length >= MAX_MESSAGES_PER_CHAT) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: `This chat has reached the maximum limit of ${MAX_MESSAGES_PER_CHAT} messages. Please start a new chat.`,
        },
      });
    }

    const savedUserMsgId = typeof userMsgId === "string" && userMsgId ? userMsgId : makeMessageId();
    const assistantMsgId = makeMessageId();
    const now = Date.now();

    // Store image binary in attachments collection and link with attachmentId
    let createdAttachmentDoc = null;
    if (validatedImage) {
      const imageBuffer = Buffer.from(validatedImage.data, "base64");
      createdAttachmentDoc = await Attachment.create({
        chatId: chat.chatId,
        messageId: savedUserMsgId,
        clientId: req.clientId,
        filename: attachmentMeta.name,
        mimeType: validatedImage.mimeType,
        size: imageBuffer.length,
        data: imageBuffer,
      });
      attachmentMeta.id = createdAttachmentDoc.attachmentId;
      attachmentMeta.url = `/api/chats/${chat.chatId}/attachments/${createdAttachmentDoc.attachmentId}`;
    }

    const userMessageObj = {
      id: savedUserMsgId,
      role: "user",
      content: trimmed,
      attachment: attachmentMeta,
      timestamp: now,
    };

    // Load attachments across all turns in this chat for multi-turn visual memory
    const attachmentsMap = await loadAttachmentsMap(
      req.clientId,
      chat.chatId,
      chat.messages,
      attachmentMeta?.id
    );

    // Build Gemini contents using message history and vision attachment(s)
    const contents = buildContents(
      [...chat.messages, userMessageObj],
      validatedImage,
      attachmentsMap
    );

    // Send to Gemini
    const reply = await sendGeminiMessage({
      model,
      contents,
    });

    const isFirstUserTurn = !chat.messages.some((m) => m.role === "user");
    if (isFirstUserTurn) {
      chat.title = deriveTitle(trimmed);
    }

    const replyContent =
      reply && typeof reply === "string" && reply.trim()
        ? reply
        : "I am Aura. How can I help you today?";

    const assistantMessageObj = {
      id: assistantMsgId,
      role: "assistant",
      content: replyContent,
      timestamp: now + 1,
    };

    chat.messages.push(userMessageObj);
    chat.messages.push(assistantMessageObj);
    await chat.save();

    // Exactly matching API_SPEC.pdf 2.7 response format
    res.json({
      title: chat.title,
      reply: replyContent,
      userMessage: userMessageObj,
      assistantMessage: assistantMessageObj,
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: err.message },
      });
    }
    if (err instanceof GeminiError) {
      return res.status(err.status || 500).json({
        error: { code: err.code || "MODEL_BUSY", message: err.message },
      });
    }
    next(err);
  }
});

/**
 * POST /api/chats/:id/messages/stream
 * Real-time SSE streaming for chat turns
 */
router.post("/:id/messages/stream", messageRateLimiter, async (req, res, next) => {
  try {
    const { id: userMsgId, content, text, model, image } = req.body || {};
    const { validatedImage, attachmentMeta } = validateImageAttachment(image);

    const rawContent = typeof content === "string" ? content : typeof text === "string" ? text : "";
    const trimmed = rawContent.trim() || (validatedImage ? "Describe this image." : "");

    if (!trimmed) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Message content or image attachment is required" },
      });
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: `Message is too long (maximum ${MAX_MESSAGE_LENGTH} characters).`,
        },
      });
    }

    let chat = await Chat.findOne(findChatQuery(req.clientId, req.params.id));

    // Auto-create chat if it does not exist yet
    if (!chat) {
      try {
        chat = await Chat.create({
          chatId: req.params.id,
          clientId: req.clientId,
          title: deriveTitle(trimmed),
          messages: [],
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          chat = await Chat.findOne(findChatQuery(req.clientId, req.params.id));
        } else {
          throw createErr;
        }
      }
    }

    // Check message cap (DATABASE_SCHEMA Section 5)
    if (chat.messages.length >= MAX_MESSAGES_PER_CHAT) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: `This chat has reached the maximum limit of ${MAX_MESSAGES_PER_CHAT} messages. Please start a new chat.`,
        },
      });
    }

    const savedUserMsgId = typeof userMsgId === "string" && userMsgId ? userMsgId : makeMessageId();
    const assistantMsgId = makeMessageId();
    const now = Date.now();

    // Store image binary in attachments collection and link with attachmentId
    let createdAttachmentDoc = null;
    if (validatedImage) {
      const imageBuffer = Buffer.from(validatedImage.data, "base64");
      createdAttachmentDoc = await Attachment.create({
        chatId: chat.chatId,
        messageId: savedUserMsgId,
        clientId: req.clientId,
        filename: attachmentMeta.name,
        mimeType: validatedImage.mimeType,
        size: imageBuffer.length,
        data: imageBuffer,
      });
      attachmentMeta.id = createdAttachmentDoc.attachmentId;
      attachmentMeta.url = `/api/chats/${chat.chatId}/attachments/${createdAttachmentDoc.attachmentId}`;
    }

    // Persist user message once immediately with attachment metadata only
    const existingUserMsg = chat.messages.find((m) => m.id === savedUserMsgId);
    const userMessageObj = existingUserMsg || {
      id: savedUserMsgId,
      role: "user",
      content: trimmed,
      attachment: attachmentMeta,
      status: "complete",
      timestamp: now,
    };

    if (!existingUserMsg) {
      chat.messages.push(userMessageObj);
    }

    const isFirstUserTurn = !chat.messages.some((m) => m.role === "user" && m.id !== savedUserMsgId);
    if (isFirstUserTurn) {
      chat.title = deriveTitle(trimmed);
    }
    await chat.save();

    // Prepare SSE Response
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    // Emit initial metadata event
    res.write(
      `event: start\ndata: ${JSON.stringify({
        chatId: chat.chatId,
        title: chat.title,
        userMessage: userMessageObj,
        assistantMessageId: assistantMsgId,
      })}\n\n`
    );
    if (typeof res.flush === "function") res.flush();

    // Set up cancellation on client abort/disconnect
    const geminiAbortController = new AbortController();
    let clientAborted = false;
    let isSaved = false;

    const handleDisconnect = () => {
      if (!isSaved) {
        clientAborted = true;
        geminiAbortController.abort();
      }
    };
    res.on("close", handleDisconnect);
    req.on("close", handleDisconnect);
    req.socket?.on("close", handleDisconnect);

    // Load all persistent attachments for this chat so follow-ups retain image memory
    const attachmentsMap = await loadAttachmentsMap(
      req.clientId,
      chat.chatId,
      chat.messages,
      attachmentMeta?.id
    );

    const contents = buildContents(chat.messages, validatedImage, attachmentsMap);
    let accumulatedText = "";

    try {
      for await (const chunk of streamGeminiMessage({
        model,
        contents,
        signal: geminiAbortController.signal,
      })) {
        if (clientAborted || geminiAbortController.signal.aborted) break;
        accumulatedText += chunk;
        res.write(`event: chunk\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
        if (typeof res.flush === "function") res.flush();
      }
    } catch (streamErr) {
      if (!clientAborted && !geminiAbortController.signal.aborted) {
        console.error("Stream generation error:", streamErr.message);
        res.write(
          `event: error\ndata: ${JSON.stringify({
            error: {
              code: streamErr.code || "STREAM_ERROR",
              message: streamErr.message || "Error generating response",
            },
          })}\n\n`
        );
      }
    }

    if (clientAborted || geminiAbortController.signal.aborted || req.socket?.destroyed || !res.writable) {
      clientAborted = true;
    }

    if (clientAborted) {
      if (!isSaved && accumulatedText.trim().length > 0) {
        isSaved = true;
        try {
          const partialMsg = {
            id: assistantMsgId,
            role: "assistant",
            content: accumulatedText,
            status: "stopped",
            timestamp: now + 1,
          };
          await Chat.updateOne(
            findChatQuery(req.clientId, req.params.id),
            { $push: { messages: partialMsg } }
          );
        } catch (e) {
          console.error("Failed to persist partial message on abort:", e.message);
        }
      }
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    // Natural stream completion
    if (!isSaved) {
      isSaved = true;
      const finalReply =
        accumulatedText.trim() || "I am Aura. How can I help you today?";

      const assistantMessageObj = {
        id: assistantMsgId,
        role: "assistant",
        content: finalReply,
        status: "complete",
        timestamp: now + 1,
      };

      chat.messages.push(assistantMessageObj);
      await chat.save();

      if (!res.writableEnded) {
        res.write(
          `event: complete\ndata: ${JSON.stringify({
            title: chat.title,
            reply: finalReply,
            assistantMessage: assistantMessageObj,
          })}\n\n`
        );
        res.end();
      }
    }
  } catch (err) {
    if (!res.headersSent) {
      if (err.status === 400) {
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: err.message },
        });
      }
      if (err instanceof GeminiError) {
        return res.status(err.status || 500).json({
          error: { code: err.code || "MODEL_BUSY", message: err.message },
        });
      }
      next(err);
    } else {
      if (!res.writableEnded) {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            error: { code: "SERVER_ERROR", message: err.message },
          })}\n\n`
        );
        res.end();
      }
    }
  }
});

/**
 * PUT/POST /api/chats/:id/messages/:messageId/stream
 * Edit a user message, truncate subsequent messages, and stream new response
 */
const handleEditMessageStream = async (req, res, next) => {
  try {
    const { content, text, model } = req.body || {};
    const rawContent = typeof content === "string" ? content : typeof text === "string" ? text : "";

    if (!rawContent || !rawContent.trim()) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Message content is required" },
      });
    }

    const trimmed = rawContent.trim();
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: `Message is too long (maximum ${MAX_MESSAGE_LENGTH} characters).`,
        },
      });
    }

    const chat = await Chat.findOne(findChatQuery(req.clientId, req.params.id));
    if (!chat) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Chat not found" },
      });
    }

    const messageId = req.params.messageId;
    const userMsgIdx = chat.messages.findIndex((m) => m.id === messageId);
    if (userMsgIdx === -1) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Message not found in chat" },
      });
    }

    if (chat.messages[userMsgIdx].role !== "user") {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Only user messages can be edited" },
      });
    }

    // Clean up attachments of truncated subsequent messages
    const truncatedMessages = chat.messages.slice(userMsgIdx + 1);
    const truncatedAttachmentIds = truncatedMessages
      .map((m) => m.attachment?.id)
      .filter(Boolean);
    if (truncatedAttachmentIds.length > 0) {
      await Attachment.deleteMany({
        clientId: req.clientId,
        chatId: chat.chatId,
        attachmentId: { $in: truncatedAttachmentIds },
      });
    }

    // Truncate subsequent messages: keep history up to userMsgIdx
    chat.messages = chat.messages.slice(0, userMsgIdx + 1);

    // Update user message in place
    chat.messages[userMsgIdx].content = trimmed;
    chat.messages[userMsgIdx].timestamp = Date.now();

    // If first user message was edited, update title consistently
    const firstUserIdx = chat.messages.findIndex((m) => m.role === "user");
    if (firstUserIdx === userMsgIdx) {
      chat.title = deriveTitle(trimmed);
    }

    await chat.save();

    // Prepare SSE Response
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const assistantMsgId = makeMessageId();
    const now = Date.now();

    // Emit initial metadata event
    res.write(
      `event: start\ndata: ${JSON.stringify({
        chatId: chat.chatId,
        title: chat.title,
        userMessage: chat.messages[userMsgIdx],
        assistantMessageId: assistantMsgId,
      })}\n\n`
    );
    if (typeof res.flush === "function") res.flush();

    // Set up cancellation on client abort/disconnect
    const geminiAbortController = new AbortController();
    let clientAborted = false;
    let isSaved = false;

    const handleDisconnect = () => {
      if (!isSaved) {
        clientAborted = true;
        geminiAbortController.abort();
      }
    };
    res.on("close", handleDisconnect);
    req.on("close", handleDisconnect);
    req.socket?.on("close", handleDisconnect);

    // Load persistent attachments for preserved turns
    const attachmentsMap = await loadAttachmentsMap(
      req.clientId,
      chat.chatId,
      chat.messages
    );

    const contents = buildContents(chat.messages, null, attachmentsMap);
    let accumulatedText = "";

    try {
      for await (const chunk of streamGeminiMessage({
        model,
        contents,
        signal: geminiAbortController.signal,
      })) {
        if (clientAborted || geminiAbortController.signal.aborted) break;
        accumulatedText += chunk;
        res.write(`event: chunk\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
        if (typeof res.flush === "function") res.flush();
      }
    } catch (streamErr) {
      if (!clientAborted && !geminiAbortController.signal.aborted) {
        console.error("Stream generation error during edit:", streamErr.message);
        res.write(
          `event: error\ndata: ${JSON.stringify({
            error: {
              code: streamErr.code || "STREAM_ERROR",
              message: streamErr.message || "Error generating response",
            },
          })}\n\n`
        );
      }
    }

    if (clientAborted || geminiAbortController.signal.aborted || req.socket?.destroyed || !res.writable) {
      clientAborted = true;
    }

    if (clientAborted) {
      if (!isSaved && accumulatedText.trim().length > 0) {
        isSaved = true;
        try {
          const partialMsg = {
            id: assistantMsgId,
            role: "assistant",
            content: accumulatedText,
            status: "stopped",
            timestamp: now + 1,
          };
          await Chat.updateOne(
            findChatQuery(req.clientId, req.params.id),
            { $push: { messages: partialMsg } }
          );
        } catch (e) {
          console.error("Failed to persist partial message on abort:", e.message);
        }
      }
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    // Natural stream completion
    if (!isSaved) {
      isSaved = true;
      const finalReply =
        accumulatedText.trim() || "I am Aura. How can I help you today?";

      const assistantMessageObj = {
        id: assistantMsgId,
        role: "assistant",
        content: finalReply,
        status: "complete",
        timestamp: now + 1,
      };

      chat.messages.push(assistantMessageObj);
      await chat.save();

      if (!res.writableEnded) {
        res.write(
          `event: complete\ndata: ${JSON.stringify({
            title: chat.title,
            reply: finalReply,
            assistantMessage: assistantMessageObj,
          })}\n\n`
        );
        res.end();
      }
    }
  } catch (err) {
    if (!res.headersSent) {
      if (err instanceof GeminiError) {
        return res.status(err.status || 500).json({
          error: { code: err.code || "MODEL_BUSY", message: err.message },
        });
      }
      next(err);
    } else {
      if (!res.writableEnded) {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            error: { code: "SERVER_ERROR", message: err.message },
          })}\n\n`
        );
        res.end();
      }
    }
  }
};

router.put("/:id/messages/:messageId/stream", messageRateLimiter, handleEditMessageStream);
router.post("/:id/messages/:messageId/stream", messageRateLimiter, handleEditMessageStream);

/**
 * POST /api/chats/import
 * Helper to migrate legacy localStorage chats
 */
router.post("/import", async (req, res, next) => {
  try {
    const { chats } = req.body || {};
    if (!Array.isArray(chats) || chats.length === 0) {
      return res.json({ imported: 0 });
    }

    let count = 0;
    for (const c of chats) {
      if (!c.messages || !Array.isArray(c.messages)) continue;
      const validMessages = c.messages
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({
          id: typeof m.id === "string" ? m.id : makeMessageId(),
          role: m.role,
          content: m.content || "",
          timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
        }));

      await Chat.create({
        chatId: typeof c.id === "string" ? c.id : undefined,
        clientId: req.clientId,
        title: typeof c.title === "string" ? c.title : "Imported chat",
        messages: validMessages,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      });
      count++;
    }

    res.json({ imported: count });
  } catch (err) {
    next(err);
  }
});

export default router;
