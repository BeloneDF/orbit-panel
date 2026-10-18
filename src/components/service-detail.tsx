"use client";

import { FormEvent, useEffect, useState } from "react";
import useSWR from "swr";
import {
  Activity, ArrowLeft, Braces, ChevronRight, CircleStop, Code2, Database,
  ExternalLink, FileClock, Gauge, Globe2, HardDrive,
  LoaderCircle, LockKeyhole, Pause, Play, Plus, RefreshCw, Rocket, RotateCcw,
  Save, ScrollText, Settings2, TerminalSquare, Trash2, Wrench, X,
} from "lucide-react";
import {
  asRecord, callEasypanel, displayValue, findNamedArray, findNamedObject,
  LiveService, normalizeCollection, serviceOperation, unwrapApiData,
} from "@/lib/easypanel-client";

type Tab = "overview" | "source" | "deployments" | "environment" | "domains" | "redirects" | "scripts" | "security" | "resources" | "maintenance" | "storage" | "ports";

const tabs = [
  ["overview", "Visão geral", Activity], ["source", "Source", Code2], ["deployments", "Deployments", FileClock],
  ["environment", "Environment", Settings2], ["domains", "Domínios", Globe2], ["redirects", "Redirects", ChevronRight],
  ["scripts", "Scripts", TerminalSquare], ["security", "Security", LockKeyhole], ["resources", "Recursos", Gauge],
  ["maintenance", "Maintenance", Wrench], ["storage", "Armazenamento", HardDrive], ["ports", "Portas", Braces],
] as const;

const typeNames: Record<string, string> = { app: "App", compose: "Compose", box: "Box", wordpress: "WordPress", postgres: "Postgres", postgresql: "Postgres", mysql: "MySQL", mariadb: "MariaDB", mongodb: "MongoDB", redis: "Redis" };

function serviceKind(service: LiveService) {
  const normalized = service.type.toLowerCase().replace(/[^a-z]/g, "");
  return Object.entries(typeNames).find(([key]) => normalized.includes(key))?.[1] ?? "App";
}

export default function ServiceDetail({ service, onBack }: { service: LiveService; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("overview"); const [notice, setNotice] = useState(""); const [pending, setPending] = useState("");
  const kind = serviceKind(service); const base = { projectName: service.projectName, serviceName: service.name };
  const inspectId = `inspect${kind}Service`;
  const { data: inspectData, error: inspectError, isLoading: inspectLoading, mutate: mutateInspect } = useSWR(["easypanel/service", service.projectName, service.name, kind], () => callEasypanel({ id: inspectId, method: "GET", path: `/${inspectId}`, query: base }), { revalidateOnFocus: false });
  const inspected = asRecord(unwrapApiData(inspectData?.data));

  async function run(action: "start" | "stop" | "restart" | "deploy") {
    const operation = serviceOperation(service, action); if (!operation) { setNotice(`Ação não disponível para ${kind}.`); return; }
    setPending(action); setNotice(""); try { await callEasypanel(operation); setNotice(`${actionLabel(action)} enviado com sucesso.`); await mutateInspect(); } catch (reason) { setNotice(errorMessage(reason)); } finally { setPending(""); }
  }
  async function destroy() {
    if (!window.confirm(`Excluir ${service.name} permanentemente, incluindo configurações e dados associados?`)) return;
    const id = `destroy${kind}Service`; setPending("destroy"); try { await callEasypanel({ id, method: "POST", path: `/${id}`, body: base }); onBack(); } catch (reason) { setNotice(errorMessage(reason)); setPending(""); }
  }

  return <main className="service-workspace">
    <header className="service-titlebar"><button className="back-service" onClick={onBack}><ArrowLeft size={16}/>Todos os serviços</button><div><span className="service-badge">{kind}</span><h1>{service.name}</h1><p>{service.projectName} / {service.name}</p></div><div className="service-title-actions"><button className="secondary-button" onClick={() => mutateInspect()}><RefreshCw size={15}/>Atualizar</button><button className="primary-button" disabled={Boolean(pending)} onClick={() => run("deploy")}><Rocket size={15}/>{pending === "deploy" ? "Publicando…" : "Deploy"}</button></div></header>
    <div className="service-layout"><aside className="service-tabs">{tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={15}/><span>{label}</span><ChevronRight size={13}/></button>)}</aside>
      <section className="service-content">
        {notice ? <div className="operation-banner"><span>{notice}</span><button className="banner-close" onClick={() => setNotice("")}><X size={14}/></button></div> : null}
        {inspectError ? <PanelState title="Não foi possível inspecionar o serviço" copy={inspectError.message}/> : inspectLoading ? <PanelState title="Lendo configuração do serviço…" copy="Consultando estado e parâmetros atuais." loading/> : <ServiceTab tab={tab} service={service} kind={kind} inspected={inspected} onNotice={setNotice} refresh={mutateInspect} run={run} pending={pending} destroy={destroy}/>} 
      </section>
    </div>
  </main>;
}

