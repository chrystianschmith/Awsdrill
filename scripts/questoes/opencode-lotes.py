"""Escreve questões por tarefa do exam guide com um modelo grátis do OpenCode. Tudo sai pendente de moderação.

Uso: python3 scripts/questoes/opencode-lotes.py <EXAME> [rodadas=2] [filtro-de-tarefa=*] [modelo=opencode/big-pickle]
Saída: conteudo/questoes/<EXAME>/opencode-<tarefa>-<rodada>.json (ArquivoQuestoes, origem "ia"; versaoPrompt "opencode-v2",
ou "opencode-v3" nos exames Associate, que somam conteudo/questoes/instrucoes-associate.md ao prompt).

Cada chamada pede 5 questões de uma tarefa (4 SINGLE de 4 alternativas e 1 MULTIPLE de 5 com 2 corretas) e recebe os
enunciados já escritos da tarefa para não repetir. A resposta passa por scripts/questoes/validar.ts (schema, código da
tarefa, duplicata contra todo o exame) e cada fonte é conferida por GET (200 depois dos redirects, ainda em host
oficial, 1 req/s por host). Falhou: nova tentativa com o motivo; o modelo de reserva entra depois de 3 falhas.

O modelo não recebe ferramentas nem contexto do repo: roda em OPENCODE_PASTA (padrão ../aws-saas-escritor), sem AGENTS.md
e com opencode.json que nega edição, bash e web. Mesmo assim, depois de cada chamada a execução aborta se o clone ganhar
arquivo novo ou alterado fora de conteudo/questoes/ (o serviço do OpenCode Desktop já gravou um arquivo na raiz). Rode com
o OpenCode Desktop fechado. OPENCODE_BIN força o binário; OPENCODE_PARALELO tarefas ao mesmo tempo (padrão 3).
"""
import fnmatch, glob, json, os, re, shutil, subprocess, sys, tempfile, threading, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

EXAME = sys.argv[1]
RODADAS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
FILTRO = sys.argv[3] if len(sys.argv) > 3 else "*"
MODELO = sys.argv[4] if len(sys.argv) > 4 else "opencode/big-pickle"
RESERVA = os.environ.get("OPENCODE_RESERVA", "opencode/big-pickle")
TENTATIVAS = [MODELO] * 3 + [RESERVA] * 2
# v2: regra de serviços fechados a novos clientes; v3: cenários de nível Associate com restrições concorrentes.
ASSOCIATE = EXAME.startswith(("SAA-", "DVA-", "SOA-", "CLO-", "DEA-", "MLA-"))
VERSAO_PROMPT = "opencode-v3" if ASSOCIATE else "opencode-v2"
SAIDA = f"conteudo/questoes/{EXAME}"
HOSTS = {"docs.aws.amazon.com", "aws.amazon.com"}
# Fechados a novos clientes (conferido na documentação em 2026-10-23): não podem ser a resposta correta.
FECHADOS = ("Snowball", "Migration Hub", "Cloud9")

PASTA = os.environ.get("OPENCODE_PASTA", os.path.join(os.path.dirname(os.path.abspath(".")), "aws-saas-escritor"))
os.makedirs(PASTA, exist_ok=True)
with open(os.path.join(PASTA, "opencode.json"), "w", encoding="utf-8") as f:
    json.dump({
        "$schema": "https://opencode.ai/config.json", "autoupdate": False, "share": "disabled",
        "permission": {"edit": "deny", "bash": "deny", "webfetch": "deny"},
        "tools": {"write": False, "edit": False, "patch": False, "bash": False, "webfetch": False},
    }, f)
if os.path.exists(os.path.join(PASTA, "AGENTS.md")):
    sys.exit(f"{PASTA}/AGENTS.md daria contexto ao escritor; remova.")

CLI_MAC = os.path.expanduser("~/Library/Application Support/ai.opencode.desktop/cli")
candidatos = sorted(glob.glob(os.path.join(CLI_MAC, "*", "opencode-cli")))
OPENCODE = [os.environ.get("OPENCODE_BIN") or shutil.which("opencode") or (candidatos[-1] if candidatos else None)]
if OPENCODE[0] is None:
    OPENCODE = ["npx", "-y", "opencode-ai@1.18.35"]

