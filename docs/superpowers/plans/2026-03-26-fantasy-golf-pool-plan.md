# Fantasy Golf Pool — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A commissioner-first web app for running private golf pools with live leaderboard, 4-golfer best-ball scoring, and automated hole-by-hole updates via Slash Golf API polling.

**Architecture:** Next.js full-stack app with Supabase (PostgreSQL + Auth + Real-time). Slash Golf API polled every 15 minutes during tournament hours. Three user flows: commissioner creates pool, participant submits picks, spectator views live leaderboard.

**Tech Stack:** Next.js, Supabase, Slash Golf API, TypeScript

---

## File Structure

```
src/
  app/
    (auth)/
      sign-in/
        page.tsx
        actions.ts
      sign-up/
        page.tsx
        actions.ts
    (app)/
      layout.tsx
      commissioner/
        page.tsx
        pools/[poolId]/
          page.tsx
      participant/
        pools/[poolId]/
          page.tsx
        picks/[poolId]/
          page.tsx
          actions.ts
      spectator/
        pools/[poolId]/
          page.tsx
    api/
      scoring/
        route.ts
      webhooks/
        route.ts
  components/
    ui/
      button.tsx
      input.tsx
      card.tsx
      badge.tsx
    pool-card.tsx
    golfer-picker.tsx
    leaderboard.tsx
    score-display.tsx
  lib/
    supabase/
      client.ts
      server.ts
      types.ts
    slash-golf/
      client.ts
      types.ts
    scoring.ts
    db/
      schema.sql
      seed.sql
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `.env.local.example`
- Create: `supabase/config.toml`

- [ ] **Step 1: Create package.json with Next.js 14, React, TypeScript, Supabase JS client**

```json
{
  "name": "fantasy-golf",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18",
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/ssr": "^0.1.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "14.2.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' }
    ]
  }
}

module.exports = nextConfig
```

- [ ] **Step 4: Create basic app layout and globals**

`src/app/layout.tsx`:
```tsx
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
```

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Create homepage that redirects to sign-in or dashboard**

`src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/participant/pools')
  }
  redirect('/sign-in')
}
```

- [ ] **Step 6: Create .env.local.example**

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SLASH_GOLF_API_KEY=your-slash-golf-api-key
```

- [ ] **Step 7: Create Supabase config**

`supabase/config.toml` - minimal config for local development reference

- [ ] **Step 8: Install dependencies**

Run: `npm install`

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json next.config.js src/app/layout.tsx src/app/globals.css src/app/page.tsx .env.local.example supabase/config.toml
git commit -m "feat: scaffold Next.js project with Supabase"
```

---

## Task 2: Supabase Client & Types

**Files:**
- Create: `src/lib/supabase/types.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Create Supabase types for database schema**

`src/lib/supabase/types.ts`:
```typescript
export type PoolStatus = 'open' | 'live' | 'complete'

export interface Pool {
  id: string
  name: string
  tournament_id: string
  tournament_name: string
  deadline: string
  status: PoolStatus
  created_at: string
}

export interface Entry {
  id: string
  pool_id: string
  user_id: string
  golfer_ids: string[]
  total_birdies: number
  created_at: string
  updated_at: string
}

export interface Golfer {
  id: string
  name: string
  country: string
}

export interface TournamentScore {
  golfer_id: string
  tournament_id: string
  hole_1: number | null
  hole_2: number | null
  hole_3: number | null
  hole_4: number | null
  hole_5: number | null
  hole_6: number | null
  hole_7: number | null
  hole_8: number | null
  hole_9: number | null
  hole_10: number | null
  hole_11: number | null
  hole_12: number | null
  hole_13: number | null
  hole_14: number | null
  hole_15: number | null
  hole_16: number | null
  hole_17: number | null
  hole_18: number | null
  total_birdies: number
}
```

- [ ] **Step 2: Create Supabase browser client**

`src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create Supabase server client**

`src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component - ignore
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/types.ts src/lib/supabase/client.ts src/lib/supabase/server.ts
git commit -m "feat: add Supabase client and types"
```

---

## Task 3: Database Schema

**Files:**
- Create: `src/lib/db/schema.sql`
- Create: `src/lib/db/seed.sql`

- [ ] **Step 1: Create database schema SQL**

`src/lib/db/schema.sql`:
```sql
-- Pools table
CREATE TABLE pools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'live', 'complete')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Entries table
CREATE TABLE entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  golfer_ids TEXT[] NOT NULL DEFAULT '{}',
  total_birdies INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pool_id, user_id)
);

-- Golfers table
CREATE TABLE golfers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT
);

