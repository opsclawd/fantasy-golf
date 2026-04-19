export function ScoreDisplay({ score }: { score: number }) {
  if (score === 0) return <span className="font-mono tabular-nums text-stone-600">E</span>
  if (score > 0) return <span className="font-mono tabular-nums text-red-600">+{score}</span>
  return <span className="font-mono tabular-nums text-green-700">{score}</span>
}