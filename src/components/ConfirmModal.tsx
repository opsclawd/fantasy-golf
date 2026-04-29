'use client'

import { useState, useEffect } from 'react'
import { panelClasses, sectionHeadingClasses } from './uiStyles'

interface ConfirmModalProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  isDestructive?: boolean
  requireTextMatch?: { text: string; label: string }
  confirmDelaySeconds?: number
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  isDestructive = false,
  requireTextMatch,
  confirmDelaySeconds,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [isDelayActive, setIsDelayActive] = useState(!!confirmDelaySeconds)
  const [canConfirm, setCanConfirm] = useState(false)

  useEffect(() => {
    if (!confirmDelaySeconds) return
    const timer = setTimeout(() => setIsDelayActive(false), confirmDelaySeconds * 1000)
    return () => clearTimeout(timer)
  }, [confirmDelaySeconds])

  useEffect(() => {
    if (requireTextMatch) {
      setCanConfirm(inputValue === requireTextMatch.text)
    } else if (confirmDelaySeconds) {
      setCanConfirm(!isDelayActive)
    } else {
      setCanConfirm(true)
    }
  }, [inputValue, isDelayActive, requireTextMatch, confirmDelaySeconds])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className={`${panelClasses()} max-w-md border-2 ${isDestructive ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'} p-6`}>
        <h2 className={sectionHeadingClasses()}>{title}</h2>
        <p className="mt-2 text-sm text-stone-700">{body}</p>

        {requireTextMatch && (
          <div className="mt-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
              Type &quot;{requireTextMatch.text}&quot; to confirm
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="mt-1 w-full rounded border border-stone-300 p-2 text-sm"
              autoComplete="off"
            />
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className={`flex-1 rounded px-4 py-2 text-sm font-semibold text-white ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                : 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
