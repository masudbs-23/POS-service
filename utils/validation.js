function assertRequiredString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    const err = new Error(`${field} is required`);
    err.status = 400;
    throw err;
  }
}

function assertPositiveNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error(`${field} must be a positive number`);
    err.status = 400;
    throw err;
  }
  return n;
}

function assertNonNegativeInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    const err = new Error(`${field} must be a non-negative integer`);
    err.status = 400;
    throw err;
  }
  return n;
}

module.exports = { assertRequiredString, assertPositiveNumber, assertNonNegativeInt };

