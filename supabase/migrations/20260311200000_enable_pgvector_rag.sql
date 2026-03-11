-- Enable pgvector extension for RAG (Retrieval-Augmented Generation)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to contents table
-- Using 768 dimensions (Gemini text-embedding-004)
-- Supabase pgvector limits HNSW/IVFFlat indexes to 2000 dims
-- For multimodal (gemini-embedding-2-preview, 3072d), use separate column later
ALTER TABLE contents ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add embedding column to ideas table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ideas' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE ideas ADD COLUMN IF NOT EXISTS embedding vector(768)';
  END IF;
END $$;

-- Add embedding column to notes table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notes' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE notes ADD COLUMN IF NOT EXISTS embedding vector(768)';
  END IF;
END $$;

-- Add embedded_at timestamp to track when content was last embedded
ALTER TABLE contents ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

-- Create HNSW index for fast cosine similarity search (768 dims fits within 2000 limit)
CREATE INDEX IF NOT EXISTS idx_contents_embedding ON contents
  USING hnsw (embedding vector_cosine_ops);

-- Create a function for similarity search on contents
CREATE OR REPLACE FUNCTION match_contents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  script text,
  caption text,
  platform text,
  status text,
  hook_text text,
  value_text text,
  cta_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.script,
    c.caption,
    c.platform,
    c.status,
    c.hook_text,
    c.value_text,
    c.cta_text,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM contents c
  WHERE
    c.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR c.user_id = filter_user_id)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RPC for similarity search on ideas (if table exists)
CREATE OR REPLACE FUNCTION match_ideas(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ideas' AND column_name = 'embedding' AND table_schema = 'public'
  ) THEN
    RETURN QUERY EXECUTE
      'SELECT i.id, i.title, i.description, 1 - (i.embedding <=> $1) AS similarity
       FROM ideas i
       WHERE i.embedding IS NOT NULL
         AND ($2 IS NULL OR i.user_id = $2)
         AND 1 - (i.embedding <=> $1) > $3
       ORDER BY i.embedding <=> $1
       LIMIT $4'
    USING query_embedding, filter_user_id, match_threshold, match_count;
  END IF;
END;
$$;
