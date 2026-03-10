"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, GitCommit, FileEdit, CheckCircle2 } from "lucide-react";

interface Activity {
  id: string;
  action: string;
  description: string;
  created_at: string;
  type?: string;
}

const iconMap: Record<string, { icon: typeof MessageSquare; color: string; bg: string }> = {
  comment: { icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50" },
  commit: { icon: GitCommit, color: "text-purple-500", bg: "bg-purple-50" },
  edit: { icon: FileEdit, color: "text-orange-500", bg: "bg-orange-50" },
  complete: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
};

export function ActivityTimeline() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    fetch("/api/activities?limit=6")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setActivities(data);
      })
      .catch(() => {});
  }, []);

  const getIcon = (activity: Activity) => {
    const type = activity.type || "edit";
    return iconMap[type] || iconMap.edit;
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900">Activity</h2>
        <a href="/history" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
          View All
        </a>
      </div>
      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100">
        {activities.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>
        )}
        {activities.map((activity) => {
          const { icon: Icon, color, bg } = getIcon(activity);
          return (
            <div key={activity.id} className="relative flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-white shrink-0 relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bg}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              <div className="flex-1 pt-1.5">
                <p className="text-sm text-slate-600 leading-tight">
                  <span className="font-semibold text-slate-900">{activity.action}</span>{" "}
                  {activity.description}
                </p>
                <span className="text-xs text-slate-400 mt-1 block">{timeAgo(activity.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
