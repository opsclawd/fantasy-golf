'use client'

import { useCallback, useEffect, useRef } from 'react'
import { GolferScorecard } from './GolferScorecard'
import { panelClasses, sectionHeadingClasses } from './uiStyles'
import { getGolferScorecard } from '@/lib/golfer-detail'
import type { TournamentScore } from '@/lib/supabase/types'
import type { GolferLike } from '@/lib/golfer-detail'

interface GolferDetailSheetProps {
  golfer: GolferLike
  score: TournamentScore | null
  onClose: () => void
}

export function GolferDetailSheet({ golfer, score, onClose }: GolferDetailSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      try {
        dialog.showModal()
      } catch {
        dialog.setAttribute('open', '')
      }

      if (!dialog.open) {
        dialog.setAttribute('open', '')
      }
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
  const golferStatus = scorecard
    ? scorecard.status === 'withdrawn'
      ? 'Withdrawn'
      : scorecard.status === 'cut'
        ? 'Cut'
        : `Thru ${scorecard.completedHoles} holes`
    : 'Awaiting scoring feed'
  const golferStatusClasses = scorecard
    ? scorecard.status === 'withdrawn' || scorecard.status === 'cut'
      ? 'border-amber-200/80 bg-amber-50 text-amber-800'
      : 'border-emerald-200/80 bg-emerald-50 text-emerald-800'
    : 'border-slate-200 bg-slate-100 text-slate-700'

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      onClose={onClose}
      className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-[#f8f5ee]/95 p-0 text-slate-900 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.55)] backdrop:bg-slate-950/55"
      aria-label={`${golfer.name} details`}
    >
      <div className="border-b border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(242,247,241,0.95))] px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <p className={sectionHeadingClasses()}>Golfer detail</p>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{golfer.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                {golfer.country ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-medium text-slate-700">
                    {golfer.country}
                  </span>
                ) : null}
                <span className={`rounded-full border px-3 py-1 font-medium ${golferStatusClasses}`}>
                  {golferStatus}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            aria-label="Close golfer details"
          >
            <span aria-hidden="true" className="text-xl">&times;</span>
          </button>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
        {scorecard ? (
          <section className={panelClasses()} aria-label="Scoring details">
            <div className="border-b border-slate-200/70 px-5 py-4">
              <p className={sectionHeadingClasses()}>Scoring details</p>
              <p className="mt-2 text-sm text-slate-600">
                Hole-by-hole scoring stays visible here so players and commissioners can verify the latest confirmed progress.
              </p>
            </div>
            <div className="px-5 py-5">
              <GolferScorecard scorecard={scorecard} />
            </div>
          </section>
        ) : (
          <section
            className="rounded-[1.75rem] border border-dashed border-slate-300/90 bg-white/75 px-6 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
            role="status"
            aria-live="polite"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-lg text-amber-700">
              i
            </div>
            <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
              Scoring details coming soon
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              We have not received hole-by-hole scoring data for this golfer yet.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Check back after the next leaderboard refresh to see round progress and scoring context.
            </p>
          </section>
        )}
      </div>
    </dialog>
  )
}
