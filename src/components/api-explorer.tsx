"use client";

import { FormEvent, useDeferredValue, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Braces, Check, ChevronRight, LoaderCircle, Play, Search, ShieldAlert, TerminalSquare } from "lucide-react";
import catalog from "@/data/endpoints.json";

type Schema = {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
};

type Endpoint = (typeof catalog.endpoints)[number];

const dangerousPattern = /delete|destroy|remove|reboot|prune|clean|deactivate|revoke|stop|update easypanel/i;

function seedValue(schema: Schema): unknown {
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.type === "boolean") return false;
  if (schema.type === "number" || schema.type === "integer") return 0;
  if (schema.type === "array") return [];
  if (schema.type === "object" || schema.properties) {
    return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, value]) => [key, seedValue(value)]));
  }
  return "";
}

function Field({ name, schema, required, value, onChange }: { name: string; schema: Schema; required: boolean; value: unknown; onChange: (value: unknown) => void }) {
  const label = <span>{name}{required ? <b> *</b> : null}<small>{schema.type ?? "valor"}</small></span>;
  if (schema.enum?.length) return <label className="schema-field">{label}<select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>{schema.enum.map((item) => <option key={String(item)}>{String(item)}</option>)}</select></label>;
  if (schema.type === "boolean") return <label className="boolean-field"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /><span className="toggle" />{name}</label>;
  if (schema.type === "object" || schema.type === "array" || schema.properties) return <label className="schema-field">{label}<textarea rows={4} value={typeof value === "string" ? value : JSON.stringify(value, null, 2)} onChange={(e) => onChange(e.target.value)} spellCheck={false} /></label>;
  return <label className="schema-field">{label}<input type={schema.type === "number" || schema.type === "integer" ? "number" : "text"} value={String(value ?? "")} onChange={(e) => onChange(schema.type === "number" || schema.type === "integer" ? Number(e.target.value) : e.target.value)} placeholder={schema.description || `Informe ${name}`} /></label>;
}

