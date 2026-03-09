"use client";

import { useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

export interface JuruMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  data_updates?: {
    refresh_needed: boolean;
    cards: Array<{ title: string; subtitle?: string; items?: string[] }>;
  };
}

export function useJuru() {
  const [messages, setMessages] = useState<JuruMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const pathname = usePathname();
  const abortRef = useRef<AbortController | null>(null);

  const getPageContext = useCallback(() => {
    const contextMap: Record<string, string> = {
      "/": "dashboard",
      "/tasks": "tasks",
      "/kanban": "kanban",
      "/projects": "projects",
      "/creative": "creative-hub",
      "/notes": "notes",
      "/calendar": "calendar",
      "/crm": "crm",
      "/ai": "ai-agents",
      "/history": "history",
      "/context": "context-hub",
      "/settings": "settings",
    };
    return contextMap[pathname] || "general";
  }, [pathname]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: JuruMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const pageContext = getPageContext();
    const contextPrefix = pageContext !== "general"
      ? `[User is on ${pageContext} page] `
      : "";

    const allMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: contextPrefix + content.trim() },
    ];

    try {
      const res = await fetch("/api/juru/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages,
          conversation_id: conversationId,
          client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Makassar",
        }),
      });

      const data = await res.json();

      const assistantMsg: JuruMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || "Maaf, saya tidak dapat memproses itu.",
        timestamp: new Date(),
        data_updates: data.data_updates,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If data was updated, trigger a refresh event
      if (data.data_updates?.refresh_needed) {
        window.dispatchEvent(new CustomEvent("juru-data-updated", {
          detail: { cards: data.data_updates.cards },
        }));
      }
    } catch (error) {
      const errorMsg: JuruMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Koneksi terputus. Pastikan kamu terhubung ke internet.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, conversationId, getPageContext]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return {
    messages,
    isLoading,
    isOpen,
    sendMessage,
    clearMessages,
    toggle,
    open,
    close,
    pageContext: getPageContext(),
  };
}
