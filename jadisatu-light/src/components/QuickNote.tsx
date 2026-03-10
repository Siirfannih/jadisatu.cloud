"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

export function QuickNote() {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("ideas").insert({
          title: note.substring(0, 100),
          content: note,
          status: "active",
          user_id: user.id,
        });
      }
      setNote("");
    } catch (e) {}
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">Quick Note</h2>
        <button className="text-slate-400 hover:text-blue-600 transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full h-32 resize-none bg-slate-50 border-none rounded-2xl p-4 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
        placeholder="Jot down an idea..."
      ></textarea>
      <div className="mt-4 flex justify-end">
        <button
          onClick={saveNote}
          disabled={saving}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Note"}
        </button>
      </div>
    </div>
  );
}
