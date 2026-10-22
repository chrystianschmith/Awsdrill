"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { trocarSenha } from "@/lib/auth/actions";
import { aplicarErrosDeCampo } from "@/lib/auth/form-utils";
import { trocarSenhaSchema, type TrocarSenhaInput } from "@/lib/auth/schemas";

const CAMPOS = [
  { nome: "senhaAtual", label: "Senha atual", auto: "current-password" },
  { nome: "novaSenha", label: "Nova senha", auto: "new-password" },
  { nome: "confirmacao", label: "Repita a nova senha", auto: "new-password" },
] as const;

export function FormSenha() {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TrocarSenhaInput, unknown, z.output<typeof trocarSenhaSchema>>({
    resolver: zodResolver(trocarSenhaSchema),
    defaultValues: { senhaAtual: "", novaSenha: "", confirmacao: "" },
  });

  async function onSubmit(dados: z.output<typeof trocarSenhaSchema>) {
    const r = await trocarSenha(dados);
    if (r.ok) {
      reset();
      toast.success("Senha alterada. As outras sessões foram encerradas.");
      return;
    }
    if (!aplicarErrosDeCampo(setError, ["senhaAtual", "novaSenha", "confirmacao"], r.fieldErrors)) toast.error(r.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:max-w-md">
      {CAMPOS.map((c) => (
        <Field key={c.nome} label={c.label} htmlFor={c.nome} error={errors[c.nome]?.message}>
          <Input
            id={c.nome}
            type="password"
            autoComplete={c.auto}
            aria-invalid={Boolean(errors[c.nome])}
            aria-describedby={errors[c.nome] ? `${c.nome}-erro` : undefined}
            {...register(c.nome)}
          />
        </Field>
      ))}
      <Button type="submit" disabled={isSubmitting} className="w-fit">
        {isSubmitting ? "Salvando..." : "Trocar senha"}
      </Button>
    </form>
  );
}