INSTRUCOES = open("conteudo/questoes/instrucoes.md", encoding="utf-8").read()
if ASSOCIATE:
    INSTRUCOES += "\n" + open("conteudo/questoes/instrucoes-associate.md", encoding="utf-8").read()


def alterados_fora():
    """Arquivos novos ou alterados no clone fora de conteudo/questoes/ (o escritor não pode tocar no repo)."""
    linhas = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, check=True).stdout.splitlines()
    return {l[3:] for l in linhas if not l[3:].startswith("conteudo/questoes/")}


ANTES = alterados_fora()
catalogo = json.loads(subprocess.run(["npx", "tsx", "scripts/questoes/validar.ts", "tarefas"],
                                     capture_output=True, text=True, check=True).stdout)
exame = next((e for e in catalogo if e["exame"] == EXAME), None)
if exame is None:
    sys.exit(f"{EXAME} não está em prisma/catalogo/exames.ts")
tarefas = [(d, t) for d in exame["dominios"] for t in d["tarefas"] if fnmatch.fnmatch(t["codigo"], FILTRO)]

trava_validacao = threading.Lock()
trava_url = threading.Lock()
ultimo_por_host = {}
urls_ok = {}


def url_viva(url):
    with trava_url:
        if url in urls_ok:
            return urls_ok[url]
        host = urllib.parse.urlsplit(url).hostname
        espera = 1.0 - (time.time() - ultimo_por_host.get(host, 0))
        if espera > 0:
            time.sleep(espera)
        ultimo_por_host[host] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "trilha-questoes/1.0 (validacao de fontes)"})
            with urllib.request.urlopen(req, timeout=20) as r:
                final = urllib.parse.urlsplit(r.geturl())
                ok = r.status == 200 and final.scheme == "https" and final.hostname in HOSTS
        except (urllib.error.URLError, TimeoutError, ValueError):
            ok = False
        urls_ok[url] = ok
        return ok


def extrai_json(saida):
    saida = re.sub(r"\x1b\[[0-9;]*m", "", saida)
    ini, fim = saida.find("["), saida.rfind("]")
    if ini == -1 or fim <= ini:
        raise ValueError("a resposta não tem um array JSON")
    return json.loads(saida[ini:fim + 1])


def confere(codigo, questoes, caminho):
    if len(questoes) != 5:
        raise ValueError(f"vieram {len(questoes)} questões; são 5")
    tipos = sorted(q.get("tipo") for q in questoes)
    if tipos != ["MULTIPLE", "SINGLE", "SINGLE", "SINGLE", "SINGLE"]:
        raise ValueError(f"composição {tipos}; são 4 SINGLE e 1 MULTIPLE")
    for i, q in enumerate(questoes):
        if q.get("dominio") != codigo:
            raise ValueError(f"questão {i}: dominio {q.get('dominio')!r}; use {codigo!r}")
        n = len(q.get("alternativas") or [])
        if (q["tipo"] == "SINGLE" and n != 4) or (q["tipo"] == "MULTIPLE" and (n != 5 or len(q.get("corretas") or []) != 2)):
            raise ValueError(f"questão {i}: SINGLE tem 4 alternativas; MULTIPLE tem 5 e 2 corretas")
        certas = " ".join(a["text"] for a in q["alternativas"] if a["key"] in q.get("corretas", []))
        if any(f in certas for f in FECHADOS):
            raise ValueError(f"questão {i}: a resposta correta usa serviço fechado a novos clientes ({', '.join(FECHADOS)})")
    arquivo = {"exame": EXAME, "origem": "ia", "versaoPrompt": VERSAO_PROMPT, "questoes": questoes}
    with trava_validacao:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(arquivo, f, ensure_ascii=False)
        outros = sorted(glob.glob(f"{SAIDA}/*.json"))
        r = subprocess.run(["npx", "tsx", "scripts/questoes/validar.ts", *outros, f.name], capture_output=True, text=True)
        os.unlink(f.name)
        rel = json.loads(r.stdout)[-1]
        if not rel["valido"]:
            raise ValueError(json.dumps({"erros": rel["erros"], "extras": rel["extras"]}, ensure_ascii=False)[:800])
        if rel["duplicatas"]:
            raise ValueError("enunciado repetido de questão já escrita")
        mortas = [u for q in questoes for u in q["fontes"] if not url_viva(u)]
        if mortas:
            raise ValueError(f"fontes que não abrem (404 ou fora de docs.aws.amazon.com/aws.amazon.com): {mortas}")
        os.makedirs(SAIDA, exist_ok=True)
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(arquivo, f, ensure_ascii=False, indent=2)
        subprocess.run(["npx", "prettier", "--write", caminho], capture_output=True, check=True)


