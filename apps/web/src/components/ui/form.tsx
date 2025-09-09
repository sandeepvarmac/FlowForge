import * as React from "react"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  children: React.ReactNode
  className?: string
}

interface FormLabelProps {
  children: React.ReactNode
  htmlFor?: string
  required?: boolean
  className?: string
}

interface FormErrorProps {
  children?: React.ReactNode
  className?: string
}

interface FormDescriptionProps {
  children: React.ReactNode
  className?: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function FormField({ children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {children}
    </div>
  )
}

export function FormLabel({ children, htmlFor, required, className }: FormLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground",
        className
      )}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}

export function FormError({ children, className }: FormErrorProps) {
  if (!children) return null
  
  return (
    <p className={cn("text-sm text-red-600", className)}>
      {children}
    </p>
  )
}

export function FormDescription({ children, className }: FormDescriptionProps) {
  return (
    <p className={cn("text-sm text-foreground-muted", className)}>
      {children}
    </p>
  )
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-10 w-full rounded-md border border-border bg-background-secondary px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-border-secondary transition-all duration-200 shadow-corporate focus:shadow-corporate-lg",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-border bg-background-secondary px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-border-secondary transition-all duration-200 shadow-corporate focus:shadow-corporate-lg resize-vertical",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"