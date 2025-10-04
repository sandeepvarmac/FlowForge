"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  Home,
  LayoutDashboard,
  Workflow,
  Activity,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  LogOut,
  UserCog,
  HelpCircle,
  GitBranch,
  Repeat,
  Send,
  Bell
} from 'lucide-react'

interface NavLink {
  href: string
  label: string
  icon: any
  badge?: string
  subLinks?: { href: string; label: string }[]
}

const links: NavLink[] = [
  { href: '/', label: 'Home', icon: Home },
  {
    href: '/orchestration',
    label: 'Orchestration',
    icon: Workflow,
    subLinks: [
      { href: '/orchestration/overview', label: 'Overview' },
      { href: '/workflows', label: 'Workflows' },
      { href: '/orchestration/monitor', label: 'Monitor' },
    ]
  },
  {
    href: '/catalog',
    label: 'Data Catalog',
    icon: Database,
    subLinks: [
      { href: '/catalog/explorer', label: 'Explorer' },
      { href: '/catalog/lineage', label: 'Lineage' },
    ]
  },
  { href: '/reconciliation', label: 'Reconciliation', icon: Repeat, badge: 'Soon' },
  { href: '/downstream', label: 'Downstream Feeds', icon: Send, badge: 'Soon' },
  { href: '/alerts', label: 'Alerts', icon: Bell, badge: 'Soon' },
  { href: '/admin', label: 'Admin', icon: Settings },
]

interface NavProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function Nav({ isCollapsed, onToggleCollapse }: NavProps) {
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    '/orchestration': true,
    '/catalog': false
  })

  const toggleMenu = (href: string) => {
    setExpandedMenus(prev => ({ ...prev, [href]: !prev[href] }))
  }

  return (
    <>
      {/* Logo and Brand */}
      <div className="p-4 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo-small.svg"
            alt="FlowForge"
            width={32}
            height={32}
            className="flex-shrink-0"
          />
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                FlowForge
              </h1>
              <p className="text-xs text-foreground-muted">Data Orchestration</p>
            </div>
          )}
        </Link>
      </div>

      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        {links.map((link) => {
          const active = pathname === link.href || link.subLinks?.some(sub => pathname === sub.href)
          const Icon = link.icon
          const hasSubLinks = link.subLinks && link.subLinks.length > 0
          const isExpanded = expandedMenus[link.href]

          return (
            <div key={link.href}>
              {hasSubLinks ? (
                <button
                  onClick={() => toggleMenu(link.href)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group',
                    active
                      ? 'bg-primary-50 text-primary-700 border-l-4 border-primary shadow-corporate'
                      : 'text-foreground-secondary hover:bg-background-tertiary hover:text-foreground hover:shadow-corporate'
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left">{link.label}</span>
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </>
                  )}
                </button>
              ) : (
                <Link
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
                      <span>{link.label}</span>
                      {link.badge && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                          {link.badge}
                        </span>
                      )}
                      {active && !link.badge && (
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                      )}
                    </span>
                  )}
                </Link>
              )}

              {/* Sub-menu */}
              {hasSubLinks && isExpanded && !isCollapsed && (
                <div className="ml-8 mt-1 space-y-1">
                  {link.subLinks?.map((subLink) => {
                    const subActive = pathname === subLink.href
                    return (
                      <Link
                        key={subLink.href}
                        href={subLink.href}
                        className={cn(
                          'block px-3 py-2 text-sm rounded-lg transition-colors',
                          subActive
                            ? 'bg-primary-100 text-primary-700 font-medium'
                            : 'text-foreground-muted hover:bg-background-tertiary hover:text-foreground'
                        )}
                      >
                        {subLink.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
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
