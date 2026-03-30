// ============================================================
// Send Rate Limiter — Prevents spam by tracking sent messages
// per phone number and enforcing cooldown periods.
//
// Two layers of protection:
// 1. Per-number rate limit: max N messages per time window
// 2. Content dedup: prevent identical messages within a window
// ============================================================

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

interface NumberTracker {
  /** Timestamps of recent sends */
  sends: number[];
  /** Hash of recently sent content (to dedup) */
  recentContentHashes: Map<string, number>;
}

const DEFAULT_MAX_PER_HOUR = 10;
const DEFAULT_MAX_PER_MINUTE = 3;
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export class SendRateLimiter {
  private static instance: SendRateLimiter;
  private trackers = new Map<string, NumberTracker>();
  private maxPerHour: number;
  private maxPerMinute: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  private constructor(maxPerHour = DEFAULT_MAX_PER_HOUR, maxPerMinute = DEFAULT_MAX_PER_MINUTE) {
    this.maxPerHour = maxPerHour;
    this.maxPerMinute = maxPerMinute;

    // Periodic cleanup of stale entries
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  static getInstance(): SendRateLimiter {
    if (!SendRateLimiter.instance) {
      SendRateLimiter.instance = new SendRateLimiter();
    }
    return SendRateLimiter.instance;
  }

  /**
   * Check if sending to this number is allowed.
   * Call BEFORE actually sending. If allowed, automatically records the send.
   */
  check(targetNumber: string, content: string): RateLimitResult {
    const normalized = this.normalize(targetNumber);
    const now = Date.now();

    let tracker = this.trackers.get(normalized);
    if (!tracker) {
      tracker = { sends: [], recentContentHashes: new Map() };
      this.trackers.set(normalized, tracker);
    }

    // Prune old sends
    tracker.sends = tracker.sends.filter((ts) => now - ts < 3600_000); // keep last hour

    // Check per-minute rate
    const sendsLastMinute = tracker.sends.filter((ts) => now - ts < 60_000).length;
    if (sendsLastMinute >= this.maxPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit: ${sendsLastMinute} messages sent to ${normalized} in last minute (max ${this.maxPerMinute})`,
      };
    }

    // Check per-hour rate
    if (tracker.sends.length >= this.maxPerHour) {
      return {
        allowed: false,
        reason: `Rate limit: ${tracker.sends.length} messages sent to ${normalized} in last hour (max ${this.maxPerHour})`,
      };
    }

    // Check content dedup
    const contentHash = this.hash(content);
    const lastSentAt = tracker.recentContentHashes.get(contentHash);
    if (lastSentAt && now - lastSentAt < DEDUP_WINDOW_MS) {
      return {
        allowed: false,
        reason: `Duplicate: identical message already sent to ${normalized} ${((now - lastSentAt) / 1000).toFixed(0)}s ago`,
      };
    }

    // Allowed — record the send
    tracker.sends.push(now);
    tracker.recentContentHashes.set(contentHash, now);

    return { allowed: true };
  }

  /**
   * Record a send without checking limits (for sends that bypass the limiter).
   */
  record(targetNumber: string, content: string): void {
    const normalized = this.normalize(targetNumber);
    const now = Date.now();

    let tracker = this.trackers.get(normalized);
    if (!tracker) {
      tracker = { sends: [], recentContentHashes: new Map() };
      this.trackers.set(normalized, tracker);
    }

    tracker.sends.push(now);
    tracker.recentContentHashes.set(this.hash(content), now);
  }

  /**
   * Get stats for a number (for debugging/monitoring).
   */
  getStats(targetNumber: string): { sendsLastHour: number; sendsLastMinute: number } {
    const normalized = this.normalize(targetNumber);
    const tracker = this.trackers.get(normalized);
    if (!tracker) return { sendsLastHour: 0, sendsLastMinute: 0 };

    const now = Date.now();
    return {
      sendsLastHour: tracker.sends.filter((ts) => now - ts < 3600_000).length,
      sendsLastMinute: tracker.sends.filter((ts) => now - ts < 60_000).length,
    };
  }

  private normalize(number: string): string {
    return number.replace(/[\s\-\(\)\+@s.whatsapp.net]/g, '');
  }

  private hash(content: string): string {
    // Simple hash — sufficient for dedup within a short window
    let hash = 0;
    const str = content.trim().toLowerCase();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [number, tracker] of this.trackers.entries()) {
      // Remove old sends
      tracker.sends = tracker.sends.filter((ts) => now - ts < 3600_000);

      // Remove old content hashes
      for (const [hash, ts] of tracker.recentContentHashes.entries()) {
        if (now - ts > DEDUP_WINDOW_MS) {
          tracker.recentContentHashes.delete(hash);
        }
      }

      // Remove empty trackers
      if (tracker.sends.length === 0 && tracker.recentContentHashes.size === 0) {
        this.trackers.delete(number);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
