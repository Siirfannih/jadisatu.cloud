import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

let _genai: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured. Set it in .env.local')
  }
  if (!_genai) {
    _genai = new GoogleGenerativeAI(GEMINI_API_KEY)
  }
  return _genai
}

/**
 * Embed text using Gemini text-embedding-004 (768 dimensions).
 * For text-only content. Fast and cost-effective.
 */
export async function embedText(text: string): Promise<number[]> {
  const genai = getGenAI()
  const model = genai.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await model.embedContent(text)
  return result.embedding.values
}

/**
 * Embed multiple texts in a single batch call.
 * More efficient than calling embedText individually.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const genai = getGenAI()
  const model = genai.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await model.batchEmbedContents({
    requests: texts.map(text => ({
      content: { role: 'user', parts: [{ text }] },
    })),
  })
  return result.embeddings.map(e => e.values)
}

/**
 * Compose a searchable text representation of a content item.
 * Combines title, script, caption, hook, value, cta into one string.
 */
export function composeContentText(content: {
  title?: string | null
  script?: string | null
  caption?: string | null
  hook_text?: string | null
  value_text?: string | null
  cta_text?: string | null
  platform?: string | null
}): string {
  const parts = [
    content.title,
    content.hook_text,
    content.value_text,
    content.cta_text,
    content.script,
    content.caption,
    content.platform ? `Platform: ${content.platform}` : null,
  ].filter(Boolean)
  return parts.join('\n\n')
}

/**
 * Generate content using Gemini with RAG context.
 * Uses gemini-2.0-flash for fast, cost-effective generation.
 */
export async function generateWithContext(
  userPrompt: string,
  retrievedDocs: Array<{
    title: string | null
    script: string | null
    caption: string | null
    platform: string | null
    hook_text: string | null
    similarity: number
  }>,
  options: {
    platform?: string
    type?: 'script' | 'caption' | 'idea' | 'carousel'
    brandName?: string
    userName?: string
  } = {}
): Promise<string> {
  const genai = getGenAI()
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // Build context from retrieved documents
  const contextParts = retrievedDocs.map((doc, i) => {
    const parts = [`--- Konten Referensi ${i + 1} (similarity: ${(doc.similarity * 100).toFixed(0)}%) ---`]
    if (doc.title) parts.push(`Judul: ${doc.title}`)
    if (doc.platform) parts.push(`Platform: ${doc.platform}`)
    if (doc.hook_text) parts.push(`Hook: ${doc.hook_text}`)
    if (doc.script) parts.push(`Script: ${doc.script.slice(0, 500)}`)
    if (doc.caption) parts.push(`Caption: ${doc.caption.slice(0, 300)}`)
    return parts.join('\n')
  }).join('\n\n')

  const typeInstructions: Record<string, string> = {
    script: 'Buatkan script konten yang lengkap dengan struktur: Hook → Value → CTA. Script harus natural dan sesuai dengan brand voice dari referensi.',
    caption: 'Buatkan caption yang engaging untuk social media. Gunakan tone dan gaya bahasa yang konsisten dengan referensi.',
    idea: 'Berikan 3-5 ide konten baru yang relevan berdasarkan histori konten. Setiap ide harus unik dan belum pernah dibahas.',
    carousel: 'Buatkan outline carousel dengan struktur: Slide 1 (Hook), Slide 2-N (Value Points), Slide terakhir (CTA). Sesuaikan dengan style dari referensi.',
  }

  const systemPrompt = `Kamu adalah Juru, asisten kreator konten untuk ${options.userName || 'kreator'} dari brand ${options.brandName || 'JadiSatu'}.

Tugasmu adalah menghasilkan konten yang terdengar seperti kreator ini — BUKAN seperti AI generic.

Gunakan konteks dari konten-konten sebelumnya untuk memahami:
- Tone of voice dan gaya bahasa
- Struktur konten yang biasa dipakai
- Topik dan angle yang sering diangkat
- Platform-specific formatting

${options.type ? typeInstructions[options.type] || '' : ''}
${options.platform ? `Target platform: ${options.platform}` : ''}

PENTING: Jangan mention bahwa kamu menggunakan referensi. Tulis seolah-olah kamu adalah kreator ini.`

  const prompt = `${contextParts ? `\n\nKonteks dari konten sebelumnya:\n${contextParts}\n\n` : ''}User request: ${userPrompt}`

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
  })

  return result.response.text()
}
