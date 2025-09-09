import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'
import { AppProvider } from '@/lib/context/app-context'

export const metadata: Metadata = {
  title: 'FlowForge',
  description: 'Modern Workflow Management Platform'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <AppProvider>
          <div className="flex h-dvh">
            {/* Mobile/Tablet Navigation - Hidden on desktop */}
            <aside className="hidden md:flex w-64 border-r border-border bg-background-secondary shadow-corporate-lg flex-col">
              <div className="p-6 border-b border-border">
                <div className="text-xl font-bold text-primary">
                  FlowForge
                </div>
                <div className="text-sm text-foreground-muted mt-1">
                  Workflow Management
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Nav />
              </div>
            </aside>
            
            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-background">
              {/* Mobile Header */}
              <div className="md:hidden bg-background-secondary border-b border-border p-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-primary">FlowForge</div>
                    <div className="text-xs text-foreground-muted">Workflow Management</div>
                  </div>
                  {/* Mobile menu button placeholder */}
                  <button className="p-2 rounded-lg bg-background-tertiary border border-border">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Page Content */}
              <div className="p-4 md:p-6">
                {children}
              </div>
            </main>
          </div>
        </AppProvider>
      </body>
    </html>
  )
}

