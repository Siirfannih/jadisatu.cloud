/**
 * Gemini Provider — for complex queries requiring deeper reasoning.
 * Uses Google's Generative AI SDK directly.
 * Model: gemini-2.0-flash (fast, good reasoning).
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

let _genai: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured')
  }
  if (!_genai) {
    _genai = new GoogleGenerativeAI(apiKey)
  }
  return _genai
}

export async function chatGemini(
  message: string,
  history: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const genai = getGenAI()
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const chatHistory = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: msg.content }],
  }))

  const chat = model.startChat({
    history: chatHistory,
    systemInstruction: { role: 'user' as const, parts: [{ text: systemPrompt }] },
  })

  const result = await chat.sendMessage(message)
  return result.response.text()
}
