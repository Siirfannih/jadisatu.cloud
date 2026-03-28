import { getModel } from '../ai/gemini-client.js';
import { getSupabase } from '../memory/supabase-client.js';

/**
 * AI Pain Classifier — Uses Gemini Flash to classify business pain points.
 *
 * Takes enriched business data and classifies:
 * - Type of pain (Kebocoran Respon, Inventaris, Informasi, Digital, Reputasi)
 * - Pain score (0-100)
 * - Decision (SKIP, LOW_PRIORITY, HIGH_PRIORITY, CONTACT_NOW)
 * - Personalized messaging angle
 */

export type PainType =
  | 'kebocoran_respon'    // Losing customers due to slow/no response
  | 'inventaris'          // Inventory/stock management issues
  | 'informasi'           // Customers can't find info (hours, menu, prices)
  | 'digital'             // Poor digital presence (no website, bad SEO)
  | 'reputasi'            // Bad reviews, reputation management needed
  | 'operasional'         // Operational inefficiency
  | 'multiple';           // Multiple pain points

export type HunterDecision = 'skip' | 'low_priority' | 'high_priority' | 'contact_now';

export interface DataCompleteness {
  available_fields: string[];
  missing_fields: string[];
  completeness_pct: number;
  is_sufficient: boolean;
}

export interface ClassificationResult {
  pain_type: PainType;
  pain_score: number;
  decision: HunterDecision;
  reasoning: string;
  messaging_angle: string;
  blind_spots: string[];
  data_completeness: DataCompleteness;
}

export class PainClassifier {
  private static instance: PainClassifier;

  static getInstance(): PainClassifier {
    if (!PainClassifier.instance) {
      PainClassifier.instance = new PainClassifier();
    }
    return PainClassifier.instance;
  }

