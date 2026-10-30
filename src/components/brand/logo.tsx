import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Símbolo: quadrado amarelo com uma trilha em degraus subindo até um marco, em preto. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--primary)" />
      <path
        d="M8 24h5v-5h5v-5h5"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="9" r="2.75" fill="var(--primary-foreground)" />
    </svg>
  );
}

/** Marca como no alibabadrill: nome em Bricolage, segunda parte na cor de destaque. */
export function Logo({ className }: { className?: string }) {
  const [primeira, segunda] = BRAND.partes;
  return (
    <span
      className={cn("inline-flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight", className)}
    >
      <LogoMark />
      <span>
        {primeira} <span className="text-primary-strong">{segunda}</span>
      </span>
    </span>
  );
}
