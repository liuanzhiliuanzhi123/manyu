import type { Metadata } from 'next'
import { AppPreferenceSync } from '@/components/travel/app-preference-sync'
import { AuthProvider } from '@/components/travel/auth/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: '拾景拼途 - 北京智能行程',
  description:
    '先把想去的北京地点加入行程，再让 AI 生成顺路方案。',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="manyu-theme"
        >
          <AuthProvider>
            <AppPreferenceSync />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
