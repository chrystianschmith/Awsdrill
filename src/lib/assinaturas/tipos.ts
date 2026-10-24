import type { PlanKey } from "./entitlements";

/** Linha de `Subscription` no formato usado pelas regras de assinatura. */
export type AssinaturaRow = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string | null;
  priceId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  graceUntil: Date | null;
  accessUntil: Date | null;
  renewalReminderSentAt: Date | null;
  effectivePlan: PlanKey;
};

export type AssinaturaDados = Partial<Omit<AssinaturaRow, "userId" | "stripeCustomerId">>;

export type StatusSeguido = "ATIVO" | "PAUSADO";
export type SeguidoRow = { id: string; status: StatusSeguido; createdAt: Date };

export type AuditMetadata = Record<string, string | number | boolean | null>;

/** Operações de banco usadas dentro de uma transação. */
export interface AssinaturaTx {
  /** Grava a chave de idempotência; false se já existia. */
  registrarEvento(id: string, type: string): Promise<boolean>;
  porUsuario(userId: string): Promise<AssinaturaRow | null>;
  porCustomer(customerId: string): Promise<AssinaturaRow | null>;
  /** Cria ou atualiza a assinatura do usuário. */
  salvar(userId: string, stripeCustomerId: string, dados: AssinaturaDados): Promise<void>;
  seguidos(userId: string): Promise<SeguidoRow[]>;
  definirStatusSeguidos(ids: string[], status: StatusSeguido): Promise<void>;
  auditar(action: string, userId: string, metadata: AuditMetadata): Promise<void>;
}

export interface AssinaturaRepo extends AssinaturaTx {
  eventoProcessado(id: string): Promise<boolean>;
  transacao<T>(fn: (tx: AssinaturaTx) => Promise<T>): Promise<T>;
  /** Usuários cujo plano efetivo pode ter mudado (Pro gravado, assinatura viva ou Pix vigente). */
  candidatosPlano(agora: Date): Promise<string[]>;
  /** Assinaturas com acesso Pix terminando até `ate` e lembrete ainda não enviado. */
  candidatosLembretePix(agora: Date, ate: Date): Promise<AssinaturaRow[]>;
  /** Preferência "avisos de pagamento" (padrão true). */
  querAvisosPagamento(userId: string): Promise<boolean>;
}

/** E-mails que as regras pedem para enviar; o envio real fica fora da transação. */
export type EmailAssinatura =
  | { tipo: "pagamento_falhou"; userId: string; graceUntil: Date }
  | { tipo: "ativada"; userId: string; via: "cartao" | "pix"; acessoAte: Date | null }
  | { tipo: "voltou_gratis"; userId: string }
  | { tipo: "lembrete_pix"; userId: string; accessUntil: Date };

export type EnviarEmailAssinatura = (email: EmailAssinatura) => Promise<void>;

export type TransicaoPlano = { de: PlanKey; para: PlanKey };
