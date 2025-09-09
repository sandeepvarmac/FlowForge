import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "./card"
import { LucideIcon } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease'
    period: string
  }
  icon?: LucideIcon
  trend?: number[]
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'error'
}

const variantStyles = {
  default: {
    icon: 'bg-primary-50 text-primary-600',
    change: {
      increase: 'text-success bg-green-50',
      decrease: 'text-error bg-red-50'
    }
  },
  success: {
    icon: 'bg-green-50 text-green-600',
    change: {
      increase: 'text-green-700 bg-green-50',
      decrease: 'text-green-500 bg-green-50'
    }
  },
  warning: {
    icon: 'bg-yellow-50 text-yellow-600',
    change: {
      increase: 'text-yellow-700 bg-yellow-50',
      decrease: 'text-yellow-500 bg-yellow-50'
    }
  },
  error: {
    icon: 'bg-red-50 text-red-600',
    change: {
      increase: 'text-red-700 bg-red-50',
      decrease: 'text-red-500 bg-red-50'
    }
  }
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
  className,
  variant = 'default'
}: MetricCardProps) {
  const styles = variantStyles[variant]
  
  return (
    <Card className={cn(
      "group hover:shadow-corporate-xl transition-all duration-300 relative overflow-hidden",
      className
    )}>
      {/* Subtle background pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-50/30 to-transparent rounded-full -translate-y-16 translate-x-16" />
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground-muted">
            {title}
          </p>
        </div>
        {Icon && (
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-colors group-hover:scale-105",
            styles.icon
          )}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold text-foreground">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {change && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              styles.change[change.type]
            )}>
              <span className="text-xs">
                {change.type === 'increase' ? '↗' : '↘'}
              </span>
              {Math.abs(change.value)}%
              <span className="opacity-75">vs {change.period}</span>
            </div>
          )}
        </div>
        
        {/* Mini trend chart placeholder */}
        {trend && (
          <div className="flex items-end gap-0.5 h-8">
            {trend.map((point, index) => (
              <div
                key={index}
                className="bg-primary/20 rounded-sm flex-1 transition-all group-hover:bg-primary/30"
                style={{ height: `${(point / Math.max(...trend)) * 100}%` }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}