"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { excluirConta } from "@/lib/auth/actions";
import { aplicarErrosDeCampo } from "@/lib/auth/form-utils";
import { excluirContaSchema, type ExcluirContaInput } from "@/lib/auth/schemas";

export function ExcluirConta() {
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExcluirContaInput, unknown, z.output<typeof excluirContaSchema>>({
    resolver: zodResolver(excluirContaSchema),
    defaultValues: { senha: "", confirmacao: "" },
  });

  async function onSubmit(dados: z.output<typeof excluirContaSchema>) {
    setErro(null);
    const r = await excluirConta(dados);
    if (r && !r.ok && !aplicarErrosDeCampo(setError, ["senha", "confirmacao"], r.fieldErrors)) setErro(r.error);
  }

  return (
    <Dialog
      onOpenChange={(aberto) => {
        if (!aberto) {
          reset();
          setErro(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="danger" className="w-fit">
          Excluir conta
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Excluir conta"
        description="Esta ação não pode ser desfeita. Seus dados pessoais, preferências e histórico de estudo serão apagados."
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          {erro ? <Alert tone="danger">{erro}</Alert> : null}
          <Field label="Sua senha" htmlFor="excluir-senha" error={errors.senha?.message}>
            <Input
              id="excluir-senha"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.senha)}
              aria-describedby={errors.senha ? "excluir-senha-erro" : undefined}
              {...register("senha")}
            />
          </Field>
          <Field label='Digite "EXCLUIR" para confirmar' htmlFor="excluir-confirmacao" error={errors.confirmacao?.message}>
            <Input
              id="excluir-confirmacao"
              autoComplete="off"
              autoCapitalize="characters"
              aria-invalid={Boolean(errors.confirmacao)}
              aria-describedby={errors.confirmacao ? "excluir-confirmacao-erro" : undefined}
              {...register("confirmacao")}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="danger" disabled={isSubmitting}>
              {isSubmitting ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
