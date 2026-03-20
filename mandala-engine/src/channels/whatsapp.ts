/**
 * WhatsApp Channel Adapter
 *
 * Supports multiple providers:
 * - Fonnte (default for MVP)
 * - Meta Cloud API (for scaling)
 */

export class WhatsAppAdapter {
  private static instance: WhatsAppAdapter;
  private provider: 'fonnte' | 'meta_cloud_api';
  private fonteToken: string;
  private metaToken: string;
  private metaPhoneId: string;

  private constructor() {
    this.provider = (process.env.WA_PROVIDER as 'fonnte' | 'meta_cloud_api') || 'fonnte';
    this.fonteToken = process.env.FONNTE_TOKEN || '';
    this.metaToken = process.env.META_WA_TOKEN || '';
    this.metaPhoneId = process.env.META_PHONE_ID || '';
  }

  static getInstance(): WhatsAppAdapter {
    if (!WhatsAppAdapter.instance) {
      WhatsAppAdapter.instance = new WhatsAppAdapter();
    }
    return WhatsAppAdapter.instance;
  }

  async send(to: string, message: string): Promise<boolean> {
    if (this.provider === 'fonnte') {
      return this.sendViaFonnte(to, message);
    }
    return this.sendViaMeta(to, message);
  }

  private async sendViaFonnte(to: string, message: string): Promise<boolean> {
    if (!this.fonteToken) {
      console.warn('[whatsapp] Fonnte token not configured, message not sent');
      console.log(`[whatsapp/dry] → ${to}: ${message}`);
      return false;
    }

    try {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': this.fonteToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: to,
          message: message,
          countryCode: '62',
        }),
      });

      const result: any = await response.json();
      if (result.status) {
        console.log(`[whatsapp/fonnte] Sent to ${to}`);
        return true;
      } else {
        console.error(`[whatsapp/fonnte] Failed:`, result);
        return false;
      }
    } catch (err) {
      console.error(`[whatsapp/fonnte] Error:`, err);
      return false;
    }
  }

  private async sendViaMeta(to: string, message: string): Promise<boolean> {
    if (!this.metaToken || !this.metaPhoneId) {
      console.warn('[whatsapp] Meta Cloud API not configured');
      console.log(`[whatsapp/dry] → ${to}: ${message}`);
      return false;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${this.metaPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.metaToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: { body: message },
          }),
        }
      );

      const result: any = await response.json();
      if (result.messages?.[0]?.id) {
        console.log(`[whatsapp/meta] Sent to ${to}`);
        return true;
      } else {
        console.error(`[whatsapp/meta] Failed:`, result);
        return false;
      }
    } catch (err) {
      console.error(`[whatsapp/meta] Error:`, err);
      return false;
    }
  }
}
