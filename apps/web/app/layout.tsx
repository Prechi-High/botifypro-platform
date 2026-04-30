import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: '1-TouchBot',
  description: 'Build powerful Telegram bots'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const themeCookie = cookieStore.get('site-theme')?.value
  const initialTheme = themeCookie === 'light' ? 'light' : 'dark'

  return (
    <html lang="en" data-theme={initialTheme} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider initialTheme={initialTheme}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
