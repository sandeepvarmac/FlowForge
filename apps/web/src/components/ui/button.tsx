import * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = {
  variant: {
    default: "bg-primary text-white hover:bg-primary-700 focus:ring-primary shadow-corporate hover:shadow-corporate-lg transition-all duration-200",
    destructive: "bg-error text-white hover:bg-error/90 focus:ring-error shadow-corporate",
    outline: "border border-border bg-background-secondary hover:bg-background-tertiary focus:ring-primary text-foreground shadow-corporate",
    secondary: "bg-secondary text-white hover:bg-secondary/90 focus:ring-secondary shadow-corporate",
    ghost: "hover:bg-background-tertiary focus:ring-primary text-foreground-secondary hover:text-foreground transition-colors",
    link: "text-primary underline-offset-4 hover:underline focus:ring-primary hover:text-primary-700"
  },
  size: {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 text-sm",
    lg: "h-12 px-8",
    icon: "h-10 w-10"
  }
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants.variant
  size?: keyof typeof buttonVariants.size
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          buttonVariants.variant[variant],
          buttonVariants.size[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }