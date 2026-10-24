import "server-only";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { BotaoReenviarConfirmacao } from "./components-client";
import { getCurrentUser } from "./session";

export { BotaoReenviarConfirmacao };

/**
 * Aviso para quem ainda não confirmou o e-mail, com botão de reenviar.
 * Server Component: não renderiza nada se não houver usuário ou se já confirmou.
 * Uso no shell: `<AvisoEmailNaoConfirmado />`.
 */
export async function AvisoEmailNaoConfirmado({ className }: { className?: string }) {
  const user = await getCurrentUser();
  if (!user || user.emailVerified) return null;
  return (
    <Alert
      tone="warning"
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}
    >
      <p>
        Confirme seu e-mail <span className="font-medium">{user.email}</span> para receber lembretes e avisos por
        e-mail.
      </p>
      <BotaoReenviarConfirmacao className="shrink-0" />
    </Alert>
  );
}
