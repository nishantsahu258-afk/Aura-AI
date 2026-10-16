const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function clientIdMiddleware(req, res, next) {
  const clientId = req.headers["x-client-id"] || req.query?.clientId || req.query?.client_id;

  if (!clientId) {
    return res.status(400).json({
      error: {
        code: "MISSING_CLIENT_ID",
        message: "Missing X-Client-Id header or clientId query parameter.",
      },
    });
  }

  if (typeof clientId !== "string" || !UUID_REGEX.test(clientId.trim())) {
    return res.status(400).json({
      error: {
        code: "INVALID_CLIENT_ID",
        message: "Invalid X-Client-Id header format. Must be a valid UUID v4.",
      },
    });
  }

  req.clientId = clientId.trim();
  next();
}
