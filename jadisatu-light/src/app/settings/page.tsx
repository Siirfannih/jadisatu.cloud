"use client";

import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Database, Globe, Calendar, CheckCircle, XCircle } from "lucide-react";

const integrations = [
  { name: "Supabase", description: "Database, Auth & Realtime", icon: Database, connected: true },
  { name: "Google Calendar", description: "Sync your schedule", icon: Calendar, connected: false },
  { name: "Custom Domains", description: "Use your own domain", icon: Globe, connected: false },
];

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-3xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Settings</h1>
              <p className="text-slate-500">Manage your account and integrations.</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Integrations</h2>
              <div className="space-y-4">
                {integrations.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.name} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-slate-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{item.name}</h3>
                          <p className="text-sm text-slate-500">{item.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.connected ? (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">
                            <CheckCircle className="w-3.5 h-3.5" /> Connected
                          </span>
                        ) : (
                          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors">
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Appearance</h2>
              <p className="text-slate-500 text-sm">You&apos;re using the <span className="font-semibold text-blue-600">Light Mode</span> theme.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
