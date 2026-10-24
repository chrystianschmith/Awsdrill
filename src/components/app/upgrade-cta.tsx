import Link from "next/link";
import { Lock } from "lucide-react";
import { FEATURE_LABELS, type Entitlements } from "@/lib/assinaturas/entitlements";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Recurso Pro bloqueado: visível, cadeado discreto e um único CTA. */
export function UpgradeCta({
  feature,
  description,
  className,
}: {
  feature: keyof Entitlements;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4", className)}>
      <p className="inline-flex items-center gap-2 text-sm font-medium">
        <Lock aria-hidden className="size-4 text-muted-foreground" />
        {FEATURE_LABELS[feature]} faz parte do plano Pro
      </p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <Link href={`/precos?recurso=${feature}`} className={buttonVariants({ size: "sm" })}>
        Ver plano Pro
      </Link>
    </div>
  );
}
