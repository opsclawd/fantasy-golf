import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ScoreDisplay } from '@/components/score-display'
import { getPoolById } from '@/lib/pool-queries'
import { getEntryHoleScore, rankEntries, getHoleScore } from '@/lib/scoring'
import { createClient } from '@/lib/supabase/server'
import type { Entry, TournamentScore } from '@/lib/supabase/types'

type HoleTrace = {
  hole: number
  bestBall: number | null
  includedInTotal: boolean
  golferValues: Array<{
    golferId: string
    score: number | null
    status: TournamentScore['status'] | 'missing'
    contributes: boolean
  }>
}

function getCompletedHoles(allScores: TournamentScore[]): number {
  const completedScores = allScores.filter((score) => score.hole_1 !== null)
  if (completedScores.length === 0) return 0

  return Math.min(
    ...completedScores.map((score) => {
      let thru = 0
      for (let i = 1; i <= 18; i++) {
        if ((score as unknown as Record<string, number | null>)[`hole_${i}`] !== null) thru = i
        else break
      }
      return thru
    })
  )
}

function buildHoleTrace(
  entry: Entry,
  golferScores: Map<string, TournamentScore>,
  completedHoles: number
): HoleTrace[] {
  const rows: HoleTrace[] = []
  let totalStillRunning = true

  for (let hole = 1; hole <= completedHoles; hole++) {
    const bestBall = getEntryHoleScore(golferScores, entry.golfer_ids, hole)
    const includedInTotal = totalStillRunning && bestBall !== null

    if (bestBall === null) {
      totalStillRunning = false
    }

    const golferValues = entry.golfer_ids.map((golferId) => {
      const golferScore = golferScores.get(golferId)
      if (!golferScore) {
        return {
          golferId,
          score: null,
          status: 'missing' as const,
          contributes: false,
        }
      }

      const score = getHoleScore(golferScore, hole)
      const inactive = golferScore.status === 'withdrawn' || golferScore.status === 'cut'
      const contributes = !inactive && score !== null && bestBall !== null && score === bestBall

      return {
        golferId,
        score,
        status: golferScore.status,
        contributes,
      }
    })

    rows.push({
      hole,
      bestBall,
      includedInTotal,
      golferValues,
    })
  }

  return rows
}

function shortUserId(userId: string): string {
  return userId.slice(0, 8)
}

function shortGolferId(golferId: string): string {
  return golferId.slice(0, 8)
}

export default async function CommissionerPoolAuditScoreTracePage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) redirect('/commissioner')
  if (pool.commissioner_id !== user.id) redirect('/commissioner')

  const { data: entriesData } = await supabase
    .from('entries')
    .select('*')
    .eq('pool_id', poolId)

  const entries = (entriesData as Entry[] | null) ?? []

  const { data: scoreRows } = await supabase
    .from('tournament_scores')
    .select('*')
    .eq('tournament_id', pool.tournament_id)

  const allScores = (scoreRows as TournamentScore[] | null) ?? []
  const golferScores = new Map<string, TournamentScore>()
  for (const score of allScores) {
    golferScores.set(score.golfer_id, score)
  }

  const golferIds = Array.from(new Set(entries.flatMap((entry) => entry.golfer_ids)))
  const { data: golferRows } = golferIds.length
    ? await supabase.from('golfers').select('id, name').in('id', golferIds)
    : { data: [] as Array<{ id: string; name: string }> }

  const golferNameById = new Map<string, string>()
  for (const golfer of golferRows ?? []) {
    golferNameById.set(golfer.id, golfer.name)
  }

  const completedHoles = getCompletedHoles(allScores)
  const ranked = rankEntries(entries, golferScores, completedHoles)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Score Trace</h1>
          <p className="text-gray-500">
            Leaderboard derivation for <span className="font-medium text-gray-700">{pool.name}</span>
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Rankings are recomputed from stored <code>entries</code> and <code>tournament_scores</code>.
          </p>
        </div>
        <Link
          href={`/commissioner/pools/${poolId}/audit`}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Back to Audit Log
        </Link>
      </div>

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-3">
          <p>
            <span className="font-medium text-gray-900">Entries:</span> {entries.length}
          </p>
          <p>
            <span className="font-medium text-gray-900">Scored holes (global):</span> {completedHoles}
          </p>
          <p>
            <span className="font-medium text-gray-900">Tournament score rows:</span> {allScores.length}
          </p>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="font-medium text-gray-700">No entries to trace</p>
          <p className="mt-1 text-sm text-gray-500">
            Add entries and refresh scores to see hole-by-hole score derivation.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {ranked.map((entry) => {
            const holeTrace = buildHoleTrace(entry, golferScores, completedHoles)
            const derivedTotal = holeTrace
              .filter((row) => row.includedInTotal && row.bestBall !== null)
              .reduce((sum, row) => sum + (row.bestBall ?? 0), 0)
            const totalMatches = derivedTotal === entry.totalScore

            return (
              <article key={entry.id} className="rounded-lg bg-white p-4 shadow">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <p className="text-sm text-gray-500">Entry {entry.id.slice(0, 8)}</p>
                    <h2 className="text-lg font-semibold text-gray-900">User {shortUserId(entry.user_id)}</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Golfers:{' '}
                      {entry.golfer_ids
                        .map((golferId) => golferNameById.get(golferId) ?? shortGolferId(golferId))
                        .join(', ')}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      Rank <span className="font-semibold text-gray-900">{entry.rank}</span>
                    </p>
                    <p>
                      Leaderboard score <span className="font-semibold text-gray-900"><ScoreDisplay score={entry.totalScore} /></span>
                    </p>
                    <p>
                      Birdies <span className="font-semibold text-gray-900">{entry.totalBirdies}</span>
                    </p>
                    <p className={totalMatches ? 'text-xs text-green-700' : 'text-xs text-rose-700'}>
                      Derived total {totalMatches ? 'matches' : 'does not match'}
                    </p>
                  </div>
                </div>

                {completedHoles === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">No stored hole scores yet.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-600">
                          <th className="px-2 py-2">Hole</th>
                          <th className="px-2 py-2">Best Ball</th>
                          {entry.golfer_ids.map((golferId) => (
                            <th key={golferId} className="px-2 py-2">
                              {golferNameById.get(golferId) ?? shortGolferId(golferId)}
                            </th>
                          ))}
                          <th className="px-2 py-2">In Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holeTrace.map((row) => (
                          <tr key={row.hole} className="border-b last:border-b-0">
                            <td className="px-2 py-2 font-medium text-gray-700">{row.hole}</td>
                            <td className="px-2 py-2">
                              {row.bestBall === null ? (
                                <span className="text-gray-400">-</span>
                              ) : (
                                <ScoreDisplay score={row.bestBall} />
                              )}
                            </td>
                            {row.golferValues.map((value) => (
                              <td
                                key={value.golferId}
                                className={`px-2 py-2 ${value.contributes ? 'bg-emerald-50 font-semibold text-emerald-800' : ''}`}
                              >
                                {value.status === 'withdrawn' || value.status === 'cut' ? (
                                  <span className="text-amber-700">{value.status}</span>
                                ) : value.score === null ? (
                                  <span className="text-gray-400">-</span>
                                ) : (
                                  <ScoreDisplay score={value.score} />
                                )}
                              </td>
                            ))}
                            <td className="px-2 py-2 text-gray-600">{row.includedInTotal ? 'yes' : 'no'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
