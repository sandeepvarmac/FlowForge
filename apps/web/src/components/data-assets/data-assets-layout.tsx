'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Database, Boxes, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataAssetsLayoutProps {
  children: React.ReactNode
}

type Tab = {
  id: string
  label: string
  icon: React.ElementType
  href: string
  description: string
}

const tabs: Tab[] = [
  {
    id: 'processed',
    label: 'Processed Data',
    icon: Boxes,
    href: '/data-assets/explorer',
    description: 'Browse Bronze, Silver, and Gold datasets'
  },
  {
    id: 'sources',
    label: 'Source Data',
    icon: Database,
    href: '/data-assets/sources',
    description: 'Explore data at the source before ingestion'
  },
  {
    id: 'published',
    label: 'Published Data',
    icon: Upload,
    href: '/data-assets/published',
    description: 'Monitor data published to external destinations'
  }
]

export function DataAssetsLayout({ children }: DataAssetsLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Determine active tab based on current path
  const getActiveTab = () => {
    if (pathname?.startsWith('/data-assets/sources')) return 'sources'
    if (pathname?.startsWith('/data-assets/published')) return 'published'
    return 'processed'
  }

  const activeTab = getActiveTab()

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b bg-card">
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Data Assets</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {tabs.find(t => t.id === activeTab)?.description}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = tab.id === activeTab
              const isPublished = tab.id === 'published'

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (!isPublished) {
                      router.push(tab.href)
                    }
                  }}
                  disabled={isPublished}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative',
                    isActive
                      ? 'border-primary text-primary bg-primary/5'
                      : isPublished
                      ? 'border-transparent text-muted-foreground cursor-not-allowed opacity-50'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isPublished && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                      Coming Soon
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {children}
      </div>
    </div>
  )
}
