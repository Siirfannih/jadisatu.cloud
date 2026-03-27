-- Mandala WhatsApp Sessions — Per-tenant Baileys connection tracking
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS mandala_wa_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'disconnected'
                    CHECK (status IN ('disconnected','qr_pending','connecting','connected','logged_out')),
  qr_code         text,
  phone_number    text,
  connected_at    timestamptz,
  disconnected_at timestamptz,
  last_qr_at      timestamptz,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mws_tenant ON mandala_wa_sessions(tenant_id);

ALTER TABLE mandala_wa_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access_mws" ON mandala_wa_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_mws" ON mandala_wa_sessions
  FOR SELECT TO authenticated USING (true);
