import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fantasy Golf Pool',
  description: 'Private golf pools with live scoring',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Fantasy Golf Pool',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#1f5d3f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
