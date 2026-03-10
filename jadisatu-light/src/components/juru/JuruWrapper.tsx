"use client";

import React from "react";
import { JuruProvider } from "./JuruProvider";
import { JuruFloatingButton } from "./JuruFloatingButton";
import { JuruPanel } from "./JuruPanel";
import { usePathname } from "next/navigation";

function JuruShell() {
  const pathname = usePathname();

  // Don't show Juru on login page or focus mode
  if (pathname === "/login" || pathname === "/focus") return null;

  return (
    <>
      <JuruPanel />
      <JuruFloatingButton />
    </>
  );
}

export function JuruWrapper({ children }: { children: React.ReactNode }) {
  return (
    <JuruProvider>
      {children}
      <JuruShell />
    </JuruProvider>
  );
}
