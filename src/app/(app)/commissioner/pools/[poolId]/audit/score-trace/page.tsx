import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ScoreDisplay } from '@/components/score-display'
import { getPoolById } from '@/lib/pool-queries'
import { deriveCompletedRounds, getEntryRoundScore, rankEntries } from '@/lib/scoring'
import { createClient } from '@/lib/supabase/server'
import type { Entry, TournamentScore } from '@/lib/supabase/types'
import { getTournamentRosterGolfers } from '@/lib/tournament-roster/queries'

type RoundTrace = {
  golferId: string
  round: number | null
  roundScore: number | null
  totalScore: number | null
  status: TournamentScore['status'] | 'missing'
  contributes: boolean
}

function buildRoundTrace(
  entry: Entry,
  golferScores: Map<string, TournamentScore>
): RoundTrace[] {
  const bestBall = getEntryRoundScore(golferScores, entry.golfer_ids)

  return entry.golfer_ids.map((golferId) => {
    const golferScore = golferScores.get(golferId)
    if (!golferScore) {
      return {
        golferId,
        round: null,
        roundScore: null,
        totalScore: null,
        status: 'missing' as const,
        contributes: false,
      }
    }

    const roundScore = golferScore.round_score ?? golferScore.total_score ?? null
    const totalScore = golferScore.total_score ?? golferScore.round_score ?? null
    const inactive = golferScore.status === 'withdrawn' || golferScore.status === 'cut'

    return {
      golferId,
      round: golferScore.round_id ?? null,
      roundScore,
      totalScore,
      status: golferScore.status,
      contributes: !inactive && roundScore !== null && bestBall !== null && roundScore === bestBall,
    }
  })
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
  const golferRows = golferIds.length
    ? (await getTournamentRosterGolfers(supabase, pool.tournament_id)).filter((golfer) => golferIds.includes(golfer.id))
    : []

  const golferNameById = new Map<string, string>()
  for (const golfer of golferRows) {
    golferNameById.set(golfer.id, golfer.name)
  }

  const completedRounds = deriveCompletedRounds(allScores)
  const ranked = rankEntries(entries, golferScores, completedRounds)

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
            <span className="font-medium text-gray-900">Scored rounds (global):</span> {completedRounds}
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
            Add entries and refresh scores to see round-level score derivation.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {ranked.map((entry) => {
            const roundTrace = buildRoundTrace(entry, golferScores)
            const derivedTotal = roundTrace
              .map((row) => row.roundScore)
              .filter((score): score is number => score !== null)
              .reduce((sum, score) => sum + score, 0)
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

                  {completedRounds === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">No stored round scores yet.</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-600">
                            <th className="px-2 py-2">Golfer</th>
                            <th className="px-2 py-2">Round</th>
                            <th className="px-2 py-2">Round Score</th>
                            <th className="px-2 py-2">Total Score</th>
                            <th className="px-2 py-2">Status</th>
                            <th className="px-2 py-2">In Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roundTrace.map((row) => (
                            <tr key={row.golferId} className="border-b last:border-b-0">
                              <td className="px-2 py-2 font-medium text-gray-700">
                                {golferNameById.get(row.golferId) ?? shortGolferId(row.golferId)}
                              </td>
                              <td className="px-2 py-2 text-gray-600">{row.round ?? '-'}</td>
                              <td className={`px-2 py-2 ${row.contributes ? 'bg-emerald-50 font-semibold text-emerald-800' : ''}`}>
                                {row.roundScore === null ? (
                                  <span className="text-gray-400">-</span>
                                ) : (
                                  <ScoreDisplay score={row.roundScore} />
                                )}
                              </td>
                              <td className="px-2 py-2">
                                {row.totalScore === null ? (
                                  <span className="text-gray-400">-</span>
                                ) : (
                                  <ScoreDisplay score={row.totalScore} />
                                )}
                              </td>
                              <td className="px-2 py-2 text-gray-600">
                                {row.status === 'missing' ? 'missing' : row.status}
                              </td>
                              <td className="px-2 py-2 text-gray-600">{row.contributes ? 'yes' : 'no'}</td>
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
