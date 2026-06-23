// OpenRouter chat-completions client (OpenAI-compatible schema).
// Auth: OPENROUTER_API_KEY. Model: OPENROUTER_MODEL (defaults below).
const { requiredEnv, optionalEnv } = require("./util");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Default chosen for groundedness + instruction-following on careful structured writing — the traits
// that prevent fabrication and generic output in a data-tied audit. Verified available on OpenRouter.
// Owner overrides with OPENROUTER_MODEL (no code change).
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
// The background worker has a 15-minute budget, so a generous default is safe. Override with
// OPENROUTER_TIMEOUT_MS if you run the pipeline somewhere with a tighter ceiling.
const DEFAULT_TIMEOUT_MS = Number(optionalEnv("OPENROUTER_TIMEOUT_MS")) || 45000;

function resolveModel() {
  return optionalEnv("OPENROUTER_MODEL") || DEFAULT_MODEL;
}

async function chatCompletion({ system, user, temperature = 0.3, maxTokens = 4000, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const model = resolveModel();

  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Optional attribution headers OpenRouter uses for its dashboards; harmless if unset.
      "HTTP-Referer": optionalEnv("SITE_URL", "https://mapgap.report"),
      "X-Title": "MapGap Report"
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed (${model}): ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = typeof choice?.message?.content === "string"
    ? choice.message.content
    : Array.isArray(choice?.message?.content)
      // Some providers return content as an array of parts.
      ? choice.message.content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("")
      : "";

  if (!content.trim()) {
    throw new Error(`OpenRouter returned empty content (${model}); finish_reason=${choice?.finish_reason || "unknown"}`);
  }
  return { content, model, usage: data.usage || null };
}

module.exports = { chatCompletion, resolveModel, DEFAULT_MODEL };
