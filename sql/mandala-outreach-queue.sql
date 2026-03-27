-- Mandala Outreach Queue
-- Bridges CRM contacts, leads, and hunter prospects into executable Mandala work items.
-- Issue #22: CRM, Leads, Hunter, and Outreach Bridge

-- Outreach queue: unified work items that Mandala can execute
CREATE TABLE IF NOT EXISTS mandala_outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source entity reference
  source_type TEXT NOT NULL CHECK (source_type IN ('lead', 'hunter_prospect', 'crm_contact', 'manual')),
  source_id TEXT NOT NULL,                    -- ID from source table (leads.id or mandala_hunter_prospects.id)
  source_snapshot JSONB DEFAULT '{}',         -- Snapshot of source entity at queue time

  -- Target contact info (denormalized for queue visibility)
  target_name TEXT NOT NULL,
  target_contact TEXT,                        -- Phone, email, or platform handle
  target_platform TEXT,                       -- whatsapp, telegram, email, instagram
  target_category TEXT,                       -- Business category or industry

  -- Outreach command
  command TEXT NOT NULL CHECK (command IN (
    'contact_new_lead',       -- First contact with a CRM/leads lead
    'follow_up_dormant',      -- Re-engage a dormant lead
    'rescue_cold',            -- Rescue a cold/stalled conversation
    'outreach_hunter',        -- Cold outreach to hunter-discovered prospect
    'custom'                  -- Freeform outreach
  )),
  command_context JSONB DEFAULT '{}',         -- Extra context: pain_type, messaging_angle, etc.
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),

  -- Execution state
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued',       -- Waiting to be picked up
    'assigned',     -- Assigned to Mandala or owner
    'in_progress',  -- Outreach started (message sent)
    'completed',    -- Outreach goal met (response received, meeting booked, etc.)
    'failed',       -- Outreach failed (wrong number, blocked, etc.)
    'cancelled'     -- Manually cancelled
  )),
  assigned_to TEXT DEFAULT 'mandala' CHECK (assigned_to IN ('mandala', 'owner', 'unassigned')),
  conversation_id UUID,                       -- Links to mandala_conversations once outreach starts

  -- Result tracking
  result_summary TEXT,                        -- What happened
  result_data JSONB DEFAULT '{}',             -- Structured result (response, next steps)

  -- Metadata
  created_by TEXT NOT NULL DEFAULT 'system',  -- Who queued this: 'system', 'owner', user email
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ,                  -- Optional: schedule outreach for later
  completed_at TIMESTAMPTZ
);

-- Indexes for queue operations
CREATE INDEX IF NOT EXISTS idx_outreach_queue_status ON mandala_outreach_queue(status);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_priority_status ON mandala_outreach_queue(priority, status) WHERE status IN ('queued', 'assigned');
CREATE INDEX IF NOT EXISTS idx_outreach_queue_source ON mandala_outreach_queue(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_created ON mandala_outreach_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_assigned ON mandala_outreach_queue(assigned_to) WHERE status IN ('queued', 'assigned', 'in_progress');

-- RLS
ALTER TABLE mandala_outreach_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role full access on outreach queue"
  ON mandala_outreach_queue FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_outreach_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outreach_queue_updated_at ON mandala_outreach_queue;
CREATE TRIGGER trg_outreach_queue_updated_at
  BEFORE UPDATE ON mandala_outreach_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_outreach_queue_updated_at();
