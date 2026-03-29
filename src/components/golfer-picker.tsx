'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PickProgress } from './PickProgress'

interface Golfer {
  id: string
  name: string
  country: string
}

interface GolferPickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  maxSelections?: number
}

export function GolferPicker({ selectedIds, onChange, maxSelections = 4 }: GolferPickerProps) {
  const [golfers, setGolfers] = useState<Golfer[]>([])
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchGolfers()
  }, [])

  const fetchGolfers = async () => {
    const { data } = await supabase.from('golfers').select('*').order('name')
    if (data) setGolfers(data)
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
      onChange(selectedIds.filter((i) => i !== id))
    } else if (selectedIds.length < maxSelections) {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="space-y-4">
      <PickProgress current={selectedIds.length} required={maxSelections} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
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

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Selected golfers</p>
        {selectedIds.length === 0 ? (
          <p className="text-sm text-gray-500">No golfers selected yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label="Selected golfers">
            {selectedIds.map((id) => {
              const golfer = golfers.find((g) => g.id === id)
              const label = golfer ? `${golfer.name} (${golfer.country})` : id

              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggleGolfer(id)}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-800 hover:bg-blue-100"
                    aria-label={`Remove ${label}`}
                  >
                    <span>{label}</span>
                    <span aria-hidden="true">&times;</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div
        className="max-h-72 overflow-y-auto border rounded"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Available golfers"
      >
        {filteredGolfers.length === 0 ? (
          <p className="p-3 text-sm text-gray-500">No golfers match your filters.</p>
        ) : (
          <ul>
            {filteredGolfers.map((golfer) => {
              const isSelected = selectedIds.includes(golfer.id)
              const isDisabled = !isSelected && selectedIds.length >= maxSelections

              return (
                <li key={golfer.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => toggleGolfer(golfer.id)}
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    aria-label={`${isSelected ? 'Remove' : 'Select'} ${golfer.name} from ${golfer.country}`}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                      isSelected ? 'bg-blue-50' : ''
                    } ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <span>
                      <span className="font-medium">{golfer.name}</span>
                      <span className="ml-2 text-sm text-gray-500">{golfer.country}</span>
                    </span>
                    <span className="text-xs font-medium text-gray-600">{isSelected ? 'Selected' : 'Select'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selectedGolfers.length > 0 && (
        <p className="text-xs text-gray-500" aria-live="polite">
          Current picks: {selectedGolfers.map((g) => g.name).join(', ')}
        </p>
      )}

      <div className="text-sm text-gray-500">
        Selected: {selectedIds.length}/{maxSelections}
      </div>
    </div>
  )
}
