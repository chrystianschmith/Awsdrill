"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Tema = "claro" | "escuro" | "sistema";

const CHAVE = "tema";
const EVENTO = "tema-alterado";

function ler(): Tema {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "claro" || v === "escuro" ? v : "sistema";
  } catch {
    return "sistema";
  }
}

function aplicar(tema: Tema) {
  const escuro = tema === "sistema" ? matchMedia("(prefers-color-scheme: dark)").matches : tema === "escuro";
  document.documentElement.classList.toggle("dark", escuro);
}

function assinar(callback: () => void) {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const aoMudarSistema = () => {
    if (ler() === "sistema") aplicar("sistema");
    callback();
  };
  window.addEventListener(EVENTO, callback);
  window.addEventListener("storage", callback);
  mq.addEventListener("change", aoMudarSistema);
  return () => {
    window.removeEventListener(EVENTO, callback);
    window.removeEventListener("storage", callback);
    mq.removeEventListener("change", aoMudarSistema);
  };
}

/** Preferência de tema salva em localStorage ('tema' = 'claro' | 'escuro'; ausente = sistema). */
export function useTema(): [Tema, (t: Tema) => void] {
  const tema = useSyncExternalStore(assinar, ler, () => "sistema" as Tema);
  const definir = useCallback((t: Tema) => {
    try {
      if (t === "sistema") localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, t);
    } catch {
      // Sem storage (modo privado): aplica só nesta página.
    }
    aplicar(t);
    window.dispatchEvent(new Event(EVENTO));
  }, []);
  return [tema, definir];
}
