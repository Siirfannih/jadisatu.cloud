import { HunterPipeline } from './index.js';

/**
 * Hunter Scheduler — Runs the hunter pipeline on a configurable cron.
 *
 * Uses simple setInterval-based scheduling (no external cron dependency).
 * Configurable via env vars:
 *   HUNTER_ENABLED=true
 *   HUNTER_INTERVAL_HOURS=6
 *   HUNTER_BATCH_SIZE=20
 *   HUNTER_CATEGORIES=hotel_bali,restaurant_denpasar
 */

export class HunterScheduler {
  private static instance: HunterScheduler;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  static getInstance(): HunterScheduler {
    if (!HunterScheduler.instance) {
      HunterScheduler.instance = new HunterScheduler();
    }
    return HunterScheduler.instance;
  }

  /**
   * Start the scheduler if HUNTER_ENABLED=true.
   */
  start(): void {
    const enabled = process.env.HUNTER_ENABLED === 'true';
    if (!enabled) {
      console.log('[hunter-scheduler] Hunter is disabled (HUNTER_ENABLED != true)');
      return;
    }

    const intervalHours = parseInt(process.env.HUNTER_INTERVAL_HOURS || '6');
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(`[hunter-scheduler] Starting — runs every ${intervalHours}h`);

    // Run once at startup (after 30s delay for services to be ready)
    setTimeout(() => this.runCycle(), 30000);

    // Then run on interval
    this.timer = setInterval(() => this.runCycle(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[hunter-scheduler] Stopped');
    }
  }

  /**
   * Manually trigger a run cycle.
   */
  async runCycle(): Promise<void> {
    if (this.running) {
      console.log('[hunter-scheduler] Already running, skipping cycle');
      return;
    }

    this.running = true;
    console.log('[hunter-scheduler] Starting cycle...');

    try {
      const categories = (process.env.HUNTER_CATEGORIES || '').split(',').filter(Boolean);
      const batchSize = parseInt(process.env.HUNTER_BATCH_SIZE || '20');
      const tenantId = process.env.HUNTER_TENANT_ID || 'mandala';
      const classifierModel = process.env.HUNTER_CLASSIFIER_MODEL || 'gemini-2.0-flash';
      const conversationModel = process.env.HUNTER_CONVERSATION_MODEL || 'gemini-2.5-pro';

      if (categories.length === 0) {
        console.log('[hunter-scheduler] No categories configured (HUNTER_CATEGORIES). Skipping.');
        return;
      }

      const pipeline = HunterPipeline.getInstance();

      for (const category of categories) {
        const query = category.replace(/_/g, ' ');
        console.log(`[hunter-scheduler] Processing category: "${query}"`);

        await pipeline.run(query, tenantId, {
          batchSize,
          classifierModel,
          conversationModel,
          autoContact: process.env.HUNTER_AUTO_CONTACT === 'true',
        });
      }

      console.log('[hunter-scheduler] Cycle complete');
    } catch (err) {
      console.error('[hunter-scheduler] Cycle error:', err);
    } finally {
      this.running = false;
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}
