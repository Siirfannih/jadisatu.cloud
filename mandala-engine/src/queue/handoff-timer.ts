/**
 * Handoff Timer System
 *
 * Manages the 2-minute timer for auto-takeover:
 * - Customer sends message
 * - Timer starts (2 min)
 * - If Owner replies → timer cancelled
 * - If Owner doesn't reply → Mandala takes over
 */

export class HandoffTimer {
  private static instance: HandoffTimer;
  private timers = new Map<string, NodeJS.Timeout>();
  private running = false;

  static getInstance(): HandoffTimer {
    if (!HandoffTimer.instance) {
      HandoffTimer.instance = new HandoffTimer();
    }
    return HandoffTimer.instance;
  }

  start(): void {
    this.running = true;
    console.log('[handoff-timer] Timer system started');
  }

  stop(): void {
    this.running = false;
    // Clear all pending timers
    for (const [id, timer] of this.timers.entries()) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    console.log('[handoff-timer] Timer system stopped');
  }

  /**
   * Start a 2-minute timer for a conversation.
   * When timer fires, callback is executed (Mandala takes over).
   * If called again for same conversation, previous timer is cancelled.
   */
  start2MinTimer(
    conversationId: string,
    onTimeout: () => Promise<void>,
    delayMs: number = 120_000 // 2 minutes default
  ): void {
    if (!this.running) return;

    // Cancel existing timer for this conversation
    this.cancel(conversationId);

    const timer = setTimeout(async () => {
      this.timers.delete(conversationId);
      try {
        await onTimeout();
      } catch (err) {
        console.error(`[handoff-timer] Error in timeout callback for ${conversationId}:`, err);
      }
    }, delayMs);

    this.timers.set(conversationId, timer);
    console.log(`[handoff-timer] Timer set for ${conversationId} (${delayMs / 1000}s)`);
  }

  /**
   * Cancel timer for a conversation (Owner replied).
   */
  cancel(conversationId: string): void {
    const existing = this.timers.get(conversationId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(conversationId);
      console.log(`[handoff-timer] Timer cancelled for ${conversationId}`);
    }
  }

  /**
   * Check if a timer is active for a conversation.
   */
  hasTimer(conversationId: string): boolean {
    return this.timers.has(conversationId);
  }

  /**
   * Get count of active timers.
   */
  activeCount(): number {
    return this.timers.size;
  }
}