function ServiceTab({ tab, service, kind, inspected, onNotice, refresh, run, pending, destroy }: { tab: Tab; service: LiveService; kind: string; inspected: Record<string, unknown>; onNotice: (value: string) => void; refresh: () => Promise<unknown>; run: (action: "start" | "stop" | "restart" | "deploy") => Promise<void>; pending: string; destroy: () => Promise<void> }) {
  if (tab === "overview") return <Overview service={service} kind={kind} inspected={inspected} run={run} pending={pending}/>;
  if (tab === "deployments") return <Deployments service={service} kind={kind} inspected={inspected} onNotice={onNotice} refresh={refresh}/>;
  if (tab === "domains") return <ServiceDomains service={service}/>;
  if (tab === "storage") return <CollectionManager service={service} mode="mounts"/>;
  if (tab === "ports") return <CollectionManager service={service} mode="ports"/>;
  if (tab === "source") return <SourceSettings service={service} kind={kind} inspected={inspected} onNotice={onNotice} refresh={refresh}/>;
  if (tab === "environment") return <TextSettings title="Variáveis de ambiente" description="Uma variável por linha, no formato CHAVE=valor." operation={`update${kind}Env`} field="env" initial={String(inspected.env ?? findNamedObject(inspected, ["config"]).env ?? "")} service={service} onNotice={onNotice} refresh={refresh}/>;
  if (tab === "redirects") return <JsonSettings title="Redirects" description="Regras de redirecionamento aplicadas antes de encaminhar a requisição." operation={`update${kind}Redirects`} field="redirects" initial={findNamedArray(inspected, ["redirects"])} service={service} onNotice={onNotice} refresh={refresh}/>;
  if (tab === "scripts") return <JsonSettings title="Scripts" description="Scripts operacionais e automações vinculadas ao serviço." operation={`update${kind}Scripts`} field="scripts" initial={findNamedArray(inspected, ["scripts"])} service={service} onNotice={onNotice} refresh={refresh}/>;
  if (tab === "security") return <JsonSettings title="Autenticação básica" description="Credenciais HTTP adicionais para proteger o serviço." operation={`update${kind}BasicAuth`} field="basicAuth" initial={findNamedArray(inspected, ["basicAuth"])} service={service} onNotice={onNotice} refresh={refresh}/>;
  if (tab === "resources") return <ResourceSettings service={service} kind={kind} inspected={inspected} onNotice={onNotice} refresh={refresh}/>;
  if (tab === "maintenance") return <MaintenanceSettings service={service} kind={kind} inspected={inspected} onNotice={onNotice} refresh={refresh} destroy={destroy}/>;
  return null;
}

function Overview({ service, kind, inspected, run, pending }: { service: LiveService; kind: string; inspected: Record<string, unknown>; run: (action: "start" | "stop" | "restart" | "deploy") => Promise<void>; pending: string }) {
  const liveLogs = useLiveLogs(service.projectName, service.name, kind === "Compose");
  const [logSearch, setLogSearch] = useState("");
  const { data: metricData } = useSWR(["easypanel/service-metrics", service.projectName, service.name], () => loadServiceMetrics(service.projectName, service.name), { refreshInterval: 1000, dedupingInterval: 750, revalidateOnFocus: false, shouldRetryOnError: false });
  const logs = liveLogs.lines.filter((entry) => entry.message.toLowerCase().includes(logSearch.toLowerCase()));
  const runtime = normalizeRuntimeStats(metricData, inspected, service);
  return <div className="service-overview"><section className="service-command"><div className="command-actions"><button className="deploy-command" disabled={Boolean(pending)} onClick={() => run("deploy")}><Rocket size={14}/>Deploy</button><button title="Iniciar" disabled={Boolean(pending)} onClick={() => run("start")}><Play size={14}/></button><button title="Parar" disabled={Boolean(pending)} onClick={() => run("stop")}><Pause size={14}/></button><button title="Reiniciar" disabled={Boolean(pending)} onClick={() => run("restart")}><RotateCcw size={14}/></button></div><div className="runtime-stats"><span>CPU <b>{runtime.cpu}</b></span><span>Memória <b>{runtime.memory}</b></span><span>Rede <b>{runtime.network}</b></span><span>Status <b>{service.status}</b></span><span>Imagem <b>{runtime.image}</b></span></div></section>
    <section className="embedded-logs"><header><div><ScrollText size={15}/><b>Logs</b><small className={liveLogs.error ? "log-stream-error" : "log-stream-live"}>{liveLogs.error ? "desconectado" : "ao vivo"}</small></div><div className="log-tools"><span>{liveLogs.lines.length} linhas</span><input aria-label="Filtrar logs" value={logSearch} onChange={event=>setLogSearch(event.target.value)} placeholder="Filtrar"/><button title="Reconectar" onClick={liveLogs.reconnect}><RefreshCw size={14}/></button></div></header><div className="embedded-terminal">{liveLogs.loading ? <p>Conectando aos logs…</p> : liveLogs.error ? <div className="terminal-unavailable"><b>Logs indisponíveis no momento</b><p>{liveLogs.error}</p><button onClick={liveLogs.reconnect}><RefreshCw size={13}/>Reconectar</button></div> : logs.length ? logs.map((entry, index) => <LogRow key={`${entry.receivedAt}-${index}`} entry={entry}/>) : <p>{logSearch ? "Nenhuma linha corresponde ao filtro." : "Aguardando entradas do serviço…"}</p>}</div></section></div>;
}