  async classify(prospectId: string, classifierModel: string): Promise<ClassificationResult | null> {
    const db = getSupabase();
    const { data: prospect } = await db
      .from('mandala_hunter_prospects')
      .select('*')
      .eq('id', prospectId)
      .single();

    if (!prospect) return null;

    console.log(`[classifier] Classifying: ${prospect.business_name}`);

    const enrichment = prospect.enrichment_data || {};
    const reviews = prospect.reviews || [];

    // Assess data completeness before classification
    const completeness = this.assessDataCompleteness(prospect, enrichment, reviews);
    console.log(`[classifier] Data completeness for ${prospect.business_name}: ${completeness.completeness_pct}% (${completeness.available_fields.length}/${completeness.available_fields.length + completeness.missing_fields.length} fields)`);

    // Build context for AI classification
    const businessContext = this.buildContext(prospect, enrichment, reviews);

    try {
      const model = getModel(classifierModel, {
        temperature: 0,
        maxOutputTokens: 512,
      });

      const result = await model.generateContent({
        systemInstruction: `Kamu adalah business analyst. Analisa data bisnis berikut dan identifikasi pain points. Output JSON ONLY.`,
        contents: [{
          role: 'user',
          parts: [{
            text: `${businessContext}

Klasifikasi bisnis ini. Output JSON:
{
  "pain_type": "kebocoran_respon|inventaris|informasi|digital|reputasi|operasional|multiple",
  "pain_score": 0-100,
  "decision": "skip|low_priority|high_priority|contact_now",
  "reasoning": "brief explanation why",
  "messaging_angle": "bagaimana cara approach bisnis ini — sebutkan strength mereka dulu baru blind spot",
  "blind_spots": ["list of specific blind spots/opportunities we can help with"]
}

Decision guide:
- skip: tidak relevan / sudah sangat bagus / bukan target market
- low_priority: ada potensi tapi kecil
- high_priority: pain score 50-79, clear opportunity
- contact_now: pain score 80+, urgent need, high probability of conversion`,
          }],
        }],
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const classification: ClassificationResult = {
          pain_type: parsed.pain_type || 'digital',
          pain_score: Math.min(100, Math.max(0, parsed.pain_score || 0)),
          decision: parsed.decision || 'low_priority',
          reasoning: parsed.reasoning || '',
          messaging_angle: parsed.messaging_angle || '',
          blind_spots: parsed.blind_spots || [],
          data_completeness: completeness,
        };

        // Update prospect in DB
        await db
          .from('mandala_hunter_prospects')
          .update({
            status: 'qualified',
            pain_type: classification.pain_type,
            pain_score: classification.pain_score,
            decision: classification.decision,
            classification_data: classification,
          })
          .eq('id', prospectId);

        console.log(`[classifier] ${prospect.business_name}: ${classification.pain_type} (score=${classification.pain_score}, decision=${classification.decision})`);
        return classification;
      }
    } catch (err) {
      console.error('[classifier] Error:', err);
    }

    return null;
  }

  /**
   * Assess data completeness before classification to prevent hallucination.
   * Tracks which fields are available vs missing so AI doesn't fabricate data.
   */
  private assessDataCompleteness(prospect: any, enrichment: any, reviews: any[]): DataCompleteness {
    const available: string[] = [];
    const missing: string[] = [];

    // Core business fields
    if (prospect.business_name) available.push('business_name'); else missing.push('business_name');
    if (prospect.address) available.push('address'); else missing.push('address');
    if (prospect.phone) available.push('phone'); else missing.push('phone');
    if (prospect.website) available.push('website'); else missing.push('website');
    if (prospect.rating != null) available.push('rating'); else missing.push('rating');
    if (prospect.review_count) available.push('review_count'); else missing.push('review_count');
    if (prospect.types?.length > 0) available.push('business_types'); else missing.push('business_types');

    // Enrichment fields
    if (enrichment.has_website !== undefined) available.push('website_check'); else missing.push('website_check');
    if (enrichment.has_whatsapp !== undefined) available.push('whatsapp_check'); else missing.push('whatsapp_check');
    if (enrichment.digital_presence_score !== undefined) available.push('digital_score'); else missing.push('digital_score');
    if (enrichment.has_instagram) available.push('instagram'); else missing.push('instagram');
    if (enrichment.social_media?.length > 0) available.push('social_media'); else missing.push('social_media');
    if (enrichment.review_analysis) available.push('review_analysis'); else missing.push('review_analysis');

    // Reviews
    if (reviews.length > 0) available.push('reviews'); else missing.push('reviews');

    const total = available.length + missing.length;
    const completeness_pct = total > 0 ? Math.round((available.length / total) * 100) : 0;

    return {
      available_fields: available,
      missing_fields: missing,
      completeness_pct,
      is_sufficient: completeness_pct >= 30 && available.includes('business_name'),
    };
  }

  private buildContext(prospect: any, enrichment: any, reviews: any[]): string {
    const parts = [
      `Business: ${prospect.business_name}`,
      `Address: ${prospect.address}`,
      `Type: ${(prospect.types || []).join(', ')}`,
      `Rating: ${prospect.rating || 'N/A'} (${prospect.review_count || 0} reviews)`,
      `Phone: ${prospect.phone || 'none'}`,
      `Website: ${prospect.website || 'none'}`,
    ];

    if (enrichment.has_website !== undefined) {
      parts.push(`Has working website: ${enrichment.has_website ? 'yes' : 'no'}`);
    }
    if (enrichment.has_whatsapp !== undefined) {
      parts.push(`WhatsApp detected: ${enrichment.has_whatsapp ? 'yes' : 'no'}`);
    }
    if (enrichment.digital_presence_score !== undefined) {
      parts.push(`Digital presence score: ${enrichment.digital_presence_score}/100`);
    }

    if (enrichment.review_analysis) {
      const ra = enrichment.review_analysis;
      parts.push(`\nReview Analysis:`);
      if (ra.positive_themes?.length > 0) {
        parts.push(`  Strengths: ${ra.positive_themes.join(', ')}`);
      }
      if (ra.negative_themes?.length > 0) {
        parts.push(`  Weaknesses: ${ra.negative_themes.join(', ')}`);
      }
      if (ra.common_complaints?.length > 0) {
        parts.push(`  Top complaints: ${ra.common_complaints.join('; ')}`);
      }
      if (ra.common_praises?.length > 0) {
        parts.push(`  Top praises: ${ra.common_praises.join('; ')}`);
      }
    }

    // Include sample reviews (max 5)
    if (reviews.length > 0) {
      parts.push(`\nSample reviews:`);
      reviews.slice(0, 5).forEach((r: any) => {
        parts.push(`  [${r.rating}★] ${(r.text || '').substring(0, 150)}`);
      });
    }

    return parts.join('\n');
  }
}
