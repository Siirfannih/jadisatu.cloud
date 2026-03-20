import { getSupabase } from '../memory/supabase-client.js';
import type { PlaceReview } from './google-maps.js';

/**
 * Business Intelligence Enricher.
 *
 * Analyzes business data from Google Maps to build a profile:
 * - Website presence check
 * - WhatsApp detection
 * - Review pattern analysis (ALL reviews, not just bad ones)
 * - Owner response rate & quality
 */

export interface EnrichmentResult {
  has_website: boolean;
  website_mobile_friendly?: boolean;
  has_whatsapp: boolean;
  whatsapp_number?: string;
  review_analysis: {
    avg_rating: number;
    total_reviews: number;
    positive_themes: string[];
    negative_themes: string[];
    common_complaints: string[];
    common_praises: string[];
    owner_response_rate: number;
    owner_response_quality: 'none' | 'generic' | 'personalized';
  };
  digital_presence_score: number; // 0-100
  enriched_at: Date;
}

export class BusinessEnricher {
  private static instance: BusinessEnricher;

  static getInstance(): BusinessEnricher {
    if (!BusinessEnricher.instance) {
      BusinessEnricher.instance = new BusinessEnricher();
    }
    return BusinessEnricher.instance;
  }

  /**
   * Enrich a prospect with business intelligence.
   */
  async enrich(prospectId: string): Promise<EnrichmentResult | null> {
    const db = getSupabase();
    const { data: prospect } = await db
      .from('mandala_hunter_prospects')
      .select('*')
      .eq('id', prospectId)
      .single();

    if (!prospect) return null;

    console.log(`[enricher] Enriching: ${prospect.business_name}`);

    // Analyze website
    const websiteInfo = await this.checkWebsite(prospect.website);

    // Detect WhatsApp
    const waInfo = this.detectWhatsApp(prospect.phone, prospect.website);

    // Analyze all reviews
    const reviewAnalysis = this.analyzeReviews(prospect.reviews || []);

    // Calculate digital presence score
    const digitalScore = this.calculateDigitalScore(websiteInfo, waInfo, reviewAnalysis, prospect);

    const result: EnrichmentResult = {
      has_website: websiteInfo.exists,
      website_mobile_friendly: websiteInfo.mobileFriendly,
      has_whatsapp: waInfo.detected,
      whatsapp_number: waInfo.number,
      review_analysis: reviewAnalysis,
      digital_presence_score: digitalScore,
      enriched_at: new Date(),
    };

    // Update prospect in DB
    await db
      .from('mandala_hunter_prospects')
      .update({
        status: 'enriched',
        enrichment_data: result,
      })
      .eq('id', prospectId);

    console.log(`[enricher] Done: ${prospect.business_name} — digital_score=${digitalScore}`);
    return result;
  }

