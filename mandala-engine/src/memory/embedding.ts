/**
 * Gemini Embedding Wrapper — gemini-embedding-001
 *
 * Dimension: 768 (truncated via outputDimensionality, matching Pinecone index config)
 * Uses the existing @google/generative-ai SDK.
 */
import { getGeminiClient } from '../ai/gemini-client.js';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const OUTPUT_DIMENSIONALITY = 768;

/**
 * Embed a single text string into a 768-dimensional vector.
 */
export async function embed(text: string): Promise<number[]> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: OUTPUT_DIMENSIONALITY,
  });
  return result.embedding.values;
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