type LiveLog = { message: string; receivedAt: number };
function LogRow({ entry }: { entry: LiveLog }) { const match=entry.message.match(/^\[([^\]]+)\]\s*(.*)$/); const tag=match?.[1]??"serviço"; const message=match?.[2]??entry.message; const level=/indisponível|erro|fail|exception|\b403\b/i.test(message)?"warning":/enviado|success|concluído|ready/i.test(message)?"success":"info"; return <article className={`log-row ${level}`}><time>{new Date(entry.receivedAt).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",second:"2-digit"})}</time><span className="log-level">{level==="warning"?"AVISO":level==="success"?"OK":"LOG"}</span><code title={tag}>{tag}</code><p>{message}</p></article>; }

function useLiveLogs(projectName: string, serviceName: string, compose: boolean) {
  const [lines, setLines] = useState<LiveLog[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  useEffect(() => { const params = new URLSearchParams({ projectName, serviceName, compose: String(compose) }); const source = new EventSource(`/api/logs/stream?${params}`); source.onmessage = (event) => { const message=decodeLiveLog(event.data).trim(); if(message)setLines((current) => [...current, {message,receivedAt:Date.now()}].slice(-500)); setLoading(false); }; source.onerror = () => { setLoading(false); setError("A conexão de logs ao vivo foi interrompida."); source.close(); }; return () => source.close(); }, [projectName, serviceName, compose, retry]);
  return { lines, error, loading, reconnect: () => { setLines([]); setError(""); setLoading(true); setRetry((value) => value + 1); } };
}

function decodeLiveLog(payload: string): string {
  try {
    let value: unknown = JSON.parse(payload);
    if (typeof value === "string") { try { value = JSON.parse(value); } catch {} }
    const record = asRecord(value); const output = typeof record.output === "string" ? record.output : typeof value === "string" ? value : "";
    return output.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  } catch { return payload; }
}

function Deployments({ service, kind, inspected, onNotice, refresh }: SettingsProps & { kind: string; inspected: Record<string, unknown> }) {
  const query = { projectName: service.projectName, serviceName: service.name, limit: 40 };
  const { data, error, isLoading, mutate } = useSWR(["easypanel/service-actions", service.projectName, service.name], () => callEasypanel({ id: "listActions", method: "GET", path: "/listActions", query }), { revalidateOnFocus: false });
  const actions = normalizeCollection(data?.data, ["actions", "items"]);
  return <div className="settings-stack">{kind === "App" ? <DeploySettings service={service} inspected={inspected} onNotice={onNotice} refresh={refresh}/> : null}<SettingsPanel title="Histórico de deployments" description="Builds, publicações e ações executadas neste serviço." action={<button className="secondary-button" onClick={() => mutate()}><RefreshCw size={14}/>Atualizar</button>}>{isLoading ? <PanelState title="Carregando histórico…" copy="" loading/> : error ? <PanelState title="Falha ao carregar" copy={error.message}/> : <div className="deployment-list">{actions.map((action, index) => <article key={String(action.id ?? index)}><span className={`deployment-dot ${String(action.status ?? "")}`}/><div><b>{displayValue(action.type ?? action.name ?? "deployment")}</b><p>{displayValue(action.message ?? action.status ?? action.serviceName)}</p></div><time>{formatDate(action.createdAt ?? action.date)}</time></article>)}{!actions.length ? <EmptyLine text="Nenhuma ação registrada para este serviço."/> : null}</div>}</SettingsPanel></div>;
}

function DeploySettings({ service, inspected, onNotice, refresh }: SettingsProps & { inspected: Record<string, unknown> }) { const current = findNamedObject(inspected, ["deploy"]); const [replicas, setReplicas] = useState(Number(current.replicas ?? 1)); const [command, setCommand] = useState(String(current.command ?? "")); const [zeroDowntime, setZeroDowntime] = useState(current.zeroDowntime !== false); const [tiniInit, setTiniInit] = useState(Boolean(current.tiniInit)); const [pending, setPending] = useState(false); async function save(event: FormEvent) { event.preventDefault(); setPending(true); try { await callEasypanel({ id: "updateAppDeploy", method: "POST", path: "/updateAppDeploy", body: { projectName: service.projectName, serviceName: service.name, deploy: { replicas, command: command || null, zeroDowntime, tiniInit, capAdd: [], capDrop: [], groups: [], sysctls: {} } } }); onNotice("Configuração de deployment atualizada."); await refresh(); } catch (reason) { onNotice(errorMessage(reason)); } finally { setPending(false); } } return <SettingsPanel title="Configuração de deployment" description="Réplicas, comando de execução e estratégia de substituição dos containers."><form className="settings-form" onSubmit={save}><div className="form-split"><Field label="Réplicas"><input type="number" min="0" value={replicas} onChange={(e) => setReplicas(Number(e.target.value))}/></Field><Field label="Comando do container"><input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Opcional"/></Field></div><label className="switch-row"><span><b>Zero downtime</b><small>Mantém o container anterior ativo até o novo ficar pronto.</small></span><input type="checkbox" checked={zeroDowntime} onChange={(e) => setZeroDowntime(e.target.checked)}/></label><label className="switch-row"><span><b>Tini init</b><small>Usa um processo init para encaminhar sinais corretamente.</small></span><input type="checkbox" checked={tiniInit} onChange={(e) => setTiniInit(e.target.checked)}/></label><SaveButton pending={pending}/></form></SettingsPanel>; }

function SourceSettings({ service, kind, inspected, onNotice, refresh }: SettingsProps & { kind: string; inspected: Record<string, unknown> }) {
  const source = findNamedObject(inspected, ["source"]); const [mode, setMode] = useState(String(source.type ?? "image")); const [image, setImage] = useState(String(source.image ?? inspected.image ?? "")); const [repo, setRepo] = useState(String(source.repo ?? "")); const [owner, setOwner] = useState(String(source.owner ?? "")); const [ref, setRef] = useState(String(source.ref ?? "main")); const [path, setPath] = useState(String(source.path ?? "/")); const [dockerfile, setDockerfile] = useState(String(source.dockerfile ?? "FROM node:24-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD [\"npm\", \"start\"]")); const [compose, setCompose] = useState(String(source.content ?? "")); const [pending, setPending] = useState(false);
  if (kind !== "App" && kind !== "Compose") return <Unavailable title="Source" kind={kind}/>;
  async function save(event: FormEvent) { event.preventDefault(); setPending(true); try { let id = ""; const body: Record<string, unknown> = { projectName: service.projectName, serviceName: service.name }; if (kind === "Compose") { id = "updateComposeSourceInline"; body.content = compose; } else if (mode === "git") { id = "updateAppSourceGit"; Object.assign(body, { repo, ref, path }); } else if (mode === "github") { id = "updateAppSourceGithub"; Object.assign(body, { owner, repo, ref, path }); } else if (mode === "dockerfile") { id = "updateAppSourceDockerfile"; body.dockerfile = dockerfile; } else { id = "updateAppSourceImage"; body.image = image; } await callEasypanel({ id, method: "POST", path: `/${id}`, body }); onNotice("Source atualizado. Faça um novo deploy para aplicar."); await refresh(); } catch (reason) { onNotice(errorMessage(reason)); } finally { setPending(false); } }
  return <div className="settings-stack"><SettingsPanel title="Source" description="Origem do código ou imagem usada para construir o serviço."><form className="settings-form" onSubmit={save}>{kind === "App" ? <><div className="segmented"><button type="button" className={mode === "image" ? "active" : ""} onClick={() => setMode("image")}>Imagem</button><button type="button" className={mode === "git" ? "active" : ""} onClick={() => setMode("git")}>Git</button><button type="button" className={mode === "github" ? "active" : ""} onClick={() => setMode("github")}>GitHub</button><button type="button" className={mode === "dockerfile" ? "active" : ""} onClick={() => setMode("dockerfile")}>Dockerfile</button></div>{mode === "image" ? <Field label="Imagem Docker"><input value={image} onChange={(e) => setImage(e.target.value)} required placeholder="ghcr.io/empresa/app:latest"/></Field> : mode === "dockerfile" ? <Field label="Dockerfile"><textarea className="code-area" rows={15} value={dockerfile} onChange={(e) => setDockerfile(e.target.value)} required/></Field> : <>{mode === "github" ? <div className="form-split"><Field label="Owner / organização"><input value={owner} onChange={(e) => setOwner(e.target.value)} required/></Field><Field label="Repositório"><input value={repo} onChange={(e) => setRepo(e.target.value)} required/></Field></div> : <Field label="Repositório Git"><input value={repo} onChange={(e) => setRepo(e.target.value)} required placeholder="https://github.com/empresa/repo.git"/></Field>}<div className="form-split"><Field label="Branch / ref"><input value={ref} onChange={(e) => setRef(e.target.value)} required/></Field><Field label="Diretório"><input value={path} onChange={(e) => setPath(e.target.value)} required/></Field></div></>} </> : <Field label="docker-compose.yml"><textarea className="code-area" rows={18} value={compose} onChange={(e) => setCompose(e.target.value)} required/></Field>}<SaveButton pending={pending}/></form></SettingsPanel>{kind === "App" && mode !== "image" && mode !== "dockerfile" ? <BuildSettings service={service} inspected={inspected} onNotice={onNotice} refresh={refresh}/> : null}</div>;
}

function BuildSettings({ service, inspected, onNotice, refresh }: SettingsProps & { inspected: Record<string, unknown> }) { const current = findNamedObject(inspected, ["build"]); const [type, setType] = useState(String(current.type ?? "nixpacks")); const [installCommand, setInstallCommand] = useState(String(current.installCommand ?? "")); const [buildCommand, setBuildCommand] = useState(String(current.buildCommand ?? "")); const [startCommand, setStartCommand] = useState(String(current.startCommand ?? "")); const [pending, setPending] = useState(false); async function save(event: FormEvent) { event.preventDefault(); setPending(true); try { const build: Record<string, unknown> = { type }; if (type === "nixpacks" || type === "railpack") Object.assign(build, { installCommand, buildCommand, startCommand }); await callEasypanel({ id: "updateAppBuild", method: "POST", path: "/updateAppBuild", body: { projectName: service.projectName, serviceName: service.name, build } }); onNotice("Estratégia de build atualizada."); await refresh(); } catch (reason) { onNotice(errorMessage(reason)); } finally { setPending(false); } } return <SettingsPanel title="Build" description="Escolha o builder e personalize os comandos usados na imagem final."><form className="settings-form" onSubmit={save}><Field label="Builder"><select className="form-select" value={type} onChange={(e) => setType(e.target.value)}><option value="nixpacks">Nixpacks</option><option value="railpack">Railpack</option><option value="buildpacks">Cloud Native Buildpacks</option><option value="paketo-buildpacks">Paketo</option><option value="heroku-buildpacks">Heroku Buildpacks</option><option value="dockerfile">Dockerfile do repositório</option></select></Field>{type === "nixpacks" || type === "railpack" ? <><Field label="Comando de instalação"><input value={installCommand} onChange={(e) => setInstallCommand(e.target.value)}/></Field><Field label="Comando de build"><input value={buildCommand} onChange={(e) => setBuildCommand(e.target.value)}/></Field><Field label="Comando de inicialização"><input value={startCommand} onChange={(e) => setStartCommand(e.target.value)}/></Field></> : null}<SaveButton pending={pending}/></form></SettingsPanel>; }

function TextSettings({ title, description, operation, field, initial, service, onNotice, refresh }: SettingsProps & { title: string; description: string; operation: string; field: string; initial: string }) { const [value, setValue] = useState(initial); const [pending, setPending] = useState(false); async function save(event: FormEvent) { event.preventDefault(); setPending(true); try { await callEasypanel({ id: operation, method: "POST", path: `/${operation}`, body: { projectName: service.projectName, serviceName: service.name, [field]: value } }); onNotice(`${title} atualizado.`); await refresh(); } catch (reason) { onNotice(errorMessage(reason)); } finally { setPending(false); } } return <SettingsPanel title={title} description={description}><form className="settings-form" onSubmit={save}><Field label="Conteúdo"><textarea className="code-area" rows={20} value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false}/></Field><SaveButton pending={pending}/></form></SettingsPanel>; }

function JsonSettings({ title, description, operation, field, initial, service, onNotice, refresh }: SettingsProps & { title: string; description: string; operation: string; field: string; initial: unknown[] }) { const [value, setValue] = useState(() => JSON.stringify(initial, null, 2)); const [pending, setPending] = useState(false); async function save(event: FormEvent) { event.preventDefault(); setPending(true); try { const parsed = JSON.parse(value); if (!Array.isArray(parsed)) throw new Error("O conteúdo precisa ser uma lista JSON."); await callEasypanel({ id: operation, method: "POST", path: `/${operation}`, body: { projectName: service.projectName, serviceName: service.name, [field]: parsed } }); onNotice(`${title} atualizado.`); await refresh(); } catch (reason) { onNotice(errorMessage(reason)); } finally { setPending(false); } } return <SettingsPanel title={title} description={description}><form className="settings-form" onSubmit={save}><Field label="Configuração JSON"><textarea className="code-area" rows={18} value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false}/></Field><SaveButton pending={pending}/></form></SettingsPanel>; }

function ResourceSettings({ service, kind, inspected, onNotice, refresh }: SettingsProps & { kind: string; inspected: Record<string, unknown> }) { const current = findNamedObject(inspected, ["resources"]); const [values, setValues] = useState({ cpuLimit: Number(current.cpuLimit ?? 0), cpuReservation: Number(current.cpuReservation ?? 0), memoryLimit: Number(current.memoryLimit ?? 0), memoryReservation: Number(current.memoryReservation ?? 0) }); const [pending, setPending] = useState(false); async function save(event: FormEvent) { event.preventDefault(); const id = `update${kind}Resources`; setPending(true); try { await callEasypanel({ id, method: "POST", path: `/${id}`, body: { projectName: service.projectName, serviceName: service.name, resources: values } }); onNotice("Limites e reservas atualizados."); await refresh(); } catch (reason) { onNotice(errorMessage(reason)); } finally { setPending(false); } } return <SettingsPanel title="Recursos" description="Defina limites e reservas de CPU e memória para o agendador."><form className="settings-form" onSubmit={save}><div className="resource-form">{Object.entries({ cpuLimit: "Limite de CPU", cpuReservation: "Reserva de CPU", memoryLimit: "Limite de memória (MB)", memoryReservation: "Reserva de memória (MB)" }).map(([key, label]) => <Field key={key} label={label}><input type="number" min="0" step="0.1" value={values[key as keyof typeof values]} onChange={(e) => setValues((old) => ({ ...old, [key]: Number(e.target.value) }))}/></Field>)}</div><SaveButton pending={pending}/></form></SettingsPanel>; }

function MaintenanceSettings({ service, kind, inspected, onNotice, refresh, destroy }: SettingsProps & { kind: string; inspected: Record<string, unknown>; destroy: () => Promise<void> }) { const current = findNamedObject(inspected, ["maintenance"]); const [enabled, setEnabled] = useState(Boolean(current.enabled)); const [title, setTitle] = useState(String(current.title ?? "Em manutenção")); const [subtitle, setSubtitle] = useState(String(current.subtitle ?? "Voltaremos em breve.")); const [pending, setPending] = useState(false); const supported = ["App", "Compose", "WordPress"].includes(kind); async function save(event: FormEvent) { event.preventDefault(); const id = kind === "WordPress" ? "updateWordPressMaintenanceMode" : `update${kind}Maintenance`; setPending(true); try { await callEasypanel({ id, method: "POST", path: `/${id}`, body: { projectName: service.projectName, serviceName: service.name, maintenance: { enabled, title, subtitle, hideLinks: false, hideLogo: false, customCss: "", customLogo: "" } } }); onNotice("Modo de manutenção atualizado."); await refresh(); } catch (reason) { onNotice(errorMessage(reason)); } finally { setPending(false); } } return <><SettingsPanel title="Maintenance" description="Exiba uma página controlada durante intervenções no serviço.">{supported ? <form className="settings-form" onSubmit={save}><label className="switch-row"><span><b>Modo de manutenção</b><small>Intercepta o tráfego público antes de chegar ao container.</small></span><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}/></label><Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)}/></Field><Field label="Mensagem"><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)}/></Field><SaveButton pending={pending}/></form> : <Unavailable title="Maintenance" kind={kind}/>}</SettingsPanel><section className="danger-zone"><div><h2>Zona de risco</h2><p>Remove o serviço e suas configurações. Esta ação não pode ser desfeita.</p></div><button className="danger-button" onClick={destroy}><Trash2 size={14}/>Excluir serviço</button></section></>;
}

