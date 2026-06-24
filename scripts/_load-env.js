// Optional convenience: load a local ".env" file (repo root) so the test/sample scripts can read keys
// from a file instead of inline env vars. ".env" is gitignored — never commit real keys. No effect and
// no error if ".env" is absent (you can still pass keys inline on the command line).
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    console.warn(`Could not load .env (${error.message}); falling back to existing environment.`);
  }
}
