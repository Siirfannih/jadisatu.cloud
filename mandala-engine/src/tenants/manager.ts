import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { TenantConfig, AIConfig, RoutingConfig, HandoffConfig, ChannelConfig } from '../types/shared.js';
import { getSupabase } from '../memory/supabase-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TENANTS_DIR = join(__dirname, '../../../tenants');

export class TenantManager {
  private static instance: TenantManager;
  private tenants = new Map<string, TenantConfig>();

  static getInstance(): TenantManager {
    if (!TenantManager.instance) {
      TenantManager.instance = new TenantManager();
    }
    return TenantManager.instance;
  }

  /**
   * Load tenants from YAML files and Supabase mandala_tenants table.
   * Supabase tenants take precedence on ID conflict.
   */
  async loadAll(): Promise<void> {
    // Step 1: Load from YAML files
    try {
      const files = await readdir(TENANTS_DIR);
      const ymlFiles = files.filter((f) => f.endsWith('.yml') && !f.startsWith('_'));

      for (const file of ymlFiles) {
        try {
          const content = await readFile(join(TENANTS_DIR, file), 'utf-8');
          const config = yaml.load(content) as TenantConfig;

          if (config.id && config.active) {
            this.tenants.set(config.id, config);
            console.log(`  [tenant] Loaded (YAML): ${config.id} (${config.name})`);
          }
        } catch (err) {
          console.error(`  [tenant] Error loading ${file}:`, err);
        }
      }
    } catch (err) {
      console.error('[tenant] Error reading tenants directory:', err);
    }

    // Step 2: Load from Supabase (takes precedence on conflict)
    try {
      const db = getSupabase();
      const { data, error } = await db
        .from('mandala_tenants')
        .select('*')
        .eq('active', true);

      if (error) {
        // Table might not exist yet — not fatal
        console.warn(`  [tenant] Supabase load skipped: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        for (const row of data) {
          const config = this.dbRowToConfig(row);
          this.tenants.set(config.id, config);
          console.log(`  [tenant] Loaded (DB): ${config.id} (${config.name})`);
        }
      }
    } catch (err) {
      console.warn('[tenant] Supabase tenant load failed (non-fatal):', err);
    }
  }

  /**
   * Convert a Supabase mandala_tenants row into a TenantConfig.
   */
  private dbRowToConfig(row: Record<string, unknown>): TenantConfig {
    const ai = (row.ai_config || {}) as AIConfig;
    const routing = (row.routing_config || { owner_numbers: [], admin_numbers: [], default_mode: 'sales-shadow' }) as RoutingConfig;
    const handoff = (row.handoff_config || {
      auto_takeover_delay_seconds: 120,
      typing_indicator_cancel: true,
      flag_response_timeout_seconds: 300,
      response_delay: { min_seconds: 3, max_seconds: 15, long_delay_chance: 0.15 },
    }) as HandoffConfig;
    const channels = (row.channel_config || []) as ChannelConfig[];

    return {
      id: row.id as string,
      name: row.name as string,
      type: (row.type as 'internal' | 'client') || 'client',
      active: row.active as boolean,
      owner: row.owner_name ? {
        name: row.owner_name as string,
        whatsapp: (row.owner_whatsapp as string) || '',
        timezone: (row.owner_timezone as string) || 'Asia/Makassar',
      } : undefined,
      channels,
      ai: {
        conversation_model: ai.conversation_model || 'gemini-2.5-pro',
        classifier_model: ai.classifier_model || 'gemini-2.0-flash',
        temperature: ai.temperature ?? 0.4,
        max_tokens: ai.max_tokens ?? 8192,
        fallback_model: ai.fallback_model,
      },
      routing,
      handoff,
      knowledge: (row.knowledge_paths as string[]) || [],
    };
  }

  get(id: string): TenantConfig | undefined {
    return this.tenants.get(id);
  }

  getByChannel(channel: string, senderNumber: string): TenantConfig | undefined {
    for (const tenant of this.tenants.values()) {
      // Check if any channel config matches
      for (const ch of tenant.channels) {
        if (ch.type === channel || ch.type === `${channel}_business`) {
          // For the main tenant (mandala), check if sender is owner or it's a customer
          if (tenant.routing?.owner_numbers?.includes(senderNumber)) {
            return tenant;
          }
        }
      }
    }

    // Default: return the first active tenant (mandala)
    return this.tenants.values().next().value;
  }

  count(): number {
    return this.tenants.size;
  }

  list(): TenantConfig[] {
    return Array.from(this.tenants.values());
  }

  // Hot-reload a specific tenant
  async reload(id: string): Promise<boolean> {
    try {
      const files = await readdir(TENANTS_DIR);
      const file = files.find((f) => f === `${id}.yml`);
      if (!file) return false;

      const content = await readFile(join(TENANTS_DIR, file), 'utf-8');
      const config = yaml.load(content) as TenantConfig;
      this.tenants.set(config.id, config);
      return true;
    } catch {
      return false;
    }
  }
}
