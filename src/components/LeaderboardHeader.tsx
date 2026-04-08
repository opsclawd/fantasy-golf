export function LeaderboardHeader({ completedRounds }: { completedRounds: number }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Live standings
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Leaderboard</h2>
      </div>
      <p className="text-sm font-medium text-slate-500">
        {completedRounds > 0 ? `Round ${completedRounds}` : 'Waiting for first scores'}
      </p>
    </div>
  )
}
