"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Link2, LoaderCircle, ShieldCheck, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConnected: (baseUrl: string) => void;
};

export function ConnectionDialog({ open, onClose, onConnected }: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setToken("");
      onConnected(data.baseUrl);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível conectar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="connect-title" onMouseDown={(e) => e.stopPropagation()}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <div className="modal-kicker"><ShieldCheck size={15} /> conexão protegida</div>
        <h2 id="connect-title">Conecte seu servidor</h2>
        <p className="modal-copy">Use a URL pública do painel e uma chave de API. A credencial fica criptografada em cookie HTTP-only e nunca entra no bundle do navegador.</p>
        <form onSubmit={submit} className="connect-form">
          <label>
            <span>URL da instância</span>
            <div className="input-shell"><Link2 size={17} /><input type="url" required placeholder="https://panel.seudominio.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} autoFocus /></div>
          </label>
          <label>
            <span>Token da API</span>
            <div className="input-shell"><KeyRound size={17} /><input type="password" required placeholder="Cole seu token aqui" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" /></div>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button full-button" disabled={pending}>
            {pending ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}
            {pending ? "Verificando conexão…" : "Conectar com segurança"}
          </button>
        </form>
      </section>
    </div>
  );
}