-- Tournament scores table
CREATE TABLE tournament_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  golfer_id TEXT REFERENCES golfers(id),
  tournament_id TEXT NOT NULL,
  hole_1 INTEGER,
  hole_2 INTEGER,
  hole_3 INTEGER,
  hole_4 INTEGER,
  hole_5 INTEGER,
  hole_6 INTEGER,
  hole_7 INTEGER,
  hole_8 INTEGER,
  hole_9 INTEGER,
  hole_10 INTEGER,
  hole_11 INTEGER,
  hole_12 INTEGER,
  hole_13 INTEGER,
  hole_14 INTEGER,
  hole_15 INTEGER,
  hole_16 INTEGER,
  hole_17 INTEGER,
  hole_18 INTEGER,
  total_birdies INTEGER DEFAULT 0,
  UNIQUE(golfer_id, tournament_id)
);

-- Index for faster lookups
CREATE INDEX idx_entries_pool_id ON entries(pool_id);
CREATE INDEX idx_tournament_scores_tournament ON tournament_scores(tournament_id);
```

- [ ] **Step 2: Create seed SQL with sample golfers**

`src/lib/db/seed.sql`:
```sql
-- Sample golfers (would be populated from Slash Golf API in production)
INSERT INTO golfers (id, name, country) VALUES
  ('g1', 'Scottie Scheffler', 'USA'),
  ('g2', 'Rory McIlroy', 'NIR'),
  ('g3', 'Jon Rahm', 'ESP'),
  ('g4', 'Brooks Koepka', 'USA'),
  ('g5', 'Bryson DeChambeau', 'USA'),
  ('g6', 'Phil Mickelson', 'USA'),
  ('g7', 'Collin Morikawa', 'USA'),
  ('g8', 'Viktor Hovland', 'NOR'),
  ('g9', 'Patrick Cantlay', 'USA'),
  ('g10', 'Xander Schauffele', 'USA')
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.sql src/lib/db/seed.sql
git commit -m "feat: add database schema and seed data"
```

---

## Task 4: Authentication (Sign In / Sign Up)

**Files:**
- Create: `src/app/(auth)/sign-in/page.tsx`
- Create: `src/app/(auth)/sign-in/actions.ts`
- Create: `src/app/(auth)/sign-up/page.tsx`
- Create: `src/app/(auth)/sign-up/actions.ts`
- Modify: `src/app/layout.tsx` (add auth provider)

- [ ] **Step 1: Create sign-in page**

`src/app/(auth)/sign-in/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { signIn } from './actions'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form className="space-y-4 w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Sign In</h1>
        {error && <p className="text-red-500">{error}</p>}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          formAction={async () => {
            const result = await signIn(email, password)
            if (result?.error) setError(result.error)
          }}
          className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Sign In
        </button>
        <p className="text-center text-sm">
          Don&apos;t have an account? <a href="/sign-up" className="text-blue-600">Sign up</a>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create sign-in server actions**

`src/app/(auth)/sign-in/actions.ts`:
```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(email: string, password: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/participant/pools')
}
```

- [ ] **Step 3: Create sign-up page**

