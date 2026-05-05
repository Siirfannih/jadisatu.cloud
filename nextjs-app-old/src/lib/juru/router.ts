/**
 * Juru Message Router — zero-cost classification.
 * Uses keyword heuristics to decide: OpenRouter (simple) vs Gemini (complex).
 * No API calls — instant classification.
 */

export type MessageTier = 'simple' | 'complex'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const GREETING_PATTERNS = /^(h(ai|alo|elo|i|ey)|yo|woi|selamat\s*(pagi|siang|sore|malam)|good\s*(morning|afternoon|evening)|morning|malam|pagi)/i
const ACKNOWLEDGMENT_PATTERNS = /^(ok(e|ay)?|sip|siap|makasih|thanks|thank you|terima\s*kasih|noted|got it|iya|ya|yep|yup|mantap|oke\s*deh|baik|lanjut|nice|cool|great|good)\s*[.!]?$/i
const YES_NO_PATTERNS = /^(ya|tidak|bukan|iya|enggak|gak|nggak|bisa|boleh|mau|ga|no|yes|nope|sure|yep)\s*[.!?]?$/i

const BRAINSTORM_KEYWORDS = /\b(ide|brainstorm|strategi|strategy|rencana|plan|roadmap|visi|misi|goals?|target|konsep|concept)\b/i
const ANALYSIS_KEYWORDS = /\b(analis[ai]s?|review|evaluasi|bandingkan|compare|assess|audit|breakdown|insight|kenapa|mengapa|why\s+.{10,})\b/i
const CREATIVE_KEYWORDS = /\b(buatkan|tolong\s+buat|bantu\s+(aku\s+)?buat|generate|write|tulis(kan)?|ranc?ang|design|develop|susun|beri\s+(aku\s+)?(\d+|beberapa))\b/i
const MULTI_STEP_KEYWORDS = /\b(dan\s+juga|lalu|kemudian|selain\s+itu|pertama.*kedua|step|langkah|tahap)\b/i
const HOW_DETAIL_KEYWORDS = /\b(bagaimana\s+(cara|caranya|bisa|kalau|untuk)|how\s+(do|can|should|would|to))\b/i

export function classifyMessage(message: string, history: ChatMessage[] = []): MessageTier {
  const trimmed = message.trim()
  const wordCount = trimmed.split(/\s+/).length

  // Fast-path: very short messages are almost always simple
  if (wordCount <= 3) {
    // Unless it's a creative command
    if (CREATIVE_KEYWORDS.test(trimmed)) return 'complex'
    return 'simple'
  }

  let score = 0

  // === SIMPLE signals (negative score) ===
  if (wordCount < 15) score -= 1
  if (GREETING_PATTERNS.test(trimmed)) score -= 2
  if (ACKNOWLEDGMENT_PATTERNS.test(trimmed)) score -= 2
  if (YES_NO_PATTERNS.test(trimmed)) score -= 2

  // === COMPLEX signals (positive score) ===
  if (wordCount > 40) score += 1
  if (BRAINSTORM_KEYWORDS.test(trimmed)) score += 2
  if (ANALYSIS_KEYWORDS.test(trimmed)) score += 1
  if (CREATIVE_KEYWORDS.test(trimmed)) score += 2
  if (HOW_DETAIL_KEYWORDS.test(trimmed) && wordCount > 8) score += 1
  if (MULTI_STEP_KEYWORDS.test(trimmed) && wordCount > 20) score += 1

  // Long conversation context suggests more complex reasoning needed
  if (history.length > 6) score += 1

  return score > 0 ? 'complex' : 'simple'
}
