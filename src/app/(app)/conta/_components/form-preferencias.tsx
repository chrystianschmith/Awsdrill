"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { atualizarPreferencias } from "@/lib/auth/actions";
import { preferenciasSchema, type PreferenciasInput } from "@/lib/auth/schemas";

const OPCOES: { nome: keyof PreferenciasInput; label: string; descricao: string }[] = [
  { nome: "revisoes", label: "Revisões do dia", descricao: "Lembrete quando houver revisões pendentes." },
  { nome: "mudancaExame", label: "Mudanças no exame", descricao: "Nova versão do guia do exame que você estuda ou data de retirada." },
  { nome: "recertificacao", label: "Recertificação", descricao: "Aviso antes de uma certificação sua vencer." },
  { nome: "avisosPagamento", label: "Assinatura e pagamento", descricao: "Falha de cobrança, renovação e fim do acesso Pro." },
];

export function FormPreferencias({ valores }: { valores: PreferenciasInput }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<PreferenciasInput, unknown, z.output<typeof preferenciasSchema>>({
    resolver: zodResolver(preferenciasSchema),
    defaultValues: valores,
  });

  async function onSubmit(dados: z.output<typeof preferenciasSchema>) {
    const r = await atualizarPreferencias(dados);
    if (r.ok) {
      reset(dados);
      toast.success("Preferências salvas.");
    } else {
      toast.error(r.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <fieldset className="grid gap-3">
        <legend className="sr-only">E-mails que você quer receber</legend>
        {OPCOES.map((o) => (
          <div key={o.nome} className="flex items-start gap-3">
            <input id={`pref-${o.nome}`} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" {...register(o.nome)} />
            <label htmlFor={`pref-${o.nome}`} className="grid gap-0.5 text-sm">
              <span className="font-medium">{o.label}</span>
              <span className="text-muted-foreground">{o.descricao}</span>
            </label>
          </div>
        ))}
      </fieldset>
      <p className="text-xs text-muted-foreground">E-mails de segurança (confirmação, redefinição e troca de senha) são sempre enviados.</p>
      <Button type="submit" disabled={isSubmitting || !isDirty} className="w-fit">
        {isSubmitting ? "Salvando..." : "Salvar preferências"}
      </Button>
    </form>
  );
}
