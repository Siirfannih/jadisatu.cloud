import type { ResistanceSignal } from '../state-machine/types.js';

/**
 * Resistance Detector — Pattern matching for customer resistance signals.
 *
 * Runs locally (no AI call) as a fast pre-check before shadow evaluator.
 * Detects common Indonesian resistance patterns in WhatsApp conversations.
 */
export class ResistanceDetector {
  private static instance: ResistanceDetector;

  static getInstance(): ResistanceDetector {
    if (!ResistanceDetector.instance) {
      ResistanceDetector.instance = new ResistanceDetector();
    }
    return ResistanceDetector.instance;
  }

  private readonly patterns: Array<{
    type: ResistanceSignal['type'];
    regexes: RegExp[];
    score_delta: number;
    action: ResistanceSignal['action'];
    message_hint?: string;
  }> = [
    {
      type: 'time_stalling',
      regexes: [
        /nanti\s*(aja|dulu|ya)/i,
        /pikir[\s-]*(pikir|dulu)/i,
        /belum\s*(bisa|siap|yakin)/i,
        /lain\s*kali/i,
        /kapan[\s-]*kapan/i,
        /minggu\s*depan/i,
        /bulan\s*depan/i,
        /tanya\s*(istri|suami|partner|bos)/i,
        /discuss\s*dulu/i,
      ],
      score_delta: -10,
      action: 'rescue',
      message_hint: 'Acknowledge timing, offer low-pressure value (free audit/tips)',
    },
    {
      type: 'value_mismatch',
      regexes: [
        /mahal/i,
        /kemahalan/i,
        /over\s*budget/i,
        /budget\s*(belum|gak|nggak|tidak)/i,
        /gak\s*(worth|sebanding)/i,
        /harga\s*(tinggi|mahal|fantastis)/i,
        /gak\s*mampu/i,
        /belum\s*ada\s*(budget|dana)/i,
      ],
      score_delta: -15,
      action: 'rescue',
      message_hint: 'Reframe value (ROI), offer phased/flexible pricing',
    },
    {
      type: 'explicit_rejection',
      regexes: [
        /gak\s*jadi/i,
        /tidak\s*(jadi|tertarik|mau|perlu|butuh)/i,
        /gak\s*(tertarik|mau|perlu|butuh)/i,
        /nggak\s*(tertarik|mau|perlu|butuh)/i,
        /cancel/i,
        /batal/i,
        /sudah\s*(ada|punya|pakai)/i,
        /udah\s*(ada|punya|pake)/i,
      ],
      score_delta: -30,
      action: 'graceful_close',
      message_hint: 'Respect decision, leave door open, offer future contact',
    },
    {
      type: 'competitor_mention',
      regexes: [
        /pakai\s*(yang\s*lain|kompetitor|alternatif)/i,
        /competitor/i,
        /ada\s*yang\s*lebih\s*(murah|bagus)/i,
        /lagi\s*(bandingin|compare|cek\s*yang\s*lain)/i,
        /vendor\s*lain/i,
      ],
      score_delta: -5,
      action: 'continue',
      message_hint: 'Differentiate, focus on unique value, ask what they are comparing',
    },
    {
      type: 'trust_issue',
      regexes: [
        /beneran\s*(gak|nggak|tidak)/i,
        /yakin\s*(gak|nggak)/i,
        /siapa\s*(sih|ya)\s*(kamu|kalian)/i,
        /penipuan/i,
        /scam/i,
        /tipu/i,
        /review\s*(nya|dong)/i,
        /testimoni/i,
        /bukti/i,
        /portfolio/i,
      ],
      score_delta: -8,
      action: 'rescue',
      message_hint: 'Provide social proof, testimonials, case studies',
    },
  ];

  /**
   * Detect resistance patterns in a message.
   * Returns null if no resistance detected.
   */
  detect(message: string): ResistanceSignal | null {
    const normalized = message.toLowerCase().trim();

    for (const pattern of this.patterns) {
      for (const regex of pattern.regexes) {
        if (regex.test(normalized)) {
          return {
            type: pattern.type,
            pattern: regex.source,
            score_delta: pattern.score_delta,
            action: pattern.action,
            message_hint: pattern.message_hint,
          };
        }
      }
    }

    return null;
  }

  /**
   * Check for silence resistance (no reply for X hours).
   * Called by a separate timer/cron, not inline.
   */
  checkSilence(lastMessageAt: Date, hoursThreshold = 4): ResistanceSignal | null {
    const hoursSinceLastMsg = (Date.now() - lastMessageAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastMsg >= hoursThreshold) {
      return {
        type: 'silence',
        pattern: `no_reply_${Math.floor(hoursSinceLastMsg)}h`,
        score_delta: -5,
        action: 'gentle_followup',
        message_hint: 'Send gentle follow-up with value (article, tip, case study)',
      };
    }

    return null;
  }
}
