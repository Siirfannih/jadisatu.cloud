'use client'

import { useEffect, useState } from "react"
import { Calendar } from "lucide-react"

type Activity = {
  id: string
  type?: string
  action?: string
  description?: string
  created_at: string
}

export default function HistoryPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadActivities() }, [])

  async function loadActivities() {
    setLoading(true)
    try {
      const res = await fetch('/light/api/activities?limit=200')
      if (res.ok) {
        const data = await res.json()
        setActivities(Array.isArray(data) ? data : [])
      } else {
        setActivities([])
      }
    } catch {
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  const grouped = activities.reduce((acc: Record<string, any[]>, a) => {
    const date = new Date(a.created_at).toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(a)
    return acc
  }, {})

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">History & Analytics</h1>
          <p className="text-muted-foreground">Review your productivity and system performance.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-md hover:bg-accent transition-colors text-sm">
          <Calendar size={16} /> Last 7 Days
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-muted-foreground">Total Activities</p>
          <p className="text-2xl font-bold">{activities.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-muted-foreground">System Events</p>
          <p className="text-2xl font-bold">{activities.filter(a => (a.type || '').length > 0).length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-muted-foreground">Recent (24h)</p>
          <p className="text-2xl font-bold">
            {activities.filter(a => (Date.now() - new Date(a.created_at).getTime()) < 24 * 60 * 60 * 1000).length}
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-6">Timeline</h3>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading activity...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-muted-foreground text-sm">No activities recorded yet. Activities will appear here as you and your agents work.</p>
        ) : (
          <div className="relative border-l border-border ml-3 space-y-8">
            {Object.entries(grouped).map(([date, events]) => (
              <div key={date} className="pl-6 relative">
                <span className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                <h4 className="text-sm font-bold mb-4">{date}</h4>
                <div className="space-y-4">
                  {(events as Activity[]).map((event) => (
                    <div key={event.id} className="flex items-center gap-4 text-sm group">
                      <span className="font-mono text-muted-foreground w-16 text-xs">{new Date(event.created_at).toLocaleTimeString()}</span>
                      <div className="flex-1 p-3 bg-muted/20 rounded-lg border border-border/50 group-hover:bg-muted/40 transition-colors">
                        <span className="font-bold">{event.action || 'Activity'}</span>
                        {event.description ? <span className="text-foreground/80"> {event.description}</span> : null}
                        {event.type && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                            {event.type}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