  private async checkWebsite(url?: string): Promise<{ exists: boolean; mobileFriendly?: boolean }> {
    if (!url) return { exists: false };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      return {
        exists: response.ok,
        mobileFriendly: undefined, // Would need Lighthouse API for real check
      };
    } catch {
      return { exists: false };
    }
  }

  private detectWhatsApp(phone?: string, website?: string): { detected: boolean; number?: string } {
    // If they have a phone, it might be on WhatsApp
    if (phone) {
      // Clean Indonesian phone number
      const cleaned = phone.replace(/[^\d+]/g, '');
      const normalized = cleaned.startsWith('+62') ? cleaned.slice(1)
        : cleaned.startsWith('0') ? '62' + cleaned.slice(1)
        : cleaned.startsWith('62') ? cleaned
        : '62' + cleaned;

      return { detected: true, number: normalized };
    }

    return { detected: false };
  }

  private analyzeReviews(reviews: PlaceReview[]): EnrichmentResult['review_analysis'] {
    if (reviews.length === 0) {
      return {
        avg_rating: 0,
        total_reviews: 0,
        positive_themes: [],
        negative_themes: [],
        common_complaints: [],
        common_praises: [],
        owner_response_rate: 0,
        owner_response_quality: 'none',
      };
    }

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    // Categorize reviews
    const positive = reviews.filter((r) => r.rating >= 4);
    const negative = reviews.filter((r) => r.rating <= 2);
    const neutral = reviews.filter((r) => r.rating === 3);

    // Extract common themes (simple keyword matching)
    const positiveThemes = this.extractThemes(positive.map((r) => r.text), 'positive');
    const negativeThemes = this.extractThemes(negative.map((r) => r.text), 'negative');

    // Extract complaints and praises
    const complaints = this.extractKeyPhrases(negative.map((r) => r.text));
    const praises = this.extractKeyPhrases(positive.map((r) => r.text));

    return {
      avg_rating: Math.round(avgRating * 10) / 10,
      total_reviews: reviews.length,
      positive_themes: positiveThemes,
      negative_themes: negativeThemes,
      common_complaints: complaints.slice(0, 5),
      common_praises: praises.slice(0, 5),
      owner_response_rate: 0, // Google Places API doesn't expose this directly
      owner_response_quality: 'none',
    };
  }

  private extractThemes(texts: string[], type: 'positive' | 'negative'): string[] {
    const themes: Set<string> = new Set();
    const combined = texts.join(' ').toLowerCase();

    // Indonesian business review keywords
    const positiveKeywords: Record<string, string> = {
      'ramah': 'pelayanan_ramah',
      'bersih': 'kebersihan',
      'nyaman': 'kenyamanan',
      'murah': 'harga_terjangkau',
      'enak': 'kualitas_produk',
      'bagus': 'kualitas_baik',
      'cepat': 'pelayanan_cepat',
      'recommended': 'recommended',
      'strategis': 'lokasi_strategis',
      'parkir': 'parkir_mudah',
    };

    const negativeKeywords: Record<string, string> = {
      'lama': 'pelayanan_lambat',
      'mahal': 'harga_mahal',
      'kotor': 'kebersihan_kurang',
      'kecewa': 'kekecewaan',
      'tidak ramah': 'pelayanan_buruk',
      'antri': 'antrian_panjang',
      'bau': 'kebersihan_kurang',
      'rusak': 'fasilitas_rusak',
      'sempit': 'tempat_sempit',
      'panas': 'kurang_nyaman',
    };

    const keywords = type === 'positive' ? positiveKeywords : negativeKeywords;

    for (const [keyword, theme] of Object.entries(keywords)) {
      if (combined.includes(keyword)) {
        themes.add(theme);
      }
    }

    return Array.from(themes);
  }

  private extractKeyPhrases(texts: string[]): string[] {
    // Simple extraction — take first sentence of each review
    return texts
      .filter((t) => t.length > 10)
      .map((t) => {
        const firstSentence = t.split(/[.!?]/)[0].trim();
        return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence;
      })
      .filter(Boolean)
      .slice(0, 5);
  }

  private calculateDigitalScore(
    website: { exists: boolean },
    wa: { detected: boolean },
    reviews: EnrichmentResult['review_analysis'],
    prospect: any
  ): number {
    let score = 0;

    // Website (0-25)
    if (website.exists) score += 25;

    // WhatsApp (0-15)
    if (wa.detected) score += 15;

    // Rating (0-20)
    if (reviews.avg_rating >= 4.5) score += 20;
    else if (reviews.avg_rating >= 4.0) score += 15;
    else if (reviews.avg_rating >= 3.5) score += 10;
    else if (reviews.avg_rating >= 3.0) score += 5;

    // Review count (0-20)
    if (reviews.total_reviews >= 100) score += 20;
    else if (reviews.total_reviews >= 50) score += 15;
    else if (reviews.total_reviews >= 20) score += 10;
    else if (reviews.total_reviews >= 5) score += 5;

    // Google Maps presence (0-10)
    if (prospect.business_hours) score += 5;
    if (prospect.phone) score += 5;

    // Negative adjustment for many complaints
    if (reviews.negative_themes.length >= 3) score -= 10;

    return Math.max(0, Math.min(100, score));
  }
}
