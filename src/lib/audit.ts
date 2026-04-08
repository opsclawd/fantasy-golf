import type { GolferStatus, TournamentScore } from './supabase/types'

export interface ScoreDiff {
  changed: boolean
  fields: Record<string, { old: unknown; new: unknown }>
  statusChange?: { old: GolferStatus; new: GolferStatus }
  birdiesChange?: { old: number; new: number }
}

export interface RefreshAuditDetails {
  completedRounds: number
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
  const diff: ScoreDiff = { changed: false, fields: {} }

  if (oldScore.round_id !== newScore.round_id) {
    diff.fields.round_id = { old: oldScore.round_id ?? null, new: newScore.round_id ?? null }
    diff.changed = true
  }

  if (oldScore.round_score !== newScore.round_score) {
    diff.fields.round_score = { old: oldScore.round_score ?? null, new: newScore.round_score ?? null }
    diff.changed = true
  }

  if (oldScore.total_score !== newScore.total_score) {
    diff.fields.total_score = { old: oldScore.total_score ?? null, new: newScore.total_score ?? null }
    diff.changed = true
  }

  if (oldScore.position !== newScore.position) {
    diff.fields.position = { old: oldScore.position ?? null, new: newScore.position ?? null }
    diff.changed = true
  }

  if (oldScore.round_status !== newScore.round_status) {
    diff.fields.round_status = { old: oldScore.round_status ?? null, new: newScore.round_status ?? null }
    diff.changed = true
  }

  if (oldScore.current_hole !== newScore.current_hole) {
    diff.fields.current_hole = { old: oldScore.current_hole ?? null, new: newScore.current_hole ?? null }
    diff.changed = true
  }

  if (oldScore.tee_time !== newScore.tee_time) {
    diff.fields.tee_time = { old: oldScore.tee_time ?? null, new: newScore.tee_time ?? null }
    diff.changed = true
  }

  if (oldScore.status !== newScore.status) {
    diff.statusChange = { old: oldScore.status, new: newScore.status }
    diff.changed = true
  }

  if (oldScore.total_birdies !== newScore.total_birdies) {
    diff.birdiesChange = { old: oldScore.total_birdies, new: newScore.total_birdies }
    diff.changed = true
  }

  return diff
}

export function buildRefreshAuditDetails(
  oldScores: Map<string, TournamentScore>,
  newScores: TournamentScore[],
  completedRounds: number,
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
    completedRounds,
    golferCount,
    changedGolfers: Array.from(changedGolferIds),
    newGolfers: Array.from(newGolferIds),
    droppedGolfers,
    diffs,
  }
}
