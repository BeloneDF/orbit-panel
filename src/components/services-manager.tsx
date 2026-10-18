"use client";

import { FormEvent, useMemo, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, ArrowLeft, Box, Database, FileCode2, LoaderCircle, Pause, Play, Plus, RefreshCw, Rocket, RotateCcw, Search, X } from "lucide-react";
import { asRecord, callEasypanel, LiveService, normalizeProjectsAndServices, serviceOperation } from "@/lib/easypanel-client";
import ServiceDetail from "./service-detail";

const loadServices = () => callEasypanel({ id: "listProjectsAndServices", method: "GET", path: "/listProjectsAndServices" });

export default function ServicesManager({ databasesOnly = false, projectName, onBack }: { databasesOnly?: boolean; projectName?: string; onBack?: () => void }) {
  const { data, error, isLoading, mutate } = useSWR("easypanel/services", loadServices, { revalidateOnFocus: false });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<LiveService | null>(null);
  const projects = useMemo(() => normalizeProjectsAndServices(data?.data), [data?.data]);
  const allServices = useMemo(() => projects.flatMap((project) => project.services), [projects]);
  const scopedServices = projectName ? allServices.filter(service=>service.projectName===projectName) : allServices;
  const metricKey = scopedServices.length ? scopedServices.map(service=>`${service.projectName}/${service.name}`).join("|") : null;
  const { data: metrics, isLoading: metricsLoading } = useSWR(metricKey ? ["easypanel/services/initial-metrics", metricKey] : null, () => loadInitialMetrics(scopedServices), { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false, dedupingInterval: 3_600_000 });
  const databaseTypes = /postgres|mysql|mariadb|mongo|redis|database/i;
  const availableTypes = [...new Set(scopedServices.map((service) => service.type))].sort();
  const services = scopedServices.filter((service) => (!databasesOnly || databaseTypes.test(service.type)) && (type === "todos" || service.type === type) && `${service.name} ${service.projectName}`.toLowerCase().includes(search.toLowerCase()));

  async function run(service: LiveService, action: "start" | "stop" | "restart" | "deploy") {
    const operation = serviceOperation(service, action);
    if (!operation) { setNotice(`A operação “${action}” não é suportada para ${service.type}.`); return; }
    const key = `${service.projectName}/${service.name}/${action}`; setPending(key); setNotice("");
    try { await callEasypanel(operation); setNotice(`${service.name}: operação enviada com sucesso.`); await mutate(); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "Falha na operação."); }
    finally { setPending(""); }
  }

  if (selected) return <ServiceDetail service={selected} onBack={() => setSelected(null)} />;

  return <main className="resource-view">
    <header className="page-heading"><div>{onBack?<button className="back-inline" onClick={onBack}><ArrowLeft size={15}/>Todos os projetos</button>:null}<span className="eyebrow">{projectName?"PROJETO": "CONTROLE OPERACIONAL"}</span><h1>{projectName?`Serviços · ${projectName}`:databasesOnly ? "Bancos de dados" : "Serviços"}</h1><p>{projectName?"Serviços deste ambiente, com status, métricas iniciais e controles operacionais.":"Crie, inicie, pare, reinicie e publique cargas reais da sua instância."}</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => mutate()}><RefreshCw size={15} />Atualizar</button><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={15}/>{databasesOnly ? "Novo banco" : "Novo serviço"}</button></div></header>
    <section className="resource-toolbar service-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar serviço ou projeto…" /></label>{!databasesOnly ? <select value={type} onChange={(event) => setType(event.target.value)}><option value="todos">Todos os tipos</option>{availableTypes.map((item) => <option key={item}>{item}</option>)}</select> : null}<span>{services.length} serviço{services.length === 1 ? "" : "s"}</span></section>
    {notice ? <div className="operation-banner">{notice}</div> : null}
    {error ? <section className="resource-state error-state"><AlertTriangle size={24} /><h2>Não foi possível carregar</h2><p>{error.message}</p></section> : isLoading ? <div className="resource-state"><LoaderCircle className="spin" /><p>Consultando a instância…</p></div> : <section className="live-service-list"><header className="services-list-head"><span>Serviço</span><span>Status</span><span>Uso inicial</span><span>Imagem</span><span>Ações</span></header>{services.map((service) => {const metric=metrics?.[`${service.projectName}/${service.name}`];const state=statusInfo(service.status);return <article className="live-service detailed-service clickable-service" key={`${service.projectName}/${service.name}`} onClick={() => setSelected(service)}><div className="live-service-icon"><Box size={18} /></div><button className="live-service-name" onClick={() => setSelected(service)}><h2>{service.name}</h2><p>{service.projectName} · {service.type}</p></button><span className={`live-status ${state.tone}`}><i />{state.label}</span><ServiceMetrics metric={metric} loading={metricsLoading}/><code className="service-image" title={service.image}>{service.image??"Imagem não informada"}</code><div className="service-actions" onClick={(event) => event.stopPropagation()}><Action title="Iniciar" icon={Play} action="start" service={service} pending={pending} run={run} /><Action title="Parar" icon={Pause} action="stop" service={service} pending={pending} run={run} /><Action title="Reiniciar" icon={RotateCcw} action="restart" service={service} pending={pending} run={run} /><Action title="Publicar" icon={Rocket} action="deploy" service={service} pending={pending} run={run} /></div></article>})}{!services.length ? <div className="resource-state"><Box size={25} /><h2>Nenhum serviço encontrado</h2><p>Ajuste os filtros ou crie serviços em um projeto.</p></div> : null}</section>}
    {createOpen ? <CreateService projects={projects.map((project) => project.name)} databasesOnly={databasesOnly} onClose={() => setCreateOpen(false)} onCreated={async (name) => { setCreateOpen(false); setNotice(`${name}: serviço criado com sucesso.`); await mutate(); }}/> : null}
  </main>;
}

