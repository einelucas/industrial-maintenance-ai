import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Variantes de domínio (não o default/secondary/destructive/outline padrão
// do shadcn/ui) — status-badge.tsx e várias páginas dependem destes nomes
// exatos para mapear RiskLevel/WorkOrderStatus/AlertSeverity/etc.
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        neutral: "bg-status-neutral/10 text-status-neutral border-status-neutral/20",
        attention: "bg-status-attention/10 text-status-attention border-status-attention/20",
        high: "bg-status-high/10 text-status-high border-status-high/20",
        critical: "bg-status-critical/10 text-status-critical border-status-critical/20",
        muted: "bg-muted text-muted-foreground border-border",
      },
    },
    defaultVariants: { variant: "muted" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
