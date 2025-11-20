"use client"

import * as React from 'react'
import { Search } from 'lucide-react'

interface GlobalSearchBarProps {
  value: string
  placeholder?: string
  onChange: (value: string) => void
  className?: string
}

export function GlobalSearchBar({
  value,
  placeholder = 'Search tables, workflows, descriptions…',
  onChange,
  className = ''
}: GlobalSearchBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={`${placeholder} (⌘K)`}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  )
}
