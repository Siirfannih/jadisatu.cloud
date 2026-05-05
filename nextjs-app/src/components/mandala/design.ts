/* ================================================================
   SHARED DESIGN TOKENS — Mandala Cockpit
   Matches Dashboard page.tsx design system exactly
   ================================================================ */

export const brand = {
  primary: '#0060E1',
  primaryLight: '#3B82F6',
  primarySoft: '#EFF6FF',
  accent: '#6366F1',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  orange: '#F97316',
}

// Card style: borderless, soft shadow, hover lift — same as Dashboard
export const card = 'bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)] transition-all duration-300'

// Card without hover effect (for static containers)
export const cardStatic = 'bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)]'

// Inner card for nested items
export const cardInner = 'bg-slate-50/60 rounded-xl'

// Section title: text-[15px] font-semibold text-slate-800
// Label: text-[11px] font-bold text-slate-400 uppercase tracking-wider
// Value: text-3xl font-bold (color via inline style)
// Body: text-[13px] text-slate-600
// Muted: text-xs text-slate-400
// Badge: inline style with `${color}18` bg and color text
