import * as React from "react"
import { cn } from "@/lib/utils"

interface ResponsiveGridProps {
  children: React.ReactNode
  cols?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: number
  className?: string
}

export function ResponsiveGrid({
  children,
  cols = { default: 1, md: 2, lg: 3, xl: 4 },
  gap = 6,
  className
}: ResponsiveGridProps) {
  const gridClasses = cn(
    "grid",
    `gap-${gap}`,
    cols.default && `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
    className
  )

  return (
    <div className={gridClasses}>
      {children}
    </div>
  )
}

interface ResponsiveContainerProps {
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

export function ResponsiveContainer({
  children,
  className,
  maxWidth = '2xl'
}: ResponsiveContainerProps) {
  const containerClasses = cn(
    "w-full mx-auto px-4 sm:px-6 lg:px-8",
    maxWidth === 'sm' && 'max-w-sm',
    maxWidth === 'md' && 'max-w-md',
    maxWidth === 'lg' && 'max-w-lg',
    maxWidth === 'xl' && 'max-w-xl',
    maxWidth === '2xl' && 'max-w-7xl',
    maxWidth === 'full' && 'max-w-none',
    className
  )

  return (
    <div className={containerClasses}>
      {children}
    </div>
  )
}