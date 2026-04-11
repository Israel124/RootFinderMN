import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

type DialogControls = {
  isOpen?: boolean
  onClose?: () => void
}

const DialogTrigger = ({
  children,
  onClick,
  render,
  setIsOpen,
}: {
  children?: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLElement>
  render?: React.ReactNode
  setIsOpen?: (v: boolean) => void
}) => {
  const content = children || render;
  if (!content) return null;
  if (!React.isValidElement(content)) return null;
  return React.cloneElement(content, { 
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      onClick?.(e);
      setIsOpen?.(true);
    }
  })
}
DialogTrigger.displayName = "DialogTrigger"

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { isOpen?: boolean, onClose?: () => void }
>(({ className, children, isOpen, onClose, ...props }, ref) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80" onClick={onClose} />
      <div
        ref={ref}
        className={cn(
          "relative z-[101] grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  )
})

DialogContent.displayName = "DialogContent"

const DialogContext = React.createContext<DialogControls | null>(null)

const DialogRoot = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <DialogContext.Provider
      value={{
        isOpen,
        onClose: () => setIsOpen(false),
      }}
    >
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) return child

        const childType = child.type as any
        const isTrigger = childType.displayName === "DialogTrigger" || childType.name === "DialogTrigger"
        const isContent = childType.displayName === "DialogContent" || childType.name === "DialogContent"

        if (isTrigger) {
          return React.cloneElement(child as React.ReactElement<any>, { setIsOpen })
        }

        if (isContent) {
          return React.cloneElement(child as React.ReactElement<any>, {
            isOpen,
            onClose: () => setIsOpen(false),
          })
        }

        return child
      })}
    </DialogContext.Provider>
  )
}

const DialogClose = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
  const controls = React.useContext(DialogContext)

  if (!children || !React.isValidElement(children)) return null

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    ;(children.props as { onClick?: React.MouseEventHandler<HTMLElement> }).onClick?.(e)
    controls?.onClose?.()
  }

  if (asChild) {
    return React.cloneElement(children, { onClick: handleClick })
  }

  return <button onClick={handleClick}>{children}</button>
}
DialogClose.displayName = "DialogClose"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

export {
  DialogRoot as Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
