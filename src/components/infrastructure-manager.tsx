"use client";

import useSWR from "swr";
import { Box, CheckCircle2, Cloud, Cpu, HardDrive, KeyRound, LoaderCircle, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { asRecord, callEasypanel, displayValue, normalizeCollection, unwrapApiData } from "@/lib/easypanel-client";

const operations = [
  ["nodes", "listNodes", "Cluster", ["nodes", "items"]],
  ["certificates", "listCertificates", "Certificados TLS", ["certificates", "items"]],
  ["builders", "listDockerBuilders", "Docker builders", ["builders", "items"]],
  ["storage", "listStorageProviders", "Armazenamento", ["providers", "storageProviders", "items"]],
] as const;

async function loadInfrastructure() {
  const [collections, panel, ip] = await Promise.all([
    Promise.all(operations.map(async ([key, id, , keys]) => [key, await callEasypanel({ id, method: "GET", path: `/${id}` }), keys] as const)),
    callEasypanel({ id: "getPanelDomain", method: "GET", path: "/getPanelDomain" }),
    callEasypanel({ id: "getServerIp", method: "GET", path: "/getServerIp" }),
  ]);
  return { collections: Object.fromEntries(collections.map(([key, response, keys]) => [key, normalizeCollection(response.data, [...keys])])), panel: unwrapApiData(panel.data), ip: unwrapApiData(ip.data) };
}

export default function InfrastructureManager() {
  const { data, error, isLoading, mutate } = useSWR("easypanel/infrastructure", loadInfrastructure, { revalidateOnFocus: false });
  if (isLoading) return <main className="resource-view"><InfraState icon={LoaderCircle} title="Mapeando a infraestrutura…" copy="Consultando cluster, rede, certificados e provedores." spin/></main>;
  if (error) return <main className="resource-view"><InfraState icon={Server} title="Não foi possível mapear a infraestrutura" copy={error.message}/></main>;
  const collections = data?.collections ?? {};
  return <main className="resource-view">
    <header className="page-heading"><div><span className="eyebrow">CONTROL PLANE</span><h1>Infraestrutura</h1><p>Inventário consolidado do servidor, cluster, TLS, build e armazenamento.</p></div><button className="secondary-button" onClick={() => mutate()}><RefreshCw size={15}/>Atualizar tudo</button></header>
    <section className="infra-summary"><Summary icon={Server} label="IP DO SERVIDOR" value={scalar(data?.ip, ["ip", "serverIp", "address"])}/><Summary icon={Cloud} label="DOMÍNIO DO PAINEL" value={scalar(data?.panel, ["domain", "panelDomain", "customDomain", "generatedDomain"])}/><Summary icon={Cpu} label="NÓS DO CLUSTER" value={String(collections.nodes?.length ?? 0)}/><Summary icon={ShieldCheck} label="CERTIFICADOS" value={String(collections.certificates?.length ?? 0)}/></section>
    <section className="infra-grid">
      <Inventory title="Nós do cluster" icon={Server} items={collections.nodes ?? []} primary={["hostname", "name", "id"]} secondary={["status", "availability", "role"]}/>
      <Inventory title="Certificados TLS" icon={KeyRound} items={collections.certificates ?? []} primary={["domain", "main", "name", "id"]} secondary={["resolver", "status", "sans"]}/>
      <Inventory title="Docker builders" icon={Box} items={collections.builders ?? []} primary={["name", "id"]} secondary={["driver", "status", "selected"]}/>
      <Inventory title="Provedores de armazenamento" icon={HardDrive} items={collections.storage ?? []} primary={["name", "type", "id"]} secondary={["provider", "endpoint", "bucket"]}/>
    </section>
  </main>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string }) { return <article><span><Icon size={17}/></span><div><small>{label}</small><b title={value}>{value || "—"}</b></div></article>; }
function Inventory({ title, icon: Icon, items, primary, secondary }: { title: string; icon: typeof Server; items: Record<string, unknown>[]; primary: string[]; secondary: string[] }) { return <article className="inventory-card"><header><span><Icon size={17}/></span><div><h2>{title}</h2><p>{items.length} registro{items.length === 1 ? "" : "s"}</p></div></header><div>{items.slice(0, 12).map((item, index) => <section key={String(item.id ?? item.name ?? index)}><CheckCircle2 size={14}/><div><b>{pick(item, primary)}</b><small>{pick(item, secondary)}</small></div></section>)}{!items.length ? <p className="inventory-empty">Nenhum registro retornado.</p> : null}</div></article>; }
function pick(record: Record<string, unknown>, keys: string[]) { const values = keys.filter((key) => record[key] !== undefined).map((key) => displayValue(record[key])).filter((value) => value !== "—"); return values.join(" · ") || "—"; }
function scalar(value: unknown, keys: string[]) { if (typeof value === "string" || typeof value === "number") return String(value); const record = asRecord(value); return pick(record, keys); }
function InfraState({ icon: Icon, title, copy, spin = false }: { icon: typeof Server; title: string; copy: string; spin?: boolean }) { return <section className="resource-state"><Icon className={spin ? "spin" : ""} size={28}/><h2>{title}</h2><p>{copy}</p></section>; }
