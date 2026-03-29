'use client'

import { useCallback, useEffect, useRef } from 'react'
import { GolferScorecard } from './GolferScorecard'
import { getGolferScorecard } from '@/lib/golfer-detail'
import type { TournamentScore, Golfer } from '@/lib/supabase/types'

interface GolferDetailSheetProps {
  golfer: Golfer
  score: TournamentScore | null
  onClose: () => void
}

export function GolferDetailSheet({ golfer, score, onClose }: GolferDetailSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  const scorecard = score ? getGolferScorecard(score) : null

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      onClose={onClose}
      className="w-full max-w-lg rounded-lg shadow-xl p-0 backdrop:bg-black/50"
      aria-label={`${golfer.name} details`}
    >
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold">{golfer.name}</h2>
            <p className="text-sm text-gray-500">{golfer.country}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close golfer details"
          >
            <span aria-hidden="true" className="text-xl">&times;</span>
          </button>
        </div>

        {/* Scorecard */}
        {scorecard ? (
          <GolferScorecard scorecard={scorecard} />
        ) : (
          <div className="py-6 text-center text-gray-500 text-sm" role="status">
            No scoring data available for this golfer.
          </div>
        )}
      </div>
    </dialog>
  )
}
