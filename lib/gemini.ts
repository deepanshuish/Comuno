import "server-only";
import { GoogleGenAI, type Content, type FunctionDeclaration, type Tool } from "@google/genai";
import { HttpError } from "./auth";
import type { Workspace } from "./types";

/**
 * Gemini is Comuno's AI engine. Every AI feature goes through this module.
 *
 * Configuration:
 *   GEMINI_API_KEY  – required (or set per-workspace in Settings → AI engine)
 *   GEMINI_MODEL    – default model, defaults to the always-current "gemini-flash-latest"
 *   GEMINI_PRO_MODEL – model for heavier reasoning (agent, research), defaults to "gemini-pro-latest"
 */

export const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
export const PRO_MODEL = process.env.GEMINI_PRO_MODEL || process.env.GEMINI_MODEL || "gemini-pro-latest";

export function geminiClient(workspace?: Pick<Workspace, "gemini_api_key"> | null) {
  const apiKey = workspace?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      503,
      "Gemini is not configured. Add GEMINI_API_KEY to your environment or set a key in Settings → AI engine.",
    );
  }
  return new GoogleGenAI({ apiKey });
}

export type Source = { title: string; url: string };

type GenOpts = {
  workspace?: Workspace | null;
  system?: string;
  prompt: string | Content[];
  /** Ground the answer in live Google Search results. */
  search?: boolean;
  model?: string;
  temperature?: number;
};

/** Generate free text. Returns the text and any Google Search sources used. */
export async function generateText(opts: GenOpts): Promise<{ text: string; sources: Source[] }> {
  const ai = geminiClient(opts.workspace);
  const res = await ai.models.generateContent({
    model: opts.model || DEFAULT_MODEL,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      temperature: opts.temperature,
      tools: opts.search ? [{ googleSearch: {} }] : undefined,
    },
  });
  return { text: (res.text || "").trim(), sources: extractSources(res) };
}

/**
 * Generate structured JSON matching `schema` (a JSON Schema object).
 * With `search: true` the model is grounded in Google Search; the JSON is then
 * requested in the prompt and parsed leniently, since some models don't allow
 * combining search grounding with a response schema.
 */
export async function generateJSON<T>(
  opts: GenOpts & { schema: Record<string, unknown> },
): Promise<{ data: T; sources: Source[] }> {
  const ai = geminiClient(opts.workspace);
  const model = opts.model || DEFAULT_MODEL;
  const tryStructured = async () => {
    const res = await ai.models.generateContent({
      model,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        temperature: opts.temperature,
        tools: opts.search ? [{ googleSearch: {} }] : undefined,
        responseMimeType: "application/json",
        responseJsonSchema: opts.schema,
      },
    });
    return { data: parseLooseJson<T>(res.text || ""), sources: extractSources(res) };
  };

  if (!opts.search) return tryStructured();
  try {
    return await tryStructured();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    // Fall back to prompting for JSON without a response schema.
    const prompt =
      typeof opts.prompt === "string"
        ? `${opts.prompt}\n\nRespond ONLY with JSON (no prose, no markdown fences) matching this JSON Schema:\n${JSON.stringify(opts.schema)}`
        : opts.prompt;
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction: opts.system, temperature: opts.temperature, tools: [{ googleSearch: {} }] },
    });
    return { data: parseLooseJson<T>(res.text || ""), sources: extractSources(res) };
  }
}

/** Run a Gemini chat turn with function-calling tools. Used by the Comuno Agent. */
export async function generateWithTools(opts: {
  workspace?: Workspace | null;
  system: string;
  contents: Content[];
  functions: FunctionDeclaration[];
  model?: string;
}) {
  const ai = geminiClient(opts.workspace);
  const tools: Tool[] = [{ functionDeclarations: opts.functions }];
  return ai.models.generateContent({
    model: opts.model || DEFAULT_MODEL,
    contents: opts.contents,
    config: { systemInstruction: opts.system, tools },
  });
}

export function parseLooseJson<T>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t) as T;
  } catch {
    const start = t.search(/[[{]/);
    const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new HttpError(502, "The AI returned an unexpected response. Please try again.");
  }
}

function extractSources(res: { candidates?: { groundingMetadata?: { groundingChunks?: { web?: { title?: string; uri?: string } }[] } }[] }): Source[] {
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const c of chunks) {
    const url = c.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: c.web?.title || url, url });
  }
  return out;
}

/** Shared context about the user's own company, injected into prompts for personalization. */
export function sellerContext(ws: Workspace): string {
  const lines = [
    ws.company_name && `Company: ${ws.company_name}`,
    ws.company_website && `Website: ${ws.company_website}`,
    ws.product_description && `What we sell: ${ws.product_description}`,
    ws.value_prop && `Value proposition: ${ws.value_prop}`,
    ws.icp_json && `Ideal customer profile: ${ws.icp_json}`,
    ws.sender_name && `Sender: ${ws.sender_name}`,
  ].filter(Boolean);
  return lines.length
    ? `About the seller (the user of this platform):\n${lines.join("\n")}`
    : "The seller has not described their company yet; keep messaging general and ask them to fill in Settings → Company profile for better results.";
}
