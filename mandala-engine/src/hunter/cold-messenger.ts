import { getModel } from '../ai/gemini-client.js';
import { getSupabase } from '../memory/supabase-client.js';
import { BaileysProvider } from '../channels/baileys-provider.js';

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

    // Send via WhatsApp
    const targetNumber = prospect.enrichment_data?.whatsapp_number || prospect.phone;
    const sent = await this.wa.send(targetNumber, message);

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

      const result = await gemini.generateContent({
        systemInstruction: `Kamu adalah sales profesional yang ramah dan natural. Buat pesan WhatsApp pertama ke pemilik bisnis.

ATURAN:
- Bahasa Indonesia casual tapi sopan (seperti chat WA normal)
- PENDEK — max 3-4 kalimat
- Jangan langsung jualan
- Format: puji hal positif → sebutkan 1 blind spot spesifik → tawarkan free audit 15 menit
- Jangan pakai template/template-like language
- Natural seperti orang betulan yang baru menemukan bisnis ini`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Bisnis: ${prospect.business_name}
Lokasi: ${prospect.address}
Rating: ${prospect.rating || 'N/A'} (${prospect.review_count || 0} reviews)
Website: ${prospect.website ? 'ada' : 'tidak ada'}

Pain type: ${classification.pain_type}
Messaging angle: ${classification.messaging_angle}
Blind spots: ${(classification.blind_spots || []).join(', ')}

Buat pesan WhatsApp pertama (MAX 4 kalimat, natural):`,
          }],
        }],
      });

      return result.response.text().trim();
    } catch (err) {
      console.error('[cold-messenger] Error generating message:', err);
      return null;
    }
  }

  getDailyCount(): number {
    return this.dailyCount;
  }
}
