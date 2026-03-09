"use client";

import React from "react";
import { useJuruContext } from "./JuruProvider";
import { MessageSquare, X } from "lucide-react";

export function JuruFloatingButton() {
  const { isOpen, toggle } = useJuruContext();

  return (
    <button
      onClick={toggle}
      className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 ${
        isOpen
          ? "bg-slate-900 hover:bg-slate-800 rotate-0"
          : "bg-blue-600 hover:bg-blue-700"
      }`}
      aria-label={isOpen ? "Close Juru" : "Open Juru"}
    >
      {isOpen ? (
        <X className="w-6 h-6 text-white" />
      ) : (
        <div className="relative">
          <MessageSquare className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-blue-600 animate-pulse" />
        </div>
      )}
    </button>
  );
}
