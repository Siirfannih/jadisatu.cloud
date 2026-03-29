/**
 * WhatsApp Channel Adapter
 *
 * Supports multiple providers:
 * - baileys (direct — uses BaileysManager for multi-tenant sessions)
 * - openclaw (uses Baileys via OpenClaw gateway)
 * - fonnte (third-party API, risk of WA account restriction)
 * - Meta Cloud API (official, requires business verification)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { BaileysManager } from './baileys-manager.js';
import { isInternalMessage } from './message-guard.js';

const execAsync = promisify(exec);

export class WhatsAppAdapter {
  private static instance: WhatsAppAdapter;
  private provider: 'baileys' | 'openclaw' | 'fonnte' | 'meta_cloud_api';
  private fonteToken: string;
  private metaToken: string;
  private metaPhoneId: string;
  private baileysManager: BaileysManager | null = null;

  private constructor() {
    this.provider = (process.env.WA_PROVIDER as 'baileys' | 'openclaw' | 'fonnte' | 'meta_cloud_api') || 'openclaw';
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

  setBaileysManager(manager: BaileysManager): void {
    this.baileysManager = manager;
  }

  /**
   * Send a message via WhatsApp.
   *
   * Safety: If skipGuard is false (default), messages are checked against
   * the MessageGuard before sending. Internal/operator messages (tagged
   * [MANDALA], [FLAG], A/B/C options, etc.) will be BLOCKED from being
   * sent to customers. Set skipGuard=true ONLY when sending to a known
   * operator/owner number (e.g., flagOwner, reportToOwner).
   */
  async send(to: string, message: string, tenantId = 'mandala', skipGuard = false): Promise<boolean> {
    // Safety guard: block internal messages from reaching customers
    if (!skipGuard) {
      const guard = isInternalMessage(message);
      if (guard.blocked) {
        console.error(
          `[whatsapp] BLOCKED internal message to ${to}: ${guard.reason}\n` +
          `  Content preview: "${message.substring(0, 120)}..."\n` +
          `  This message should be sent to the operator, not the customer.`
        );
        return false;
      }
    }

    if (this.provider === 'baileys') {
      return this.sendViaBaileys(to, message, tenantId);
    }
    if (this.provider === 'openclaw') {
      return this.sendViaOpenClaw(to, message);
    }
    if (this.provider === 'fonnte') {
      return this.sendViaFonnte(to, message);
    }
    return this.sendViaMeta(to, message);
  }

  /**
   * Mark messages from a contact as read (send read receipt).
   * Supports delayed read to simulate natural "not staring at phone" behavior.
   */
  async markAsRead(contactNumber: string): Promise<boolean> {
    if (this.provider === 'baileys' || this.provider === 'openclaw') {
      if (this.provider === 'baileys') return true; // Baileys handles read receipts in session
      return this.markAsReadViaOpenClaw(contactNumber);
    }
    // Fonnte and Meta don't have a straightforward markAsRead in this adapter;
    // silently succeed — the read receipt will happen implicitly on send.
    return true;
  }

  private async sendViaBaileys(to: string, message: string, tenantId: string): Promise<boolean> {
    if (!this.baileysManager) {
      console.error('[whatsapp/baileys] BaileysManager not set — call setBaileysManager() first');
      console.log(`[whatsapp/dry] → ${to}: ${message}`);
      return false;
    }
    return this.baileysManager.send(tenantId, to, message);
  }

  private async markAsReadViaOpenClaw(contactNumber: string): Promise<boolean> {
    try {
      const jid = contactNumber.includes('@') ? contactNumber : `${contactNumber}@s.whatsapp.net`;
      const cmd = `openclaw message read --channel whatsapp --target '${jid}'`;
      await execAsync(cmd, { timeout: 10000 });
      return true;
    } catch (err: any) {
      // Non-critical — if read receipt fails, continue with send
      console.warn(`[whatsapp/openclaw] markAsRead failed (non-critical):`, err.message || err);
      return true;
    }
  }

  private async sendViaOpenClaw(to: string, message: string): Promise<boolean> {
    try {
      // Format: openclaw message send --channel whatsapp --target <JID> --message <text>
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      const escaped = message.replace(/'/g, "'\\''");
      const cmd = `openclaw message send --channel whatsapp --target '${jid}' --message '${escaped}'`;

      const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
      if (stderr && !stderr.includes('Sent via gateway')) {
        console.error(`[whatsapp/openclaw] stderr:`, stderr);
      }
      console.log(`[whatsapp/openclaw] Sent to ${to}`);
      return true;
    } catch (err: any) {
      console.error(`[whatsapp/openclaw] Error:`, err.message || err);
      return false;
    }
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
