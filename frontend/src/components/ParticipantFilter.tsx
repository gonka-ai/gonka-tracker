import { useEffect, useMemo, useRef, useState } from 'react'
import { Participant } from '../types/inference'

interface ParticipantFilterProps {
  participants: Participant[]
  selectedIndexes: string[]
  onChange: (indexes: string[]) => void
}

export function ParticipantFilter({ participants, selectedIndexes, onChange }: ParticipantFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const participantOptions = useMemo(() => {
    return participants
      .map((participant) => ({
        index: participant.index,
        moniker: participant.moniker?.trim() || ''
      }))
      .sort((a, b) => a.index.localeCompare(b.index))
  }, [participants])

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) {
      return participantOptions
    }

    const query = searchTerm.trim().toLowerCase()
    return participantOptions.filter((option) => {
      const matchesIndex = option.index.toLowerCase().includes(query)
      const matchesMoniker = option.moniker.toLowerCase().includes(query)
      return matchesIndex || matchesMoniker
    })
  }, [participantOptions, searchTerm])

  const missingSelections = useMemo(() => {
    return selectedIndexes.filter(
      (index) => !participantOptions.some((option) => option.index === index)
    )
  }, [participantOptions, selectedIndexes])

  const toggleSelection = (index: string) => {
    if (selectedIndexes.includes(index)) {
      onChange(selectedIndexes.filter((value) => value !== index))
    } else {
      onChange([...selectedIndexes, index])
    }
  }

  const handleClear = () => {
    onChange([])
    setSearchTerm('')
  }

  const selectedCount = selectedIndexes.length

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          {selectedCount === 0 ? 'Filter participants' : `${selectedCount} selected`}
        </button>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            Clear all
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          {selectedIndexes.map((index) => {
            const option = participantOptions.find((item) => item.index === index)
            if (!option) {
              return null
            }
            const label = option.moniker ? `${index} · ${option.moniker}` : index
            return (
              <span
                key={index}
                className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200"
              >
                <span className="font-mono">{label}</span>
                <button
                  type="button"
                  onClick={() => toggleSelection(index)}
                  className="text-gray-500 hover:text-gray-900 focus:outline-none"
                  aria-label={`Remove ${index}`}
                >
                  ×
                </button>
              </span>
            )
          })}
          {missingSelections.map((index) => (
            <span
              key={index}
              className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs bg-red-50 text-red-700 border border-red-200"
            >
              <span className="font-mono">{index} (missing)</span>
              <button
                type="button"
                onClick={() => toggleSelection(index)}
                className="text-red-600 hover:text-red-900 focus:outline-none"
                aria-label={`Remove ${index}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-72 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-3 border-b border-gray-100">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by index or moniker"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">No matches found</div>
            ) : (
              <ul className="py-2">
                {filteredOptions.map((option) => {
                  const isChecked = selectedIndexes.includes(option.index)
                  return (
                    <li key={option.index}>
                      <button
                        type="button"
                        onClick={() => toggleSelection(option.index)}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between ${
                          isChecked ? 'bg-gray-50' : ''
                        }`}
                      >
                        <div>
                          <div className="font-mono text-sm text-gray-900">{option.index}</div>
                          {option.moniker && (
                            <div className="text-xs text-gray-500">{option.moniker}</div>
                          )}
                        </div>
                        <div
                          className={`w-4 h-4 border rounded ${
                            isChecked ? 'bg-gray-900 border-gray-900' : 'border-gray-300'
                          }`}
                        ></div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


