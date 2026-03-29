import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-gray-900 focus:shadow"
      >
        Skip to main content
      </a>

      <nav className="bg-white shadow-sm" aria-label="Primary">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/participant/pools" className="text-xl font-bold text-gray-900">
            Fantasy Golf
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/participant/pools" className="text-gray-600 hover:text-gray-900">
              My Pools
            </Link>
            <Link href="/commissioner" className="text-gray-600 hover:text-gray-900">
              Commissioner
            </Link>
          </div>
        </div>
      </nav>

      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
