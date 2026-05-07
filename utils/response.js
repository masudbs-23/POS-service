function success(res, { code = "S100", message = "Success", data = null, status = 200 } = {}) {
  return res.status(status).json({
    responseCode: code,
    responseMessage: message,
    data,
  });
}

function error(res, { code = "E500", message = "Internal server error", status = 500, data = null } = {}) {
  return res.status(status).json({
    responseCode: code,
    responseMessage: message,
    data,
  });
}

function mapErrorCode(status) {
  if (status === 400) return "E400";
  if (status === 401) return "E401";
  if (status === 403) return "E403";
  if (status === 404) return "E404";
  if (status === 409) return "E409";
  return "E500";
}

module.exports = { success, error, mapErrorCode };

