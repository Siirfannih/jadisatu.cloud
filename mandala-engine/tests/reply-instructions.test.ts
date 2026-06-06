import { describe, it, expect } from 'vitest';
import { buildReplyInstructions } from '../src/ai/engine.js';

/**
 * These are STRUCTURAL tests for the inbound reply prompt scaffold.
 *
 * The actual reply text is produced by an LLM, so we cannot assert exact strings
 * deterministically here. What we CAN (and must) guarantee is that every turn the
 * model receives the right guardrails: language-mirror first, multi-intent routing,
 * ACK→JAWAB→ARAH, intent-gated selling, no-invention, and a self-check. If any of
 * these regress, the "Hello good evening → lagi santai/sibuk nih" class of bug returns.
 *
 * The 10 behavioural cases from the audit are encoded as a fixture for LLM/manual eval.
 */

describe('buildReplyInstructions — guardrail scaffold', () => {
  const cold = buildReplyInstructions('Hello good evening', 0);

  it('echoes the customer message verbatim', () => {
    expect(cold).toContain('Hello good evening');
  });

  it('puts LANGUAGE detection first and mirrors it (EN→EN)', () => {
    expect(cold).toContain('BAHASA');
    expect(cold).toContain('Customer pakai English → balas English');
    expect(cold).toContain('Bahasa customer MENANG atas persona');
  });

  it('routes by an intent stack with priority, not a single label', () => {
    expect(cold).toContain('INTENT STACK');
    expect(cold).toContain('Sapaan TIDAK PERNAH mengalahkan intent bisnis');
  });

  it('handles greeting-only as ACK + service offer, never a personal question', () => {
    expect(cold).toContain('how can I help you today?');
    expect(cold).toContain('DILARANG tanya hal personal');
  });

  it('uses ACK → JAWAB → ARAH with a business-relevant next step', () => {
    expect(cold).toContain('ACK → JAWAB → ARAH');
    expect(cold).toContain('BUKAN pertanyaan personal');
  });

  it('forbids inventing price/stock/schedule', () => {
    expect(cold).toContain('JANGAN mengarang');
  });

  it('ends with a self-check that forces a rewrite on failure', () => {
    expect(cold).toContain('SELF-CHECK');
    expect(cold).toContain('TULIS ULANG');
    expect(cold).toContain('Bahasa balasan = bahasa customer?');
  });

  it('drops the old "TEMAN CURHAT" framing that caused the bug', () => {
    expect(cold).not.toContain('TEMAN CURHAT');
  });

  it('makes the lead-score band SUBORDINATE to explicit business intent', () => {
    expect(cold).toContain('LAYANI kebutuhannya apa pun levelnya');
  });

  it('still varies engagement by score band (HOT vs COLD)', () => {
    expect(buildReplyInstructions('halo kak', 80)).toContain('HOT');
    expect(cold).toContain('COLD');
  });
});

/**
 * Behavioural eval cases (audit Case 1–10). Use with an LLM-graded eval harness;
 * here we only assert the scaffold carries each input so the prompt is well-formed.
 */
export const REPLY_EVAL_CASES = [
  { name: 'EN greeting only', input: 'Hello good evening', score: 0, expectLang: 'en', primary: 'greeting' },
  { name: 'ID greeting only', input: 'Halo selamat malam', score: 0, expectLang: 'id', primary: 'greeting' },
  { name: 'ID greeting + price', input: 'Halo selamat malam kak, saya mau tanya kamar ada pricelistnya?', score: 0, expectLang: 'id', primary: 'asking_price' },
  { name: 'EN greeting + price', input: 'Good evening, do you have a room pricelist?', score: 0, expectLang: 'en', primary: 'asking_price' },
  { name: 'Greeting + complaint', input: 'Halo kak, pesanan saya kok belum sampai ya?', score: 40, expectLang: 'id', primary: 'complaint' },
  { name: 'Ready to buy', input: 'Hai kak, aku mau order yang warna sage size L', score: 60, expectLang: 'id', primary: 'ready_to_buy' },
  { name: 'Mixed language', input: 'Halo kak, do you have price list for villa?', score: 0, expectLang: 'mixed', primary: 'asking_price' },
  { name: 'Vague', input: 'Kak mau tanya', score: 0, expectLang: 'id', primary: 'other' },
  { name: 'Over-casual prevention', input: 'Good evening', score: 0, expectLang: 'en', primary: 'greeting' },
  { name: 'No price data', input: 'Halo kak pricelist kamar ada?', score: 0, expectLang: 'id', primary: 'asking_price' },
] as const;

describe('buildReplyInstructions — audit eval cases are well-formed', () => {
  for (const c of REPLY_EVAL_CASES) {
    it(`${c.name}: carries input + scaffold`, () => {
      const prompt = buildReplyInstructions(c.input, c.score);
      expect(prompt).toContain(c.input);
      expect(prompt).toContain('BAHASA');
      expect(prompt).toContain('INTENT STACK');
    });
  }
});
