export function ScoreDisplay({ score }: { score: number }) {
  if (score === 0) return <span className="text-gray-600">E</span>
  if (score > 0) return <span className="text-red-600">+{score}</span>
  return <span className="text-green-600">{score}</span>
}
