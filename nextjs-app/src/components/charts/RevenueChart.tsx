'use client'

import {
  BarChart, Bar, XAxis, CartesianGrid, Cell,
  Tooltip, ResponsiveContainer,
} from 'recharts'

function formatRupiah(num: number) {
  if (num >= 1000000) return `Rp${(num / 1000000).toFixed(1)}jt`
  if (num >= 1000) return `Rp${(num / 1000).toFixed(0)}rb`
  return `Rp${num}`
}

interface Props {
  data: { day: string; value: number }[]
  maxValue: number
  primaryColor: string
}

export default function RevenueChart({ data, maxValue, primaryColor }: Props) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barSize={32} barGap={8}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          formatter={(value: any) => [formatRupiah(Number(value) || 0), 'Revenue']}
          cursor={{ fill: 'rgba(0,96,225,0.03)' }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.value === maxValue ? primaryColor : '#DBEAFE'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
