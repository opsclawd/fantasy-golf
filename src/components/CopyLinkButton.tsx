'use client'

import { useState } from 'react'

interface CopyLinkButtonProps {
  url: string
  label?: string
}

export function CopyLinkButton({ url, label = 'Copy Link' }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text for manual copy
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
      aria-live="polite"
    >
      {copied ? (
        <>
          <span aria-hidden="true">{'\u2713'}</span>
          Copied!
        </>
      ) : (
        <>
          <span aria-hidden="true">{'\u2398'}</span>
          {label}
        </>
      )}
    </button>
  )
}
