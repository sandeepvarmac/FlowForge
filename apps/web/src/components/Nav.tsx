"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/workflows', label: 'Workflows' },
  { href: '/monitoring', label: 'Monitoring' },
  { href: '/catalog', label: 'Data Catalog' },
  { href: '/admin', label: 'Admin' },
] as const

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="p-4 space-y-1">
      {links.map((link) => {
        const active = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group',
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
  )
}
