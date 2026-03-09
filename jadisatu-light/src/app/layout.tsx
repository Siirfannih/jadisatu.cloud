import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JadiSatu Light',
  description: 'JadiSatu OS - Light Mode',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-gray-900">
        {children}
      </body>
    </html>
  )
}
