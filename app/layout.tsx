﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import type { Metadata } from 'next'
import { Geist, Geist_Mono, Noto_Sans_SC } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AppPreferenceSync } from '@/components/travel/app-preference-sync'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans-sc',
})

export const metadata: Metadata = {
  title: '途境漫语 - 智能旅行规划',
  description:
    '让每一次旅行都成为美好故事。智能行程规划，一键生成个性化旅行方案。',
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
      <body
        className={`${notoSansSC.variable} ${geist.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="manyu-theme"
        >
          <AppPreferenceSync />
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
