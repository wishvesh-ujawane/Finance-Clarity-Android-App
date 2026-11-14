import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// DESIGN §5.12. Primary is the single main action (accent fill); secondary
// and outline are card surfaces with a border; destructive is for confirming
// deletes/resets inside dialogs. Every size keeps a 48 px hit area (§12.3).
const buttonVariants = cva(
  "tap-target inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:border-transparent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground hover:bg-accent/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-card text-foreground hover:bg-muted/60",
        secondary: "border border-border bg-card text-foreground hover:bg-muted/60",
        ghost: "text-accent hover:bg-accent/10 disabled:bg-transparent",
        link: "text-accent underline-offset-4 hover:underline disabled:bg-transparent",
      },
      size: {
        default: "min-h-12 px-5",
        sm: "min-h-10 px-4",
        lg: "min-h-12 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
