import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

/**
 * Gemini API Client — Singleton for all AI operations.
 *
 * Uses @google/generative-ai SDK.
 * Safety settings relaxed for legitimate business use (WhatsApp sales AI).
 */
let genAI: GoogleGenerativeAI | null = null;

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('[gemini] Missing GEMINI_API_KEY environment variable');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Qwen-backed drop-in for the old Gemini GenerativeModel.
 *
 * Every legacy `getModel(...).generateContent(req)` call now routes through the
 * Qwen-only orchestrator (generateText) with multi-model failover — so the ~12
 * call sites that bypassed the orchestrator are Qwen-only too, with NO call-site
 * edits. The passed model name (e.g. "gemini-2.5-pro") only selects the tier
 * (reasoning vs fast); the actual model is Qwen. Supports the request shapes used
 * in this repo: a plain string, or { systemInstruction, contents:[{parts:[{text}]}] }.
 */
export function getModel(modelName: string, config?: { temperature?: number; maxOutputTokens?: number }) {
  return {
    async generateContent(req: unknown): Promise<{ response: { text: () => string } }> {
      let system: string | undefined;
      let user = '';
      let json = false;
      if (typeof req === 'string') {
        user = req;
      } else if (req && typeof req === 'object') {
        const r = req as Record<string, any>;
        const si = r.systemInstruction;
        if (typeof si === 'string') system = si;
        else if (si?.parts) system = si.parts.map((p: any) => p?.text ?? '').join('\n');
        else if (si?.text) system = si.text;
        const contents = r.contents;
        if (typeof contents === 'string') user = contents;
        else if (Array.isArray(contents))
          user = contents.flatMap((c: any) => (c?.parts ?? []).map((p: any) => p?.text ?? '')).join('\n');
        if (r.generationConfig?.responseMimeType === 'application/json') json = true;
      }
      // Honor JSON-output prompts (Qwen json_object mode needs "json" in the text).
      if (!json && /json/i.test(`${system ?? ''}\n${user}`)) json = true;
      const text = await generateText({
        system,
        user,
        model: modelName,
        temperature: config?.temperature,
        maxTokens: config?.maxOutputTokens,
        json,
      });
      const out = json ? text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() : text;
      return { response: { text: () => out } };
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * LLM Orchestrator — multi-provider failover (mirrors web src/lib/ai/llm.ts).
 *
 * If the primary Gemini key fails (rate limit, 5xx, billing, empty), the engine
 * transparently falls through to the next provider so a customer NEVER sees a
 * failed reply. Voice stays consistent because every provider runs the SAME
 * system prompt (Memory Pertama SOP) + temperature.
 *   GEMINI_API_KEY → GROQ_API_KEY → DEEPSEEK_API_KEY → GEMINI_API_KEY_2
 * Order overridable via LLM_PROVIDER_ORDER="gemini,groq,gemini2".
 * ───────────────────────────────────────────────────────────────────────── */

type Tier = 'fast' | 'reasoning';
interface LlmProvider {
  name: string;
  kind: 'gemini' | 'openai';
  apiKey: string;
  baseUrl?: string;
  models: Record<Tier, string>;
  extraBody?: Record<string, unknown>;
}

const REST_SAFETY = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

function llmProviders(): LlmProvider[] {
  const list: LlmProvider[] = [];
  // ── Qwen-only (product decision) ──────────────────────────────────────────
  // Generation runs on ONLY Qwen (Alibaba DashScope). Resilience = SEVERAL
  // distinct Qwen models, each with its OWN independent daily free quota, so one
  // model being rate-limited just fails over to the next Qwen model (never to a
  // non-Qwen provider). The earlier outage came from pointing at ONE spent model
  // (qwen-plus-2025-07-28); multiple models make a single quota cap non-fatal.
  const QWEN_BASE = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  const qwen = (name: string, fast: string, reasoning: string, apiKey: string): LlmProvider => ({
    name, kind: 'openai', apiKey, baseUrl: QWEN_BASE,
    models: { fast, reasoning }, extraBody: { enable_thinking: false },
  });
  const dashKeys = [
    { key: process.env.DASHSCOPE_API_KEY, suffix: '' },
    { key: process.env.DASHSCOPE_API_KEY_2, suffix: '-k2' },
  ].filter((k) => k.key) as Array<{ key: string; suffix: string }>;
  for (const { key, suffix } of dashKeys) {
    list.push(qwen('qwen-plus' + suffix, 'qwen3.5-plus-2026-02-15', 'qwen-max', key));
    list.push(qwen('qwen-flash' + suffix, 'qwen-flash', 'qwen-plus', key));
    list.push(qwen('qwen-turbo' + suffix, 'qwen-turbo', 'qwen-turbo', key));
  }

  const order = (process.env.LLM_PROVIDER_ORDER ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (order.length) {
    const rank = (n: string) => { const i = order.indexOf(n); return i < 0 ? 99 : i; };
    list.sort((a, b) => rank(a.name) - rank(b.name));
  }
  return list;
}

interface GenTextOpts { system?: string; user: string; model?: string; temperature?: number; maxTokens?: number; json?: boolean; }

async function callGeminiRest(p: LlmProvider, model: string, o: GenTextOpts): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${p.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(o.system ? { systemInstruction: { parts: [{ text: o.system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: o.user }] }],
      safetySettings: REST_SAFETY,
      generationConfig: {
        temperature: o.temperature ?? 0.4,
        maxOutputTokens: o.maxTokens ?? 2048,
        ...(o.json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`gemini HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j: any = await res.json();
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? '').join('');
  if (!text.trim()) throw new Error('gemini empty');
  return text;
}

async function callOpenAICompat(p: LlmProvider, model: string, o: GenTextOpts): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (o.system) messages.push({ role: 'system', content: o.system });
  messages.push({ role: 'user', content: o.user });
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, messages,
      temperature: o.temperature ?? 0.4,
      max_tokens: o.maxTokens ?? 2048,
      ...(o.json ? { response_format: { type: 'json_object' } } : {}),
      ...(p.extraBody ?? {}),
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`${p.name} HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j: any = await res.json();
  const text = j.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error(`${p.name} empty`);
  return text;
}

/** Generate text with automatic provider failover. Throws only if ALL fail. */
export async function generateText(o: GenTextOpts): Promise<string> {
  const tier: Tier = /pro|reason/i.test(String(o.model ?? '')) ? 'reasoning' : 'fast';
  const providers = llmProviders();
  if (providers.length === 0) throw new Error('[llm] no provider configured');
  let lastErr: unknown;
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    try {
      const text = p.kind === 'gemini' ? await callGeminiRest(p, p.models[tier], o) : await callOpenAICompat(p, p.models[tier], o);
      if (i > 0) console.warn(`[llm] primary unavailable — served by fallback "${p.name}"`);
      return text;
    } catch (err) {
      lastErr = err;
      console.error(`[llm] provider "${p.name}" failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw new Error(`[llm] all providers failed. Last: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}
