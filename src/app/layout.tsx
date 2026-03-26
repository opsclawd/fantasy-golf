import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fantasy Golf Pool',
  description: 'Private golf pools with live scoring',
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
