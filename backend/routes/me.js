import { Router } from "express";
import { Client } from "../models/Client.js";
import { Chat } from "../models/Chat.js";
import { generateDisplayId } from "../services/displayId.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const clientId = req.clientId;
    let client = await Client.findOne({ clientId });

    if (!client) {
      const MAX_ATTEMPTS = 5;
      let attempts = 0;
      let created = false;

      while (!created && attempts < MAX_ATTEMPTS) {
        attempts++;
        try {
          const displayId = generateDisplayId();
          client = await Client.create({
            clientId,
            displayId,
            lastSeenAt: new Date(),
          });
          created = true;
        } catch (err) {
          if (err.code === 11000) {
            // Duplicate key on clientId: concurrent request created it first
            if (
              err.keyPattern?.clientId ||
              (err.keyValue && "clientId" in err.keyValue) ||
              (err.message && err.message.includes("clientId"))
            ) {
              client = await Client.findOne({ clientId });
              if (client) {
                created = true;
                break;
              }
            }

            // Duplicate key on displayId (rare collision): retry loop up to 5 attempts
            if (attempts >= MAX_ATTEMPTS) {
              return res.status(500).json({
                error: {
                  code: "ID_COLLISION_ERROR",
                  message: "Failed to generate unique display ID after maximum attempts",
                },
              });
            }
          } else {
            throw err;
          }
        }
      }
    }

    if (!client) {
      client = await Client.findOne({ clientId });
    }

    if (!client) {
      return res.status(500).json({
        error: {
          code: "CLIENT_NOT_FOUND",
          message: "Unable to find or create client profile.",
        },
      });
    }

    // Update lastSeenAt
    client.lastSeenAt = new Date();
    await client.save().catch((e) => console.error("Failed to update lastSeenAt:", e.message));

    // Count the unique chats for this client (consistent with deduplicated sidebar)
    const chatDocs = await Chat.find({ clientId }).select("chatId _id").lean();
    const uniqueIds = new Set(chatDocs.map((c) => c.chatId || c._id?.toString()));
    const chatCount = uniqueIds.size;

    // Respond with exact profile shape. Never return the raw document or expose clientId.
    return res.json({
      profile: {
        userId: client.displayId,
        createdAt: new Date(client.createdAt).getTime(),
        chatCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
