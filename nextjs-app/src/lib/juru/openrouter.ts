/**
 * OpenRouter Provider — for simple/repetitive queries.
 * Uses OpenAI-compatible API format.
 * Model: google/gemini-2.0-flash-exp:free (zero cost, consistent with Gemini style).
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'google/gemini-2.0-flash-exp:free'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function chatOpenRouter(
  message: string,
  history: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ]

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://jadisatu.cloud',
      'X-Title': 'JadiSatu Juru Copilot',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error')
    throw new Error(`OpenRouter ${res.status}: ${errorText}`)
  }

  const data = await res.json()
  const reply = data.choices?.[0]?.message?.content

  if (!reply) {
    throw new Error('Empty response from OpenRouter')
  }

  return reply
}
