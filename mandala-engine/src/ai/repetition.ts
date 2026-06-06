/**
 * Repetition detector — prevents Mandala from repeating itself
 * (re-asking what it already asked, or sending near-duplicate bubbles).
 *
 * Pure + conservative: only flags CLEAR repeats so we never wrongly
 * suppress a legitimately new reply.
 */

/**
 * Normalize a message for comparison:
 * lowercase, strip emoji/punctuation, collapse whitespace.
 */
export function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    // strip emoji / pictographs / symbols
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu, ' ')
    // strip punctuation (keep word chars + whitespace)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(normText: string): string[] {
  if (!normText) return [];
  return normText.split(' ').filter(Boolean);
}

/**
 * Jaccard-style token overlap of `a` relative to the candidate set.
 * Returns overlap = |intersection| / |union| in [0,1].
 */
function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : inter / union;
}

/**
 * Extract the trailing question (text after the last sentence boundary that
 * ends in '?'), normalized. Returns '' if the message is not a question.
 */
function trailingQuestion(raw: string): string {
  if (!raw || !raw.includes('?')) return '';
  // take the last clause ending in ?
  const matches = raw.match(/[^?.!\n]*\?/g);
  if (!matches || matches.length === 0) return '';
  return normalize(matches[matches.length - 1]);
}

/**
 * Returns true if `candidate` is a near-duplicate of any recent Mandala
 * outgoing message. Conservative — only flags clear repeats:
 *   1. Identical normalized text, OR
 *   2. Token-overlap >= threshold (default 0.8), OR
 *   3. Same trailing question (re-asking something already asked).
 *
 * Very short candidates (< 3 tokens) are only flagged on exact match,
 * to avoid suppressing short acks like "ok" / "siap" unfairly via overlap.
 */
export function isRepetitive(
  candidate: string,
  recentOutgoing: string[],
  threshold = 0.8
): boolean {
  const candNorm = normalize(candidate);
  if (!candNorm) return false; // empty/whitespace candidate — let caller handle, never flag

  const candTokens = tokens(candNorm);
  const candQuestion = trailingQuestion(candidate);

  for (const prev of recentOutgoing) {
    const prevNorm = normalize(prev);
    if (!prevNorm) continue;

    // 1. Exact normalized match
    if (candNorm === prevNorm) return true;

    // 3. Same trailing question (re-asking)
    if (candQuestion && candQuestion === trailingQuestion(prev)) return true;

    // 2. High token overlap — but require enough tokens to be meaningful
    if (candTokens.length >= 3) {
      const overlap = tokenOverlap(candTokens, tokens(prevNorm));
      if (overlap >= threshold) return true;
    }
  }

  return false;
}
