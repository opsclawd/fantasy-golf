'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  const [filter, setFilter] = useState('')
  const [showList, setShowList] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchGolfers()
  }, [])

  const fetchGolfers = async () => {
    const { data } = await supabase.from('golfers').select('*').order('name')
    if (data) setGolfers(data)
  }

  const filteredGolfers = golfers.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === '' || g.country === filter
    return matchesSearch && matchesFilter
  })

  const countries = Array.from(new Set(golfers.map(g => g.country)))

  const toggleGolfer = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id))
    } else if (selectedIds.length < maxSelections) {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search golfers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All Countries</option>
          {countries.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowList(!showList)}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          {showList ? 'Hide List' : 'Show List'}
        </button>
      </div>

      {showList && (
        <div className="max-h-64 overflow-y-auto border rounded">
          {filteredGolfers.map(golfer => (
            <div
              key={golfer.id}
              onClick={() => toggleGolfer(golfer.id)}
              className={`p-2 cursor-pointer hover:bg-gray-50 ${
                selectedIds.includes(golfer.id) ? 'bg-blue-50' : ''
              }`}
            >
              <span className="font-medium">{golfer.name}</span>
              <span className="text-gray-500 text-sm ml-2">{golfer.country}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-sm text-gray-500">
        Selected: {selectedIds.length}/{maxSelections}
      </div>
    </div>
  )
}
