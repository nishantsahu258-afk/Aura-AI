import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure .env is loaded from the backend directory regardless of execution cwd
dotenv.config({ path: join(__dirname, ".env") });
dotenv.config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDB } from "./db.js";
import chatsRouter from "./routes/chats.js";
import meRouter from "./routes/me.js";
import { clientIdMiddleware } from "./middleware/clientId.js";
import { apiRateLimiter, messageRateLimiter } from "./middleware/rateLimit.js";
import { sendGeminiMessage, GeminiError } from "./services/gemini.js";
import { buildContents } from "./services/prompt.js";

const app = express();
const PORT = process.env.PORT || 5000;
const rawClientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const configuredOrigins = rawClientOrigin
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

// Security headers (Security Checklist)
app.use(helmet());

// CORS configuration supporting local development, configured CLIENT_ORIGIN, and Vercel deployments
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Vite proxy)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");
      let isAllowed =
        configuredOrigins.includes(normalizedOrigin) ||
        normalizedOrigin.startsWith("http://localhost:") ||
        normalizedOrigin.startsWith("http://127.0.0.1:");

      if (!isAllowed) {
        try {
          const hostname = new URL(origin).hostname;
          if (hostname.endsWith(".vercel.app")) {
            isAllowed = true;
          }
        } catch {
          // invalid origin URL
        }
      }

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error("CORS blocked by origin policy"));
    },
    credentials: true,
  })
);

// Body limit 10MB to support lightweight single-image base64 payloads
app.use(express.json({ limit: "10mb" }));

// General API rate limit (Security Checklist)
app.use(apiRateLimiter);

// Root & Health check endpoints for deployment monitoring
app.get("/", (req, res) => {
  res.json({
    name: "Aura AI Backend API",
    status: "ok",
    health: "/api/health",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Standalone generate endpoint (Roadmap Phase 1 / API_SPEC 2.1)
app.post("/api/generate", messageRateLimiter, async (req, res, next) => {
  try {
    const { contents, messages, model } = req.body || {};
    const geminiContents = contents || buildContents(messages || []);
    const reply = await sendGeminiMessage({ model, contents: geminiContents });
    res.json({ reply });
  } catch (err) {
    if (err instanceof GeminiError) {
      return res.status(err.status || 500).json({
        error: { code: err.code || "GEMINI_ERROR", message: err.message },
      });
    }
    next(err);
  }
});

// User profile & display ID (X-Client-Id authenticated)
app.use("/api/me", clientIdMiddleware, meRouter);

// Chat CRUD & messaging routes with X-Client-Id authentication (FR-5, FR-6)
app.use("/api/chats", clientIdMiddleware, chatsRouter);

// 404 handler for unknown API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "API endpoint not found" },
  });
});

// Global error handler: never leak stack traces (Security S8)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  const status = err.status || 500;
  const message = status === 500 ? "Internal server error" : err.message;
  const code = err.code || "SERVER_ERROR";
  res.status(status).json({
    error: { code, message },
  });
});

// Connect to Database and start server
async function startServer() {
  await connectDB();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Aura AI Backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
