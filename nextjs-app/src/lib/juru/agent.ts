/**
 * Juru Agent — Main orchestrator.
 *
 * Routes messages through:
 * 1. Classify complexity (router.ts)
 * 2. Build shared personality prompt (personality.ts)
 * 3. Call appropriate provider (OpenRouter or Gemini)
 * 4. Transparent fallback if primary provider fails
 *
 * User never notices which model answered.
 */

import { classifyMessage, type MessageTier } from './router'
import { buildSystemPrompt, type WorkspaceContext } from './personality'
import { chatOpenRouter } from './openrouter'
import { chatGemini } from './gemini-provider'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface JuruResponse {
  reply: string
  tier: MessageTier
  provider: 'openrouter' | 'gemini'
}

export async function juruChat(
  message: string,
  history: ChatMessage[],
  workspaceContext: WorkspaceContext,
  userName: string,
): Promise<JuruResponse> {
  const tier = classifyMessage(message, history)
  const systemPrompt = buildSystemPrompt(userName, workspaceContext)

  // Trim history to last 10 messages
  const recentHistory = history.slice(-10)

  if (tier === 'simple') {
    // Try OpenRouter first, fall back to Gemini
    try {
      const reply = await chatOpenRouter(message, recentHistory, systemPrompt)
      return { reply, tier, provider: 'openrouter' }
    } catch (err) {
      console.warn('OpenRouter failed, falling back to Gemini:', err instanceof Error ? err.message : err)
    }
  }

  // Complex tier OR OpenRouter fallback → use Gemini
  try {
    const reply = await chatGemini(message, recentHistory, systemPrompt)
    return { reply, tier, provider: 'gemini' }
  } catch (err) {
    console.error('Gemini failed:', err instanceof Error ? err.message : err)

    // Last resort: try OpenRouter even for complex if Gemini fails
    if (tier === 'complex') {
      try {
        const reply = await chatOpenRouter(message, recentHistory, systemPrompt)
        return { reply, tier, provider: 'openrouter' }
      } catch {
        // Both failed
      }
    }

    throw new Error('All AI providers failed')
  }
}
