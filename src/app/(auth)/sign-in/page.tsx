'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from './actions'

export default function SignIn() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const redirectTo = searchParams.get('redirect') ?? undefined
    const result = await signIn(email, password, redirectTo)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form className="space-y-4 w-full max-w-md p-8" action={handleSubmit}>
        <h1 className="text-2xl font-bold">Sign In</h1>
        {error && <p className="text-red-500">{error}</p>}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="text-center text-sm">
          Don&apos;t have an account? <a href="/sign-up" className="text-blue-600">Sign up</a>
        </p>
      </form>
    </div>
  )
}
