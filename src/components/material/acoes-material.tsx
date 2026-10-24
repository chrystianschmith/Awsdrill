"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { gerarMaterialAction, reportarErroAction } from "@/lib/ai/actions";

/** Gera o material da tarefa (uma vez, para todos). */
export function GerarMaterial({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [gerando, setGerando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const gerar = async () => {
    setGerando(true);
    setAviso(null);
    const r = await gerarMaterialAction(topicId);
    setGerando(false);
    if (!r.ok) return toast.error(r.error);
    if (r.data.status === "pronto") return router.refresh();
    setAviso(
      r.data.status === "gerando"
        ? "Outra pessoa está gerando este material agora. Tente de novo em um minuto."
        : r.data.mensagem,
    );
  };
  return (
    <div className="grid justify-items-start gap-3">
      <Button onClick={gerar} disabled={gerando}>
        {gerando ? "Gerando material, pode levar um minuto…" : "Gerar material desta tarefa"}
      </Button>
      {aviso ? <Alert tone="warning">{aviso}</Alert> : null}
    </div>
  );
}

/** "Reportar erro" em um resumo ou flashcard gerado por IA. */
export function ReportarErro({
  topicId,
  contentType,
  contentId,
  rotulo,
}: {
  topicId: string;
  contentType: "summary" | "flashcard";
  contentId: string;
  rotulo: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const campo = `report-${contentId}`;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const r = await reportarErroAction({ topicId, contentType, contentId, message: mensagem });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.fieldErrors?.message?.[0] ?? r.error);
      return;
    }
    setAberto(false);
    setMensagem("");
    setErro(undefined);
    toast.success("Obrigado! O erro foi enviado para revisão.");
    if (r.data.despublicado) router.refresh();
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Reportar erro: ${rotulo}`}>
          <Flag className="size-4" aria-hidden />
          Reportar erro
        </Button>
      </DialogTrigger>
      <DialogContent title="Reportar erro" description="Diga o que está errado. A equipe revisa cada report.">
        <form onSubmit={enviar} className="grid gap-3">
          <Label htmlFor={campo}>O que está errado?</Label>
          <Textarea
            id={campo}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            maxLength={1000}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? `${campo}-erro` : undefined}
          />
          <FieldError id={`${campo}-erro`} message={erro} />
          <Button type="submit" disabled={enviando}>
            Enviar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
