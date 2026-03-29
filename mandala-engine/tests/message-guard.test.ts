import { describe, it, expect } from 'vitest';
import { isInternalMessage, isOperatorNumber, sanitizeMessage } from '../src/channels/message-guard.js';

describe('MessageGuard', () => {
  describe('isInternalMessage', () => {
    it('should block messages with [MANDALA] tag', () => {
      const result = isInternalMessage('[MANDALA]\nSebelum saya hubungi 081353848164, saya butuh satu klarifikasi');
      expect(result.blocked).toBe(true);
      expect(result.pattern).toContain('[MANDALA]');
    });

    it('should block messages with [MANDALA TASK REPORT] tag', () => {
      const result = isInternalMessage('[MANDALA TASK REPORT]\n━━━━━━━━━━━━\nTask: outreach');
      expect(result.blocked).toBe(true);
    });

    it('should block messages with [MANDALA ESKALASI] tag', () => {
      const result = isInternalMessage('[MANDALA ESKALASI]\n━━━━━━━━━━━━\nTarget: 62813');
      expect(result.blocked).toBe(true);
    });

    it('should block messages with [FLAG] tag', () => {
      const result = isInternalMessage('[FLAG] Customer: 6281353848164\nPhase: Kenalan');
      expect(result.blocked).toBe(true);
    });

    it('should block messages with A/B/C confirmation options', () => {
      const msg = 'Apa yang harus dilakukan?\n\nA) Lanjutkan saja\nB) Berikan konteks tambahan\nC) Batalkan task';
      const result = isInternalMessage(msg);
      expect(result.blocked).toBe(true);
    });

    it('should block messages with A/B options only', () => {
      const msg = 'Override atau batalkan?\n\nA) Override — kirim pesan apa adanya\nB) Batalkan';
      const result = isInternalMessage(msg);
      expect(result.blocked).toBe(true);
    });

    it('should block messages with leaked intent metadata', () => {
      const result = isInternalMessage('{"intent": "buying_signal", "confidence": 0.8}');
      expect(result.blocked).toBe(true);
    });

    it('should block messages with leaked confidence metadata', () => {
      const result = isInternalMessage('Response: {"confidence": 0.95, "messages": []}');
      expect(result.blocked).toBe(true);
    });

    it('should block messages with report separators', () => {
      const result = isInternalMessage('Task Report\n━━━━━━━━━━━━━━━━━━━━\nSomething');
      expect(result.blocked).toBe(true);
    });

    it('should block clarification preamble', () => {
      const result = isInternalMessage('Sebelum saya hubungi 081353848164, saya butuh satu klarifikasi');
      expect(result.blocked).toBe(true);
    });

    it('should NOT block normal customer messages', () => {
      const result = isInternalMessage('Hai kak, gimana kabarnya? Lagi sibuk gak?');
      expect(result.blocked).toBe(false);
    });

    it('should NOT block normal sales messages', () => {
      const result = isInternalMessage('Aku mau tanya soal bisnisnya kak, udah berapa lama di bidang F&B?');
      expect(result.blocked).toBe(false);
    });

    it('should NOT block messages with casual question marks', () => {
      const result = isInternalMessage('Boleh sharing gak kak pengalaman manage social media?');
      expect(result.blocked).toBe(false);
    });

    it('should NOT block empty messages', () => {
      const result = isInternalMessage('');
      expect(result.blocked).toBe(false);
    });

    it('should block messages with [META] tag', () => {
      const result = isInternalMessage('[META] score_delta: +5, intent: interest');
      expect(result.blocked).toBe(true);
    });

    it('should block escalation format with options', () => {
      const msg = 'Target: 62813xxx\nSituasi: Task tidak bisa dieksekusi\nYang dibutuhkan: Fix data\nOpsi:\nA) Perbaiki\nB) Batalkan';
      const result = isInternalMessage(msg);
      expect(result.blocked).toBe(true);
    });
  });

  describe('isOperatorNumber', () => {
    const ownerNumbers = ['6281234567890', '6289876543210'];
    const adminNumbers = ['6285551234567'];

    it('should identify owner numbers', () => {
      expect(isOperatorNumber('6281234567890', ownerNumbers)).toBe(true);
    });

    it('should identify admin numbers', () => {
      expect(isOperatorNumber('6285551234567', ownerNumbers, adminNumbers)).toBe(true);
    });

    it('should NOT identify random customer numbers as operators', () => {
      expect(isOperatorNumber('6281353848164', ownerNumbers, adminNumbers)).toBe(false);
    });
  });

  describe('sanitizeMessage', () => {
    it('should return null for messages starting with [MANDALA]', () => {
      expect(sanitizeMessage('[MANDALA] Some internal message')).toBeNull();
    });

    it('should return null for messages starting with [FLAG]', () => {
      expect(sanitizeMessage('[FLAG] Customer: 62813')).toBeNull();
    });

    it('should return null for messages with report separators', () => {
      expect(sanitizeMessage('Report\n━━━━━━━━━━━━')).toBeNull();
    });

    it('should return null for A/B option blocks', () => {
      expect(sanitizeMessage('Choose:\nA) Option 1\nB) Option 2')).toBeNull();
    });

    it('should return content for normal messages', () => {
      expect(sanitizeMessage('Hai kak, apa kabar?')).toBe('Hai kak, apa kabar?');
    });
  });
});