def ja_escritos(codigo):
    enunciados = []
    for arq in sorted(glob.glob(f"{SAIDA}/opencode-{codigo}-*.json")):
        enunciados += [q["enunciado"] for q in json.load(open(arq, encoding="utf-8"))["questoes"]]
    return enunciados


def escreve(dominio, tarefa, rodada):
    codigo = tarefa["codigo"]
    caminho = f"{SAIDA}/opencode-{codigo}-{rodada}.json"
    if os.path.exists(caminho):
        return True
    anteriores = ja_escritos(codigo)
    pedido = (
        f"{INSTRUCOES}\n\n## Pedido\nExame: {exame['nome']} ({EXAME}).\n"
        f"Domínio {dominio['codigo']}: {dominio['nomeEn']}.\nTarefa {codigo}: {tarefa['nomeEn']}\n\n"
        f"Escreva 5 questões novas para a tarefa {codigo} (\"dominio\": \"{codigo}\"): 4 SINGLE e 1 MULTIPLE, "
        f"com a resposta correta em posições diferentes.\n"
    )
    if anteriores:
        pedido += "\nJá existem estas questões da tarefa; não repita tema nem cenário:\n" + "\n".join(f"- {e}" for e in anteriores)
    for tentativa, m in enumerate(TENTATIVAS, 1):
        esperas, espera = 0, 60
        while True:
            try:
                r = subprocess.run([*OPENCODE, "run", "-m", m, pedido], capture_output=True, text=True, timeout=900,
                                   stdin=subprocess.DEVNULL, cwd=PASTA)
                saida = (r.stdout or "") + (r.stderr or "")
                intrusos = alterados_fora() - ANTES
                if intrusos:
                    print(f"{codigo}-{rodada} ABORTADO: o escritor alterou o repo: {sorted(intrusos)}", flush=True)
                    os._exit(2)
                if "Free usage limit reached" in saida:
                    print(f"{codigo}-{rodada} parado: cota grátis do OpenCode esgotada", flush=True)
                    return False
                if any(s in saida for s in ("Rate limit exceeded", "Upstream request failed")) and esperas < 12:
                    print(f"{codigo}-{rodada} limite/falha do OpenCode; aguardando {espera}s", flush=True)
                    time.sleep(espera)
                    esperas, espera = esperas + 1, min(espera * 2, 900)
                    continue
                confere(codigo, extrai_json(r.stdout or ""), caminho)
                print(f"OK {EXAME} {codigo}-{rodada} ({m}, tentativa {tentativa})", flush=True)
                return True
            except Exception as e:  # noqa: BLE001 - qualquer falha vira nova tentativa
                motivo = str(e)[:800]
                print(f"{codigo}-{rodada} tentativa {tentativa} ({m}) falhou: {motivo}", flush=True)
                pedido += f"\n\nATENÇÃO: a resposta anterior foi rejeitada: {motivo}. Corrija e responda de novo só com o JSON."
                break
    return False


def tarefa_inteira(par):
    d, t = par
    return [escreve(d, t, n) for n in range(1, RODADAS + 1)]


with ThreadPoolExecutor(max_workers=int(os.environ.get("OPENCODE_PARALELO", "3"))) as ex:
    resultados = list(ex.map(tarefa_inteira, tarefas))
falhas = sum(r.count(False) for r in resultados)
print(f"{EXAME}: {sum(r.count(True) for r in resultados)} lotes prontos, {falhas} falhas.", flush=True)
sys.exit(1 if falhas else 0)
