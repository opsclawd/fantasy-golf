'use client'

import { useMemo, useRef, useState } from 'react'
import { filterLocalGolfers } from '@/lib/golfer-catalog/normalize'
import { PickProgress } from './PickProgress'

export interface Golfer {
  id: string
  name: string
  country: string
  search_name: string | null
  is_active: boolean
}

export function mergeVisibleGolfers({
  golfers,
  filteredGolfers,
  selectedIds,
}: {
  golfers: Golfer[]
  filteredGolfers: Golfer[]
  selectedIds: string[]
}): Golfer[] {
  const filteredIds = new Set(filteredGolfers.map((golfer) => golfer.id))
  const selectedInactiveGolfers = golfers.filter(
    (golfer) => selectedIds.includes(golfer.id) && !golfer.is_active && !filteredIds.has(golfer.id),
  )

  return [...selectedInactiveGolfers, ...filteredGolfers]
}

interface GolferPickerProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  maxSelections: number
  golfers: Golfer[]
}

export function GolferPicker({ selectedIds, onSelectionChange, maxSelections, golfers }: GolferPickerProps) {
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const focusNextOption = (startIndex: number, step: 1 | -1) => {
    if (optionRefs.current.length === 0) {
      return
    }

    let index = startIndex

    for (let i = 0; i < optionRefs.current.length; i += 1) {
      index = (index + step + optionRefs.current.length) % optionRefs.current.length
      const button = optionRefs.current[index]

      if (button && !button.disabled) {
        button.focus()
        break
      }
    }
  }

  const filteredGolfers = filterLocalGolfers(golfers, {
    search,
    country: countryFilter,
  })

  const visibleGolfers = useMemo(() => {
    return mergeVisibleGolfers({ golfers, filteredGolfers, selectedIds })
  }, [filteredGolfers, golfers, selectedIds])

  const countries = useMemo(
    () => Array.from(new Set(golfers.map((g) => g.country))).sort((a, b) => a.localeCompare(b)),
    [golfers],
  )

  const selectedGolfers = useMemo(
    () => selectedIds.map((id) => golfers.find((g) => g.id === id)).filter(Boolean) as Golfer[],
    [golfers, selectedIds],
  )

  const toggleGolfer = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id))
    } else if (selectedIds.length < maxSelections) {
      onSelectionChange([...selectedIds, id])
    }
  }

  return (
    <div className="space-y-4">
      <PickProgress current={selectedIds.length} required={maxSelections} />

      <div className="flex flex-col gap-3 rounded-3xl border border-stone-200/80 bg-white/90 p-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="golfer-search" className="mb-1 block text-sm font-medium text-stone-700">
            Search golfers
          </label>
          <input
            id="golfer-search"
            type="text"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5"
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="golfer-country" className="mb-1 block text-sm font-medium text-stone-700">
            Country
          </label>
          <select
            id="golfer-country"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5"
          >
            <option value="">All Countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="max-h-80 overflow-y-auto rounded-3xl border border-stone-200/80 bg-white/90"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Available golfers"
      >
        {visibleGolfers.length === 0 ? (
          <p className="p-3 text-sm text-stone-500">No golfers match your filters.</p>
        ) : (
          <ul>
            {visibleGolfers.map((golfer, index) => {
              const isSelected = selectedIds.includes(golfer.id)
              const isDisabled = !isSelected && selectedIds.length >= maxSelections

              return (
                <li key={golfer.id}>
                  <button
                    ref={(element) => {
                      optionRefs.current[index] = element
                    }}
                    type="button"
                    onClick={() => toggleGolfer(golfer.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        focusNextOption(index, 1)
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        focusNextOption(index, -1)
                      }
                    }}
                    disabled={isDisabled}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled}
                    aria-label={`${isSelected ? 'Remove' : 'Select'} ${golfer.name} from ${golfer.country}`}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-inset ${
                      isSelected ? 'bg-green-50 border-l-4 border-l-green-700' : ''
                    } ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <span>
                      <span className="font-medium">{golfer.name}</span>
                      <span className="ml-2 text-sm text-stone-500">{golfer.country}</span>
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                        isSelected ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="rounded-3xl border border-stone-200/80 bg-stone-50/80 px-3 py-2 text-sm text-stone-600">
        {selectedGolfers.length > 0 ? (
          <p aria-live="polite">Current picks: {selectedGolfers.map((g) => g.name).join(', ')}</p>
        ) : (
          <p aria-live="polite">Tap golfers below to build your entry.</p>
        )}
      </div>
    </div>
  )
}
