"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { esqueciSenha } from "@/lib/auth/actions";
import { aplicarErrosDeCampo } from "@/lib/auth/form-utils";
import { esqueciSchema, type EsqueciInput } from "@/lib/auth/schemas";

export function FormEsqueci() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EsqueciInput, unknown, z.output<typeof esqueciSchema>>({
    resolver: zodResolver(esqueciSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(dados: z.output<typeof esqueciSchema>) {
    setErro(null);
    const r = await esqueciSenha(dados);
    if (r.ok) {
      setEnviado(r.data.mensagem);
      return;
    }
    if (!aplicarErrosDeCampo(setError, ["email"], r.fieldErrors)) setErro(r.error);
  }

  if (enviado) {
    return (
      <Alert tone="success" role="status">
        {enviado}
      </Alert>
    );
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
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Enviando..." : "Enviar link"}
      </Button>
    </form>
  );
}
