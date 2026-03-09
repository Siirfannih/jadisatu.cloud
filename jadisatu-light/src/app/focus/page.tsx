"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Play, Pause, RotateCcw, Settings, Music, CheckCircle2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
}

export default function FocusModePage() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);

  useEffect(() => {
    fetch("/api/tasks?limit=10&status=active")
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
        setTimeLeft((time) => {
          if (time <= 1) { setIsActive(false); return 0; }
          return time - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const upNext = tasks.filter((t) => t.id !== currentTask?.id).slice(0, 3);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Focus Mode</h1>
                <p className="text-slate-500">Deep work session in progress.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                    <div className="w-[400px] h-[400px] rounded-full border-[4px] border-slate-50"></div>
                    <div className="absolute w-[400px] h-[400px] rounded-full border-[4px] border-blue-500 border-t-transparent border-l-transparent rotate-45 opacity-20"></div>
                    <div className="absolute w-[300px] h-[300px] rounded-full border-[2px] border-slate-100"></div>
                  </div>
                  <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-bold tracking-wide uppercase mb-8 relative z-10">Pomodoro Session</span>
                  <div className="text-8xl font-bold tracking-tighter text-slate-900 mb-4 relative z-10 font-mono">{formatTime(timeLeft)}</div>
                  <p className="text-slate-500 text-lg font-medium relative z-10 mb-12">
                    {currentTask ? <>Focusing on: <span className="text-slate-900">{currentTask.title}</span></> : "No task selected"}
                  </p>
                  <div className="flex items-center justify-center gap-6 relative z-10">
                    <button onClick={() => { setIsActive(false); setTimeLeft(25 * 60); }} className="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors">
                      <RotateCcw className="w-6 h-6" />
                    </button>
                    <button onClick={() => setIsActive(!isActive)} className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 hover:scale-105 transition-all shadow-xl shadow-blue-200/50">
                      {isActive ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-2" />}
                    </button>
                    <button className="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors">
                      <Music className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Current Task</h3>
                  {currentTask ? (
                    <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/50">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-1">{currentTask.title}</h4>
                          <p className="text-sm text-slate-500">{currentTask.status}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No active tasks</p>
                  )}
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Up Next</h3>
                  <div className="space-y-3">
                    {upNext.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setCurrentTask(task)}>
                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                        <span className="text-sm font-medium text-slate-700">{task.title}</span>
                      </div>
                    ))}
                    {upNext.length === 0 && <p className="text-sm text-slate-400">No more tasks</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
