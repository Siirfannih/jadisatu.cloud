/**
 * Semantic Store — Pinecone read/write for all memory layers.
 *
 * Handles:
 * - Storing memories (embed + upsert to Pinecone)
 * - Recalling relevant memories (query by similarity)
 * - Multi-tenant isolation via namespaces
 * - Customer-level filtering via metadata
 */
import { getTenantNamespace, getBaseSkillsNamespace, type MemoryType, type VectorMetadata } from './pinecone-client.js';
import { embed } from './embedding.js';
import crypto from 'crypto';

export interface MemoryRecord {
  id: string;
  content: string;
  type: MemoryType;
  score: number;
  metadata: VectorMetadata;
}

export class SemanticStore {
  private static instance: SemanticStore;

  static getInstance(): SemanticStore {
    if (!SemanticStore.instance) {
      SemanticStore.instance = new SemanticStore();
    }
    return SemanticStore.instance;
  }

  /**
   * Store a memory in the tenant's namespace.
   */
  async store(
    tenantId: string,
    content: string,
    type: MemoryType,
    metadata?: Partial<VectorMetadata>
  ): Promise<string> {
    const id = crypto.randomUUID();
    const vector = await embed(content);

    const fullMetadata: VectorMetadata = {
      type,
      tenant_id: tenantId,
      content: content.substring(0, 1000), // Store truncated text in metadata
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    const ns = getTenantNamespace(tenantId);
    await ns.upsert([{
      id,
      values: vector,
      metadata: fullMetadata as Record<string, string>,
    }]);

    return id;
  }

  /**
   * Store a base skill (shared across all tenants).
   */
  async storeBaseSkill(content: string, source?: string): Promise<string> {
    const id = crypto.randomUUID();
    const vector = await embed(content);

    const metadata: VectorMetadata = {
      type: 'base-skill',
      tenant_id: 'shared',
      content: content.substring(0, 1000),
      timestamp: new Date().toISOString(),
      source,
    };

    const ns = getBaseSkillsNamespace();
    await ns.upsert([{
      id,
      values: vector,
      metadata: metadata as Record<string, string>,
    }]);

    return id;
  }

  /**
   * Recall relevant memories for a query from a tenant's namespace.
   * Optionally filter by memory type and/or customer.
   */
  async recall(
    tenantId: string,
    query: string,
    options?: {
      type?: MemoryType;
      customerNumber?: string;
      topK?: number;
      minScore?: number;
    }
  ): Promise<MemoryRecord[]> {
    const { type, customerNumber, topK = 5, minScore = 0.3 } = options || {};

    const queryVector = await embed(query);

    // Build metadata filter
    const filter: Record<string, unknown> = {};
    if (type) filter.type = { $eq: type };
    if (customerNumber) filter.customer_number = { $eq: customerNumber };

    const ns = getTenantNamespace(tenantId);
    const results = await ns.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    return (results.matches || [])
      .filter(m => (m.score ?? 0) >= minScore)
      .map(m => ({
        id: m.id,
        content: (m.metadata as unknown as VectorMetadata)?.content || '',
        type: (m.metadata as unknown as VectorMetadata)?.type || 'semantic',
        score: m.score ?? 0,
        metadata: m.metadata as unknown as VectorMetadata,
      }));
  }

  /**
   * Recall from base skills namespace (shared knowledge).
   */
  async recallBaseSkills(query: string, topK = 3): Promise<MemoryRecord[]> {
    const queryVector = await embed(query);

    const ns = getBaseSkillsNamespace();
    const results = await ns.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
    });

    return (results.matches || [])
      .filter(m => (m.score ?? 0) >= 0.3)
      .map(m => ({
        id: m.id,
        content: (m.metadata as unknown as VectorMetadata)?.content || '',
        type: 'base-skill' as MemoryType,
        score: m.score ?? 0,
        metadata: m.metadata as unknown as VectorMetadata,
      }));
  }

  /**
   * Combined recall: query tenant memory + base skills in parallel.
   * Returns results grouped by type.
   */
  async recallAll(
    tenantId: string,
    query: string,
    customerNumber?: string
  ): Promise<{
    episodic: MemoryRecord[];
    semantic: MemoryRecord[];
    procedural: MemoryRecord[];
    baseSkills: MemoryRecord[];
  }> {
    const [episodic, semantic, procedural, baseSkills] = await Promise.all([
      this.recall(tenantId, query, { type: 'episodic', customerNumber, topK: 3 }),
      this.recall(tenantId, query, { type: 'semantic', topK: 3 }),
      this.recall(tenantId, query, { type: 'procedural', topK: 2 }),
      this.recallBaseSkills(query, 2),
    ]);

    return { episodic, semantic, procedural, baseSkills };
  }

  /**
   * Delete a specific memory vector by ID.
   */
  async delete(tenantId: string, vectorId: string): Promise<void> {
    const ns = getTenantNamespace(tenantId);
    await ns.deleteOne(vectorId);
  }
}
