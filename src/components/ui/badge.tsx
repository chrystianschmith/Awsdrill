import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "bg-surface-muted text-muted-foreground",
      primary: "bg-primary-soft text-primary-strong",
      success: "bg-success/15 text-success-strong",
      warning: "bg-warning/15 text-warning-strong",
      danger: "bg-danger/15 text-danger-strong",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
