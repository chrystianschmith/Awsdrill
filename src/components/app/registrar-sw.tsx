"use client";

import { useEffect } from "react";

/** Registra o service worker (só em produção). */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sem SW o app funciona normalmente; só perde a página offline.
    });
  }, []);
  return null;
}