function ServiceDomains({ service }: { service: LiveService }) { const query = { projectName: service.projectName, serviceName: service.name }; const { data, error, isLoading, mutate } = useSWR(["easypanel/service-domains", service.projectName, service.name], () => callEasypanel({ id: "listDomains", method: "GET", path: "/listDomains", query }), { revalidateOnFocus: false }); const domains = normalizeCollection(data?.data, ["domains", "items"]); const [open, setOpen] = useState(false); return <SettingsPanel title="Domínios" description="Rotas públicas que encaminham tráfego para este serviço." action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={14}/>Adicionar</button>}>{isLoading ? <PanelState title="Carregando domínios…" copy="" loading/> : error ? <PanelState title="Falha ao carregar" copy={error.message}/> : <div className="settings-list">{domains.map((domain, index) => <article key={String(domain.id ?? index)}><Globe2 size={16}/><div><b>{displayValue(domain.host)}</b><small>{domain.https ? "HTTPS" : "HTTP"} · {displayValue(domain.path ?? "/")}</small></div><a href={`${domain.https ? "https" : "http"}://${domain.host}`} target="_blank" rel="noreferrer"><ExternalLink size={14}/></a></article>)}{!domains.length ? <EmptyLine text="Nenhum domínio configurado."/> : null}</div>}{open ? <QuickDomain service={service} close={() => setOpen(false)} created={async () => { setOpen(false); await mutate(); }}/>: null}</SettingsPanel>; }

