import * as React from "react";
import { cn } from "@/lib/utils";

const tons = {
  info: "border-info/30 bg-info/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/30 bg-danger/10",
  success: "border-success/30 bg-success/10",
} as const;

export function Alert({
  tone = "info",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof tons }) {
  return <div role="status" className={cn("rounded-lg border px-4 py-3 text-sm", tons[tone], className)} {...props} />;
}
