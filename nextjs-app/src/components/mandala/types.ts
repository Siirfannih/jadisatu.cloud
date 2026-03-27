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
  { key: 'hot', label: 'Hot', range: '70+', color: 'bg-red-50 border-red-200 text-red-700' },
  { key: 'warm', label: 'Warm', range: '50-69', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { key: 'lukewarm', label: 'Lukewarm', range: '30-49', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  { key: 'cold', label: 'Cold', range: '0-29', color: 'bg-blue-50 border-blue-200 text-blue-700' },
]

export const PROSPECT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  discovered: { bg: 'bg-slate-100', text: 'text-slate-600' },
  enriched: { bg: 'bg-blue-100', text: 'text-blue-600' },
  qualified: { bg: 'bg-amber-100', text: 'text-amber-600' },
  contacted: { bg: 'bg-green-100', text: 'text-green-600' },
}

export const DECISION_COLORS: Record<string, { bg: string; text: string }> = {
  contact_now: { bg: 'bg-red-100', text: 'text-red-700' },
  high_priority: { bg: 'bg-orange-100', text: 'text-orange-700' },
  low_priority: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  skip: { bg: 'bg-gray-100', text: 'text-gray-500' },
}
