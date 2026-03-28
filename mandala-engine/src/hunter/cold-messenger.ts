import { getModel } from '../ai/gemini-client.js';
import { getSupabase } from '../memory/supabase-client.js';
import { BaileysProvider } from '../channels/baileys-provider.js';
import { naturalDelay } from '../task/executor.js';

/**
 * Cold Messenger — Sends personalized first messages to qualified prospects.
 *
 * Format: Acknowledge strength → Identify specific blind spot → Offer free audit.
 * Rate limited: max 10/day to avoid WhatsApp ban.
 */

export class ColdMessenger {
  private static instance: ColdMessenger;
  private wa = BaileysProvider.getInstance();
  private dailyCount = 0;
  private lastResetDate = '';

  static getInstance(): ColdMessenger {
    if (!ColdMessenger.instance) {
      ColdMessenger.instance = new ColdMessenger();
    }
    return ColdMessenger.instance;
  }

  /**
   * Send cold message to a qualified prospect.
   */
  async sendColdMessage(
    prospectId: string,
    conversationModel: string,
    maxDaily = 10
  ): Promise<boolean> {
    // Rate limit check
    const today = new Date().toISOString().split('T')[0];
    if (this.lastResetDate !== today) {
      this.dailyCount = 0;
      this.lastResetDate = today;
    }

    if (this.dailyCount >= maxDaily) {
      console.log(`[cold-messenger] Daily limit reached (${maxDaily}). Skipping.`);
      return false;
    }

    const db = getSupabase();
    const { data: prospect } = await db
      .from('mandala_hunter_prospects')
      .select('*')
      .eq('id', prospectId)
      .single();

    if (!prospect) return false;
    if (!prospect.phone && !prospect.enrichment_data?.whatsapp_number) {
      console.log(`[cold-messenger] No phone for ${prospect.business_name}. Skipping.`);
      return false;
    }

    const classification = prospect.classification_data;
    if (!classification) {
      console.log(`[cold-messenger] Not classified yet: ${prospect.business_name}. Skipping.`);
      return false;
    }

    // Generate personalized message
    const message = await this.generateMessage(prospect, classification, conversationModel);
    if (!message) return false;

    // Issue 4: Pre-send delay — randomized 5-30 seconds between contacts (anti-ban)
    const preSendMs = naturalDelay(5, 30);
    console.log(`[cold-messenger] Pre-send delay: ${(preSendMs / 1000).toFixed(1)}s`);
    await this.sleep(preSendMs);

    // Send via WhatsApp
    const targetNumber = prospect.enrichment_data?.whatsapp_number || prospect.phone;

    // If message has multiple parts (split by |||), send with natural delays
    const messageParts = message.split('|||').map((p: string) => p.trim()).filter(Boolean);
    let sent = true;

    for (let i = 0; i < messageParts.length; i++) {
      if (i > 0) {
        // Between message parts: 1.5-4 seconds (varied, not fixed)
        const betweenMs = naturalDelay(1.5, 4);
        await this.sleep(betweenMs);
      }
      const partSent = await this.wa.send(targetNumber, messageParts[i]);
      if (!partSent) {
        sent = false;
        break;
      }
    }

    if (sent) {
      this.dailyCount++;

      // Update prospect status
      await db
        .from('mandala_hunter_prospects')
        .update({
          status: 'contacted',
          cold_message: message,
          contacted_at: new Date().toISOString(),
        })
        .eq('id', prospectId);

      console.log(`[cold-messenger] Sent to ${prospect.business_name} (${targetNumber}) [${this.dailyCount}/${maxDaily} today]`);
    }

    return sent;
  }

