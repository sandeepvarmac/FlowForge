'use client'

import { useState, ReactNode } from 'react'
import { Nav } from '@/components/Nav'
import { AppProvider } from '@/lib/context/app-context'
import { MobileNav } from '@/components/MobileNav'
import { UploadQueueProvider } from '@/contexts/upload-queue-context'
import { UploadQueueWidget } from '@/components/upload-queue/upload-queue-widget'
import { ToastProvider } from '@/components/ui/toast'

export function ClientLayout({ children }: { children: ReactNode }) {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false)

  return (
    <AppProvider>
      <ToastProvider>
        <UploadQueueProvider>
          <div className="flex h-dvh">
            {/* Desktop Navigation */}
            <aside className={`hidden md:flex ${isNavCollapsed ? 'w-20' : 'w-64'} border-r border-border bg-background-secondary shadow-corporate-lg flex-col transition-all duration-300 relative`}>
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

          {/* Global Upload Queue Widget */}
          <UploadQueueWidget />
        </UploadQueueProvider>
      </ToastProvider>
    </AppProvider>
  )
}
