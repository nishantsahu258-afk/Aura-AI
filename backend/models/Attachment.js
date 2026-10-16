import mongoose from "mongoose";

function generateAttachmentId() {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const attachmentSchema = new mongoose.Schema(
  {
    attachmentId: {
      type: String,
      required: true,
      unique: true,
      default: generateAttachmentId,
      index: true,
    },
    chatId: {
      type: String,
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      required: true,
      index: true,
    },
    clientId: {
      type: String,
      required: true,
      index: true,
    },
    filename: {
      type: String,
      trim: true,
      default: "image",
    },
    mimeType: {
      type: String,
      required: true,
      enum: ["image/png", "image/jpeg", "image/webp"],
    },
    size: {
      type: Number,
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "attachments",
  }
);

// Compound indexes for client ownership validation and cleanup
attachmentSchema.index({ clientId: 1, chatId: 1 });
attachmentSchema.index({ clientId: 1, attachmentId: 1 }, { unique: true });

export const Attachment = mongoose.model("Attachment", attachmentSchema);
