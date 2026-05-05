const MANDALA_API = process.env.MANDALA_ENGINE_URL || process.env.NEXT_PUBLIC_MANDALA_API_URL || 'https://jadisatu.cloud'

async function mandalaFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const url = `${MANDALA_API}${path}`
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// Conversations
export async function getConversations(tenant?: string) {
  const params = tenant ? `?tenant=${tenant}` : ''
  return mandalaFetch<any[]>(`/api/conversations${params}`)
}

export async function getConversation(id: string) {
  return mandalaFetch<any>(`/api/conversations/${id}`)
}

export async function takeOver(id: string) {
  return mandalaFetch<any>(`/api/takeover/${id}`, { method: 'POST' })
}

export async function letMandala(id: string) {
  return mandalaFetch<any>(`/api/let-mandala/${id}`, { method: 'POST' })
}

export async function closeConversation(id: string) {
  return mandalaFetch<any>(`/api/conversations/${id}/close`, { method: 'POST' })
}

// Leads & Pipeline
export async function getLeads(temperature?: string) {
  const params = temperature ? `?temperature=${temperature}` : ''
  return mandalaFetch<any[]>(`/api/leads${params}`)
}

// Stats
export async function getStats() {
  return mandalaFetch<{
    total_conversations: number
    active_conversations: number
    total_leads: number
    success_rate: number
  }>('/api/stats')
}

// Hunter / Outreach
export async function getHunterProspects(status?: string) {
  const params = status ? `?status=${status}` : ''
  return mandalaFetch<any[]>(`/api/hunter/prospects${params}`)
}

// Tasks
export async function getTasks(status?: string) {
  const params = status ? `?status=${status}` : ''
  return mandalaFetch<any[]>(`/api/tasks${params}`)
}

export async function executeTask(input: { type: string; data: Record<string, unknown> }) {
  return mandalaFetch<any>('/api/task/execute', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// WhatsApp
export async function getWaSessions() {
  return mandalaFetch<any[]>('/api/wa/sessions')
}

export async function connectWa(tenantId: string) {
  return mandalaFetch<any>(`/api/wa/connect/${tenantId}`, { method: 'POST' })
}

export async function getWaQr(tenantId: string) {
  return mandalaFetch<any>(`/api/wa/qr/${tenantId}`)
}

export async function getWaStatus(tenantId: string) {
  return mandalaFetch<any>(`/api/wa/status/${tenantId}`)
}
