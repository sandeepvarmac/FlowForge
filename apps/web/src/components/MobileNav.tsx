"use client"

import * as React from "react"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { X, Menu } from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/workflows', label: 'Workflows' },
  { href: '/monitoring', label: 'Monitoring' },
  { href: '/catalog', label: 'Data Catalog' },
  { href: '/admin', label: 'Admin' },
] as const

export function MobileNav() {
  const [isOpen, setIsOpen] = React.useState(false)
  const pathname = usePathname()

  // Close menu when route changes
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when menu is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden bg-background-secondary border-b border-border p-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-primary">FlowForge</div>
            <div className="text-xs text-foreground-muted">Workflow Management</div>
          </div>
          <button 
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-lg bg-background-tertiary border border-border hover:bg-background-tertiary/80 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Mobile Menu */}
          <div className="fixed top-0 right-0 h-full w-80 max-w-[80vw] bg-background-secondary border-l border-border shadow-corporate-xl z-50 md:hidden transform transition-transform duration-300">
            {/* Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold text-primary">FlowForge</div>
                  <div className="text-sm text-foreground-muted mt-1">Workflow Management</div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg bg-background-tertiary border border-border hover:bg-background-tertiary/80 transition-colors"
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Navigation Links */}
            <nav className="p-4 space-y-1">
              {links.map((link) => {
                const active = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 group',
                      active
                        ? 'bg-primary-50 text-primary-700 border-l-4 border-primary shadow-corporate'
                        : 'text-foreground-secondary hover:bg-background-tertiary hover:text-foreground hover:shadow-corporate'
                    )}
                  >
                    <span className="flex items-center justify-between w-full">
                      {link.label}
                      {active && (
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                      )}
                    </span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </>
      )}
    </>
  )
}