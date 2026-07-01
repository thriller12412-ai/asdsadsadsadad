import Groq from "groq-sdk";

// Groq client factory. Reads GROQ_API_KEY at call time (not module scope).
export function getGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY");
  return new Groq({ apiKey: key });
}

export const GROQ_MODEL = "llama-3.3-70b-versatile";
export const GROQ_FAST_MODEL = "llama-3.1-8b-instant";

// JSON-mode helper: sends messages, requests strict JSON, parses it.
export async function groqJson<T = unknown>(opts: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<T> {
  const groq = getGroq();
  const res = await groq.chat.completions.create({
    model: opts.model ?? GROQ_MODEL,
    temperature: opts.temperature ?? 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: opts.system + "\nRespond ONLY with valid JSON. No markdown, no prose." },
      { role: "user", content: opts.user },
    ],
  });
  const content = res.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as T;
  } catch (e) {
    // Attempt to salvage: strip code fences if present
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as T;
  }
}

export async function groqText(opts: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<string> {
  const groq = getGroq();
  const res = await groq.chat.completions.create({
    model: opts.model ?? GROQ_MODEL,
    temperature: opts.temperature ?? 0.5,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}