function QuickDomain({ service, close, created }: { service: LiveService; close: () => void; created: () => Promise<void> }) { const [host, setHost] = useState(""); const [port, setPort] = useState("80"); const [https, setHttps] = useState(true); const [pending, setPending] = useState(false); const [error, setError] = useState(""); async function submit(event: FormEvent) { event.preventDefault(); setPending(true); try { await callEasypanel({ id: "createDomain", method: "POST", path: "/createDomain", body: { id: crypto.randomUUID(), host, path: "/", https, wildcard: false, certificateResolver: https ? "letsencrypt" : "", middlewares: [], destinationType: "service", serviceDestination: { projectName: service.projectName, serviceName: service.name, port: Number(port), protocol: "http", path: "/" } } }); await created(); } catch (reason) { setError(errorMessage(reason)); } finally { setPending(false); } } return <div className="modal-backdrop" onMouseDown={close}><section className="modal compact-modal" onMouseDown={(e) => e.stopPropagation()}><button className="icon-button modal-close" onClick={close}><X size={16}/></button><div className="modal-kicker"><Globe2 size={14}/> nova rota</div><h2>Adicionar domínio</h2><form className="connect-form" onSubmit={submit}><Field label="Host"><input value={host} onChange={(e) => setHost(e.target.value.toLowerCase().trim())} required placeholder="app.empresa.com.br"/></Field><Field label="Porta do container"><input type="number" min="1" value={port} onChange={(e) => setPort(e.target.value)} required/></Field><label className="boolean-field"><input type="checkbox" checked={https} onChange={(e) => setHttps(e.target.checked)}/><span className="toggle"/>Ativar HTTPS</label>{error ? <p className="form-error">{error}</p> : null}<button className="primary-button full-button" disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <Plus size={15}/>}Criar rota</button></form></section></div>; }

