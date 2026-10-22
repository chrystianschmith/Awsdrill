"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { redefinirSenha } from "@/lib/auth/actions";
import { aplicarErrosDeCampo } from "@/lib/auth/form-utils";
import { redefinirSchema, type RedefinirInput } from "@/lib/auth/schemas";

export function FormRedefinir({ token }: { token: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RedefinirInput, unknown, z.output<typeof redefinirSchema>>({
    resolver: zodResolver(redefinirSchema),
    defaultValues: { token, senha: "", confirmacao: "" },
  });

  async function onSubmit(dados: z.output<typeof redefinirSchema>) {
    setErro(null);
    const r = await redefinirSenha(dados);
    if (r && !r.ok && !aplicarErrosDeCampo(setError, ["senha", "confirmacao"], r.fieldErrors)) setErro(r.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {errors.token?.message ? <Alert tone="danger">{errors.token.message}</Alert> : null}
      <input type="hidden" {...register("token")} />
      <Field label="Nova senha" htmlFor="senha" error={errors.senha?.message} hint="Pelo menos 8 caracteres.">
        <Input
          id="senha"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.senha)}
          aria-describedby={errors.senha ? "senha-erro" : undefined}
          {...register("senha")}
        />
      </Field>
      <Field label="Repita a nova senha" htmlFor="confirmacao" error={errors.confirmacao?.message}>
        <Input
          id="confirmacao"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmacao)}
          aria-describedby={errors.confirmacao ? "confirmacao-erro" : undefined}
          {...register("confirmacao")}
        />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