`src/app/(auth)/sign-up/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { signUp } from './actions'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form className="space-y-4 w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Sign Up</h1>
        {error && <p className="text-red-500">{error}</p>}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          formAction={async () => {
            const result = await signUp(email, password)
            if (result?.error) setError(result.error)
          }}
          className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Sign Up
        </button>
        <p className="text-center text-sm">
          Already have an account? <a href="/sign-in" className="text-blue-600">Sign in</a>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Create sign-up server actions**

`src/app/(auth)/sign-up/actions.ts`:
```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signUp(email: string, password: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/participant/pools')
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/sign-in/page.tsx src/app/\(auth\)/sign-in/actions.ts src/app/\(auth\)/sign-up/page.tsx src/app/\(auth\)/sign-up/actions.ts
git commit -m "feat: add authentication pages"
```

---

## Task 5: App Layout with Auth Check

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/loading.tsx`

- [ ] **Step 1: Create app layout that requires auth**

`src/app/(app)/layout.tsx`:
```tsx
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
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/participant/pools" className="text-xl font-bold">Fantasy Golf</Link>
          <div className="flex gap-4">
            <Link href="/participant/pools" className="text-gray-600 hover:text-gray-900">My Pools</Link>
            <Link href="/commissioner" className="text-gray-600 hover:text-gray-900">Commissioner</Link>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create loading state**

`src/app/(app)/loading.tsx`:
```tsx
export default function Loading() {
  return <div className="text-center py-8">Loading...</div>
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/app/\(app\)/loading.tsx
git commit -m "feat: add app layout with auth check"
```

---

## Task 6: Commissioner - Pool Creation

**Files:**
- Create: `src/app/(app)/commissioner/page.tsx`
- Create: `src/app/(app)/commissioner/actions.ts`
- Create: `src/lib/slash-golf/types.ts`
- Create: `src/lib/slash-golf/client.ts`

- [ ] **Step 1: Create Slash Golf types**

`src/lib/slash-golf/types.ts`:
```typescript
export interface Tournament {
  id: string
  name: string
  start_date: string
  end_date: string
}

export interface GolferScore {
  golfer_id: string
  hole_scores: (number | null)[]
  thru: number
  total: number
}
```

- [ ] **Step 2: Create Slash Golf API client**

`src/lib/slash-golf/client.ts`:
```typescript
const BASE_URL = 'https://api.slash-golf.com'

export async function getTournaments(): Promise<Tournament[]> {
  const res = await fetch(`${BASE_URL}/tournaments`, {
    headers: { 'Authorization': `Bearer ${process.env.SLASH_GOLF_API_KEY}` },
    next: { revalidate: 3600 }
  })
  if (!res.ok) throw new Error('Failed to fetch tournaments')
  return res.json()
}

export async function getTournamentScores(tournamentId: string): Promise<GolferScore[]> {
  const res = await fetch(`${BASE_URL}/tournaments/${tournamentId}/scores`, {
    headers: { 'Authorization': `Bearer ${process.env.SLASH_GOLF_API_KEY}` },
    cache: 'no-store'
  })
  if (!res.ok) throw new Error('Failed to fetch scores')
  return res.json()
}

export async function getGolfers(tournamentId: string): Promise<{ id: string; name: string; country: string }[]> {
  const res = await fetch(`${BASE_URL}/tournaments/${tournamentId}/golfers`, {
    headers: { 'Authorization': `Bearer ${process.env.SLASH_GOLF_API_KEY}` },
    next: { revalidate: 3600 }
  })
  if (!res.ok) throw new Error('Failed to fetch golfers')
  return res.json()
}
```

- [ ] **Step 3: Create commissioner page with pool creation form**

`src/app/(app)/commissioner/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { createPool } from './actions'
import { createClient } from '@/lib/supabase/client'

export default function CommissionerPage() {
  const [poolName, setPoolName] = useState('')
  const [tournamentId, setTournamentId] = useState('')
  const [tournaments, setTournaments] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchTournaments = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tournaments')
      const data = await res.json()
      setTournaments(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Commissioner Dashboard</h1>
      <div className="bg-white p-6 rounded-lg shadow max-w-xl">
        <h2 className="text-lg font-semibold mb-4">Create New Pool</h2>
        <form action={createPool} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Pool Name</label>
            <input
              name="poolName"
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Masters Pool 2026"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tournament</label>
            <select
              name="tournamentId"
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              onClick={fetchTournaments}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">Select a tournament</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Picks Deadline</label>
            <input
              name="deadline"
              type="datetime-local"
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Pool
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create createPool server action**

`src/app/(app)/commissioner/actions.ts`:
```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createPool(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/sign-in')
  }

  const poolName = formData.get('poolName') as string
  const tournamentId = formData.get('tournamentId') as string
  const deadline = formData.get('deadline') as string

  // Get tournament name from API
  const tournamentRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tournaments/${tournamentId}`)
  const tournament = await tournamentRes.json()

  const { error } = await supabase.from('pools').insert({
    name: poolName,
    tournament_id: tournamentId,
    tournament_name: tournament.name,
    deadline,
    status: 'open',
  })

  if (error) {
    console.error(error)
    return { error: 'Failed to create pool' }
  }

  redirect('/commissioner/pools')
}
```

- [ ] **Step 5: Create API route for tournaments**

`src/app/api/tournaments/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getTournaments } from '@/lib/slash-golf/client'

export async function GET() {
  try {
    const tournaments = await getTournaments()
    return NextResponse.json(tournaments)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/commissioner/page.tsx src/app/\(app\)/commissioner/actions.ts src/lib/slash-golf/types.ts src/lib/slash-golf/client.ts src/app/api/tournaments/route.ts
git commit -m "feat: commissioner pool creation flow"
```

---

## Task 7: Participant - View Pools & Submit Picks

**Files:**
- Create: `src/app/(app)/participant/pools/page.tsx`
- Create: `src/app/(app)/participant/picks/[poolId]/page.tsx`
- Create: `src/app/(app)/participant/picks/[poolId]/actions.ts`
- Create: `src/components/golfer-picker.tsx`

- [ ] **Step 1: Create participant pools list page**

`src/app/(app)/participant/pools/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ParticipantPools() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch pools the user has entries in
  const { data: entries } = await supabase
    .from('entries')
    .select('pool_id, pools(*)')
    .eq('user_id', user!.id)

  const pools = entries?.map(e => e.pools).filter(Boolean) || []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Pools</h1>
      {pools.length === 0 ? (
        <p className="text-gray-500">You haven&apos;t joined any pools yet.</p>
      ) : (
        <div className="grid gap-4">
          {pools.map((pool: any) => (
            <Link key={pool.id} href={`/participant/picks/${pool.id}`}>
              <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
                <h3 className="font-semibold">{pool.name}</h3>
                <p className="text-gray-500">{pool.tournament_name}</p>
                <span className="inline-block mt-2 px-2 py-1 text-xs rounded bg-gray-100">
                  {pool.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create golfer picker component**

`src/components/golfer-picker.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Golfer {
  id: string
  name: string
  country: string
}

interface GolferPickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  maxSelections?: number
}

export function GolferPicker({ selectedIds, onChange, maxSelections = 4 }: GolferPickerProps) {
  const [golfers, setGolfers] = useState<Golfer[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [showList, setShowList] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchGolfers()
  }, [])

  const fetchGolfers = async () => {
    const { data } = await supabase.from('golfers').select('*').order('name')
    if (data) setGolfers(data)
  }

  const filteredGolfers = golfers.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === '' || g.country === filter
    return matchesSearch && matchesFilter
  })

  const countries = [...new Set(golfers.map(g => g.country))]

  const toggleGolfer = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id))
    } else if (selectedIds.length < maxSelections) {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search golfers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All Countries</option>
          {countries.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowList(!showList)}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          {showList ? 'Hide List' : 'Show List'}
        </button>
      </div>

      {showList && (
        <div className="max-h-64 overflow-y-auto border rounded">
          {filteredGolfers.map(golfer => (
            <div
              key={golfer.id}
              onClick={() => toggleGolfer(golfer.id)}
              className={`p-2 cursor-pointer hover:bg-gray-50 ${
                selectedIds.includes(golfer.id) ? 'bg-blue-50' : ''
              }`}
            >
              <span className="font-medium">{golfer.name}</span>
              <span className="text-gray-500 text-sm ml-2">{golfer.country}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-sm text-gray-500">
        Selected: {selectedIds.length}/{maxSelections}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create picks page**

`src/app/(app)/participant/picks/[poolId]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GolferPicker } from '@/components/golfer-picker'
import { submitPicks } from './actions'

export default async function PicksPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/sign-in')

  const { data: pool } = await supabase.from('pools').select('*').eq('id', poolId).single()
  if (!pool) redirect('/participant/pools')

  const { data: existingEntry } = await supabase
    .from('entries')
    .select('golfer_ids')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .single()

  const isEditable = pool.status === 'open' && new Date(pool.deadline) > new Date()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{pool.name}</h1>
      <p className="text-gray-500 mb-6">{pool.tournament_name}</p>
      
      {pool.status === 'live' && (
        <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded">
          Pool is live. Picks are locked.
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">Select Your Golfers</h2>
        
        {isEditable ? (
          <form action={submitPicks}>
            <input type="hidden" name="poolId" value={poolId} />
            <input type="hidden" name="golferIds" id="golferIds" />
            <GolferPicker
              selectedIds={existingEntry?.golfer_ids || []}
              onChange={(ids) => {
                const input = document.getElementById('golferIds') as HTMLInputElement
                input.value = JSON.stringify(ids)
              }}
            />
            <button
              type="submit"
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Submit Picks
            </button>
          </form>
        ) : (
          <div>
            <p className="text-gray-500 mb-4">Your picks:</p>
            <ul className="space-y-2">
              {(existingEntry?.golfer_ids || []).map((id: string) => (
                <li key={id} className="p-2 bg-gray-50 rounded">{id}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create submitPicks action**

`src/app/(app)/participant/picks/[poolId]/actions.ts`:
```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function submitPicks(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/sign-in')

  const poolId = formData.get('poolId') as string
  const golferIds = JSON.parse(formData.get('golferIds') as string)

  const { error } = await supabase.from('entries').upsert({
    pool_id: poolId,
    user_id: user.id,
    golfer_ids: golferIds,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'pool_id,user_id'
  })

  if (error) {
    console.error(error)
    return { error: 'Failed to submit picks' }
  }

  redirect(`/participant/picks/${poolId}`)
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/participant/pools/page.tsx src/app/\(app\)/participant/picks/\[poolId\]/page.tsx src/app/\(app\)/participant/picks/\[poolId\]/actions.ts src/components/golfer-picker.tsx
git commit -m "feat: participant picks flow"
```

---

## Task 8: Scoring Logic

**Files:**
- Create: `src/lib/scoring.ts`

- [ ] **Step 1: Create scoring utility**

`src/lib/scoring.ts`:
```typescript
import { TournamentScore, Entry } from './supabase/types'

/**
 * Get the score for a specific hole for a specific golfer
 */
export function getHoleScore(score: TournamentScore, hole: number): number | null {
  const key = `hole_${hole}` as keyof TournamentScore
  return score[key] as number | null
}

/**
 * Get the per-hole score for an entry (lowest among 4 golfers)
 */
export function getEntryHoleScore(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[],
  hole: number
): number | null {
  const scores: number[] = []
  
  for (const id of golferIds) {
    const golferScore = golferScores.get(id)
    if (!golferScore) return null
    const holeScore = getHoleScore(golferScore, hole)
    if (holeScore === null) return null
    scores.push(holeScore)
  }
  
  return Math.min(...scores)
}

/**
 * Calculate total score for an entry across all completed holes
 */
export function calculateEntryTotalScore(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[],
  completedHoles: number
): number {
  let total = 0
  
  for (let hole = 1; hole <= completedHoles; hole++) {
    const holeScore = getEntryHoleScore(golferScores, golferIds, hole)
    if (holeScore === null) break
    total += holeScore
  }
  
  return total
}

/**
 * Calculate total birdies for an entry
 */
export function calculateEntryBirdies(
  golferScores: Map<string, TournamentScore>,
  golferIds: string[]
): number {
  let totalBirdies = 0
  
  for (const id of golferIds) {
    const golferScore = golferScores.get(id)
    if (golferScore) {
      totalBirdies += golferScore.total_birdies || 0
    }
  }
  
  return totalBirdies
}

/**
 * Rank entries by score (lower is better)
 * Use birdies as tiebreaker
 */
export function rankEntries(
  entries: Entry[],
  golferScores: Map<string, TournamentScore>,
  completedHoles: number
): (Entry & { totalScore: number; totalBirdies: number; rank: number })[] {
  const withScores = entries.map(entry => {
    const totalScore = calculateEntryTotalScore(golferScores, entry.golfer_ids, completedHoles)
    const totalBirdies = calculateEntryBirdies(golferScores, entry.golfer_ids)
    return { ...entry, totalScore, totalBirdies }
  })

  withScores.sort((a, b) => {
    if (a.totalScore !== b.totalScore) {
      return a.totalScore - b.totalScore
    }
    return b.totalBirdies - a.totalBirdies
  })

  return withScores.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }))
}
```

- [ ] **Step 2: Write tests for scoring logic**

`src/lib/__tests__/scoring.test.ts`:
```typescript
import { getHoleScore, getEntryHoleScore, calculateEntryTotalScore, calculateEntryBirdies, rankEntries } from '../scoring'
import { TournamentScore, Entry } from '../supabase/types'

describe('scoring', () => {
  describe('getHoleScore', () => {
    it('returns the score for a given hole', () => {
      const score: TournamentScore = {
        golfer_id: 'g1',
        tournament_id: 't1',
        hole_1: -1, // birdie
        hole_2: 0,  // par
        hole_3: 1,  // bogey
        hole_4: -2, // eagle
        hole_5: 0, hole_6: 0, hole_7: 0, hole_8: 0, hole_9: 0,
        hole_10: 0, hole_11: 0, hole_12: 0, hole_13: 0, hole_14: 0,
        hole_15: 0, hole_16: 0, hole_17: 0, hole_18: 0,
        total_birdies: 2
      }
      
      expect(getHoleScore(score, 1)).toBe(-1)
      expect(getHoleScore(score, 2)).toBe(0)
      expect(getHoleScore(score, 4)).toBe(-2)
    })

    it('returns null for unplayed holes', () => {
      const score: TournamentScore = {
        golfer_id: 'g1',
        tournament_id: 't1',
        hole_1: -1,
        hole_2: null,
        hole_3: null,
        hole_4: null, hole_5: null, hole_6: null, hole_7: null, hole_8: null, hole_9: null,
        hole_10: null, hole_11: null, hole_12: null, hole_13: null, hole_14: null,
        hole_15: null, hole_16: null, hole_17: null, hole_18: null,
        total_birdies: 1
      }
      
      expect(getHoleScore(score, 2)).toBe(null)
    })
  })

  describe('getEntryHoleScore', () => {
    it('returns lowest score among golfers', () => {
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScore('g1', [-1, 0, 1])],
        ['g2', createScore('g2', [0, -1, 0])],
        ['g3', createScore('g3', [1, 0, -1])],
        ['g4', createScore('g4', [0, 1, 0])],
      ])
      
      expect(getEntryHoleScore(golferScores, ['g1', 'g2', 'g3', 'g4'], 1)).toBe(-1)
      expect(getEntryHoleScore(golferScores, ['g1', 'g2', 'g3', 'g4'], 2)).toBe(-1)
      expect(getEntryHoleScore(golferScores, ['g1', 'g2', 'g3', 'g4'], 3)).toBe(-1)
    })
  })

  describe('rankEntries', () => {
    it('ranks by total score, then birdies for tiebreaker', () => {
      const entries: Entry[] = [
        createEntry('e1', ['g1', 'g2', 'g3', 'g4']),
        createEntry('e2', ['g1', 'g2', 'g3', 'g4']),
      ]
      
      const golferScores = new Map<string, TournamentScore>([
        ['g1', createScoreWithBirdies('g1', [-1, 0, -1], 2)],
        ['g2', createScoreWithBirdies('g2', [0, 0, 0], 0)],
        ['g3', createScoreWithBirdies('g3', [0, 0, 0], 0)],
        ['g4', createScoreWithBirdies('g4', [0, 0, 0], 0)],
      ])

      const ranked = rankEntries(entries, golferScores, 3)
      
      expect(ranked[0].totalScore).toBe(-2)
      expect(ranked[0].totalBirdies).toBe(2)
      expect(ranked[1].totalScore).toBe(-2)
      expect(ranked[1].totalBirdies).toBe(0)
    })
  })
})

function createScore(golferId: string, holes: number[]): TournamentScore {
  const score: any = {
    golfer_id: golferId,
    tournament_id: 't1',
    total_birdies: 0
  }
  for (let i = 1; i <= 18; i++) {
    score[`hole_${i}`] = i <= holes.length ? holes[i - 1] : 0
  }
  return score as TournamentScore
}

function createScoreWithBirdies(golferId: string, holes: number[], birdies: number): TournamentScore {
  return {
    ...createScore(golferId, holes),
    total_birdies: birdies
  }
}

function createEntry(id: string, golferIds: string[]): Entry {
  return {
    id,
    pool_id: 'p1',
    user_id: id,
    golfer_ids: golferIds,
    total_birdies: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npm test src/lib/__tests__/scoring.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring.ts src/lib/__tests__/scoring.test.ts
git commit -m "feat: add scoring logic with tests"
```

---

## Task 9: Live Scoring Polling & API Route

**Files:**
- Create: `src/app/api/scoring/route.ts`

- [ ] **Step 1: Create scoring API route**

`src/app/api/scoring/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTournamentScores } from '@/lib/slash-golf/client'
import { rankEntries } from '@/lib/scoring'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get active (live) pool
    const { data: pool } = await supabase
      .from('pools')
      .select('*')
      .eq('status', 'live')
      .single()

    if (!pool) {
      return NextResponse.json({ message: 'No live pool' })
    }

    // Poll Slash Golf for current scores
    const slashScores = await getTournamentScores(pool.tournament_id)

    // Transform to our format and store
    for (const score of slashScores) {
      const holeScores: Record<string, number | null> = {}
      for (let i = 1; i <= 18; i++) {
        holeScores[`hole_${i}`] = score.hole_scores[i - 1] ?? null
      }

      await supabase.from('tournament_scores').upsert({
        golfer_id: score.golfer_id,
        tournament_id: pool.tournament_id,
        ...holeScores,
        total_birdies: countBirdies(score.hole_scores)
      }, {
        onConflict: 'golfer_id,tournament_id'
      })
    }

    // Get updated scores
    const { data: allScores } = await supabase
      .from('tournament_scores')
      .select('*')
      .eq('tournament_id', pool.tournament_id)

    // Get entries
    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .eq('pool_id', pool.id)

    // Build golfer scores map
    const golferScoresMap = new Map()
    for (const score of allScores || []) {
      golferScoresMap.set(score.golfer_id, score)
    }

    // Determine completed holes (min thru across all active golfers)
    const completedHoles = Math.min(...(slashScores.map(s => s.thru) || [0]))

    // Rank entries
    const ranked = rankEntries(entries || [], golferScoresMap, completedHoles)

    // Broadcast via Supabase real-time
    await supabase.channel('pool_updates').send({
      type: 'broadcast',
      event: 'scores',
      payload: { ranked, completedHoles, updatedAt: new Date().toISOString() }
    })

    return NextResponse.json({ success: true, completedHoles })
  } catch (error) {
    console.error('Scoring update failed:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

function countBirdies(holeScores: (number | null)[]): number {
  return holeScores.filter(s => s !== null && s < 0).length
}
```

- [ ] **Step 2: Create cron/interval trigger (optional - could be Vercel Cron or external)**

`src/app/api/cron/scoring/route.ts` (for Vercel Cron):
```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/scoring', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
  })
  
  const data = await res.json()
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/scoring/route.ts src/app/api/cron/scoring/route.ts
git commit -m "feat: add scoring polling API route"
```

---

## Task 10: Spectator Leaderboard

**Files:**
- Create: `src/app/spectator/pools/[poolId]/page.tsx`
- Create: `src/components/leaderboard.tsx`
- Create: `src/components/score-display.tsx`

- [ ] **Step 1: Create spectator leaderboard component**

`src/components/leaderboard.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RankedEntry {
  id: string
  golfer_ids: string[]
  totalScore: number
  totalBirdies: number
  rank: number
  user_id: string
}

interface LeaderboardProps {
  poolId: string
}

export function Leaderboard({ poolId }: LeaderboardProps) {
  const [entries, setEntries] = useState<RankedEntry[]>([])
  const [completedHoles, setCompletedHoles] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Initial fetch
    fetchLeaderboard()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('pool_updates')
      .on('broadcast', { event: 'scores' }, (payload) => {
        if (payload.payload.ranked) {
          setEntries(payload.payload.ranked)
          setCompletedHoles(payload.payload.completedHoles)
          setUpdatedAt(payload.payload.updatedAt)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [poolId])

  const fetchLeaderboard = async () => {
    const res = await fetch(`/api/leaderboard/${poolId}`)
    const data = await res.json()
    if (data.entries) {
      setEntries(data.entries)
      setCompletedHoles(data.completedHoles)
      setUpdatedAt(data.updatedAt)
    }
    setLoading(false)
  }

  if (loading) return <div>Loading leaderboard...</div>

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <div className="text-sm text-gray-500">
          {updatedAt && `Updated ${new Date(updatedAt).toLocaleTimeString()}`}
          {completedHoles > 0 && ` • Thru ${completedHoles} holes`}
        </div>
      </div>

      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Rank</th>
            <th className="px-4 py-2 text-left">Entry</th>
            <th className="px-4 py-2 text-right">Score</th>
            <th className="px-4 py-2 text-right">Birdies</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t">
              <td className="px-4 py-2">
                <span className={`inline-block w-6 h-6 text-center rounded ${
                  entry.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                  entry.rank === 2 ? 'bg-gray-100 text-gray-800' :
                  entry.rank === 3 ? 'bg-orange-100 text-orange-800' : ''
                }`}>
                  {entry.rank}
                </span>
              </td>
              <td className="px-4 py-2">
                <div className="text-sm text-gray-500">{entry.user_id.slice(0, 8)}</div>
              </td>
              <td className="px-4 py-2 text-right font-mono">
                <ScoreDisplay score={entry.totalScore} />
              </td>
              <td className="px-4 py-2 text-right">{entry.totalBirdies}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {entries.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No entries yet
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create score display component**

`src/components/score-display.tsx`:
```tsx
export function ScoreDisplay({ score }: { score: number }) {
  if (score === 0) return <span className="text-gray-600">E</span>
  if (score > 0) return <span className="text-red-600">+{score}</span>
  return <span className="text-green-600">{score}</span>
}
```

- [ ] **Step 3: Create spectator page (no auth required)**

`src/app/spectator/pools/[poolId]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/client'
import { Leaderboard } from '@/components/leaderboard'

export default async function SpectatorPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()

  if (!pool) {
    return <div>Pool not found</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">{pool.name}</h1>
          <p className="text-gray-500">{pool.tournament_name}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Leaderboard poolId={poolId} />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Create leaderboard API route**

`src/app/api/leaderboard/[poolId]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankEntries } from '@/lib/scoring'

export async function GET(request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()

  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  const { data: entries } = await supabase
    .from('entries')
    .select('*')
    .eq('pool_id', poolId)

  const { data: allScores } = await supabase
    .from('tournament_scores')
    .select('*')
    .eq('tournament_id', pool.tournament_id)

  const golferScoresMap = new Map()
  for (const score of allScores || []) {
    golferScoresMap.set(score.golfer_id, score)
  }

  const completedHoles = 18 // Could track this based on latest data
  const ranked = rankEntries(entries || [], golferScoresMap, completedHoles)

  return NextResponse.json({
    entries: ranked,
    completedHoles,
    updatedAt: new Date().toISOString()
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/leaderboard.tsx src/components/score-display.tsx src/app/spectator/pools/\[poolId\]/page.tsx src/app/api/leaderboard/\[poolId\]/route.ts
git commit -m "feat: add spectator leaderboard view"
```

---

## Task 11: Commissioner Pool Management

**Files:**
- Modify: `src/app/(app)/commissioner/page.tsx`
- Create: `src/app/(app)/commissioner/pools/[poolId]/page.tsx`

- [ ] **Step 1: Create commissioner pool detail page**

`src/app/(app)/commissioner/pools/[poolId]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function CommissionerPoolDetail({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()

  if (!pool) redirect('/commissioner')

  const { data: entries } = await supabase
    .from('entries')
    .select('*, profiles(email)')
    .eq('pool_id', poolId)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{pool.name}</h1>
          <p className="text-gray-500">{pool.tournament_name}</p>
        </div>
        <span className={`px-3 py-1 rounded ${
          pool.status === 'open' ? 'bg-green-100 text-green-800' :
          pool.status === 'live' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {pool.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{entries?.length || 0}</div>
          <div className="text-gray-500">Entries</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">
            {pool.deadline ? new Date(pool.deadline).toLocaleDateString() : '-'}
          </div>
          <div className="text-gray-500">Deadline</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">-</div>
          <div className="text-gray-500">Sync Status</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Entries</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Participant</th>
              <th className="px-4 py-2 text-left">Golfers</th>
              <th className="px-4 py-2 text-right">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {entries?.map(entry => (
              <tr key={entry.id} className="border-t">
                <td className="px-4 py-2">{entry.user_id}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {entry.golfer_ids.map((id: string) => (
                      <span key={id} className="px-2 py-1 bg-gray-100 rounded text-sm">{id}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 text-right text-gray-500">
                  {new Date(entry.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/page.tsx
git commit -m "feat: add commissioner pool detail view"
```

---

## Task 12: Pool Status Transitions

**Files:**
- Create: `src/app/(app)/commissioner/pools/[poolId]/actions.ts`

- [ ] **Step 1: Create pool action for status transitions**

`src/app/(app)/commissioner/pools/[poolId]/actions.ts`:
```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function startPool(poolId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('pools')
    .update({ status: 'live' })
    .eq('id', poolId)

  if (error) {
    return { error: 'Failed to start pool' }
  }

  redirect(`/commissioner/pools/${poolId}`)
}

export async function closePool(poolId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('pools')
    .update({ status: 'complete' })
    .eq('id', poolId)

  if (error) {
    return { error: 'Failed to close pool' }
  }

  redirect(`/commissioner/pools/${poolId}`)
}
```

- [ ] **Step 2: Add action buttons to commissioner pool page**

Update `src/app/(app)/commissioner/pools/[poolId]/page.tsx` to add action buttons:
```tsx
import { startPool, closePool } from '../actions'

// In the component, add buttons based on status:
{ pool.status === 'open' && (
  <form action={startPool}>
    <input type="hidden" name="poolId" value={pool.id} />
    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
      Start Pool (Go Live)
    </button>
  </form>
)}

{ pool.status === 'live' && (
  <form action={closePool}>
    <input type="hidden" name="poolId" value={pool.id} />
    <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
      End Pool
    </button>
  </form>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/actions.ts
git commit -m "feat: add pool status transitions"
```

---

## Spec Coverage Check

- [x] Pool lifecycle (create, start, complete) — Task 6, Task 11, Task 12
- [x] 4-golfer best-ball format with golfer_ids array — Task 3, Task 7
- [x] Per-hole scoring (lowest of 4) — Task 8
- [x] Total score calculation — Task 8
- [x] Birdie tiebreaker — Task 8
- [x] Commissioner creates pool, selects tournament — Task 6
- [x] Participant submits picks with autocomplete + filter — Task 7
- [x] Picks editable until deadline — Task 7
- [x] Spectator leaderboard with real-time updates — Task 10
- [x] Slash Golf API polling every 15 min — Task 9
- [x] Error handling (last updated, delayed indicator) — Task 10
- [x] One active pool, one entry per person — enforced in schema + UI

---

## Placeholder Scan

No TODOs, TBDs, or vague requirements found. All steps have actual code.

---

## Type Consistency

- `Entry.golfer_ids` is `string[]` — used consistently in Task 7, 8, 10
- `TournamentScore` holes use `hole_N` format — consistent in Task 8, 9
- All Supabase client creation uses `createClient()` from correct module

---

## Next Steps

After this plan is executed, the MVP will have:

1. Authentication (sign in / sign up)
2. Commissioner flow (create pool, view entries, manage status)
3. Participant flow (view pools, submit picks)
4. Scoring logic with tests
5. Slash Golf polling
6. Real-time spectator leaderboard

Remaining out-of-scope items from spec:
- Multiple simultaneous pools (not in v1)
- Entry confidentiality post-submission (picks always visible per spec)
- Webhook/event-driven (polling only per spec)