function CollectionManager({ service, mode }: { service: LiveService; mode: "mounts" | "ports" }) { const isMount = mode === "mounts"; const listId = isMount ? "listMounts" : "listPorts"; const keys = isMount ? ["mounts", "items"] : ["ports", "items"]; const query = { projectName: service.projectName, serviceName: service.name }; const { data, error, isLoading, mutate } = useSWR([`easypanel/${mode}`, service.projectName, service.name], () => callEasypanel({ id: listId, method: "GET", path: `/${listId}`, query }), { revalidateOnFocus: false }); const items = normalizeCollection(data?.data, keys); const [open, setOpen] = useState(false); return <SettingsPanel title={isMount ? "Armazenamento" : "Portas"} description={isMount ? "Volumes, arquivos e caminhos persistentes montados no container." : "Portas TCP ou UDP publicadas diretamente no servidor."} action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={14}/>Adicionar</button>}>{isLoading ? <PanelState title="Carregando…" copy="" loading/> : error ? <PanelState title="Falha ao carregar" copy={error.message}/> : <div className="settings-list">{items.map((item, index) => <article key={String(item.id ?? index)}>{isMount ? <HardDrive size={16}/> : <Braces size={16}/>}<div><b>{isMount ? displayValue(item.mountPath ?? item.path) : `${displayValue(item.published)} → ${displayValue(item.target)}`}</b><small>{displayValue(item.type ?? item.protocol)}</small></div></article>)}{!items.length ? <EmptyLine text={isMount ? "Nenhum volume montado." : "Nenhuma porta publicada."}/> : null}</div>}{open ? <QuickCollection service={service} mode={mode} close={() => setOpen(false)} created={async () => { setOpen(false); await mutate(); }}/> : null}</SettingsPanel>; }

