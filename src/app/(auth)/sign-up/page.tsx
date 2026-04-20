'use client'

import { useState } from 'react'
import { signUp } from './actions'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { sectionHeadingClasses } from '@/components/uiStyles'

export default function SignUp() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const result = await signUp(email, password)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card accent="left" className="w-full max-w-md p-6 sm:p-8">
        <form className="space-y-4" action={handleSubmit}>
          <p className={sectionHeadingClasses()}>Create account</p>
          {error && <p className="text-red-600">{error}</p>}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-stone-600">
            Already have an account?{' '}
            <a href="/sign-in" className="font-medium text-green-700 hover:text-green-900 hover:underline">
              Sign in
            </a>
          </p>
        </form>
      </Card>
    </div>
  )
}
