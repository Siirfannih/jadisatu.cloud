/**
 * Gemini Embedding Wrapper — gemini-embedding-001
 *
 * Dimension: 768 (truncated via outputDimensionality, matching Pinecone index config)
 * Uses the existing @google/generative-ai SDK.
 */
import { GoogleGenerativeAI, type EmbedContentRequest } from '@google/generative-ai';
// getGeminiClient no longer needed here — embed() builds its own multi-key clients

const EMBEDDING_MODEL = 'gemini-embedding-001';
const OUTPUT_DIMENSIONALITY = 768;

/**
 * Embed a single text string into a 768-dimensional vector.
 */
export async function embed(text: string): Promise<number[]> {
  const request = {
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: OUTPUT_DIMENSIONALITY,
  } as EmbedContentRequest;
  // Multi-key fallback: project on GEMINI_API_KEY may be dunning-blocked (403) —
  // fall through to GEMINI_API_KEY_2 so semantic recall stays alive. 768-dim, no migration.
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(Boolean) as string[];
  let lastErr: unknown;
  for (const key of keys) {
    try {
      const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: EMBEDDING_MODEL });
      const result = await model.embedContent(request);
      return result.embedding.values;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('[embed] no Gemini key available for embeddings');
}

/**
 * Embed multiple texts in batch.
 * Uses sequential calls since the SDK doesn't natively support batch embedding.
 * Groups into chunks of 5 to avoid rate limits.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  const CHUNK_SIZE = 5;

  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const chunk = texts.slice(i, i + CHUNK_SIZE);
    const embeddings = await Promise.all(chunk.map(embed));
    results.push(...embeddings);
  }

  return results;
}
