import type { GolferStatus, TournamentScore } from './supabase/types'
import { getHoleScore } from './scoring'

export interface ScoreDiff {
  changed: boolean
  holes: Record<string, { old: number | null; new: number | null }>
  statusChange?: { old: GolferStatus; new: GolferStatus }
  birdiesChange?: { old: number; new: number }
}

export interface RefreshAuditDetails {
  completedHoles: number
  golferCount: number
  changedGolfers: string[]
  newGolfers: string[]
  droppedGolfers: string[]
  diffs: Record<string, ScoreDiff>
}

export function computeScoreDiff(
  oldScore: TournamentScore,
  newScore: TournamentScore
): ScoreDiff {
  const holes: Record<string, { old: number | null; new: number | null }> = {}
  let changed = false

  for (let i = 1; i <= 18; i++) {
    const oldHole = getHoleScore(oldScore, i)
    const newHole = getHoleScore(newScore, i)
    if (oldHole !== newHole) {
      holes[`hole_${i}`] = { old: oldHole, new: newHole }
      changed = true
    }
  }

  const diff: ScoreDiff = { changed, holes }

  if (oldScore.status !== newScore.status) {
    diff.statusChange = { old: oldScore.status, new: newScore.status }
    changed = true
  }

  if (oldScore.total_birdies !== newScore.total_birdies) {
    diff.birdiesChange = { old: oldScore.total_birdies, new: newScore.total_birdies }
    changed = true
  }

  diff.changed = changed
  return diff
}

export function buildRefreshAuditDetails(
  oldScores: Map<string, TournamentScore>,
  newScores: TournamentScore[],
  completedHoles: number,
  golferCount: number
): RefreshAuditDetails {
  const changedGolferIds = new Set<string>()
  const newGolferIds = new Set<string>()
  const droppedGolfers: string[] = []
  const diffs: Record<string, ScoreDiff> = {}

  const seenGolferIds = new Set<string>()

  for (const newScore of newScores) {
    seenGolferIds.add(newScore.golfer_id)
    const oldScore = oldScores.get(newScore.golfer_id)
    if (!oldScore) {
      newGolferIds.add(newScore.golfer_id)
      changedGolferIds.add(newScore.golfer_id)
      continue
    }
    const diff = computeScoreDiff(oldScore, newScore)
    if (diff.changed) {
      changedGolferIds.add(newScore.golfer_id)
      diffs[newScore.golfer_id] = diff
    }
  }

  oldScores.forEach((_score, oldGolferId) => {
    if (!seenGolferIds.has(oldGolferId)) {
      droppedGolfers.push(oldGolferId)
    }
  })

  return {
    completedHoles,
    golferCount,
    changedGolfers: Array.from(changedGolferIds),
    newGolfers: Array.from(newGolferIds),
    droppedGolfers,
    diffs,
  }
}
