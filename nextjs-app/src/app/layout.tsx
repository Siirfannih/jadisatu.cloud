import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/layout/AppShell'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'JadiSatu OS - Creator Operating System',
  description: 'Your unified creator command center',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{__html: `
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}} />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}
        style={{ backgroundColor: '#F8FAFC', color: '#0f172a' }}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
