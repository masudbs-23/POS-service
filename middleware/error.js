const { error: sendError, mapErrorCode } = require("../utils/response");

function notFound(req, res, next) {
  return sendError(res, {
    status: 404,
    code: "E404",
    message: "Route not found",
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  return sendError(res, {
    status,
    code: err.code && /^E\d+$/i.test(String(err.code)) ? String(err.code).toUpperCase() : mapErrorCode(status),
    message,
  });
}

module.exports = { notFound, errorHandler };

