const jwt = require("jsonwebtoken");
const { error: sendError } = require("../utils/response");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return sendError(res, {
      status: 401,
      code: "E401",
      message: "Missing Authorization Bearer token",
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return sendError(res, {
      status: 401,
      code: "E401",
      message: "Invalid or expired token",
    });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, { status: 401, code: "E401", message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, { status: 403, code: "E403", message: "Forbidden" });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };

