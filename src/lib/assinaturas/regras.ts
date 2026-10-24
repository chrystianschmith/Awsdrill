import { ENTITLEMENTS, type PlanKey } from "./entitlements";
import { DIAS_CARENCIA, DIAS_LEMBRETE_PIX, MESES_PIX } from "./precos";
import type { AssinaturaRow, SeguidoRow } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Status do Stripe em que a assinatura no cartão segue viva (renova sozinha). */
export const STATUS_VIVOS = new Set(["trialing", "active", "past_due"]);
/** Status finais: a assinatura não volta mais. */
export const STATUS_TERMINAIS = new Set(["canceled", "incomplete_expired"]);

/** Soma meses em UTC, ajustando para o último dia do mês quando preciso (31/01 + 1 → 28/02). */
export function somarMesesUTC(data: Date, meses: number): Date {
  const d = new Date(data.getTime());
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimoDia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimoDia));
  return d;
}

/**
 * Novo `accessUntil` após um pagamento anual via Pix: +12 meses a partir do
 * acesso atual, se ainda vigente, ou a partir de agora.
 */
export function calcularAccessUntilPix(atual: Date | null, agora: Date, meses: number = MESES_PIX): Date {
  const base = atual && atual.getTime() > agora.getTime() ? atual : agora;
  return somarMesesUTC(base, meses);
}

export type AcaoCarencia = "manter" | "iniciar" | "limpar";

/**
 * Carência após falha no cartão. Começa na primeira falha e não é estendida
 * pelas novas tentativas do Stripe; some quando a assinatura volta a ficar em dia.
 */
export function calcularCarencia(
  atual: Date | null,
  status: string,
  acao: AcaoCarencia,
  agora: Date,
  dias: number = DIAS_CARENCIA,
): { graceUntil: Date | null; iniciou: boolean } {
  if (status === "active" || status === "trialing" || acao === "limpar") return { graceUntil: null, iniciou: false };
  if (acao === "iniciar" && !atual) return { graceUntil: new Date(agora.getTime() + dias * DIA_MS), iniciou: true };
  return { graceUntil: atual, iniciou: false };
}

/**
 * Downgrade sem apagar dados: no Grátis, mantém ativos os exames seguidos mais
 * antigos até o limite e pausa o resto; no Pro, reativa todos.
 */
export function planejarSeguidos(seguidos: SeguidoRow[], plano: PlanKey): { pausar: string[]; reativar: string[] } {
  if (plano === "PRO") {
    return { pausar: [], reativar: seguidos.filter((s) => s.status === "PAUSADO").map((s) => s.id) };
  }
  const limite = ENTITLEMENTS[plano].maxExamesSeguidos;
  const ativos = seguidos
    .filter((s) => s.status === "ATIVO")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  return { pausar: ativos.slice(limite).map((s) => s.id), reativar: [] };
}

/** Lembrete de renovação do Pix: 7 dias antes do fim, uma vez por período, só sem cartão ativo. */
export function precisaLembretePix(
  sub: Pick<AssinaturaRow, "accessUntil" | "renewalReminderSentAt" | "status">,
  agora: Date,
  dias: number = DIAS_LEMBRETE_PIX,
): boolean {
  if (!sub.accessUntil || sub.renewalReminderSentAt) return false;
  if (sub.status && STATUS_VIVOS.has(sub.status)) return false;
  const falta = sub.accessUntil.getTime() - agora.getTime();
  return falta > 0 && falta <= dias * DIA_MS;
}

/** Fim do trial para quem ainda tem acesso pago via Pix e passa para o cartão (não cobra em dobro). */
export function trialAteFimDoPix(accessUntil: Date | null, agora: Date): number | null {
  // O Stripe exige trial_end ao menos 48 h no futuro e no máximo 730 dias.
  if (!accessUntil) return null;
  const falta = accessUntil.getTime() - agora.getTime();
  if (falta < 2 * DIA_MS + 60_000 || falta > 730 * DIA_MS) return null;
  return Math.floor(accessUntil.getTime() / 1000);
}
