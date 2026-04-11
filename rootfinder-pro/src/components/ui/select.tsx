import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

const Select = ({ children, value, onValueChange }: { children: React.ReactNode, value?: string, onValueChange?: (value: string) => void }) => {
  return (
    <div className="relative group">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { value, onValueChange })
        }
        return child
      })}
    </div>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <ChevronDown className="h-4 w-4 opacity-50" />
  </button>
))
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder, value }: { placeholder?: string, value?: string }) => {
  return <span>{value || placeholder}</span>
}

const SelectContent = ({ children, value, onValueChange, className }: { children: React.ReactNode, value?: string, onValueChange?: (value: string) => void, className?: string }) => {
  return (
    <div className="absolute top-0 left-0 w-full h-full opacity-0">
      <select 
        value={value} 
        onChange={(e) => onValueChange?.(e.target.value)}
        className="w-full h-full cursor-pointer"
      >
        {children}
      </select>
    </div>
  )
}

const SelectItem = ({ value, children }: { value: string, children: React.ReactNode }) => {
  return <option value={value}>{children}</option>
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
}
