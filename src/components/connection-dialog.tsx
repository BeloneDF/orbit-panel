"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Link2, LoaderCircle, ShieldCheck, X, Server } from "lucide-react";
import { AccessibilityModal } from "./accessibility-modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
};

export function ConnectionDialog({ open, onClose, onConnected }: Props) {
  const [name, setName] = useState("");
  const [panelUrl, setPanelUrl] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/easypanel/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, panelUrl, apiUrl, apiKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setApiKey("");
      onConnected();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível conectar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AccessibilityModal labelledBy="connect-title" onClose={onClose}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <div className="modal-kicker"><ShieldCheck size={15} /> conexão protegida</div>
        <h2 id="connect-title">Adicionar servidor</h2>
        <p className="modal-copy">A chave é validada antes do cadastro, fica criptografada no banco e nunca volta para o navegador.</p>
        <form onSubmit={submit} className="connect-form">
          <label>
            <span>Nome do servidor</span>
            <div className="input-shell"><Server size={17} /><input required maxLength={80} placeholder="Produção São Paulo" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          </label>
          <label>
            <span>URL do painel</span>
            <div className="input-shell"><Link2 size={17} /><input type="url" required placeholder="https://panel.seudominio.com" value={panelUrl} onChange={(e) => setPanelUrl(e.target.value)} /></div>
          </label>
          <label>
            <span>URL da API</span>
            <div className="input-shell"><Link2 size={17} /><input type="url" required placeholder="https://panel.seudominio.com/api" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} /></div>
          </label>
          <label>
            <span>API key</span>
            <div className="input-shell"><KeyRound size={17} /><input type="password" required placeholder="Cole sua chave aqui" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="new-password" /></div>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button full-button" disabled={pending}>
            {pending ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}
            {pending ? "Validando servidor…" : "Salvar e selecionar"}
          </button>
        </form>
    </AccessibilityModal>
  );
}
