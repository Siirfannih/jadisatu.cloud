import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { TenantConfig } from '../types/shared.js';

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

  async loadAll(): Promise<void> {
    try {
      const files = await readdir(TENANTS_DIR);
      const ymlFiles = files.filter((f) => f.endsWith('.yml') && !f.startsWith('_'));

      for (const file of ymlFiles) {
        try {
          const content = await readFile(join(TENANTS_DIR, file), 'utf-8');
          const config = yaml.load(content) as TenantConfig;

          if (config.id && config.active) {
            this.tenants.set(config.id, config);
            console.log(`  [tenant] Loaded: ${config.id} (${config.name})`);
          }
        } catch (err) {
          console.error(`  [tenant] Error loading ${file}:`, err);
        }
      }
    } catch (err) {
      console.error('[tenant] Error reading tenants directory:', err);
    }
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
