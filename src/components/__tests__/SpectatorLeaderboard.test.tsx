import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

import { ScoreDisplay } from '../score-display'
import { FreshnessChip } from '../FreshnessChip'
import { LeaderboardHeader } from '../LeaderboardHeader'
import { LeaderboardRow } from '../LeaderboardRow'

const SCORE_DISPLAY_PATH = path.join(__dirname, '..', 'score-display.tsx')
const FRESHNESS_CHIP_PATH = path.join(__dirname, '..', 'FreshnessChip.tsx')
const LEADERBOARD_HEADER_PATH = path.join(__dirname, '..', 'LeaderboardHeader.tsx')
const LEADERBOARD_ROW_PATH = path.join(__dirname, '..', 'LeaderboardRow.tsx')
const LEADERBOARD_PATH = path.join(__dirname, '..', 'leaderboard.tsx')
const PAGE_PATH = path.join(__dirname, '..', '..', 'app', 'spectator', 'pools', '[poolId]', 'page.tsx')

describe('Spectator leaderboard token migration (OPS-23)', () => {
  describe('ScoreDisplay', () => {
    it('renders even par with stone-600', () => {
      const markup = renderToStaticMarkup(createElement(ScoreDisplay, { score: 0 }))
      expect(markup).toContain('text-stone-600')
      expect(markup).not.toContain('text-gray-600')
    })

    it('renders over par with text-red-600', () => {
      const markup = renderToStaticMarkup(createElement(ScoreDisplay, { score: 3 }))
      expect(markup).toContain('text-red-600')
    })

    it('renders under par with text-green-700', () => {
      const markup = renderToStaticMarkup(createElement(ScoreDisplay, { score: -2 }))
      expect(markup).toContain('text-green-700')
      expect(markup).not.toContain('text-green-600')
    })

    it('applies font-mono tabular-nums to all score variants', () => {
      const evenPar = renderToStaticMarkup(createElement(ScoreDisplay, { score: 0 }))
      const overPar = renderToStaticMarkup(createElement(ScoreDisplay, { score: 1 }))
      const underPar = renderToStaticMarkup(createElement(ScoreDisplay, { score: -1 }))
      expect(evenPar).toContain('font-mono')
      expect(evenPar).toContain('tabular-nums')
      expect(overPar).toContain('font-mono')
      expect(underPar).toContain('font-mono')
    })

    it('does not use gray-* tokens in source file', () => {
      const source = fs.readFileSync(SCORE_DISPLAY_PATH, 'utf-8')
      const grayMatches = source.match(/gray-\d{2,3}/g)
      expect(grayMatches).toBeNull()
    })
  })

  describe('FreshnessChip', () => {
    it('uses green-* tokens for current status (not emerald)', () => {
      const source = fs.readFileSync(FRESHNESS_CHIP_PATH, 'utf-8')
      expect(source).toContain('border-green-200')
      expect(source).toContain('bg-green-50')
      expect(source).toContain('text-green-900')
      expect(source).not.toContain('emerald-200')
      expect(source).not.toContain('bg-emerald-50')
      expect(source).not.toContain('text-emerald-900')
    })

    it('uses stone-* tokens for unknown status (not slate)', () => {
      const source = fs.readFileSync(FRESHNESS_CHIP_PATH, 'utf-8')
      expect(source).toContain('border-stone-200')
      expect(source).toContain('bg-stone-100')
      expect(source).toContain('text-stone-700')
      expect(source).not.toContain('border-slate-200')
      expect(source).not.toContain('bg-slate-100')
      expect(source).not.toContain('text-slate-700')
    })

    it('replaces text-green-800/70 (not text-green-700/70) in sectionHeadingClasses call', () => {
      const source = fs.readFileSync(FRESHNESS_CHIP_PATH, 'utf-8')
      expect(source).toContain('text-green-800/70')
      expect(source).not.toContain("text-green-700/70")
    })
  })

  describe('LeaderboardHeader', () => {
    it('uses green-700 for eyebrow (not emerald-700)', () => {
      const markup = renderToStaticMarkup(createElement(LeaderboardHeader, { completedRounds: 2 }))
      expect(markup).toContain('text-green-700')
      expect(markup).not.toContain('text-emerald-700')
    })

    it('uses stone-* tokens (not slate-*)', () => {
      const markup = renderToStaticMarkup(createElement(LeaderboardHeader, { completedRounds: 2 }))
      expect(markup).toContain('text-stone-950')
      expect(markup).toContain('text-stone-500')
      expect(markup).not.toContain('text-slate-950')
      expect(markup).not.toContain('text-slate-500')
    })

    it('uses stone border (not slate border)', () => {
      const source = fs.readFileSync(LEADERBOARD_HEADER_PATH, 'utf-8')
      expect(source).toContain('border-stone-200/80')
      expect(source).not.toContain('border-slate-200/80')
    })
  })

  describe('LeaderboardRow', () => {
    it('does not use emerald-* tokens in source', () => {
      const source = fs.readFileSync(LEADERBOARD_ROW_PATH, 'utf-8')
      expect(source).not.toContain('emerald-50')
      expect(source).not.toContain('emerald-100')
      expect(source).not.toContain('emerald-900')
    })

    it('does not use slate-* tokens in source', () => {
      const source = fs.readFileSync(LEADERBOARD_ROW_PATH, 'utf-8')
      expect(source).not.toContain('slate-900')
      expect(source).not.toContain('slate-950')
      expect(source).not.toContain('slate-600')
      expect(source).not.toContain('slate-200')
    })

    it('uses stone-* tokens for rank badge and entry name', () => {
      const source = fs.readFileSync(LEADERBOARD_ROW_PATH, 'utf-8')
      expect(source).toContain('bg-stone-900')
      expect(source).toContain('text-stone-950')
      expect(source).toContain('text-stone-600')
      expect(source).toContain('border-stone-200/80')
    })

    it('uses green-* tokens for active golfer pills', () => {
      const source = fs.readFileSync(LEADERBOARD_ROW_PATH, 'utf-8')
      expect(source).toContain('bg-green-50')
      expect(source).toContain('text-green-900')
      expect(source).toContain('hover:bg-green-100')
    })

    it('uses amber-50/amber-800 for withdrawn golfer pills', () => {
      const source = fs.readFileSync(LEADERBOARD_ROW_PATH, 'utf-8')
      expect(source).toContain('bg-amber-50')
      expect(source).toContain('text-amber-800')
    })

    it('accepts rowIndex prop for alternating rows', () => {
      const source = fs.readFileSync(LEADERBOARD_ROW_PATH, 'utf-8')
      expect(source).toContain('rowIndex')
    })

    it('applies bg-stone-50/60 on odd rows', () => {
      const source = fs.readFileSync(LEADERBOARD_ROW_PATH, 'utf-8')
      expect(source).toContain('bg-stone-50/60')
    })

    it('applies bg-white on even rows', () => {
      const source = fs.readFileSync(LEADERBOARD_ROW_PATH, 'utf-8')
      expect(source).toContain('bg-white')
    })
  })

  describe('leaderboard.tsx', () => {
    it('does not use slate-* tokens in source', () => {
      const source = fs.readFileSync(LEADERBOARD_PATH, 'utf-8')
      expect(source).not.toContain('slate-100')
      expect(source).not.toContain('slate-500')
      expect(source).not.toContain('slate-200')
    })

    it('uses stone-* tokens for table header', () => {
      const source = fs.readFileSync(LEADERBOARD_PATH, 'utf-8')
      expect(source).toContain('bg-stone-100/80')
      expect(source).toContain('text-stone-600')
      expect(source).toContain('border-stone-200/80')
    })

    it('uses text-stone-500 for loading state', () => {
      const source = fs.readFileSync(LEADERBOARD_PATH, 'utf-8')
      expect(source).toContain('text-stone-500')
    })

    it('uses min-w-[28rem] for mobile optimization', () => {
      const source = fs.readFileSync(LEADERBOARD_PATH, 'utf-8')
      expect(source).toContain('min-w-[28rem]')
      expect(source).not.toContain('min-w-[40rem]')
    })

    it('uses rounded-3xl for table border radius', () => {
      const source = fs.readFileSync(LEADERBOARD_PATH, 'utf-8')
      expect(source).toContain('rounded-3xl')
      expect(source).not.toContain('rounded-2xl')
    })

    it('hides Birdies column on mobile with hidden sm:table-cell', () => {
      const source = fs.readFileSync(LEADERBOARD_PATH, 'utf-8')
      expect(source).toContain('hidden sm:table-cell')
    })

    it('passes index as rowIndex to LeaderboardRow', () => {
      const source = fs.readFileSync(LEADERBOARD_PATH, 'utf-8')
      expect(source).toMatch(/rowIndex.*index|index.*rowIndex/)
    })
  })

  describe('page.tsx (spectator)', () => {
    it('does not use slate-* tokens in source', () => {
      const source = fs.readFileSync(PAGE_PATH, 'utf-8')
      expect(source).not.toContain('text-slate-950')
      expect(source).not.toContain('text-slate-600')
    })

    it('uses bg-primary-900 for dark green header', () => {
      const source = fs.readFileSync(PAGE_PATH, 'utf-8')
      expect(source).toContain('bg-primary-900')
    })

    it('uses text-white for pool name heading', () => {
      const source = fs.readFileSync(PAGE_PATH, 'utf-8')
      expect(source).toContain('text-white')
    })

    it('uses text-green-200 for secondary header text', () => {
      const source = fs.readFileSync(PAGE_PATH, 'utf-8')
      expect(source).toContain('text-green-200')
    })
  })
})
