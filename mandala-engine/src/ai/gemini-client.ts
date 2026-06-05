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

export function getModel(modelName: string, config?: { temperature?: number; maxOutputTokens?: number }): GenerativeModel {
  const client = getGeminiClient();
  return client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: config?.temperature,
      maxOutputTokens: config?.maxOutputTokens,
    },
    safetySettings: SAFETY_SETTINGS,
  });
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
  if (process.env.DASHSCOPE_API_KEY)
    list.push({ name: 'qwen', kind: 'openai', apiKey: process.env.DASHSCOPE_API_KEY, baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', models: { fast: 'qwen-plus-2025-07-28', reasoning: 'qwen3-max' }, extraBody: { enable_thinking: false } });
  if (process.env.GEMINI_API_KEY)
    list.push({ name: 'gemini', kind: 'gemini', apiKey: process.env.GEMINI_API_KEY, models: { fast: 'gemini-2.5-flash', reasoning: 'gemini-2.5-pro' } });
  if (process.env.GROQ_API_KEY)
    list.push({ name: 'groq', kind: 'openai', apiKey: process.env.GROQ_API_KEY, baseUrl: 'https://api.groq.com/openai/v1', models: { fast: 'llama-3.3-70b-versatile', reasoning: 'llama-3.3-70b-versatile' } });
  if (process.env.DEEPSEEK_API_KEY)
    list.push({ name: 'deepseek', kind: 'openai', apiKey: process.env.DEEPSEEK_API_KEY, baseUrl: 'https://api.deepseek.com', models: { fast: 'deepseek-chat', reasoning: 'deepseek-reasoner' } });
  if (process.env.GEMINI_API_KEY_2)
    list.push({ name: 'gemini2', kind: 'gemini', apiKey: process.env.GEMINI_API_KEY_2, models: { fast: 'gemini-2.5-flash', reasoning: 'gemini-2.5-pro' } });

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
