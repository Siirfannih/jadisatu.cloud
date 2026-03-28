import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external deps before importing the module
vi.mock('../src/memory/supabase-client.js', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
          limit: () => ({ single: () => Promise.resolve({ data: null }) }),
        }),
      }),
    }),
  }),
}));

vi.mock('../src/ai/gemini-client.js', () => ({
  getModel: () => ({
    generateContent: () => Promise.resolve({
      response: {
        text: () => JSON.stringify({
          question: 'Bisnis target bergerak di bidang apa?',
          options: ['Lanjut saja', 'Berikan konteks'],
          context: 'Data target tidak tersedia',
        }),
      },
    }),
  }),
}));

vi.mock('../src/memory/conversation-store.js', () => ({
  ConversationStore: {
    getInstance: () => ({
      getByCustomer: () => Promise.resolve(null),
    }),
  },
}));

vi.mock('../src/evaluator/memory-updater.js', () => ({
  MemoryUpdater: {
    getInstance: () => ({
      getMemory: () => Promise.resolve(null),
    }),
  },
}));

import { QuestionBook } from '../src/task/question-book.js';

describe('QuestionBook', () => {
  let qb: QuestionBook;

  beforeEach(() => {
    // Reset singleton for clean tests
    (QuestionBook as any).instance = undefined;
    qb = QuestionBook.getInstance();
  });

  describe('parse', () => {
    it('should normalize Indonesian phone number 08xxx to 62xxx', async () => {
      const parsed = await qb.parse({
        task_type: 'outreach',
        target_number: '081353848164',
        objective_raw: 'Hubungi dan tawarkan jasa kelola sosmed',
      }, 'mandala');

      expect(parsed.target_number).toBe('6281353848164');
    });

    it('should handle already-international format', async () => {
      const parsed = await qb.parse({
        task_type: 'outreach',
        target_number: '6281353848164',
        objective_raw: 'Hubungi dan tawarkan jasa',
      }, 'mandala');

      expect(parsed.target_number).toBe('6281353848164');
    });

    it('should strip spaces and dashes from phone numbers', async () => {
      const parsed = await qb.parse({
        task_type: 'outreach',
        target_number: '+62 813-5384-8164',
        objective_raw: 'Test',
      }, 'mandala');

      expect(parsed.target_number).toBe('6281353848164');
    });

    it('should preserve all task fields', async () => {
      const parsed = await qb.parse({
        task_type: 'follow_up',
        target_number: '081353848164',
        objective_raw: 'Follow up discussion',
        context_extra: 'Mereka tertarik soal pricing',
        contact_name: 'Budi',
      }, 'mandala');

      expect(parsed.task_type).toBe('follow_up');
      expect(parsed.objective_raw).toBe('Follow up discussion');
      expect(parsed.context_extra).toBe('Mereka tertarik soal pricing');
      expect(parsed.contact_name).toBe('Budi');
      expect(parsed.tenant_id).toBe('mandala');
    });
  });

  describe('validate', () => {
    it('should pass for valid outreach task', async () => {
      const parsed = await qb.parse({
        task_type: 'outreach',
        target_number: '081353848164',
        objective_raw: 'Hubungi dan tawarkan jasa kelola sosial media',
      }, 'mandala');

      const validation = await qb.validate(parsed);
      expect(validation.valid).toBe(true);
      expect(validation.status).toBe('ready');
    });

    it('should block invalid phone number', async () => {
      const parsed = await qb.parse({
        task_type: 'outreach',
        target_number: '123',
        objective_raw: 'Hubungi dan tawarkan jasa kelola sosial media',
      }, 'mandala');

      const validation = await qb.validate(parsed);
      expect(validation.valid).toBe(false);
      expect(validation.status).toBe('blocked');
      expect(validation.issues.some((i) => i.field === 'target_number')).toBe(true);
    });

    it('should block empty objective', async () => {
      const parsed = await qb.parse({
        task_type: 'outreach',
        target_number: '081353848164',
        objective_raw: '',
      }, 'mandala');

      const validation = await qb.validate(parsed);
      expect(validation.valid).toBe(false);
      expect(validation.issues.some((i) => i.field === 'objective_raw')).toBe(true);
    });

    it('should block rescue without history', async () => {
      const parsed = await qb.parse({
        task_type: 'rescue',
        target_number: '081353848164',
        objective_raw: 'Rescue this lead',
      }, 'mandala');

      const validation = await qb.validate(parsed);
      expect(validation.valid).toBe(false);
      expect(validation.issues.some((i) => i.field === 'task_type' && i.issue.includes('rescue'))).toBe(true);
    });

    it('should warn on vague objective without action verb', async () => {
      const parsed = await qb.parse({
        task_type: 'outreach',
        target_number: '081353848164',
        objective_raw: 'nomor ini menarik',
      }, 'mandala');

      const validation = await qb.validate(parsed);
      expect(validation.issues.some((i) => i.severity === 'warning')).toBe(true);
    });

    it('should warn follow_up without history', async () => {
      const parsed = await qb.parse({
        task_type: 'follow_up',
        target_number: '081353848164',
        objective_raw: 'Follow up yang kemarin',
      }, 'mandala');

      const validation = await qb.validate(parsed);
      expect(validation.issues.some((i) => i.field === 'task_type' && i.issue.includes('follow_up'))).toBe(true);
    });
  });

  describe('generateClarification', () => {
    it('should generate a clarification request', async () => {
      const parsed = await qb.parse({
        task_type: 'outreach',
        target_number: '081353848164',
        objective_raw: 'nomor ini menarik',
      }, 'mandala');

      const validation = await qb.validate(parsed);
      const clarification = await qb.generateClarification(
        'test-task-id',
        parsed,
        validation,
        'gemini-2.0-flash'
      );

      expect(clarification.task_id).toBe('test-task-id');
      expect(clarification.target).toBe('6281353848164');
      expect(clarification.question).toBeTruthy();
      expect(clarification.options.length).toBeGreaterThan(0);
    });
  });
});
