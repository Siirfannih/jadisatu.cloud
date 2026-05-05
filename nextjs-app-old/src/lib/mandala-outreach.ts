/**
 * Mandala Outreach Bridge — shared types and helpers
 *
 * Bridges CRM contacts, leads, and hunter prospects into
 * executable Mandala work items via the outreach queue.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type OutreachSourceType = 'lead' | 'hunter_prospect' | 'crm_contact' | 'manual'

export type OutreachCommand =
  | 'contact_new_lead'
  | 'follow_up_dormant'
  | 'rescue_cold'
  | 'outreach_hunter'
  | 'custom'

export type OutreachPriority = 'urgent' | 'high' | 'medium' | 'low'

export type OutreachStatus =
  | 'queued'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type OutreachAssignee = 'mandala' | 'owner' | 'unassigned'

// ---------------------------------------------------------------------------
// Core model
// ---------------------------------------------------------------------------

export interface OutreachQueueItem {
  id: string
  source_type: OutreachSourceType
  source_id: string
  source_snapshot: Record<string, unknown>
  target_name: string
  target_contact: string | null
  target_platform: string | null
  target_category: string | null
  command: OutreachCommand
  command_context: Record<string, unknown>
  priority: OutreachPriority
  status: OutreachStatus
  assigned_to: OutreachAssignee
  conversation_id: string | null
  result_summary: string | null
  result_data: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
  scheduled_for: string | null
  completed_at: string | null
}

// ---------------------------------------------------------------------------
// API request shapes
// ---------------------------------------------------------------------------

/** POST /api/mandala/outreach — create a new outreach command */
export interface CreateOutreachRequest {
  source_type: OutreachSourceType
  source_id: string
  target_name: string
  target_contact?: string
  target_platform?: string
  target_category?: string
  command: OutreachCommand
  command_context?: Record<string, unknown>
  priority?: OutreachPriority
  assigned_to?: OutreachAssignee
  scheduled_for?: string
}

/** PATCH /api/mandala/outreach — update status of queue item */
export interface UpdateOutreachRequest {
  id: string
  status?: OutreachStatus
  assigned_to?: OutreachAssignee
  result_summary?: string
}

// ---------------------------------------------------------------------------
// Helpers: map source entities → outreach requests
// ---------------------------------------------------------------------------

/** Map a CRM/leads contact into an outreach request */
export function leadToOutreach(lead: {
  id: string
  title: string
  body?: string
  platform?: string
  category?: string
  pain_score?: number
  status?: string
}): CreateOutreachRequest {
  const isDormant = lead.status === 'lead' || lead.status === 'new'
  return {
    source_type: 'lead',
    source_id: lead.id,
    target_name: lead.title,
    target_contact: lead.body || undefined,
    target_platform: lead.platform || undefined,
    target_category: lead.category || undefined,
    command: isDormant ? 'contact_new_lead' : 'follow_up_dormant',
    command_context: {
      pain_score: lead.pain_score,
      current_status: lead.status,
    },
    priority: (lead.pain_score ?? 0) >= 80 ? 'high' : 'medium',
  }
}

/** Map a hunter prospect into an outreach request */
export function prospectToOutreach(prospect: {
  id: string
  business_name: string
  phone?: string
  website?: string
  pain_type?: string
  pain_score?: number
  decision?: string
  address?: string
}): CreateOutreachRequest {
  const priority: OutreachPriority =
    prospect.decision === 'contact_now' ? 'urgent' :
    prospect.decision === 'high_priority' ? 'high' : 'medium'

  return {
    source_type: 'hunter_prospect',
    source_id: prospect.id,
    target_name: prospect.business_name,
    target_contact: prospect.phone || undefined,
    target_platform: prospect.phone ? 'whatsapp' : undefined,
    target_category: prospect.pain_type?.replace(/_/g, ' ') || undefined,
    command: 'outreach_hunter',
    command_context: {
      pain_type: prospect.pain_type,
      pain_score: prospect.pain_score,
      decision: prospect.decision,
      address: prospect.address,
    },
    priority,
  }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const COMMAND_LABELS: Record<OutreachCommand, string> = {
  contact_new_lead: 'Contact Lead',
  follow_up_dormant: 'Follow Up',
  rescue_cold: 'Rescue Cold',
  outreach_hunter: 'Hunter Outreach',
  custom: 'Custom',
}

export const STATUS_CONFIG: Record<OutreachStatus, { label: string; bg: string; text: string }> = {
  queued: { label: 'Queued', bg: 'bg-slate-100', text: 'text-slate-600' },
  assigned: { label: 'Assigned', bg: 'bg-blue-100', text: 'text-blue-600' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-100', text: 'text-amber-600' },
  completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-600' },
  failed: { label: 'Failed', bg: 'bg-red-100', text: 'text-red-600' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-500' },
}

export const PRIORITY_CONFIG: Record<OutreachPriority, { label: string; bg: string; text: string }> = {
  urgent: { label: 'Urgent', bg: 'bg-red-100', text: 'text-red-700' },
  high: { label: 'High', bg: 'bg-orange-100', text: 'text-orange-700' },
  medium: { label: 'Medium', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  low: { label: 'Low', bg: 'bg-slate-100', text: 'text-slate-600' },
}

export const SOURCE_LABELS: Record<OutreachSourceType, string> = {
  lead: 'Lead',
  hunter_prospect: 'Hunter',
  crm_contact: 'CRM',
  manual: 'Manual',
}
