type BulkRefreshQuota = {
  usedCalls: number
  hardLimit: number
}

type SearchableGolfer = {
  id: string
  name: string
  search_name: string | null
  country: string
  is_active: boolean
}

function buildSearchCandidates(golfer: Pick<SearchableGolfer, 'name' | 'search_name'>): string[] {
  const candidates = [golfer.search_name, golfer.name].map((value) => buildSearchName(value ?? ''))

  return Array.from(new Set(candidates.filter((value) => value.length > 0)))
}

export function buildSearchName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function isBulkRefreshBlocked({ usedCalls, hardLimit }: BulkRefreshQuota): boolean {
  return usedCalls >= hardLimit
}

export function filterLocalGolfers(
  golfers: SearchableGolfer[],
  filters: { search: string; country: string },
): SearchableGolfer[] {
  const normalizedSearch = buildSearchName(filters.search)

  return golfers.filter((golfer) => {
    if (!golfer.is_active) return false

    const matchesSearch =
      normalizedSearch.length === 0 || buildSearchCandidates(golfer).some((candidate) => candidate.includes(normalizedSearch))

    const matchesCountry = filters.country === '' || golfer.country === filters.country

    return matchesSearch && matchesCountry
  })
}
