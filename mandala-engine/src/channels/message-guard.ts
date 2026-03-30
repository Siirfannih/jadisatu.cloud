// ============================================================
// Message Guard — Safety filter to prevent internal messages
// from being sent to customers via WhatsApp.
//
// Internal messages include:
// - [MANDALA] tagged messages (clarifications, reports)
// - [FLAG] tagged messages (owner notifications)
// - [MANDALA TASK REPORT] / [MANDALA ESKALASI] reports
// - Messages with A/B/C confirmation options meant for operators
// - Leaked metadata (JSON internals, confidence scores, etc.)
//
// This guard operates at multiple levels:
// 1. WhatsAppAdapter.send() — last line of defense
// 2. TaskExecutor.sendDrafts() — pre-send check
// 3. MessageRouter.sendMessage() — runtime check
// ============================================================

export interface GuardResult {
  blocked: boolean;
  reason?: string;
  pattern?: string;
}

/**
 * Patterns that indicate an internal/operator-only message.
 * These should NEVER be sent to a customer.
 */
const INTERNAL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Mandala system tags
  { pattern: /\[MANDALA\]/i, label: '[MANDALA] tag' },
  { pattern: /\[MANDALA TASK REPORT\]/i, label: '[MANDALA TASK REPORT] tag' },
  { pattern: /\[MANDALA ESKALASI\]/i, label: '[MANDALA ESKALASI] tag' },
  { pattern: /\[FLAG\]/i, label: '[FLAG] tag' },

  // A/B/C option pattern used in clarifications and escalations
  // Matches lines like: A) option text \n B) option text \n C) option text
  { pattern: /^[A-C]\)\s+.+/m, label: 'A/B/C confirmation options' },

  // Multiple-choice with lettered options on separate lines (at least 2 options)
  { pattern: /\bA\)\s+.+\n\s*B\)\s+/m, label: 'A/B lettered options block' },

  // Internal metadata leak
  { pattern: /\{.*"intent"\s*:/i, label: 'Leaked intent metadata' },
  { pattern: /\{.*"confidence"\s*:/i, label: 'Leaked confidence metadata' },
  { pattern: /\{.*"score_delta"\s*:/i, label: 'Leaked score_delta metadata' },
  { pattern: /\[META\]/i, label: '[META] tag' },

  // Task execution internal markers
  { pattern: /━━━━━━━━/, label: 'Internal report separator' },
  { pattern: /Yang dibutuhkan:.*\n.*Opsi:/m, label: 'Escalation format' },

  // Clarification preamble patterns
  { pattern: /saya butuh.*klarifikasi/i, label: 'Clarification request preamble' },
  { pattern: /sebelum saya hubungi.*saya butuh/i, label: 'Pre-execution clarification' },
];

/**
 * Check if a message contains internal/operator-only content
 * that should NOT be sent to a customer.
 */
export function isInternalMessage(content: string): GuardResult {
  if (!content || content.trim().length === 0) {
    return { blocked: false };
  }

  for (const { pattern, label } of INTERNAL_PATTERNS) {
    if (pattern.test(content)) {
      return {
        blocked: true,
        reason: `Message contains internal pattern: ${label}`,
        pattern: label,
      };
    }
  }

  return { blocked: false };
}

/**
 * Check if a target number is an operator/owner number (not a customer).
 * Operator messages bypass the guard.
 */
export function isOperatorNumber(
  targetNumber: string,
  ownerNumbers: string[],
  adminNumbers: string[] = []
): boolean {
  const normalized = targetNumber.replace(/[\s\-\(\)\+@s.whatsapp.net]/g, '');
  const allOperator = [...ownerNumbers, ...adminNumbers].map(
    (n) => n.replace(/[\s\-\(\)\+@s.whatsapp.net]/g, '')
  );
  return allOperator.includes(normalized);
}

/**
 * Sanitize a message by removing internal markers if partial cleanup is viable.
 * Returns null if the message is entirely internal (should be blocked entirely).
 */
export function sanitizeMessage(content: string): string | null {
  // If the message starts with a system tag, it's fully internal — block entirely
  if (/^\[MANDALA|^\[FLAG|^\[META/i.test(content.trim())) {
    return null;
  }

  // If it contains report separators, it's fully internal
  if (/━━━━━━━━/.test(content)) {
    return null;
  }

  // If it has A/B/C options block, it's a clarification — block entirely
  if (/\bA\)\s+.+\n\s*B\)\s+/m.test(content)) {
    return null;
  }

  // Otherwise, the content might have minor leaks — return as-is
  // (the caller should still block based on isInternalMessage result)
  return content;
}
