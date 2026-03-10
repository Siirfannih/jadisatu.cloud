"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useJuru, JuruMessage } from "@/hooks/useJuru";

interface JuruContextType {
  messages: JuruMessage[];
  isLoading: boolean;
  isOpen: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  toggle: () => void;
  open: () => void;
  close: () => void;
  pageContext: string;
}

const JuruContext = createContext<JuruContextType | null>(null);

export function JuruProvider({ children }: { children: ReactNode }) {
  const juru = useJuru();

  return (
    <JuruContext.Provider value={juru}>
      {children}
    </JuruContext.Provider>
  );
}

export function useJuruContext() {
  const context = useContext(JuruContext);
  if (!context) {
    throw new Error("useJuruContext must be used within JuruProvider");
  }
  return context;
}
