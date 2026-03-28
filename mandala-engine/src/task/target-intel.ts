import { getSupabase } from '../memory/supabase-client.js';
import { MemoryUpdater } from '../evaluator/memory-updater.js';
import type { TargetProfile } from './types.js';

/**
 * Target Intel — Pre-contact intelligence gathering.
 *
 * Before Mandala contacts anyone, this module checks all available data sources:
 * 1. Hunter prospects (from Google Maps discovery + enrichment)
 * 2. Existing conversation memory (from previous interactions)
 * 3. Leads table (from Light Mode CRM)
 *
 * Returns a TargetProfile that determines the messaging approach:
 * - If rich data exists → pain_based approach (use specific pain points)
 * - If partial data → curiosity_based with known context
 * - If no data → basa-basi approach (casual introduction, ask about their business)
 */
export class TargetIntel {
  private static instance: TargetIntel;
  private memoryUpdater = MemoryUpdater.getInstance();

  static getInstance(): TargetIntel {
    if (!TargetIntel.instance) {
      TargetIntel.instance = new TargetIntel();
    }
    return TargetIntel.instance;
  }

  /**
   * Gather all available intelligence about a target number.
   * Checks: hunter prospects, conversation memory, leads table.
   */
  async gather(targetNumber: string, tenantId: string): Promise<TargetProfile> {
    const [hunterData, memoryData, leadData] = await Promise.all([
      this.checkHunterProspects(targetNumber, tenantId),
      this.checkConversationMemory(targetNumber, tenantId),
      this.checkLeadsTable(targetNumber, tenantId),
    ]);

    // Merge all data sources into a single profile
    return this.mergeProfile(hunterData, memoryData, leadData);
  }

  /**
   * Check if target exists in hunter prospects table.
   * This is the richest data source — includes Google Maps data, reviews, enrichment.
   */
  private async checkHunterProspects(
    number: string,
    tenantId: string
  ): Promise<HunterMatch | null> {
    try {
      const db = getSupabase();

      // Try exact phone match first
      const { data: byPhone } = await db
        .from('mandala_hunter_prospects')
        .select('business_name, address, phone, rating, review_count, website, types, pain_type, pain_score, classification_data, enrichment_data')
        .eq('tenant_id', tenantId)
        .or(`phone.eq.${number},phone.eq.+${number}`)
        .limit(1)
        .single();

      if (byPhone) {
        return {
          source: 'hunter_phone' as const,
          business_name: byPhone.business_name,
          business_type: (byPhone.types || [])[0],
          pain_type: byPhone.pain_type,
          pain_score: byPhone.pain_score,
          pain_points: byPhone.classification_data?.blind_spots || [],
          messaging_angle: byPhone.classification_data?.messaging_angle,
          enrichment: byPhone.enrichment_data,
          rating: byPhone.rating,
          review_count: byPhone.review_count,
        };
      }

      // Try WhatsApp number in enrichment data
      const { data: byWa } = await db
        .from('mandala_hunter_prospects')
        .select('business_name, address, phone, rating, review_count, website, types, pain_type, pain_score, classification_data, enrichment_data')
        .eq('tenant_id', tenantId)
        .filter('enrichment_data->>whatsapp_number', 'eq', number)
        .limit(1)
        .single();

      if (byWa) {
        return {
          source: 'hunter_wa' as const,
          business_name: byWa.business_name,
          business_type: (byWa.types || [])[0],
          pain_type: byWa.pain_type,
          pain_score: byWa.pain_score,
          pain_points: byWa.classification_data?.blind_spots || [],
          messaging_angle: byWa.classification_data?.messaging_angle,
          enrichment: byWa.enrichment_data,
          rating: byWa.rating,
          review_count: byWa.review_count,
        };
      }
    } catch (err) {
      console.error('[target-intel] Hunter lookup error:', err);
    }

    return null;
  }

  /**
   * Check existing conversation memory from previous interactions.
   */
  private async checkConversationMemory(
    number: string,
    tenantId: string
  ): Promise<MemoryMatch | null> {
    try {
      const db = getSupabase();
      const { data } = await db
        .from('mandala_customer_memory')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('customer_number', number)
        .limit(1)
        .single();

      if (data) {
        return {
          business_name: data.business_name,
          business_type: data.business_type,
          pain_points: data.pain_points || [],
          communication_style: data.communication_style || 'casual',
          budget_indication: data.budget_indication,
          key_facts: data.key_facts || [],
          negotiation_position: data.negotiation_position,
        };
      }
    } catch (err) {
      console.error('[target-intel] Memory lookup error:', err);
    }

    return null;
  }

  /**
   * Check leads table from CRM.
   */
  private async checkLeadsTable(
    number: string,
    tenantId: string
  ): Promise<LeadMatch | null> {
    try {
      const db = getSupabase();

      // Leads might store phone in various formats
      const variants = [number, '+' + number, '0' + number.substring(2)];
      const { data } = await db
        .from('leads')
        .select('title, body, pain_score, category, source, platform')
        .in('id', variants)
        .limit(1)
        .single();

      if (data) {
        return {
          title: data.title,
          body: data.body,
          pain_score: data.pain_score,
          category: data.category,
          source: data.source,
          platform: data.platform,
        };
      }
    } catch {
      // Leads table might not exist or have different schema
    }

    return null;
  }

  /**
   * Merge all data sources into a unified TargetProfile.
   * Priority: hunter > conversation memory > leads > estimated.
   */
  private mergeProfile(
    hunter: HunterMatch | null,
    memory: MemoryMatch | null,
    lead: LeadMatch | null
  ): TargetProfile {
    // Calculate data completeness
    const dataPoints = [
      hunter?.business_name,
      hunter?.business_type || memory?.business_type,
      hunter?.pain_points?.length || memory?.pain_points?.length,
      hunter?.pain_type,
      memory?.communication_style,
      memory?.budget_indication,
      lead?.category,
    ].filter(Boolean).length;

    const completeness = Math.round((dataPoints / 7) * 100);

    // Determine source
    let source: TargetProfile['source'] = 'estimated';
    if (hunter) source = 'hunter_data';
    else if (memory) source = 'conversation_memory';

    // Merge pain points from all sources
    const painPoints: string[] = [];
    if (hunter?.pain_points) painPoints.push(...hunter.pain_points);
    if (memory?.pain_points) {
      for (const p of memory.pain_points) {
        if (!painPoints.includes(p)) painPoints.push(p);
      }
    }

    // Determine communication style
    let commStyle: TargetProfile['communication_style'] = 'unknown';
    if (memory?.communication_style) {
      commStyle = memory.communication_style;
    }

    return {
      source,
      business_name: hunter?.business_name || memory?.business_name,
      business_type: hunter?.business_type || memory?.business_type || lead?.category,
      pain_points: painPoints,
      communication_style: commStyle,
      data_completeness: completeness,
    };
  }
}

// Internal data source types

interface HunterMatch {
  source: 'hunter_phone' | 'hunter_wa';
  business_name?: string;
  business_type?: string;
  pain_type?: string;
  pain_score?: number;
  pain_points: string[];
  messaging_angle?: string;
  enrichment?: Record<string, unknown>;
  rating?: number;
  review_count?: number;
}

interface MemoryMatch {
  business_name?: string;
  business_type?: string;
  pain_points: string[];
  communication_style: 'formal' | 'casual' | 'mixed';
  budget_indication?: string;
  key_facts: string[];
  negotiation_position?: string;
}

interface LeadMatch {
  title?: string;
  body?: string;
  pain_score?: number;
  category?: string;
  source?: string;
  platform?: string;
}
