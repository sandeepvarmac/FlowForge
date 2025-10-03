"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Workflow,
  Activity,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  UserCog,
  HelpCircle
} from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/workflows', label: 'Workflows', icon: Workflow },
  { href: '/monitoring', label: 'Monitoring', icon: Activity },
  { href: '/catalog', label: 'Data Catalog', icon: Database },
  { href: '/admin', label: 'Admin', icon: Settings },
] as const

interface NavProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function Nav({ isCollapsed, onToggleCollapse }: NavProps) {
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)

  return (
    <>
      <nav className="p-4 space-y-1 flex-1">
        {links.map((link) => {
          const active = pathname === link.href
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group',
                active
                  ? 'bg-primary-50 text-primary-700 border-l-4 border-primary shadow-corporate'
                  : 'text-foreground-secondary hover:bg-background-tertiary hover:text-foreground hover:shadow-corporate'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="flex items-center justify-between w-full">
                  {link.label}
                  {active && (
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                  )}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-border p-4 relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-background-tertiary transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-primary-700" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">John Doe</p>
              <p className="text-xs text-foreground-muted">Admin</p>
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {showUserMenu && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-background-secondary border border-border rounded-lg shadow-corporate-lg overflow-hidden">
            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-tertiary transition-colors text-sm text-foreground">
              <UserCog className="w-4 h-4" />
              <span>Profile Settings</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-tertiary transition-colors text-sm text-foreground">
              <HelpCircle className="w-4 h-4" />
              <span>Help & Support</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-tertiary transition-colors text-sm text-error border-t border-border">
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Collapse Toggle Button */}
      <button
        onClick={onToggleCollapse}
        className="absolute top-6 -right-3 w-6 h-6 bg-background-secondary border border-border rounded-full flex items-center justify-center hover:bg-primary-50 hover:border-primary transition-all duration-200 shadow-corporate"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-foreground-secondary" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-foreground-secondary" />
        )}
      </button>
    </>
  )
}