  private async generateMessage(
    prospect: any,
    classification: any,
    model: string
  ): Promise<string | null> {
    try {
      const gemini = getModel(model, {
        temperature: 0.7,
        maxOutputTokens: 300,
      });

      // Assess data completeness to prevent hallucination
      const availableFields: string[] = [];
      const missingFields: string[] = [];

      if (prospect.business_name) availableFields.push('business_name');
      else missingFields.push('business_name');
      if (prospect.address) availableFields.push('address');
      else missingFields.push('address');
      if (prospect.rating != null) availableFields.push('rating');
      else missingFields.push('rating');
      if (prospect.review_count) availableFields.push('review_count');
      else missingFields.push('review_count');
      if (prospect.website) availableFields.push('website');
      else missingFields.push('website');
      if (prospect.phone) availableFields.push('phone');
      else missingFields.push('phone');

      const enrichment = prospect.enrichment_data || {};
      if (enrichment.has_instagram) availableFields.push('instagram');
      else missingFields.push('instagram');
      if (enrichment.social_media?.length > 0) availableFields.push('social_media');
      else missingFields.push('social_media');

      const dataCompletenessNote = missingFields.length > 0
        ? `\n\nDATA YANG TIDAK TERSEDIA (jangan sebut/asumsikan): ${missingFields.join(', ')}`
        : '';

      const result = await gemini.generateContent({
        systemInstruction: `Kamu adalah sales profesional yang ramah dan natural. Buat pesan WhatsApp pertama ke pemilik bisnis.

ATURAN:
- Bahasa Indonesia casual tapi sopan (seperti chat WA normal)
- PENDEK — max 3-4 kalimat
- Jangan langsung jualan
- Format: puji hal positif → sebutkan 1 blind spot spesifik → tawarkan free audit 15 menit
- Jangan pakai template/template-like language
- Natural seperti orang betulan yang baru menemukan bisnis ini

ANTI-HALLUCINATION (WAJIB):
- HANYA gunakan fakta dari data yang disediakan
- Jika sebuah field kosong/N/A, JANGAN asumsikan atau karang informasi
- Jangan sebut platform sosial media (IG, TikTok, dll) kecuali data tersebut EKSPLISIT tersedia
- Jangan sebut detail bisnis yang tidak ada di data (produk spesifik, jumlah karyawan, dll)
- Jika data terbatas, fokus pada hal umum yang bisa diamati (lokasi, rating) daripada mengarang detail`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Bisnis: ${prospect.business_name}
Lokasi: ${prospect.address || 'N/A'}
Rating: ${prospect.rating || 'N/A'} (${prospect.review_count || 0} reviews)
Website: ${prospect.website ? 'ada' : 'tidak ada'}

Data yang TERSEDIA: ${availableFields.join(', ')}${dataCompletenessNote}

Pain type: ${classification.pain_type}
Messaging angle: ${classification.messaging_angle}
Blind spots: ${(classification.blind_spots || []).join(', ') || 'tidak teridentifikasi'}

Buat pesan WhatsApp pertama (MAX 4 kalimat, natural). HANYA referensikan data yang tersedia:`,
          }],
        }],
      });

      const generatedMessage = result.response.text().trim();

      // Output validation: cross-check claims against available data
      const validated = this.validateMessage(generatedMessage, prospect, enrichment);
      return validated;
    } catch (err) {
      console.error('[cold-messenger] Error generating message:', err);
      return null;
    }
  }

  /**
   * Validate generated message against actual available data.
   * Strips or flags claims that reference data we don't have.
   */
  private validateMessage(message: string, prospect: any, enrichment: any): string {
    const lowerMessage = message.toLowerCase();

    // Check for social media claims when no social media data exists
    const socialPlatforms = ['instagram', 'ig', 'tiktok', 'facebook', 'fb', 'twitter', 'youtube', 'linkedin'];
    const hasSocialData = enrichment.has_instagram || enrichment.social_media?.length > 0;

    if (!hasSocialData) {
      for (const platform of socialPlatforms) {
        if (lowerMessage.includes(platform)) {
          console.warn(`[cold-messenger] Hallucination detected: message mentions "${platform}" but no social media data exists. Regeneration needed.`);
          return ''; // Return empty to trigger skip — better no message than a hallucinated one
        }
      }
    }

    // Check for website claims when no website exists
    if (!prospect.website && (lowerMessage.includes('website') || lowerMessage.includes('web ') || lowerMessage.includes('situs'))) {
      // Only flag if the message claims they HAVE a website
      if (!lowerMessage.includes('belum punya') && !lowerMessage.includes('tidak ada') && !lowerMessage.includes('belum ada')) {
        console.warn('[cold-messenger] Hallucination detected: message implies website exists but prospect has none.');
        return '';
      }
    }

    return message;
  }

  getDailyCount(): number {
    return this.dailyCount;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
