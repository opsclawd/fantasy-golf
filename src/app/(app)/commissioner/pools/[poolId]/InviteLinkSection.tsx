'use client'

import { useMemo, useState } from 'react'

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
    <section className="bg-white p-4 rounded-lg shadow mb-6">
      <h2 className="font-semibold mb-2">Invite Link</h2>
      <p className="text-sm text-gray-600 mb-3">Share this link so players can join your pool.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          readOnly
          value={inviteUrl}
          className="flex-1 p-2 border rounded bg-gray-50 text-sm"
          aria-label="Pool invite link"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </section>
  )
}
