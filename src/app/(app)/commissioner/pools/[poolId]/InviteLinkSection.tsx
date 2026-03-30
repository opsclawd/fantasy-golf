'use client'

import { useMemo, useState } from 'react'

import { panelClasses, sectionHeadingClasses } from '@/components/uiStyles'

type InviteLinkSectionProps = {
  inviteCode: string
}

export default function InviteLinkSection({ inviteCode }: InviteLinkSectionProps) {
  const [copied, setCopied] = useState(false)

  const inviteUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return `/join/${inviteCode}`
    }
    return `${window.location.origin}/join/${inviteCode}`
  }, [inviteCode])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className={`${panelClasses()} p-5`}>
      <p className={sectionHeadingClasses()}>Invite players</p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Share the pool link</h2>
          <p className="mt-1 text-sm text-slate-600">Send this link so players can join before picks lock.</p>
        </div>
        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-900">
          Invite code: {inviteCode}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={inviteUrl}
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          aria-label="Pool invite link"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {copied ? 'Copied link' : 'Copy link'}
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        Players land on the join flow immediately, so you can use this as the fastest next step after creating the pool.
      </p>
    </section>
  )
}