type ServiceMetric={cpu?:number;memoryPercent?:number;memoryUsage?:number;networkIn?:number;networkOut?:number};
async function loadInitialMetrics(services:LiveService[]):Promise<Record<string,ServiceMetric>>{const results=await Promise.all(services.map(async service=>{try{const result=await callEasypanel({id:"getLegacyMonitorServiceStats",method:"GET",path:"/getLegacyMonitorServiceStats",query:{projectName:service.projectName,serviceName:service.name}});const stats=asRecord(result.data);const memory=asRecord(stats.memory);const network=asRecord(stats.network);return [`${service.projectName}/${service.name}`,{cpu:numberValue(asRecord(stats.cpu).percent),memoryPercent:numberValue(memory.percent),memoryUsage:numberValue(memory.usage),networkIn:numberValue(network.in),networkOut:numberValue(network.out)}] as const}catch{return [`${service.projectName}/${service.name}`,{}] as const}}));return Object.fromEntries(results)}
function numberValue(value:unknown){const number=Number(value);return Number.isFinite(number)?number:undefined}
function statusInfo(status:string){if(/running|online|active|ready|healthy/.test(status))return{label:"Online",tone:"online"};if(/deploy|build|start|restart/.test(status))return{label:"Em operação",tone:"deploying"};if(/stop|inactive|offline|disabled/.test(status))return{label:"Parado",tone:"stopped"};return{label:status||"Desconhecido",tone:"unknown"}}
function formatBytes(value?:number){if(value===undefined)return"—";if(value<1024*1024)return`${Math.round(value/1024)} KB`;return`${(value/1024/1024).toLocaleString("pt-BR",{maximumFractionDigits:1})} MB`}
function ServiceMetrics({metric,loading}:{metric?:ServiceMetric;loading:boolean}){return <div className="service-metrics"><span><small>CPU</small><b>{loading?"…":metric?.cpu===undefined?"—":`${metric.cpu.toLocaleString("pt-BR",{maximumFractionDigits:1})}%`}</b></span><span><small>MEMÓRIA</small><b>{loading?"…":metric?.memoryUsage===undefined?"—":formatBytes(metric.memoryUsage)}</b></span><span><small>REDE</small><b>{loading?"…":metric?.networkIn===undefined?"—":`${formatBytes(metric.networkIn)} ↓`}</b></span></div>}

