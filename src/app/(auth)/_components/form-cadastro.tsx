"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input } from "@/components/ui/input";
import { cadastrar } from "@/lib/auth/actions";
import { aplicarErrosDeCampo } from "@/lib/auth/form-utils";
import { cadastroSchema, type CadastroInput } from "@/lib/auth/schemas";

export function FormCadastro() {
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CadastroInput, unknown, z.output<typeof cadastroSchema>>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: { nome: "", email: "", senha: "", aceiteTermos: false },
  });

  async function onSubmit(dados: z.output<typeof cadastroSchema>) {
    setErro(null);
    const r = await cadastrar(dados);
    if (r && !r.ok) {
      const temCampo = aplicarErrosDeCampo(setError, ["nome", "email", "senha", "aceiteTermos"], r.fieldErrors);
      if (!temCampo || r.code === "rate_limit") setErro(r.error);
    }
  }

  const aria = (campo: keyof CadastroInput) => ({
    "aria-invalid": Boolean(errors[campo]),
    "aria-describedby": errors[campo] ? `${campo}-erro` : undefined,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      <Field label="Nome" htmlFor="nome" error={errors.nome?.message}>
        <Input id="nome" autoComplete="name" {...aria("nome")} {...register("nome")} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          {...aria("email")}
          {...register("email")}
        />
      </Field>
      <Field
        label="Senha"
        htmlFor="senha"
        error={errors.senha?.message}
        hint="Pelo menos 8 caracteres. Evite senhas óbvias."
      >
        <Input id="senha" type="password" autoComplete="new-password" {...aria("senha")} {...register("senha")} />
      </Field>
      <div className="grid gap-1.5">
        <div className="flex items-start gap-2">
          <input
            id="aceiteTermos"
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
            {...aria("aceiteTermos")}
            {...register("aceiteTermos")}
          />
          <label htmlFor="aceiteTermos" className="text-sm">
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" className="text-primary-strong underline underline-offset-4">
              termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank" className="text-primary-strong underline underline-offset-4">
              política de privacidade
            </Link>
            .
          </label>
        </div>
        <FieldError id="aceiteTermos-erro" message={errors.aceiteTermos?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}
