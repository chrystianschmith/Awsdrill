"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { atualizarDados } from "@/lib/auth/actions";
import { aplicarErrosDeCampo } from "@/lib/auth/form-utils";
import { dadosSchema, type DadosInput } from "@/lib/auth/schemas";

export function FormDados({ nome }: { nome: string }) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DadosInput, unknown, z.output<typeof dadosSchema>>({
    resolver: zodResolver(dadosSchema),
    defaultValues: { nome },
  });

  async function onSubmit(dados: z.output<typeof dadosSchema>) {
    const r = await atualizarDados(dados);
    if (r.ok) {
      reset(dados);
      toast.success("Dados atualizados.");
      return;
    }
    if (!aplicarErrosDeCampo(setError, ["nome"], r.fieldErrors)) toast.error(r.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:max-w-md">
      <Field label="Nome" htmlFor="nome" error={errors.nome?.message}>
        <Input
          id="nome"
          autoComplete="name"
          aria-invalid={Boolean(errors.nome)}
          aria-describedby={errors.nome ? "nome-erro" : undefined}
          {...register("nome")}
        />
      </Field>
      <Button type="submit" disabled={isSubmitting || !isDirty} className="w-fit">
        {isSubmitting ? "Salvando..." : "Salvar dados"}
      </Button>
    </form>
  );
}
