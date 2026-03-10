import React from "react";
import { PenTool, Video, Image as ImageIcon, ArrowRight } from "lucide-react";
import Link from "next/link";

const ideas = [
  { id: 1, title: "Brand Identity Refresh", type: "Design", icon: PenTool, color: "text-purple-600", bg: "bg-purple-50" },
  { id: 2, title: "Product Launch Video", type: "Video", icon: Video, color: "text-blue-600", bg: "bg-blue-50" },
  { id: 3, title: "Social Media Assets", type: "Graphics", icon: ImageIcon, color: "text-orange-600", bg: "bg-orange-50" },
];

export function CreativePreview() {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Creative Hub</h2>
          <p className="text-sm text-slate-500 mt-1">Recent drafts and ideas</p>
        </div>
        <Link
          href="/creative"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 bg-blue-50 px-4 py-2 rounded-xl"
        >
          Open Hub <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {ideas.map((idea) => {
          const Icon = idea.icon;
          return (
            <div
              key={idea.id}
              className="group relative rounded-2xl overflow-hidden border border-slate-100 hover:border-blue-100 hover:shadow-md transition-all cursor-pointer bg-white flex flex-col"
            >
              <div className="aspect-[4/3] relative w-full overflow-hidden bg-slate-50 flex items-center justify-center">
                <Icon className={`w-12 h-12 ${idea.color} opacity-30`} />
                <div className="absolute top-4 left-4 z-10">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md bg-white/90 ${idea.color}`}>
                    {idea.type}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">{idea.title}</h4>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
