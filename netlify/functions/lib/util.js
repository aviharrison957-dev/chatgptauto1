// Small shared helpers used across the fulfillment pipeline.

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === null || value === "" ? fallback : value;
}

// OWNER_FALLBACK_EMAIL is the canonical name; AVI_FALLBACK_EMAIL is honored as a legacy alias.
function ownerFallbackEmail() {
  const value = optionalEnv("OWNER_FALLBACK_EMAIL") || optionalEnv("AVI_FALLBACK_EMAIL");
  if (!value) {
    throw new Error("Missing required environment variable: OWNER_FALLBACK_EMAIL");
  }
  return value;
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function truncate(value, max) {
  const str = String(value === undefined || value === null ? "" : value);
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

module.exports = {
  requiredEnv,
  optionalEnv,
  ownerFallbackEmail,
  escapeHtml,
  truncate,
  jsonResponse
};
