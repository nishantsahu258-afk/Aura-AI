import mongoose from "mongoose";

function generateChatId() {
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateMessageId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// Lightweight attachment metadata schema (only metadata, never raw image bytes)
const attachmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    mimeType: {
      type: String,
      trim: true,
      enum: ["image/png", "image/jpeg", "image/webp"],
    },
    size: {
      type: Number,
    },
  },
  { _id: false }
);

// Exactly matching DATABASE_SCHEMA.pdf Section 2 & 3
const messageSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      default: generateMessageId,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      default: "",
      maxlength: 50000,
    },
    attachment: {
      type: attachmentSchema,
      default: null,
    },
    status: {
      type: String,
      enum: ["complete", "stopped", "error"],
      default: "complete",
    },
    timestamp: {
      type: Number,
      required: true,
      default: () => Date.now(),
    },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.Mixed,
      default: () => new mongoose.Types.ObjectId(),
    },
    chatId: {
      type: String,
      required: true,
      default: generateChatId,
    },
    clientId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: "New chat",
      maxlength: 100,
      trim: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes matching DATABASE_SCHEMA.pdf Section 3
chatSchema.index({ clientId: 1, updatedAt: -1 });
chatSchema.index({ clientId: 1, chatId: 1 }, { unique: true });

export const Chat = mongoose.model("Chat", chatSchema);
