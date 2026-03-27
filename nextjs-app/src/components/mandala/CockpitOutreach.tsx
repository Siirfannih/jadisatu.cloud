'use client'

import { cn } from '@/lib/utils'
import { Search, MapPin, ExternalLink, Phone, Globe, Star } from 'lucide-react'
import type { Prospect } from './types'
import { PROSPECT_STATUS_COLORS, DECISION_COLORS } from './types'

interface Props {
  prospects: Prospect[]
  hunterQuery: string
  hunterRunning: boolean
  onQueryChange: (q: string) => void
  onRunHunter: () => void
}

export default function CockpitOutreach({ prospects, hunterQuery, hunterRunning, onQueryChange, onRunHunter }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Hunter Controls */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Outreach & Prospecting</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Discover businesses via Google Maps, enrich, classify, and initiate contact</p>
          </div>
          <span className="text-sm text-muted-foreground">{prospects.length} prospects</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={hunterQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onRunHunter()}
            placeholder="Search query, e.g. hotel bali, klinik denpasar..."
            className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={onRunHunter}
            disabled={hunterRunning || !hunterQuery.trim()}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              hunterRunning || !hunterQuery.trim()
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-orange-500 text-white hover:bg-orange-600"
            )}
          >
            {hunterRunning ? 'Running...' : 'Run Hunter'}
          </button>
        </div>
      </div>

      {/* Prospects List */}
      {prospects.length === 0 ? (
        <div className="p-12 text-center">
          <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No prospects yet.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Use the hunter to discover and qualify businesses automatically.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {prospects.map((prospect) => {
            const statusColor = PROSPECT_STATUS_COLORS[prospect.status] || PROSPECT_STATUS_COLORS.discovered
            const decisionColor = DECISION_COLORS[prospect.decision] || DECISION_COLORS.skip
            return (
              <div key={prospect.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{prospect.business_name}</p>
                      {prospect.maps_url && (
                        <a href={prospect.maps_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    {prospect.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> {prospect.address}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColor.bg, statusColor.text)}>
                        {prospect.status}
                      </span>
                      {prospect.decision && (
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", decisionColor.bg, decisionColor.text)}>
                          {prospect.decision.replace('_', ' ')}
                        </span>
                      )}
                      {prospect.pain_type && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {prospect.pain_type.replace('_', ' ')}
                        </span>
                      )}
                      {prospect.rating > 0 && (
                        <span className="text-xs flex items-center gap-0.5 text-amber-600">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {prospect.rating} ({prospect.review_count})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {prospect.pain_score > 0 && (
                      <div className={cn(
                        "text-lg font-bold",
                        prospect.pain_score >= 80 ? "text-red-600" :
                        prospect.pain_score >= 50 ? "text-orange-600" : "text-slate-500"
                      )}>
                        {prospect.pain_score}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {prospect.phone && <Phone className="w-3.5 h-3.5 text-green-500" />}
                      {prospect.website && <Globe className="w-3.5 h-3.5 text-blue-500" />}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
