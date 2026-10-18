"use client";

import { Server, Zap } from "lucide-react";

export function ConnectGate({ title, onConnect }: { title: string; onConnect: () => void }) {
  return <main className="resource-view"><section className="connect-gate"><span><Server size={28} /></span><p className="eyebrow">CONEXÃO NECESSÁRIA</p><h1>{title}</h1><p>Conecte uma instância Easypanel para carregar e controlar os recursos reais deste módulo.</p><button className="primary-button" onClick={onConnect}><Zap size={16} />Conectar servidor</button></section></main>;
}
