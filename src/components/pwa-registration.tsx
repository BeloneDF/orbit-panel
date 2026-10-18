"use client";

import { useEffect } from "react";

/** Registra apenas o cache de arquivos estáticos; dados autenticados nunca vão ao cache. */
export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);
  return null;
}
