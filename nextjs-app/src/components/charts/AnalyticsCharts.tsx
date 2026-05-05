'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

const formatRp = (n: number) => `Rp ${(n / 1000000).toFixed(0)}jt`

// Revenue & Forecast line chart
interface RevenueLineProps {
  data: { month: string; actual: number; forecast: number }[]
  primaryColor: string
}

export function RevenueLineChart({ data, primaryColor }: RevenueLineProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={v => formatRp(v)} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
          formatter={(v) => [formatRp(Number(v) || 0)]}
        />
        <Line type="monotone" dataKey="actual" stroke={primaryColor} strokeWidth={2} dot={{ fill: primaryColor, r: 4 }} />
        <Line type="monotone" dataKey="forecast" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Channel pie chart
interface ChannelPieProps {
  data: { name: string; value: number; color: string }[]
}

export function ChannelPieChart({ data }: ChannelPieProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
