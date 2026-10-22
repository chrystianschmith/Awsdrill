import { NextResponse } from "next/server";
import { audit } from "@/lib/auth/audit";
import { exportarDadosDoUsuario } from "@/lib/auth/fluxos";
import { chaveLimite, consumir, LIMITES } from "@/lib/auth/rate-limit";
import { getIp } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** LGPD: devolve um JSON com todos os dados do usuário logado. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta para exportar os dados." }, { status: 401 });

  if (!(await consumir(chaveLimite("exportar:usuario", user.id), LIMITES.exportarUsuario))) {
    return NextResponse.json(
      { erro: "Muitas exportações seguidas. Aguarde alguns minutos e tente novamente." },
      { status: 429 },
    );
  }

  const dados = await exportarDadosDoUsuario(user.id);
  await audit("conta.exportada", user.id, undefined, await getIp());
  const data = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-${data}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
