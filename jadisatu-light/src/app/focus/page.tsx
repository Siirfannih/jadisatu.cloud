"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX,
  CheckCircle2, Circle, ArrowLeft, Maximize2, Minimize2,
  CloudRain, Coffee, TreePine, Waves, Wind, Radio
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
}

const SESSION_TYPES = [
  { label: "Focus", minutes: 25, color: "bg-blue-600" },
  { label: "Short Break", minutes: 5, color: "bg-emerald-500" },
  { label: "Long Break", minutes: 15, color: "bg-violet-500" },
  { label: "Deep Work", minutes: 50, color: "bg-orange-500" },
];

const SOUNDS = [
  { id: "rain", label: "Rain", icon: CloudRain },
  { id: "cafe", label: "Cafe", icon: Coffee },
  { id: "forest", label: "Forest", icon: TreePine },
  { id: "ocean", label: "Ocean", icon: Waves },
  { id: "wind", label: "Wind", icon: Wind },
  { id: "lofi", label: "Lo-fi", icon: Radio },
];

export default function FocusModePage() {
  const supabase = createClient();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [sessionType, setSessionType] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const [isZen, setIsZen] = useState(false);

  useEffect(() => {
    fetch("/api/tasks?limit=20&status=active")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTasks(data);
          const inProgress = data.find((t: Task) => t.status === "in-progress");
          setCurrentTask(inProgress || data[0] || null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            setIsActive(false);
            setSessionsCompleted((s) => s + 1);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  function selectSession(idx: number) {
    setSessionType(idx);
    setTimeLeft(SESSION_TYPES[idx].minutes * 60);
    setIsActive(false);
  }

  function resetTimer() {
    setIsActive(false);
    setTimeLeft(SESSION_TYPES[sessionType].minutes * 60);
  }

  function skipSession() {
    setSessionsCompleted((s) => s + 1);
    const next = sessionType === 0 ? 1 : 0;
    selectSession(next);
  }

  async function completeTask() {
    if (!currentTask) return;
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentTask.id, status: "done" }),
    });
    const remaining = tasks.filter((t) => t.id !== currentTask.id);
    setTasks(remaining);
    setCurrentTask(remaining[0] || null);
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = 1 - timeLeft / (SESSION_TYPES[sessionType].minutes * 60);
  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference * (1 - progress);
  const sessionColor = SESSION_TYPES[sessionType].color;
  const upNext = tasks.filter((t) => t.id !== currentTask?.id).slice(0, 4);

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isZen ? "bg-slate-950" : "bg-[#F8FAFC]"}`}>
      {/* Minimal Top Bar */}
      <div className={`h-14 flex items-center justify-between px-6 ${isZen ? "bg-transparent" : "bg-white/80 backdrop-blur-sm border-b border-slate-100"}`}>
        <Link href="/" className={`flex items-center gap-2 text-sm font-medium transition-colors ${isZen ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-blue-600"}`}>
          <ArrowLeft className="w-4 h-4" />Exit Focus
        </Link>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${isZen ? "text-slate-500" : "text-slate-400"}`}>{sessionsCompleted} sessions</span>
          <button
            onClick={() => setIsZen(!isZen)}
            className={`p-2 rounded-lg transition-colors ${isZen ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
            title={isZen ? "Exit Zen Mode" : "Zen Mode"}
          >
            {isZen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-4xl mx-auto">
          {/* Session Type Selector */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {SESSION_TYPES.map((s, i) => (
              <button
                key={s.label}
                onClick={() => selectSession(i)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  sessionType === i
                    ? `${isZen ? "bg-white/10 text-white" : "bg-slate-900 text-white"} shadow-sm`
                    : `${isZen ? "text-slate-500 hover:text-slate-300 hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center justify-center mb-10">
            <div className="relative w-80 h-80 flex items-center justify-center">
              {/* Progress Ring */}
              <svg className="absolute inset-0 w-80 h-80 -rotate-90" viewBox="0 0 300 300">
                <circle cx="150" cy="150" r="140" fill="none" stroke={isZen ? "#1e293b" : "#f1f5f9"} strokeWidth="6" />
                <circle
                  cx="150" cy="150" r="140" fill="none"
                  stroke={sessionType === 0 ? "#2563eb" : sessionType === 1 ? "#10b981" : sessionType === 2 ? "#8b5cf6" : "#f97316"}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000"
                />
              </svg>
              {/* Time Display */}
              <div className="relative z-10 text-center">
                <div className={`text-7xl font-bold tracking-tighter font-mono ${isZen ? "text-white" : "text-slate-900"}`}>
                  {formatTime(timeLeft)}
                </div>
                <p className={`text-sm font-medium mt-2 ${isZen ? "text-slate-500" : "text-slate-400"}`}>
                  {SESSION_TYPES[sessionType].label} · {SESSION_TYPES[sessionType].minutes}min
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-5 mt-6">
              <button onClick={resetTimer} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isZen ? "bg-white/10 text-slate-400 hover:text-white hover:bg-white/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsActive(!isActive)}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all hover:scale-105 shadow-xl ${
                  sessionType === 0 ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200/50" :
                  sessionType === 1 ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200/50" :
                  sessionType === 2 ? "bg-violet-500 hover:bg-violet-600 shadow-violet-200/50" :
                  "bg-orange-500 hover:bg-orange-600 shadow-orange-200/50"
                } text-white`}
              >
                {isActive ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>
              <button onClick={skipSession} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isZen ? "bg-white/10 text-slate-400 hover:text-white hover:bg-white/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bottom Section: Task + Sounds */}
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${isZen ? "" : ""}`}>
            {/* Current Task & Queue */}
            <div className={`rounded-2xl p-5 ${isZen ? "bg-white/5 border border-white/10" : "bg-white border border-slate-100 shadow-sm"}`}>
              <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${isZen ? "text-slate-500" : "text-slate-400"}`}>Focusing On</h3>
              {currentTask ? (
                <div className={`p-4 rounded-xl mb-4 ${isZen ? "bg-white/5 border border-white/10" : "bg-blue-50/50 border border-blue-100"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`w-5 h-5 ${isZen ? "text-blue-400" : "text-blue-500"}`} />
                      <span className={`font-semibold ${isZen ? "text-white" : "text-slate-900"}`}>{currentTask.title}</span>
                    </div>
                    <button onClick={completeTask} className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${isZen ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}>
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <p className={`text-sm ${isZen ? "text-slate-600" : "text-slate-400"}`}>No task selected</p>
              )}
              {upNext.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-bold uppercase tracking-wider ${isZen ? "text-slate-600" : "text-slate-400"}`}>Up Next</p>
                  {upNext.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setCurrentTask(task)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${isZen ? "hover:bg-white/5" : "hover:bg-slate-50"}`}
                    >
                      <Circle className={`w-4 h-4 ${isZen ? "text-slate-600" : "text-slate-300"}`} />
                      <span className={`text-sm ${isZen ? "text-slate-400" : "text-slate-600"}`}>{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ambient Sounds */}
            <div className={`rounded-2xl p-5 ${isZen ? "bg-white/5 border border-white/10" : "bg-white border border-slate-100 shadow-sm"}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isZen ? "text-slate-500" : "text-slate-400"}`}>Ambient Sound</h3>
                {activeSound && (
                  <button
                    onClick={() => setSoundMuted(!soundMuted)}
                    className={`p-1.5 rounded-lg transition-colors ${isZen ? "text-slate-500 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
                  >
                    {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {SOUNDS.map((sound) => {
                  const Icon = sound.icon;
                  const isSelected = activeSound === sound.id;
                  return (
                    <button
                      key={sound.id}
                      onClick={() => setActiveSound(isSelected ? null : sound.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                        isSelected
                          ? `${isZen ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-blue-50 text-blue-600 border border-blue-200"}`
                          : `${isZen ? "bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300 border border-transparent" : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-transparent"}`
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{sound.label}</span>
                    </button>
                  );
                })}
              </div>
              {activeSound && !soundMuted && (
                <div className={`mt-4 flex items-center gap-3 px-3 py-2 rounded-xl ${isZen ? "bg-white/5" : "bg-slate-50"}`}>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`w-1 rounded-full animate-pulse ${isZen ? "bg-blue-400" : "bg-blue-500"}`} style={{ height: `${8 + Math.random() * 12}px`, animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${isZen ? "text-slate-500" : "text-slate-400"}`}>
                    Now playing: {SOUNDS.find((s) => s.id === activeSound)?.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
