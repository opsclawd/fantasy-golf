'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PickProgress } from './PickProgress'

interface Golfer {
  id: string
  name: string
  country: string
}

interface GolferPickerProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  maxSelections: number
}

export function GolferPicker({ selectedIds, onSelectionChange, maxSelections }: GolferPickerProps) {
  const [golfers, setGolfers] = useState<Golfer[]>([])
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    const runFetch = async () => {
      try {
        const { data, error } = await supabase.from('golfers').select('*').order('name')

        if (!isMounted) {
          return
        }

        if (error) {
          setFetchError('Unable to load golfers right now. Please refresh and try again.')
          setGolfers([])
          return
        }

        setFetchError(null)
        setGolfers(data ?? [])
      } catch {
        if (!isMounted) {
          return
        }

        setFetchError('Unable to load golfers right now. Please refresh and try again.')
        setGolfers([])
      }
    }

    void runFetch()

    return () => {
      isMounted = false
    }
  }, [supabase])

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

  const filteredGolfers = golfers.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase().trim())
    const matchesFilter = countryFilter === '' || g.country === countryFilter
    return matchesSearch && matchesFilter
  })

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

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="golfer-search" className="mb-1 block text-sm font-medium text-gray-700">
            Search golfers
          </label>
          <input
            id="golfer-search"
            type="text"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="golfer-country" className="mb-1 block text-sm font-medium text-gray-700">
            Country
          </label>
          <select
            id="golfer-country"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
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
        className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white/90"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Available golfers"
      >
        {fetchError ? (
          <p className="p-3 text-sm text-red-600" role="alert">
            {fetchError}
          </p>
        ) : filteredGolfers.length === 0 ? (
          <p className="p-3 text-sm text-gray-500">No golfers match your filters.</p>
        ) : (
          <ul>
            {filteredGolfers.map((golfer, index) => {
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
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-inset ${
                      isSelected ? 'bg-sky-50' : ''
                    } ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <span>
                      <span className="font-medium">{golfer.name}</span>
                      <span className="ml-2 text-sm text-gray-500">{golfer.country}</span>
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                        isSelected ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'
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

      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">
        {selectedGolfers.length > 0 ? (
          <p aria-live="polite">Current picks: {selectedGolfers.map((g) => g.name).join(', ')}</p>
        ) : (
          <p aria-live="polite">Tap golfers below to build your entry.</p>
        )}
      </div>
    </div>
  )
}
