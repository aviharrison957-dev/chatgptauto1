// OpenRouter chat-completions client (OpenAI-compatible schema).
// Auth: OPENROUTER_API_KEY. Model: OPENROUTER_MODEL (defaults below).
const { requiredEnv, optionalEnv, readUpstreamError } = require("./util");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Default chosen for groundedness + instruction-following on careful structured writing — the traits
// that prevent fabrication and generic output in a data-tied audit. Verified available on OpenRouter.
// Owner overrides with OPENROUTER_MODEL (no code change).
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
// One full audit is a single non-streaming completion of ~3,300-4,300 output tokens. Measured cold
// latency for that on OpenRouter (anthropic/claude-sonnet-4.5) is ~75s — see JOURNAL 2026-06-24. The
// async background worker already has a 15-minute budget, so the *request* timeout, not the platform,
// is the binding limit. The old 45s default aborted legitimate in-flight responses ("operation was
// aborted due to timeout") and silently lost paid orders. Default is now 150s (≈2x the cold latency,
// still 1/6 of the worker budget); raise OPENROUTER_TIMEOUT_MS on any host with a tighter ceiling.
const DEFAULT_TIMEOUT_MS = Number(optionalEnv("OPENROUTER_TIMEOUT_MS")) || 150000;
// The audit JSON runs ~3,300-4,300 completion tokens (one sample hit 4,287), so the old hard-coded
// 4,000 ceiling left almost no headroom and a verbose business hit the cap, truncating the response
// mid-JSON — it surfaced as a cryptic "did not return valid JSON" error. 6,000 gives comfortable room
// and the model stops on its own (finish_reason="stop") well before it. Override with OPENROUTER_MAX_TOKENS.
const DEFAULT_MAX_TOKENS = Number(optionalEnv("OPENROUTER_MAX_TOKENS")) || 6000;

function resolveModel() {
  return optionalEnv("OPENROUTER_MODEL") || DEFAULT_MODEL;
}

async function chatCompletion({ system, user, temperature = 0.3, maxTokens = DEFAULT_MAX_TOKENS, timeoutMs = DEFAULT_TIMEOUT_MS }) {
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
    throw new Error(`OpenRouter request failed (${model}): ${response.status} ${await readUpstreamError(response)}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  // A "length" finish means the model was cut off at max_tokens; the JSON is then incomplete and would
  // fail to parse downstream with a confusing error. Surface the real cause and the exact knob to raise.
  if (choice?.finish_reason === "length") {
    throw new Error(`OpenRouter response truncated at max_tokens=${maxTokens} (${model}); raise OPENROUTER_MAX_TOKENS.`);
  }
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