function QuickCollection({ service, mode, close, created }: { service: LiveService; mode: "mounts" | "ports"; close: () => void; created: () => Promise<void> }) { const isMount = mode === "mounts"; const [first, setFirst] = useState(isMount ? "data" : "8080"); const [second, setSecond] = useState(isMount ? "/data" : "80"); const [pending, setPending] = useState(false); const [error, setError] = useState(""); async function submit(event: FormEvent) { event.preventDefault(); const id = isMount ? "createMount" : "createPort"; const values = isMount ? { type: "volume", name: first, mountPath: second } : { protocol: "tcp", published: Number(first), target: Number(second) }; setPending(true); try { await callEasypanel({ id, method: "POST", path: `/${id}`, body: { projectName: service.projectName, serviceName: service.name, values } }); await created(); } catch (reason) { setError(errorMessage(reason)); } finally { setPending(false); } } return <div className="modal-backdrop" onMouseDown={close}><section className="modal compact-modal" onMouseDown={(e) => e.stopPropagation()}><button className="icon-button modal-close" onClick={close}><X size={16}/></button><div className="modal-kicker">{isMount ? <HardDrive size={14}/> : <Braces size={14}/>} novo recurso</div><h2>{isMount ? "Montar volume" : "Publicar porta"}</h2><form className="connect-form" onSubmit={submit}><Field label={isMount ? "Nome do volume" : "Porta pública"}><input value={first} onChange={(e) => setFirst(e.target.value)} required/></Field><Field label={isMount ? "Caminho no container" : "Porta do container"}><input value={second} onChange={(e) => setSecond(e.target.value)} required/></Field>{error ? <p className="form-error">{error}</p> : null}<button className="primary-button full-button" disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <Plus size={15}/>}Adicionar</button></form></section></div>; }

