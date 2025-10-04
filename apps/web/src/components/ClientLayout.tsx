'use client'

import { useState, ReactNode } from 'react'
import { Nav } from '@/components/Nav'
import { AppProvider } from '@/lib/context/app-context'
import { MobileNav } from '@/components/MobileNav'

export function ClientLayout({ children }: { children: ReactNode }) {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false)

  return (
    <AppProvider>
      <div className="flex h-dvh">
        {/* Desktop Navigation */}
        <aside className={`hidden md:flex ${isNavCollapsed ? 'w-20' : 'w-64'} border-r border-border bg-background-secondary shadow-corporate-lg flex-col transition-all duration-300 relative`}>
          <div className="p-6 border-b border-border">
            {!isNavCollapsed ? (
              <>
                <div className="text-xl font-bold text-primary">
                  FlowForge
                </div>
                <div className="text-sm text-foreground-muted mt-1">
                  Workflow Management
                </div>
              </>
            ) : (
              <div className="text-2xl font-bold text-primary text-center">
                FF
              </div>
            )}
          </div>
          <Nav isCollapsed={isNavCollapsed} onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background">
          {/* Mobile Navigation */}
          <MobileNav />

          {/* Page Content */}
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </AppProvider>
  )
}
