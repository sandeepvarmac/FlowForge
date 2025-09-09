import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { LucideIcon, MoreHorizontal, Maximize2, Minimize2 } from "lucide-react"

interface WidgetContainerProps {
  title: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
  collapsible?: boolean
  expandable?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
}

const sizeClasses = {
  sm: 'col-span-1',
  md: 'col-span-1 md:col-span-2',
  lg: 'col-span-1 md:col-span-2 lg:col-span-3',
  xl: 'col-span-1 md:col-span-2 lg:col-span-4'
}

export function WidgetContainer({
  title,
  icon: Icon,
  children,
  className,
  actions,
  collapsible = false,
  expandable = false,
  size = 'md',
  loading = false
}: WidgetContainerProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <Card className={cn(
      "shadow-corporate-lg transition-all duration-300 hover:shadow-corporate-xl",
      sizeClasses[size],
      isExpanded && "fixed inset-4 z-50 col-span-full",
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg font-semibold">
          {Icon && <Icon className="w-4 h-4 md:w-5 md:h-5 text-primary" />}
          {title}
          {loading && (
            <div className="w-2 h-2 md:w-3 md:h-3 bg-primary rounded-full animate-pulse" />
          )}
        </CardTitle>
        
        <div className="flex items-center gap-1">
          {actions}
          
          {collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-md hover:bg-background-tertiary transition-colors"
              aria-label={isCollapsed ? "Expand widget" : "Collapse widget"}
            >
              <Minimize2 className={cn(
                "w-4 h-4 transition-transform",
                isCollapsed && "rotate-180"
              )} />
            </button>
          )}
          
          {expandable && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-md hover:bg-background-tertiary transition-colors"
              aria-label={isExpanded ? "Minimize widget" : "Expand widget"}
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}
          
          <button className="p-1.5 rounded-md hover:bg-background-tertiary transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent className={cn(
          "transition-all duration-300",
          isExpanded ? "p-6 h-[calc(100vh-8rem)] overflow-auto" : "p-4 md:p-6"
        )}>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            children
          )}
        </CardContent>
      )}
      
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </Card>
  )
}