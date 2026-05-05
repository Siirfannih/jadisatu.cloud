export interface MandalaStats {
  conversations: {
    total: number
    active: number
    by_phase: Record<string, number>
    by_handler: Record<string, number>
    conversion_rate: number
  }
  leads: {
    total: number
    avg_score: number
    by_temperature: Record<string, number>
  }
  hunter: {
    total_prospects: number
    contacted: number
    contact_now: number
  }
}

export interface Conversation {
  id: string
  tenant_id: string
  customer_name: string
  customer_number: string
  channel: string
  status: string
  phase: string
  current_handler: string
  owner_active: boolean
  score: number
  updated_at: string
}

export interface Prospect {
  id: string
  business_name: string
  address: string
  phone: string
  website: string
  rating: number
  review_count: number
  status: string
  decision: string
  pain_type: string
  pain_score: number
  maps_url: string
  created_at: string
}

export interface KnowledgeFile {
  name: string
  category: string
  content: string
}

export interface PolicyData {
  rules: string
  identity: string
}

export const PHASES = [
  { key: 'kenalan', label: 'Kenalan', color: 'bg-blue-500', lightBg: 'bg-blue-50', text: 'text-blue-600', range: '0-30' },
  { key: 'gali_masalah', label: 'Gali Masalah', color: 'bg-amber-500', lightBg: 'bg-amber-50', text: 'text-amber-600', range: '31-50' },
  { key: 'tawarkan_solusi', label: 'Tawarkan Solusi', color: 'bg-purple-500', lightBg: 'bg-purple-50', text: 'text-purple-600', range: '51-79' },
  { key: 'closing', label: 'Closing', color: 'bg-green-500', lightBg: 'bg-green-50', text: 'text-green-600', range: '80+' },
  { key: 'rescue', label: 'Rescue', color: 'bg-red-500', lightBg: 'bg-red-50', text: 'text-red-600', range: 'resistance' },
]

export const TEMPERATURE_CONFIG = [
  { key: 'hot', label: 'Sangat Tertarik', range: '70+', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { key: 'warm', label: 'Tertarik', range: '50-69', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { key: 'lukewarm', label: 'Cukup Tertarik', range: '30-49', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { key: 'cold', label: 'Belum Tertarik', range: '0-29', color: 'text-[#0060E1]', bg: 'bg-[#0060E1]/10', border: 'border-[#0060E1]/20' },
]

export const PROSPECT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  discovered: { bg: 'bg-slate-100', text: 'text-slate-500' },
  enriched: { bg: 'bg-[#0060E1]/10', text: 'text-[#0060E1]' },
  qualified: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  contacted: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
}

export const DECISION_COLORS: Record<string, { bg: string; text: string }> = {
  contact_now: { bg: 'bg-red-500/10', text: 'text-red-500' },
  high_priority: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
  low_priority: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  skip: { bg: 'bg-slate-100', text: 'text-slate-400' },
}

