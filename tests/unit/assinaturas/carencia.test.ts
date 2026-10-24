import { beforeEach, describe, expect, it } from "vitest";
import { executarCarencia } from "@/lib/assinaturas/carencia";
import { aplicarPlanoEfetivoCom } from "@/lib/assinaturas/plano-efetivo";
import { RepoMemoria, caixaDeEmails } from "./repo-memoria";

const agora = new Date("2026-10-08T12:00:00Z");
const dias = (n: number) => new Date(agora.getTime() + n * 86_400_000);

let repo: RepoMemoria;
let caixa: ReturnType<typeof caixaDeEmails>;

beforeEach(() => {
  repo = new RepoMemoria();
  caixa = caixaDeEmails();
  repo.seguir("u1", "e1", new Date("2026-01-01T00:00:00Z"));
  repo.seguir("u1", "e2", new Date("2026-02-01T00:00:00Z"));
  repo.seguir("u1", "e3", new Date("2026-03-01T00:00:00Z"));
});

describe("aplicarPlanoEfetivo", () => {
  it("ao virar Grátis pausa os exames além do mais antigo e, ao voltar ao Pro, reativa todos", async () => {
    await repo.salvar("u1", "cus_1", { status: "canceled", effectivePlan: "PRO" });
    expect(await aplicarPlanoEfetivoCom(repo, "u1", agora)).toEqual({ de: "PRO", para: "FREE" });
    expect(repo.statusSeguidos("u1")).toEqual({ e1: "ATIVO", e2: "PAUSADO", e3: "PAUSADO" });

    await repo.salvar("u1", "cus_1", { status: "active" });
    expect(await aplicarPlanoEfetivoCom(repo, "u1", agora)).toEqual({ de: "FREE", para: "PRO" });
    expect(repo.statusSeguidos("u1")).toEqual({ e1: "ATIVO", e2: "ATIVO", e3: "ATIVO" });
    expect(repo.estado.auditoria.map((a) => a.metadata.para)).toEqual(["FREE", "PRO"]);
  });

  it("é idempotente e não audita quando o plano não muda", async () => {
    await repo.salvar("u1", "cus_1", { status: "active", effectivePlan: "PRO" });
    expect(await aplicarPlanoEfetivoCom(repo, "u1", agora)).toEqual({ de: "PRO", para: "PRO" });
    expect(repo.estado.auditoria).toHaveLength(0);
  });

  it("usuário sem assinatura fica no limite do Grátis", async () => {
    await aplicarPlanoEfetivoCom(repo, "u1", agora);
    expect(repo.statusSeguidos("u1")).toEqual({ e1: "ATIVO", e2: "PAUSADO", e3: "PAUSADO" });
  });
});

describe("cron de carência", () => {
  it("rebaixa quem passou da carência e avisa uma vez", async () => {
    await repo.salvar("u1", "cus_1", { status: "past_due", graceUntil: dias(-0.5), effectivePlan: "PRO" });
    const r = await executarCarencia({ repo, enviarEmail: caixa.enviar, agora });
    expect(r).toMatchObject({ rebaixados: 1 });
    expect(repo.statusSeguidos("u1")).toEqual({ e1: "ATIVO", e2: "PAUSADO", e3: "PAUSADO" });
    expect(caixa.enviados).toEqual([{ tipo: "voltou_gratis", userId: "u1" }]);

    const r2 = await executarCarencia({ repo, enviarEmail: caixa.enviar, agora: dias(1) });
    expect(r2.rebaixados).toBe(0);
    expect(caixa.enviados).toHaveLength(1);
  });

  it("mantém o Pro durante a carência", async () => {
    await repo.salvar("u1", "cus_1", { status: "past_due", graceUntil: dias(1), effectivePlan: "PRO" });
    const r = await executarCarencia({ repo, enviarEmail: caixa.enviar, agora });
    expect(r.rebaixados).toBe(0);
    expect(repo.statusSeguidos("u1")).toEqual({ e1: "ATIVO", e2: "ATIVO", e3: "ATIVO" });
  });

  it("rebaixa quando o acesso Pix termina", async () => {
    await repo.salvar("u1", "cus_1", { accessUntil: dias(-0.1), effectivePlan: "PRO" });
    const r = await executarCarencia({ repo, enviarEmail: caixa.enviar, agora });
    expect(r.rebaixados).toBe(1);
    expect((await repo.porUsuario("u1"))?.effectivePlan).toBe("FREE");
  });

  it("envia o lembrete do Pix 7 dias antes, uma única vez", async () => {
    await repo.salvar("u1", "cus_1", { accessUntil: dias(6), effectivePlan: "PRO" });
    await executarCarencia({ repo, enviarEmail: caixa.enviar, agora });
    await executarCarencia({ repo, enviarEmail: caixa.enviar, agora: dias(1) });
    expect(caixa.enviados).toEqual([{ tipo: "lembrete_pix", userId: "u1", accessUntil: dias(6) }]);
    expect((await repo.porUsuario("u1"))?.renewalReminderSentAt).toEqual(agora);
  });

  it("não envia lembrete a quem desligou avisos de pagamento, mas marca para não repetir", async () => {
    await repo.salvar("u1", "cus_1", { accessUntil: dias(3), effectivePlan: "PRO" });
    repo.estado.semAvisos.add("u1");
    const r = await executarCarencia({ repo, enviarEmail: caixa.enviar, agora });
    expect(r.lembretes).toBe(0);
    expect(caixa.enviados).toEqual([]);
    expect((await repo.porUsuario("u1"))?.renewalReminderSentAt).toEqual(agora);
  });

  it("falha no envio do lembrete não marca, para tentar de novo", async () => {
    await repo.salvar("u1", "cus_1", { accessUntil: dias(3), effectivePlan: "PRO" });
    await executarCarencia({
      repo,
      agora,
      enviarEmail: async () => {
        throw new Error("smtp");
      },
    });
    expect((await repo.porUsuario("u1"))?.renewalReminderSentAt).toBeNull();
  });
});
