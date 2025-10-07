"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DropdownMenuProps {
  trigger: React.ReactNode
  children: React.ReactNode
}

interface DropdownMenuItemProps {
  onClick?: () => void
  className?: string
  children: React.ReactNode
  destructive?: boolean
}

const DropdownMenuContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
} | null>(null)

export function DropdownMenu({ trigger, children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={dropdownRef} className="relative inline-block">
        <div onClick={() => setOpen(!open)}>
          {trigger}
        </div>
        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-background-secondary border border-border rounded-lg shadow-corporate-lg py-1 z-50 animate-in fade-in-0 zoom-in-95">
            {children}
          </div>
        )}
      </div>
    </DropdownMenuContext.Provider>
  )
}

export function DropdownMenuItem({ onClick, className, children, destructive }: DropdownMenuItemProps) {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuItem must be used within DropdownMenu')

  const handleClick = () => {
    onClick?.()
    context.setOpen(false)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left px-4 py-2 text-sm hover:bg-background-tertiary transition-colors flex items-center gap-2",
        destructive && "text-red-600 hover:bg-red-50 hover:text-red-700",
        className
      )}
    >
      {children}
    </button>
  )
}

export function DropdownMenuSeparator() {
  return <div className="my-1 border-t border-border" />
}
