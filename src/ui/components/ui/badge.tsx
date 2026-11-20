/**
 * Badge component for pills and labels.
 * Height 24px, padding 4x10, 13px text per DESIGN_SYSTEM.md.
 */

import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@ui/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-1 text-small font-normal whitespace-nowrap rounded-[var(--radius-pill)]',
  {
    variants: {
      variant: {
        default: 'bg-surface-2 text-ink',
        conflict: 'bg-conflict-bg text-conflict',
        resolved: 'bg-resolved-bg text-resolved',
        escalated: 'bg-escalated-bg text-escalated',
        agreed: 'bg-agreed-bg text-agreed',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