export default function ApiExplorer({ connected, onConnect, initialGroup = "Todos os grupos", heading = "Explorador da API" }: { connected: boolean; onConnect: () => void; initialGroup?: string; heading?: string }) {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("ALL");
  const [group, setGroup] = useState(initialGroup);
  const [selected, setSelected] = useState<Endpoint | null>(null);
  const deferredQuery = useDeferredValue(query);
  const groups = useMemo(() => ["Todos os grupos", ...new Set(catalog.endpoints.map((item) => item.group))], []);
  const filtered = useMemo(() => {
    const needle = deferredQuery.toLowerCase();
    return catalog.endpoints.filter((item) =>
      (method === "ALL" || item.method === method) &&
      (group === "Todos os grupos" || item.group === group) &&
      (!needle || `${item.title} ${item.path} ${item.group}`.toLowerCase().includes(needle)),
    );
  }, [deferredQuery, group, method]);

  return (
    <main className="explorer-view">
      <header className="page-heading explorer-heading">
        <div><span className="eyebrow">CONTROLE TOTAL · OPENAPI {catalog.version}</span><h1>{heading}</h1><p>{catalog.endpoints.length} operações oficiais, prontas para consultar e executar.</p></div>
        <div className="catalog-stamp"><Braces size={20} /><span><b>{filtered.length}</b> exibidas</span></div>
      </header>
      <section className="explorer-toolbar">
        <label className="search-field"><Search size={17} /><input placeholder="Buscar endpoint, rota ou grupo…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <div className="method-filter"><button className={method === "ALL" ? "active" : ""} onClick={() => setMethod("ALL")}>Todos</button><button className={method === "GET" ? "active get" : ""} onClick={() => setMethod("GET")}>GET</button><button className={method === "POST" ? "active post" : ""} onClick={() => setMethod("POST")}>POST</button></div>
        <select className="group-select" value={group} onChange={(e) => setGroup(e.target.value)}>{groups.map((item) => <option key={item}>{item}</option>)}</select>
      </section>
      <section className="endpoint-table" aria-label="Catálogo de endpoints">
        <div className="endpoint-table-head"><span>Método</span><span>Operação</span><span>Grupo</span><span /></div>
        {filtered.map((endpoint) => (
          <button className="endpoint-row" key={`${endpoint.method}-${endpoint.id}`} onClick={() => setSelected(endpoint)}>
            <span className={`method-badge ${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
            <span className="endpoint-name"><b>{endpoint.title}</b><code>{endpoint.path}</code></span>
            <span className="endpoint-group">{endpoint.group}</span><ChevronRight size={17} />
          </button>
        ))}
        {!filtered.length ? <div className="empty-state"><Search size={24} /><b>Nenhuma operação encontrada</b><span>Ajuste a busca ou remova um filtro.</span></div> : null}
      </section>
      {selected ? <EndpointDrawer key={selected.id} endpoint={selected} connected={connected} onConnect={onConnect} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function EndpointDrawer({ endpoint, connected, onConnect, onClose }: { endpoint: Endpoint; connected: boolean; onConnect: () => void; onClose: () => void }) {
  const schema = useMemo(() => (endpoint.body ?? {}) as Schema, [endpoint.body]);
  const initialBody = useMemo(() => seedValue(schema), [schema]);
  const [body, setBody] = useState<Record<string, unknown>>((initialBody && typeof initialBody === "object" && !Array.isArray(initialBody) ? initialBody : {}) as Record<string, unknown>);
  const [rawBody, setRawBody] = useState(() => JSON.stringify(initialBody || {}, null, 2));
  const [query, setQuery] = useState<Record<string, unknown>>({});
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; status?: number; data?: unknown; error?: string } | null>(null);
  const dangerous = dangerousPattern.test(endpoint.title);

  async function execute(event: FormEvent) {
    event.preventDefault();
    if (!connected) return onConnect();
    setPending(true); setResult(null);
    try {
      const normalizedBody = Object.fromEntries(Object.entries(body).map(([key, value]) => {
        if (typeof value === "string" && (/^[\[{]/.test(value.trim()))) { try { return [key, JSON.parse(value)]; } catch { return [key, value]; } }
        return [key, value];
      }));
      const payloadBody = schema.properties ? normalizedBody : JSON.parse(rawBody || "{}");
      const response = await fetch("/api/easypanel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: endpoint.id, method: endpoint.method, path: endpoint.path, query, body: payloadBody }) });
      const data = await response.json();
      setResult({ ok: response.ok, status: data.status ?? response.status, data: data.data, error: data.error });
    } catch (reason) { setResult({ ok: false, error: reason instanceof Error ? reason.message : "Falha inesperada." }); }
    finally { setPending(false); }
  }

  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="endpoint-drawer" onMouseDown={(e) => e.stopPropagation()}>
    <header className="drawer-header"><button className="back-button" onClick={onClose}><ArrowLeft size={17} /> catálogo</button><span className={`method-badge ${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><h2>{endpoint.title}</h2><code>{endpoint.path}</code><p>{endpoint.description}</p></header>
    <form className="endpoint-form" onSubmit={execute}>
      {endpoint.parameters.length ? <fieldset><legend>Parâmetros de consulta</legend>{endpoint.parameters.map((parameter) => <Field key={parameter.name} name={parameter.name} schema={parameter.schema as Schema} required={("required" in parameter && parameter.required) ?? false} value={query[parameter.name] ?? ""} onChange={(value) => setQuery((current) => ({ ...current, [parameter.name]: value }))} />)}</fieldset> : null}
      {schema.properties ? <fieldset><legend>Corpo da requisição</legend>{Object.entries(schema.properties).map(([name, field]) => <Field key={name} name={name} schema={field} required={schema.required?.includes(name) ?? false} value={body[name]} onChange={(value) => setBody((current) => ({ ...current, [name]: value }))} />)}</fieldset> : endpoint.method === "POST" ? <fieldset><legend>Corpo JSON</legend><textarea className="raw-json" rows={6} value={rawBody} onChange={(e) => setRawBody(e.target.value)} spellCheck={false} /></fieldset> : null}
      {dangerous ? <div className="danger-confirm"><ShieldAlert size={19} /><div><b>Ação sensível</b><p>Ela pode interromper ou remover recursos. Digite <strong>EXECUTAR</strong> para liberar.</p><input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="EXECUTAR" /></div></div> : null}
      <button className="primary-button full-button execute-button" disabled={pending || (dangerous && confirm !== "EXECUTAR")}>
        {pending ? <LoaderCircle className="spin" size={17} /> : connected ? <Play size={16} fill="currentColor" /> : <TerminalSquare size={17} />}{pending ? "Executando…" : connected ? "Executar operação" : "Conectar para executar"}
      </button>
    </form>
    {result ? <section className={`response-panel ${result.ok ? "success" : "error"}`}><header>{result.ok ? <Check size={16} /> : <AlertTriangle size={16} />}<b>{result.ok ? "Resposta recebida" : "Falha na operação"}</b><span>{result.status ? `HTTP ${result.status}` : ""}</span></header><pre>{JSON.stringify(result.error ?? result.data, null, 2)}</pre></section> : null}
  </aside></div>;
}
