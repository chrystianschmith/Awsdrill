import { MarketingShell } from "@/components/app/marketing-shell";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
