import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Gemini API Client — Singleton for all AI operations.
 *
 * Uses @google/generative-ai SDK.
 * Replaces Anthropic SDK entirely.
 */
let genAI: GoogleGenerativeAI | null = null;

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
  });
}
