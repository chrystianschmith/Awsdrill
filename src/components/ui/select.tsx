import * as React from "react";
import { cn } from "@/lib/utils";

/** Select nativo estilizado: acessível e leve no mobile. */
export function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn("flex h-10 w-full rounded-md border border-input bg-surface px-3 text-sm disabled:opacity-50", className)}
      {...props}
    />
  );
}
