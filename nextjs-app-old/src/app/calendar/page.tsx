'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, Clock, X } from 'lucide-react'

interface ScheduleBlock {
  id: string
  date: string
  start_time: string
  end_time: string
  title: string
  domain: string | null
  type: string
}

const DOMAIN_COLORS: Record<string, string> = {
  work: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  learn: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  business: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  personal: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('10:00')
  const [newDomain, setNewDomain] = useState('work')
  const supabase = createClient()

  useEffect(() => { loadBlocks() }, [selectedDate])

  async function loadBlocks() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', selectedDate)
      .order('start_time')
    if (data) setBlocks(data)
  }

  async function addBlock() {
    if (!newTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('schedule_blocks').insert({
      date: selectedDate,
      start_time: newStart,
      end_time: newEnd,
      title: newTitle,
      domain: newDomain,
      type: 'task',
      user_id: user.id,
    })
    setNewTitle('')
    setShowAddForm(false)
    loadBlocks()
  }

  async function deleteBlock(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('schedule_blocks').delete().eq('id', id).eq('user_id', user.id)
    loadBlocks()
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]

  const calendarDays: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) calendarDays.push(null)
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i)

  function navigateMonth(delta: number) {
    setCurrentDate(new Date(year, month + delta, 1))
  }

  function formatDateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">Schedule and manage your time blocks.</p>
        </div>
        <button
          onClick={() => { setSelectedDate(today); setCurrentDate(new Date()) }}
          className="px-4 py-2 bg-card border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">{MONTHS[month]} {year}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => navigateMonth(-1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => navigateMonth(1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS.map(day => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">{day}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />
              const dateStr = formatDateStr(day)
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDate
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    'aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all',
                    isSelected
                      ? 'bg-primary text-white shadow-sm'
                      : isToday
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'hover:bg-muted text-foreground'
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        {/* Schedule for Selected Date */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </h3>
              <p className="text-xs text-muted-foreground">{blocks.length} blocks scheduled</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>

          {showAddForm && (
            <div className="bg-muted rounded-2xl p-4 mb-4 space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Block title..."
                autoFocus
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)}
                  className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
                <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
                  className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <select
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="work">Work</option>
                <option value="learn">Learn</option>
                <option value="business">Business</option>
                <option value="personal">Personal</option>
              </select>
              <div className="flex gap-2">
                <button onClick={addBlock} className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-medium hover:bg-primary/90">Add</button>
                <button onClick={() => setShowAddForm(false)} className="px-4 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            </div>
          )}

          <div className="flex-1 space-y-2 overflow-y-auto">
            {blocks.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No blocks scheduled</p>
              </div>
            ) : (
              blocks.map(block => (
                <div key={block.id} className={cn('group p-3 rounded-2xl border transition-colors', DOMAIN_COLORS[block.domain || 'work'] || DOMAIN_COLORS.work)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{block.title}</p>
                      <p className="text-xs mt-1 opacity-70">{block.start_time} - {block.end_time}</p>
                    </div>
                    <button
                      onClick={() => deleteBlock(block.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
