import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import { ThemeProvider } from '@/lib/theme'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'JadiSatu OS - Creator Operating System',
  description: 'Your unified creator command center',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: `
          (function() {
            try {
              var theme = localStorage.getItem('jadisatu-theme');
              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <AppShell>
            {children}
          </AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
