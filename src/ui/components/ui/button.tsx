/**
 * Button component based on shadcn/ui patterns.
 * Follows MedGit design system: primary (violet filled), secondary (outlined).
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@ui/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-violet text-on-violet hover:bg-violet/90',
        secondary: 'border-2 border-line-strong bg-surface text-ink hover:bg-surface-2',
        ghost: 'hover:bg-surface-2 text-ink',
      },
      size: {
        default: 'h-10 px-4 py-2 rounded-[var(--radius-row)]',
        sm: 'h-9 px-3 text-small rounded-[var(--radius-cell)]',
        lg: 'h-11 px-8 rounded-[var(--radius-row)]',
        icon: 'h-10 w-10 rounded-[var(--radius-row)]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
