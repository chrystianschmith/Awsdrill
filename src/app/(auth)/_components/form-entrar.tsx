"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { entrar } from "@/lib/auth/actions";
import { aplicarErrosDeCampo } from "@/lib/auth/form-utils";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";

export function FormEntrar({ voltar }: { voltar?: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", senha: "", voltar },
  });

  async function onSubmit(dados: z.output<typeof loginSchema>) {
    setErro(null);
    const r = await entrar({ ...dados, voltar });
    if (r && !r.ok) {
      aplicarErrosDeCampo(setError, ["email", "senha"], r.fieldErrors);
      setErro(r.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-erro" : undefined}
          {...register("email")}
        />
      </Field>
      <Field label="Senha" htmlFor="senha" error={errors.senha?.message}>
        <Input
          id="senha"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.senha)}
          aria-describedby={errors.senha ? "senha-erro" : undefined}
          {...register("senha")}
        />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