function Action({ title, icon: Icon, action, service, pending, run }: { title: string; icon: typeof Play; action: "start" | "stop" | "restart" | "deploy"; service: LiveService; pending: string; run: (service: LiveService, action: "start" | "stop" | "restart" | "deploy") => void }) {
  const operation = serviceOperation(service, action); const active = pending === `${service.projectName}/${service.name}/${action}`;
  return <button title={operation ? title : `${title} não disponível para este tipo`} disabled={!operation || Boolean(pending)} onClick={() => run(service, action)}>{active ? <LoaderCircle className="spin" size={14} /> : <Icon size={14} />}<span>{title}</span></button>;
}

const serviceKinds = [
  { value: "App", label: "Aplicação / imagem", icon: Box },
  { value: "Compose", label: "Docker Compose", icon: FileCode2 },
  { value: "Postgres", label: "PostgreSQL", icon: Database },
  { value: "MySQL", label: "MySQL", icon: Database },
  { value: "MariaDB", label: "MariaDB", icon: Database },
  { value: "MongoDB", label: "MongoDB", icon: Database },
  { value: "Redis", label: "Redis", icon: Database },
] as const;

function CreateService({ projects, databasesOnly, onClose, onCreated }: { projects: string[]; databasesOnly: boolean; onClose: () => void; onCreated: (name: string) => Promise<void> }) {
  const kinds = databasesOnly ? serviceKinds.filter((item) => !["App", "Compose"].includes(item.value)) : serviceKinds;
  const [kind, setKind] = useState(kinds[0]?.value ?? "App"); const [projectName, setProjectName] = useState(projects[0] ?? ""); const [serviceName, setServiceName] = useState("");
  const [image, setImage] = useState("nginx:alpine"); const [compose, setCompose] = useState("services:\n  app:\n    image: nginx:alpine\n    ports:\n      - 80"); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    const id = `create${kind}Service`; const body: Record<string, unknown> = { projectName, serviceName };
    if (kind === "App") Object.assign(body, { source: { type: "image", image }, env: "", domains: [], mounts: [], ports: [], deploy: { replicas: 1, zeroDowntime: true } });
    if (kind === "Compose") Object.assign(body, { source: { type: "inline", content: compose }, env: "", domains: [], createDotEnv: false });
    try { await callEasypanel({ id, method: "POST", path: `/${id}`, body }); await onCreated(serviceName); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao criar serviço."); }
    finally { setPending(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal service-modal" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button modal-close" onClick={onClose}><X size={17}/></button><div className="modal-kicker"><Plus size={15}/> provisionamento</div><h2>Novo serviço</h2><p className="modal-copy">Crie a carga no projeto e ajuste as opções avançadas depois.</p><form className="connect-form" onSubmit={submit}><label><span>Tipo</span><div className="kind-picker">{kinds.map((item) => { const Icon = item.icon; return <button type="button" className={kind === item.value ? "active" : ""} key={item.value} onClick={() => setKind(item.value)}><Icon size={15}/><span>{item.label}</span></button>; })}</div></label><div className="form-split"><label><span>Projeto</span><select className="form-select" required value={projectName} onChange={(event) => setProjectName(event.target.value)}>{projects.map((project) => <option key={project}>{project}</option>)}</select></label><label><span>Nome do serviço</span><input className="plain-input" required pattern="[a-z0-9-_]+" value={serviceName} onChange={(event) => setServiceName(event.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))} placeholder="api"/></label></div>{kind === "App" ? <label><span>Imagem Docker</span><input className="plain-input" required value={image} onChange={(event) => setImage(event.target.value)} placeholder="ghcr.io/empresa/app:latest"/></label> : null}{kind === "Compose" ? <label><span>docker-compose.yml</span><textarea className="compose-editor" required rows={9} value={compose} onChange={(event) => setCompose(event.target.value)}/></label> : null}{error ? <p className="form-error">{error}</p> : null}<button className="primary-button full-button" disabled={pending || !projectName || !serviceName}>{pending ? <LoaderCircle className="spin" size={16}/> : <Rocket size={16}/>}Criar serviço</button></form></section></div>;
}
