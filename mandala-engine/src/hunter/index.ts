import { GoogleMapsClient } from './google-maps.js';
import { BusinessEnricher } from './enricher.js';
import { PainClassifier } from './classifier.js';
import { ColdMessenger } from './cold-messenger.js';
import { getSupabase } from '../memory/supabase-client.js';

/**
 * Hunter Pipeline — Orchestrates the full prospecting workflow.
 *
 * discover() → enrich() → classify() → coldMessage()
 */

export interface PipelineOptions {
  batchSize?: number;
  classifierModel?: string;
  conversationModel?: string;
  autoContact?: boolean;
}

export interface PipelineStats {
  discovered: number;
  enriched: number;
  qualified: number;
  contacted: number;
  skipped: number;
}

export class HunterPipeline {
  private static instance: HunterPipeline;
  private maps = GoogleMapsClient.getInstance();
  private enricher = BusinessEnricher.getInstance();
  private classifier = PainClassifier.getInstance();
  private messenger = ColdMessenger.getInstance();

  static getInstance(): HunterPipeline {
    if (!HunterPipeline.instance) {
      HunterPipeline.instance = new HunterPipeline();
    }
    return HunterPipeline.instance;
  }

  /**
   * Run the full pipeline for a search query.
   */
  async run(
    query: string,
    tenantId: string,
    options: PipelineOptions = {}
  ): Promise<PipelineStats> {
    const {
      batchSize = 20,
      classifierModel = 'gemini-2.0-flash',
      conversationModel = 'gemini-2.5-pro',
      autoContact = false,
    } = options;

    const stats: PipelineStats = {
      discovered: 0,
      enriched: 0,
      qualified: 0,
      contacted: 0,
      skipped: 0,
    };

    // Step 1: Discover
    console.log(`[hunter-pipeline] Step 1: Discover "${query}"`);
    stats.discovered = await this.maps.discover(query, tenantId, batchSize);

    // Step 2: Enrich discovered prospects
    console.log('[hunter-pipeline] Step 2: Enrich');
    const db = getSupabase();
    const { data: toEnrich } = await db
      .from('mandala_hunter_prospects')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'discovered')
      .eq('search_query', query)
      .limit(batchSize);

    for (const prospect of toEnrich || []) {
      await this.enricher.enrich(prospect.id);
      stats.enriched++;
      await this.delay(500);
    }

    // Step 3: Classify enriched prospects
    console.log('[hunter-pipeline] Step 3: Classify');
    const { data: toClassify } = await db
      .from('mandala_hunter_prospects')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'enriched')
      .eq('search_query', query)
      .limit(batchSize);

    for (const prospect of toClassify || []) {
      const result = await this.classifier.classify(prospect.id, classifierModel);
      if (result) {
        if (result.decision === 'skip') {
          stats.skipped++;
        } else {
          stats.qualified++;
        }
      }
      await this.delay(1000); // Respect API rate limits
    }

    // Step 4: Cold message (only if autoContact enabled)
    if (autoContact) {
      console.log('[hunter-pipeline] Step 4: Cold Message');
      const { data: toContact } = await db
        .from('mandala_hunter_prospects')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'qualified')
        .in('decision', ['high_priority', 'contact_now'])
        .eq('search_query', query)
        .limit(10);

      for (const prospect of toContact || []) {
        const sent = await this.messenger.sendColdMessage(prospect.id, conversationModel);
        if (sent) stats.contacted++;
        await this.delay(3000); // Longer delay between WA messages
      }
    }

    console.log(`[hunter-pipeline] Complete: discovered=${stats.discovered}, enriched=${stats.enriched}, qualified=${stats.qualified}, contacted=${stats.contacted}, skipped=${stats.skipped}`);
    return stats;
  }

  /**
   * Get pipeline statistics for a tenant.
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_decision: Record<string, number>;
    by_pain_type: Record<string, number>;
  }> {
    const db = getSupabase();
    const { data } = await db
      .from('mandala_hunter_prospects')
      .select('status, decision, pain_type')
      .eq('tenant_id', tenantId);

    const prospects = data || [];
    const byStatus: Record<string, number> = {};
    const byDecision: Record<string, number> = {};
    const byPainType: Record<string, number> = {};

    for (const p of prospects) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      if (p.decision) byDecision[p.decision] = (byDecision[p.decision] || 0) + 1;
      if (p.pain_type) byPainType[p.pain_type] = (byPainType[p.pain_type] || 0) + 1;
    }

    return {
      total: prospects.length,
      by_status: byStatus,
      by_decision: byDecision,
      by_pain_type: byPainType,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
