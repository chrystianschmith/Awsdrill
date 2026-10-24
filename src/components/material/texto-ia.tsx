import { analisarMarkdown, type Trecho } from "@/lib/ai/markdown";

/** Texto gerado por IA em markdown restrito: só texto escapado pelo React, sem HTML nem links. */
function Trechos({ trechos }: { trechos: Trecho[] }) {
  return trechos.map((t, i) =>
    t.tipo === "negrito" ? (
      <strong key={i}>{t.texto}</strong>
    ) : t.tipo === "codigo" ? (
      <code key={i} className="rounded-sm bg-surface-muted px-1 py-0.5 text-[0.9em]">
        {t.texto}
      </code>
    ) : (
      <span key={i}>{t.texto}</span>
    ),
  );
}

export function TextoIA({ texto }: { texto: string }) {
  return (
    <div className="grid gap-3 text-sm leading-relaxed">
      {analisarMarkdown(texto).map((b, i) =>
        b.tipo === "titulo" ? (
          <h3 key={i} className="pt-1 font-semibold">
            <Trechos trechos={b.trechos} />
          </h3>
        ) : b.tipo === "lista" ? (
          b.ordenada ? (
            <ol key={i} className="grid list-decimal gap-1 pl-5">
              {b.itens.map((item, j) => (
                <li key={j}>
                  <Trechos trechos={item} />
                </li>
              ))}
            </ol>
          ) : (
            <ul key={i} className="grid list-disc gap-1 pl-5">
              {b.itens.map((item, j) => (
                <li key={j}>
                  <Trechos trechos={item} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <p key={i}>
            <Trechos trechos={b.trechos} />
          </p>
        ),
      )}
    </div>
  );
}
