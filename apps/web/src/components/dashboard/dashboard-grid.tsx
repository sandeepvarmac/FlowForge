import * as React from "react"
import { cn } from "@/lib/utils"

interface DashboardGridProps {
  children: React.ReactNode
  columns?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: number
  className?: string
}

export function DashboardGrid({
  children,
  columns = { default: 1, md: 2, lg: 3, xl: 4 },
  gap = 6,
  className
}: DashboardGridProps) {
  const gridClasses = cn(
    "grid auto-rows-min",
    `gap-${gap}`,
    columns.default && `grid-cols-${columns.default}`,
    columns.sm && `sm:grid-cols-${columns.sm}`,
    columns.md && `md:grid-cols-${columns.md}`,
    columns.lg && `lg:grid-cols-${columns.lg}`,
    columns.xl && `xl:grid-cols-${columns.xl}`,
    className
  )

  return (
    <div className={gridClasses}>
      {children}
    </div>
  )
}

interface DashboardSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function DashboardSection({
  title,
  description,
  children,
  className
}: DashboardSectionProps) {
  return (
    <section className={cn("space-y-4 md:space-y-6", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-xl md:text-2xl font-semibold text-foreground">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm md:text-base text-foreground-secondary">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}