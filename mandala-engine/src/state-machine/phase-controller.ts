import type { ConversationPhase, PhaseConfig, PhaseTransition, EvaluatorResult } from './types.js';

/**
 * Phase Controller — Manages the 5-phase graduated scoring system.
 *
 * KENALAN (0-30):       Perkenalan, basa-basi, bangun rapport
 * GALI_MASALAH (31-50): Tanya pain points, dalami masalah bisnis
 * TAWARKAN_SOLUSI (51-79): Present solution, handle objections
 * CLOSING (≥80):        Arahkan ke deal, schedule meeting
 * RESCUE:               Triggered by resistance at any phase
 */
export class PhaseController {
  private static instance: PhaseController;

  static getInstance(): PhaseController {
    if (!PhaseController.instance) {
      PhaseController.instance = new PhaseController();
    }
    return PhaseController.instance;
  }

  private readonly phases: PhaseConfig[] = [
    {
      phase: 'kenalan',
      scoreRange: { min: 0, max: 30 },
      skills: [
        'skills/conversation/natural-flow.md',
        'skills/conversation/style-matching.md',
        'skills/sales/qualifying.md',
      ],
      maxContextMessages: 10,
      description: 'Perkenalan & bangun rapport. Tujuan: kenali bisnis customer.',
    },
    {
      phase: 'gali_masalah',
      scoreRange: { min: 31, max: 50 },
      skills: [
        'skills/conversation/natural-flow.md',
        'skills/conversation/style-matching.md',
        'skills/sales/qualifying.md',
        'skills/sales/product-knowledge.md',
      ],
      maxContextMessages: 15,
      description: 'Gali pain points bisnis. Tujuan: customer sadar ada masalah.',
    },
    {
      phase: 'tawarkan_solusi',
      scoreRange: { min: 51, max: 79 },
      skills: [
        'skills/conversation/style-matching.md',
        'skills/sales/product-knowledge.md',
        'skills/sales/objection-handling.md',
        'skills/sales/qualifying.md',
      ],
      maxContextMessages: 15,
      description: 'Presentasi solusi & handle objections. Tujuan: customer tertarik.',
    },
    {
      phase: 'closing',
      scoreRange: { min: 80, max: 100 },
      skills: [
        'skills/conversation/style-matching.md',
        'skills/sales/closing.md',
        'skills/sales/product-knowledge.md',
      ],
      maxContextMessages: 10,
      description: 'Closing deal. Tujuan: schedule meeting / deal.',
    },
    {
      phase: 'rescue',
      scoreRange: { min: -100, max: 100 },
      skills: [
        'skills/conversation/natural-flow.md',
        'skills/conversation/style-matching.md',
        'skills/sales/objection-handling.md',
      ],
      maxContextMessages: 10,
      description: 'Customer resistant. Tujuan: rebuild trust, offer value.',
    },
  ];

  getPhaseConfig(phase: ConversationPhase): PhaseConfig {
    return this.phases.find((p) => p.phase === phase) || this.phases[0];
  }

  getSkillsForPhase(phase: ConversationPhase): string[] {
    return this.getPhaseConfig(phase).skills;
  }

  getMaxContextMessages(phase: ConversationPhase): number {
    return this.getPhaseConfig(phase).maxContextMessages;
  }

  /**
   * Evaluate whether the conversation should transition to a new phase.
   */
  evaluate(
    currentPhase: ConversationPhase,
    currentScore: number,
    evaluatorResult: EvaluatorResult
  ): PhaseTransition | null {
    const newScore = currentScore + evaluatorResult.score_delta;

    // Check for rescue trigger
    if (evaluatorResult.recommended_action === 'rescue' && currentPhase !== 'rescue') {
      return {
        from: currentPhase,
        to: 'rescue',
        reason: `Resistance detected: ${evaluatorResult.resistance_type || evaluatorResult.objection || 'unknown'}`,
        score: newScore,
        timestamp: new Date(),
      };
    }

    // If in rescue and score recovering, transition back
    if (currentPhase === 'rescue' && evaluatorResult.score_delta > 0) {
      const targetPhase = this.getPhaseForScore(newScore);
      if (targetPhase !== 'rescue') {
        return {
          from: 'rescue',
          to: targetPhase,
          reason: 'Customer re-engaged after rescue',
          score: newScore,
          timestamp: new Date(),
        };
      }
    }

    // Normal phase progression (only forward, never backward unless rescue)
    if (currentPhase !== 'rescue') {
      const targetPhase = this.getPhaseForScore(newScore);
      const currentIndex = this.getPhaseIndex(currentPhase);
      const targetIndex = this.getPhaseIndex(targetPhase);

      if (targetIndex > currentIndex) {
        return {
          from: currentPhase,
          to: targetPhase,
          reason: `Score ${currentScore} → ${newScore} (crossed ${targetPhase} threshold)`,
          score: newScore,
          timestamp: new Date(),
        };
      }
    }

    return null;
  }

  getPhaseForScore(score: number): ConversationPhase {
    if (score >= 80) return 'closing';
    if (score >= 51) return 'tawarkan_solusi';
    if (score >= 31) return 'gali_masalah';
    return 'kenalan';
  }

  private getPhaseIndex(phase: ConversationPhase): number {
    const order: ConversationPhase[] = ['kenalan', 'gali_masalah', 'tawarkan_solusi', 'closing'];
    return order.indexOf(phase);
  }
}
