"use client";

import React, { useState, useRef, useEffect } from "react";
import { useJuruContext } from "./JuruProvider";
import {
  Sparkles, Send, Trash2, Loader2, CheckCircle2,
  FolderPlus, FileText, Calendar, ListTodo, Lightbulb, ArrowRight
} from "lucide-react";

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text: string) {
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono text-blue-600">$1</code>');

  const lines = html.split(/\r?\n/);
  let result = "";
  let inList = false;
  for (const line of lines) {
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { result += '<ul class="list-disc list-inside space-y-0.5 my-1 text-sm">'; inList = true; }
      result += `<li>${line.replace(/^\s*[-*]\s+/, "")}</li>`;
    } else {
      if (inList) { result += "</ul>"; inList = false; }
      if (line.trim() === "") result += "<br/>";
      else result += `<p class="mb-1">${line}</p>`;
    }
  }
  if (inList) result += "</ul>";
  return result;
}

function ActionCard({ card }: { card: { title: string; subtitle?: string; items?: string[] } }) {
  const iconMap: Record<string, typeof FileText> = {
    task: ListTodo, project: FolderPlus, note: FileText,
    content: Lightbulb, schedule: Calendar,
  };
  const type = card.title.toLowerCase().includes("task") ? "task"
    : card.title.toLowerCase().includes("project") ? "project"
    : card.title.toLowerCase().includes("note") ? "note"
    : card.title.toLowerCase().includes("content") ? "content"
    : "task";
  const Icon = iconMap[type] || CheckCircle2;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 my-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 line-clamp-1">{card.title}</p>
          {card.subtitle && <p className="text-[10px] text-slate-500">{card.subtitle}</p>}
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
      </div>
      {card.items && card.items.length > 0 && (
        <div className="mt-2 space-y-1">
          {card.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <div className="w-1 h-1 rounded-full bg-blue-400" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function JuruPanel() {
  const { messages, isLoading, isOpen, sendMessage, clearMessages, pageContext } = useJuruContext();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const contextHints: Record<string, string> = {
    dashboard: "Coba: \"buat task baru\" atau \"ringkasan hari ini\"",
    tasks: "Coba: \"buat task revisi desain\" atau \"tandai selesai\"",
    projects: "Coba: \"buat project baru\" atau \"tambah task ke project\"",
    creative: "Coba: \"buat draft script\" atau \"bantu tulis caption\"",
    notes: "Coba: \"catat ide\" atau \"ringkas catatan\"",
    calendar: "Coba: \"jadwalkan meeting besok jam 10\"",
    crm: "Coba: \"tampilkan leads terbaru\"",
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 w-[400px] max-h-[600px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Juru</h3>
            <p className="text-[10px] text-slate-500">AI Copilot • {pageContext}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearMessages} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Clear chat">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-[300px] max-h-[400px] scrollbar-hide">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-blue-600" />
            </div>
            <h4 className="font-bold text-slate-900 mb-1">Halo! Saya Juru 👋</h4>
            <p className="text-xs text-slate-500 mb-4 max-w-[260px]">
              AI copilot kamu untuk mengatur tasks, projects, notes, dan konten kreatif.
            </p>
            <p className="text-[10px] text-blue-600 font-medium">
              {contextHints[pageContext] || "Tanya apa saja atau minta bantuan."}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${msg.role === "user" ? "" : ""}`}>
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-slate-100 text-slate-800 rounded-bl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {/* Action Cards */}
              {msg.data_updates?.cards?.map((card, i) => (
                <ActionCard key={i} card={card} />
              ))}
              <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-right text-slate-400" : "text-slate-400"}`}>
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-sm text-slate-500">Juru sedang berpikir...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tulis pesan ke Juru..."
            rows={1}
            className="flex-1 resize-none rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all max-h-24"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white flex items-center justify-center transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
