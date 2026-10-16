import rateLimit from "express-rate-limit";

// Rate limit for message generation: 20 requests per minute per IP (Security S2)
export const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many message requests. Please wait a moment before sending another message.",
      },
    });
  },
});

// General API limiter: 120 requests per minute per IP
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    });
  },
});
