"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Plus, ChevronLeft, ChevronRight, Clock, Trash2, X } from "lucide-react";

interface ScheduleBlock {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  domain: string | null;
  type: string;
  date: string;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

const domainColors: Record<string, string> = {
  work: "bg-blue-500",
  learn: "bg-amber-500",
  business: "bg-emerald-500",
  personal: "bg-violet-500",
};

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");
  const [newDomain, setNewDomain] = useState("personal");
  const [newType, setNewType] = useState("task");

  const dateStr = selectedDate.toISOString().split("T")[0];

  useEffect(() => { loadSchedule(); }, [dateStr]);

  async function loadSchedule() {
    const res = await fetch(`/api/schedule?date=${dateStr}`);
    if (res.ok) {
      const data = await res.json();
      setSchedule(Array.isArray(data) ? data : []);
    }
  }

  async function addBlock() {
    if (!newTitle.trim()) return;
    await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateStr, start_time: newStart, end_time: newEnd, title: newTitle, domain: newDomain, type: newType }),
    });
    setNewTitle("");
    setShowAdd(false);
    await loadSchedule();
  }

  function prevDay() { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); }
  function nextDay() { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); }
  function goToday() { setSelectedDate(new Date()); }

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const dayLabel = selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  function getBlockPosition(block: ScheduleBlock) {
    const [sh, sm] = block.start_time.split(":").map(Number);
    const [eh, em] = block.end_time.split(":").map(Number);
    const startMinutes = (sh - 6) * 60 + sm;
    const endMinutes = (eh - 6) * 60 + em;
    const top = (startMinutes / 60) * 64;
    const height = Math.max(((endMinutes - startMinutes) / 60) * 64, 24);
    return { top, height };
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-hidden flex flex-col p-8">
          <div className="max-w-5xl mx-auto w-full h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">Calendar</h1>
                <p className="text-slate-500">Plan your day and sync with Google Calendar.</p>
              </div>
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm">
                <Plus className="w-5 h-5" /><span>Add Event</span>
              </button>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-4 mb-6 shrink-0">
              <div className="flex items-center gap-1">
                <button onClick={prevDay} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                <button onClick={nextDay} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
              </div>
              <h2 className="text-xl font-bold text-slate-900">{dayLabel}</h2>
              {!isToday && <button onClick={goToday} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">Today</button>}
            </div>

            {/* Add Event Form */}
            {showAdd && (
              <div className="mb-6 shrink-0 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900">New Event</h3>
                  <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Event title..." className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 col-span-full" autoFocus />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Start</label>
                      <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">End</label>
                      <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Domain</label>
                      <select value={newDomain} onChange={e => setNewDomain(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option value="personal">Personal</option>
                        <option value="work">Work</option>
                        <option value="learn">Learn</option>
                        <option value="business">Business</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Type</label>
                      <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option value="task">Task</option>
                        <option value="meeting">Meeting</option>
                        <option value="focus">Focus</option>
                        <option value="break">Break</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={addBlock} disabled={!newTitle.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">Create Event</button>
                  <button onClick={() => setShowAdd(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {/* Timeline View */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-y-auto">
              <div className="relative min-h-[1024px]">
                {HOURS.map(hour => (
                  <div key={hour} className="flex items-start border-b border-slate-50" style={{ height: 64 }}>
                    <div className="w-16 shrink-0 text-right pr-3 pt-1">
                      <span className="text-xs text-slate-400 font-medium">{hour.toString().padStart(2, "0")}:00</span>
                    </div>
                    <div className="flex-1 border-l border-slate-100 h-full"></div>
                  </div>
                ))}

                {/* Schedule Blocks */}
                {schedule.map(block => {
                  const pos = getBlockPosition(block);
                  const color = domainColors[block.domain || "personal"] || "bg-blue-500";
                  return (
                    <div
                      key={block.id}
                      className={`absolute left-16 right-4 ${color} bg-opacity-15 border-l-4 ${color} rounded-r-xl px-3 py-1.5 cursor-pointer hover:bg-opacity-25 transition-colors`}
                      style={{ top: pos.top, height: pos.height }}
                    >
                      <p className="text-sm font-semibold text-slate-900 line-clamp-1">{block.title}</p>
                      <p className="text-[10px] text-slate-500">{block.start_time} – {block.end_time}</p>
                    </div>
                  );
                })}

                {/* Current Time Indicator */}
                {isToday && (() => {
                  const now = new Date();
                  const mins = (now.getHours() - 6) * 60 + now.getMinutes();
                  if (mins < 0 || mins > 960) return null;
                  const top = (mins / 60) * 64;
                  return (
                    <div className="absolute left-16 right-0 flex items-center" style={{ top }}>
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5"></div>
                      <div className="flex-1 h-px bg-red-500"></div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
