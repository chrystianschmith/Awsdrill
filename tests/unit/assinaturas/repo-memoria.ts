import type {
  AssinaturaRepo,
  AssinaturaRow,
  AssinaturaTx,
  AuditMetadata,
  EmailAssinatura,
  SeguidoRow,
} from "@/lib/assinaturas/tipos";

type Estado = {
  eventos: Map<string, string>;
  assinaturas: Map<string, AssinaturaRow>;
  seguidos: Map<string, SeguidoRow & { userId: string }>;
  auditoria: Array<{ action: string; userId: string; metadata: AuditMetadata }>;
  semAvisos: Set<string>;
};

function clonar(e: Estado): Estado {
  return {
    eventos: new Map(e.eventos),
    assinaturas: new Map([...e.assinaturas].map(([k, v]) => [k, { ...v }])),
    seguidos: new Map([...e.seguidos].map(([k, v]) => [k, { ...v }])),
    auditoria: [...e.auditoria],
    semAvisos: new Set(e.semAvisos),
  };
}

/** Repositório em memória com transação (rollback em caso de erro). */
export class RepoMemoria implements AssinaturaRepo {
  estado: Estado = {
    eventos: new Map(),
    assinaturas: new Map(),
    seguidos: new Map(),
    auditoria: [],
    semAvisos: new Set(),
  };

  async registrarEvento(id: string, type: string) {
    if (this.estado.eventos.has(id)) return false;
    this.estado.eventos.set(id, type);
    return true;
  }
  async porUsuario(userId: string) {
    const a = this.estado.assinaturas.get(userId);
    return a ? { ...a } : null;
  }
  async porCustomer(customerId: string) {
    const a = [...this.estado.assinaturas.values()].find((s) => s.stripeCustomerId === customerId);
    return a ? { ...a } : null;
  }
  async salvar(userId: string, stripeCustomerId: string, dados: Partial<AssinaturaRow>) {
    const atual: AssinaturaRow = this.estado.assinaturas.get(userId) ?? {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: null,
      status: null,
      priceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      graceUntil: null,
      accessUntil: null,
      renewalReminderSentAt: null,
      effectivePlan: "FREE",
    };
    this.estado.assinaturas.set(userId, { ...atual, ...dados, userId, stripeCustomerId });
  }
  async seguidos(userId: string) {
    return [...this.estado.seguidos.values()]
      .filter((s) => s.userId === userId)
      .map(({ id, status, createdAt }) => ({ id, status, createdAt }));
  }
  async definirStatusSeguidos(ids: string[], status: "ATIVO" | "PAUSADO") {
    for (const id of ids) {
      const s = this.estado.seguidos.get(id);
      if (s) s.status = status;
    }
  }
  async auditar(action: string, userId: string, metadata: AuditMetadata) {
    this.estado.auditoria.push({ action, userId, metadata });
  }
  async eventoProcessado(id: string) {
    return this.estado.eventos.has(id);
  }
  async transacao<T>(fn: (tx: AssinaturaTx) => Promise<T>): Promise<T> {
    const copia = clonar(this.estado);
    try {
      return await fn(this);
    } catch (e) {
      this.estado = copia;
      throw e;
    }
  }
  async candidatosPlano(agora: Date) {
    return [...this.estado.assinaturas.values()]
      .filter(
        (a) =>
          a.effectivePlan === "PRO" ||
          ["trialing", "active", "past_due"].includes(a.status ?? "") ||
          (a.accessUntil !== null && a.accessUntil > agora),
      )
      .map((a) => a.userId);
  }
  async candidatosLembretePix(agora: Date, ate: Date) {
    return [...this.estado.assinaturas.values()].filter(
      (a) => a.accessUntil && a.accessUntil > agora && a.accessUntil <= ate && !a.renewalReminderSentAt,
    );
  }
  async querAvisosPagamento(userId: string) {
    return !this.estado.semAvisos.has(userId);
  }

  // Ajudantes dos testes
  seguir(userId: string, id: string, createdAt: Date, status: "ATIVO" | "PAUSADO" = "ATIVO") {
    this.estado.seguidos.set(id, { id, userId, status, createdAt });
  }
  statusSeguidos(userId: string) {
    return Object.fromEntries(
      [...this.estado.seguidos.values()].filter((s) => s.userId === userId).map((s) => [s.id, s.status]),
    );
  }
}

export function caixaDeEmails() {
  const enviados: EmailAssinatura[] = [];
  return { enviados, enviar: async (e: EmailAssinatura) => void enviados.push(e) };
}
