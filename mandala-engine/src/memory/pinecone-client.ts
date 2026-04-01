/**
 * Pinecone Client — Singleton for vector memory operations.
 *
 * Index: mandala-memory (dimension: 768 for Gemini text-embedding-004)
 * Namespaces:
 *   - "base-skills" — shared knowledge, read-only for all tenants
 *   - "tenant-{id}" — per-tenant memory (episodic, semantic, procedural)
 */
import { Pinecone, type Index } from '@pinecone-database/pinecone';

let pineconeInstance: Pinecone | null = null;
let indexInstance: Index | null = null;

const DEFAULT_INDEX = 'mandala-memory';

export function getPinecone(): Pinecone {
  if (!pineconeInstance) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('[pinecone] Missing PINECONE_API_KEY environment variable');
    }
    pineconeInstance = new Pinecone({ apiKey });
  }
  return pineconeInstance;
}

export function getIndex(): Index {
  if (!indexInstance) {
    const pc = getPinecone();
    const indexName = process.env.PINECONE_INDEX || DEFAULT_INDEX;
    indexInstance = pc.index(indexName);
  }
  return indexInstance;
}

/**
 * Get a namespaced index for a specific tenant.
 * All tenant data is isolated by namespace.
 */
export function getTenantNamespace(tenantId: string) {
  return getIndex().namespace(`tenant-${tenantId}`);
}

/**
 * Get the shared base-skills namespace.
 */
export function getBaseSkillsNamespace() {
  return getIndex().namespace('base-skills');
}

/**
 * Memory types stored in Pinecone metadata.
 */
export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'base-skill';

/**
 * Standard metadata attached to every Pinecone vector.
 */
export interface VectorMetadata {
  type: MemoryType;
  tenant_id: string;
  customer_number?: string;
  content: string;
  episode_type?: string;
  conversation_id?: string;
  timestamp: string;
  source?: string;
}
