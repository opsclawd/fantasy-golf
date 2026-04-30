interface TieExplanationBadgeProps {
  isTied: boolean
  entryName: string
  totalBirdies: number
}

export function TieExplanationBadge({ isTied, entryName, totalBirdies }: TieExplanationBadgeProps) {
  if (!isTied) {
    return null
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
      <span>🔗</span>
      <span>Tied with {entryName}. Ranked by total birdies ({totalBirdies}).</span>
    </span>
  )
}