type SettingsProps = { service: LiveService; onNotice: (value: string) => void; refresh: () => Promise<unknown> };
function SettingsPanel({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="settings-panel"><header><div><span className="panel-kicker">CONFIGURAÇÃO DO SERVIÇO</span><h2>{title}</h2><p>{description}</p></div>{action}</header><div className="settings-body">{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="settings-field"><span>{label}</span>{children}</label>; }
function SaveButton({ pending }: { pending: boolean }) { return <button className="primary-button save-settings" disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>}Salvar alterações</button>; }
function PanelState({ title, copy, loading = false }: { title: string; copy: string; loading?: boolean }) { return <div className="service-panel-state">{loading ? <LoaderCircle className="spin" size={24}/> : <CircleStop size={24}/>}<b>{title}</b>{copy ? <p>{copy}</p> : null}</div>; }
function Unavailable({ title, kind }: { title: string; kind: string }) { return <div className="service-panel-state"><Database size={25}/><b>{title} é gerenciado pelo tipo {kind}</b><p>As operações específicas disponíveis permanecem acessíveis no API Explorer.</p></div>; }
function EmptyLine({ text }: { text: string }) { return <div className="settings-empty">{text}</div>; }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "A operação falhou."; }
function actionLabel(action: string) { return ({ start: "Inicialização", stop: "Parada", restart: "Reinicialização", deploy: "Deploy" } as Record<string, string>)[action] ?? action; }
function formatDate(value: unknown) { if (!value) return "—"; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR"); }
async function loadServiceMetrics(projectName: string, serviceName: string) {
  const query = { projectName, serviceName };
  const attempts = await Promise.allSettled([
    callEasypanel({ id: "getMonitorTableData", method: "GET", path: "/getMonitorTableData" }),
    callEasypanel({ id: "getLegacyMonitorServiceStats", method: "GET", path: "/getLegacyMonitorServiceStats", query }),
    callEasypanel({ id: "getMetricsServiceStats", method: "GET", path: "/getMetricsServiceStats", query: { ...query, range: 900, step: "30s" } }),
  ]);
  return attempts.filter((attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof callEasypanel>>> => attempt.status === "fulfilled").map((attempt) => attempt.value.data);
}

function normalizeRuntimeStats(metricPayloads: unknown[] | undefined, inspected: Record<string, unknown>, service: LiveService) {
  const payloads = (metricPayloads ?? []).flatMap((payload) => metricsForService(payload, service.projectName, service.name));
  payloads.push(inspected, service.raw);
  const legacy = payloads.map(asRecord).find((value) => asRecord(value.cpu).percent !== undefined || asRecord(value.memory).usage !== undefined) ?? {};
  const cpu = numberAt(asRecord(legacy.cpu).percent) ?? firstNumber(payloads, ["cpuPercent", "cpuPercentage", "cpuUsage", "cpuUsagePercentage", "cpu"]);
  const memory = numberAt(asRecord(legacy.memory).usage) ?? firstNumber(payloads, ["memoryBytes", "memoryUsage", "memoryUsageBytes", "memory", "mem"]);
  const received = numberAt(asRecord(legacy.network).in) ?? firstNumber(payloads, ["networkRx", "rxBytes", "receivedBytes", "networkReceive", "networkIn", "networkInput"]);
  const sent = numberAt(asRecord(legacy.network).out) ?? firstNumber(payloads, ["networkTx", "txBytes", "sentBytes", "networkTransmit", "networkOut", "networkOutput"]);
  const image = firstText(payloads, ["image", "imageName", "dockerImage"]) ?? service.image;
  return {
    cpu: cpu === undefined ? "—" : `${(cpu <= 1 ? cpu * 100 : cpu).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
    memory: memory === undefined ? "—" : formatBytes(memory),
    network: received === undefined && sent === undefined ? "—" : `${received === undefined ? "—" : formatBytes(received)} ↓ / ${sent === undefined ? "—" : formatBytes(sent)} ↑`,
    image: image || "—",
  };
}

function numberAt(value: unknown) {
  const number = typeof value === "string" ? Number(value.replace(/[^0-9,.-]/g, "").replace(",", ".")) : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function metricsForService(value: unknown, projectName: string, serviceName: string): unknown[] {
  const matches: Record<string, unknown>[] = []; const queue = [value]; const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift(); if (!current || typeof current !== "object" || seen.has(current)) continue; seen.add(current);
    if (Array.isArray(current)) { for (const item of current) queue.push(item); continue; }
    const record = asRecord(current);
    if (String(record.projectName ?? record.project ?? "") === projectName && String(record.serviceName ?? record.service ?? record.name ?? "") === serviceName) matches.push(record);
    for (const nested of Object.values(record)) if (nested && typeof nested === "object") queue.push(nested);
  }
  return matches.length ? matches : [value];
}

function firstNumber(values: unknown[], keys: string[]) {
  for (const value of values) {
    const found = findMetricValue(value, new Set(keys.map((key) => key.toLowerCase())));
    if (found !== undefined) return found;
  }
  return undefined;
}

function firstText(values: unknown[], keys: string[]) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const queue = [...values]; const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift(); if (!current || typeof current !== "object" || seen.has(current)) continue; seen.add(current);
    const record = asRecord(current);
    for (const [key, value] of Object.entries(record)) if (wanted.has(key.toLowerCase()) && typeof value === "string" && value) return value;
    for (const nested of Object.values(record)) if (nested && typeof nested === "object") queue.push(nested);
  }
  return undefined;
}

function findMetricValue(value: unknown, keys: Set<string>): number | undefined {
  const queue = [value]; const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift(); if (!current || typeof current !== "object" || seen.has(current)) continue; seen.add(current);
    if (Array.isArray(current)) { for (const item of current) queue.push(item); continue; }
    const record = asRecord(current);
    for (const [key, candidate] of Object.entries(record)) {
      if (keys.has(key.toLowerCase())) {
        const direct = typeof candidate === "string" ? Number(candidate.replace(/[^0-9,.-]/g, "").replace(",", ".")) : Number(candidate); if (Number.isFinite(direct)) return direct;
        if (Array.isArray(candidate)) {
          const last = candidate.at(-1);
          const nested = Array.isArray(last) ? Number(last.at(-1)) : Number(asRecord(last).value ?? asRecord(last).y);
          if (Number.isFinite(nested)) return nested;
        }
      }
      if (candidate && typeof candidate === "object") queue.push(candidate);
    }
  }
  return undefined;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"]; let value = bytes; let index = 0;
  while (Math.abs(value) >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${units[index]}`;
}
