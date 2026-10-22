import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Símbolo: trilha em degraus subindo até um marco. Monocromático. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-6", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor" />
      <path
        d="M8 24h5v-5h5v-5h5"
        fill="none"
        stroke="var(--logo-bg, white)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="9" r="2.5" fill="var(--logo-bg, white)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark className="text-primary [--logo-bg:var(--surface)]" />
      <span>{BRAND.name}</span>
    </span>
  );
}
