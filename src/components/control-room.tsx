"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Activity, Blocks, Box, Braces, CircleDot, ClipboardList, Cloud, Command,
  Database, Gauge, Globe2, HardDrive, LayoutDashboard, LifeBuoy,
  LogOut, Menu, Plus, Search, Server, Settings2, ShieldCheck, Sparkles,
  Terminal, X, ScrollText, UsersRound, Network,
} from "lucide-react";
import { ConnectGate } from "./connect-gate";
import { PwaInstallButton } from "./pwa-install-button";
import { asRecord, callEasypanel, normalizeProjectsAndServices } from "@/lib/easypanel-client";

const ApiExplorer = dynamic(() => import("./api-explorer"), {
  loading: () => <div className="view-loader"><span /><p>Carregando catálogo da API…</p></div>,
});
const ProjectsManager = dynamic(() => import("./projects-manager"), { loading: ResourceLoader });
const ServicesManager = dynamic(() => import("./services-manager"), { loading: ResourceLoader });
const DomainsManager = dynamic(() => import("./domains-manager"), { loading: ResourceLoader });
const LogsViewer = dynamic(() => import("./logs-viewer"), { loading: ResourceLoader });
const UsersManager = dynamic(() => import("./users-manager"), { loading: ResourceLoader });
const AuditManager = dynamic(() => import("./audit-manager"), { loading: ResourceLoader });
const AccountSecurity = dynamic(() => import("./account-security"), { loading: ResourceLoader });
const InfrastructureManager = dynamic(() => import("./infrastructure-manager"), { loading: ResourceLoader });
const SystemMonitor = dynamic(() => import("./system-monitor"), { loading: ResourceLoader });

type ConnectionState = { connected: boolean; baseUrl?: string };
type Actor = { id:string; name:string; email:string; role:"ADMINISTRADOR"|"DEV"; sessionId:string };
type View = "overview" | "projects" | "services" | "databases" | "network" | "backups" | "logs" | "monitoring" | "infrastructure" | "users" | "audit" | "profile" | "sessions" | "security" | "explorer";

const nav = [
  { section: "OPERAÇÕES", items: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "projects", label: "Projetos", icon: Blocks, count: "6" },
    { id: "services", label: "Serviços", icon: Box, count: "18" },
  ] },
  { section: "INFRAESTRUTURA", items: [
    { id: "databases", label: "Bancos de dados", icon: Database },
    { id: "network", label: "Domínios & rede", icon: Globe2 },
    { id: "backups", label: "Backups", icon: HardDrive },
    { id: "logs", label: "Logs", icon: ScrollText },
    { id: "monitoring", label: "Observabilidade", icon: Activity },
    { id: "infrastructure", label: "Infraestrutura", icon: Network },
  ] },
  { section: "ADMINISTRAÇÃO", items: [{ id: "users", label: "Usuários & acesso", icon: UsersRound }, { id: "audit", label: "Logs de auditoria", icon: ClipboardList }] },
  { section: "DESENVOLVEDOR", items: [{ id: "explorer", label: "API Explorer", icon: Braces, count: "375" }] },
] as const;

const services = [
  { name: "gateway-api", project: "plataforma", type: "App", status: "online", version: "v2.4.1", cpu: 32, memory: 48, color: "cyan" },
  { name: "postgres-primary", project: "plataforma", type: "PostgreSQL", status: "online", version: "16.2", cpu: 18, memory: 67, color: "violet" },
  { name: "storefront", project: "commerce", type: "App", status: "deploying", version: "build #847", cpu: 54, memory: 36, color: "coral" },
  { name: "redis-cache", project: "commerce", type: "Redis", status: "online", version: "7.2", cpu: 9, memory: 42, color: "amber" },
  { name: "automation", project: "internal", type: "Compose", status: "online", version: "main@8c91f", cpu: 23, memory: 51, color: "blue" },
];

const viewPaths:Record<View,string>={overview:"/",projects:"/projetos",services:"/servicos",databases:"/bancos-de-dados",network:"/dominios-e-rede",backups:"/backups",logs:"/logs",monitoring:"/observabilidade",infrastructure:"/infraestrutura",users:"/usuarios",audit:"/auditoria",profile:"/conta",sessions:"/conta/sessoes",security:"/conta/seguranca",explorer:"/api-explorer"};
export function ControlRoom({ initialConnection, actor, initialView="overview", initialProject }: { initialConnection: ConnectionState; actor: Actor; initialView?:View; initialProject?:string }) {
  const router = useRouter();
  const view=initialView;
  const connection = initialConnection;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: navigationData } = useSWR(connection.connected ? "easypanel/overview/projects" : null, () => callEasypanel({ id: "listProjectsAndServices", method: "GET", path: "/listProjectsAndServices" }), { revalidateOnFocus: false });
  const navigationProjects = normalizeProjectsAndServices(navigationData?.data);
  const navigationCounts = { projects: navigationProjects.length, services: navigationProjects.reduce((total, project) => total + project.services.length, 0) };

  function navigate(next: View) { router.push(viewPaths[next]); setSidebarOpen(false); }
  function openProject(name:string){router.push(`/projetos/${encodeURIComponent(name)}`);setSidebarOpen(false)}

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><Image className="brand-logo" src="/orbit-logo.png" alt="Orbit" width={38} height={38} priority /><div><b>ORBIT</b><small>PANEL</small></div><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X /></button></div>
      <nav>{nav.filter((group) => group.section !== "ADMINISTRAÇÃO" || actor.role === "ADMINISTRADOR").map((group) => <div className="nav-group" key={group.section}><p>{group.section}</p>{group.items.map((item) => { const Icon = item.icon; const staticCount = "count" in item ? item.count : undefined; const count = connection.connected && item.id === "projects" ? navigationCounts.projects : connection.connected && item.id === "services" ? navigationCounts.services : staticCount; return <button key={item.id} className={view === item.id ? "nav-active" : ""} onClick={() => navigate(item.id as View)}><Icon size={17} /><span>{item.label}</span>{count !== undefined ? <em>{count}</em> : null}</button>; })}</div>)}</nav>
      <div className="sidebar-bottom"><a className="sidebar-link" href="https://easypanel.io/docs" target="_blank" rel="noreferrer"><LifeBuoy size={17} /><span>Central de ajuda</span></a><button onClick={() => navigate("profile")}><Settings2 size={17} /><span>Configurações</span></button><div className="account"><button className="account-profile" onClick={() => navigate("profile")} aria-label="Abrir minha conta"><span className="avatar">{actor.name.slice(0,2).toUpperCase()}</span><span><b>{actor.name}</b><small>{actor.role === "ADMINISTRADOR" ? "Administrador" : "Desenvolvedor"}</small></span></button><button className="account-logout" aria-label="Sair" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});router.replace("/login");router.refresh();}}><LogOut size={15} /></button></div></div>
    </aside>
    {sidebarOpen ? <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} /> : null}
    <section className="content-shell">
      <header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu /></button><div className="command-search"><Search size={16} /><span>Buscar em todo o painel</span><kbd><Command size={12} /> K</kbd></div><div className="topbar-right"><PwaInstallButton /><span className="connection-pill live"><i />{connection.baseUrl ? new URL(connection.baseUrl).hostname : "Instância não configurada"}</span></div></header>
      <ActiveView view={view} projectName={initialProject} connected={connection.connected} onConnect={() => {}} navigate={navigate} openProject={openProject} actorRole={actor.role} />
    </section>
  </div>;
}

function ActiveView({ view, projectName, connected, onConnect, navigate, openProject, actorRole }: { view: View; projectName?:string; connected: boolean; onConnect: () => void; navigate: (view: View) => void; openProject:(name:string)=>void; actorRole: Actor["role"] }) {
  if (view === "explorer") return <ApiExplorer connected={connected} onConnect={onConnect} />;
  if (view === "projects") return connected ? <ProjectsManager initialProject={projectName} onOpenProject={openProject} onBack={()=>navigate("projects")} /> : <ConnectGate title="Gerencie seus projetos" onConnect={onConnect} />;
  if (view === "services") return connected ? <ServicesManager /> : <ConnectGate title="Controle seus serviços" onConnect={onConnect} />;
  if (view === "databases") return connected ? <ServicesManager databasesOnly /> : <ConnectGate title="Controle seus bancos de dados" onConnect={onConnect} />;
  if (view === "network") return connected ? <DomainsManager /> : <ConnectGate title="Gerencie domínios e rede" onConnect={onConnect} />;
  if (view === "logs") return connected ? <LogsViewer /> : <ConnectGate title="Consulte os logs dos serviços" onConnect={onConnect} />;
  if (view === "infrastructure") return connected ? <InfrastructureManager /> : <ConnectGate title="Inspecione sua infraestrutura" onConnect={onConnect} />;
  if (view === "users") return <UsersManager />;
  if (view === "audit") return <AuditManager />;
  if (view === "profile" || view === "sessions" || view === "security") return <AccountSecurity key={view} mode={view} admin={view === "sessions" && actorRole === "ADMINISTRADOR"} />;
  const consoles: Partial<Record<View, { group: string; heading: string }>> = {
    backups: { group: "Database Backups", heading: "Backups" },
    monitoring: { group: "Metrics", heading: "Observabilidade" },
  };
  const consoleView = consoles[view];
  if (consoleView) return <ApiExplorer key={consoleView.group} connected={connected} onConnect={onConnect} initialGroup={consoleView.group} heading={consoleView.heading} />;
  return <Dashboard connected={connected} onExplorer={() => navigate("explorer")} onServices={() => navigate("services")} />;
}

function ResourceLoader() { return <div className="view-loader"><span /><p>Carregando módulo operacional…</p></div>; }

function Dashboard({ connected, onExplorer, onServices }: { connected: boolean; onExplorer: () => void; onServices: () => void }) {
  const { data: projectData, isLoading } = useSWR(connected ? "easypanel/overview/projects" : null, () => callEasypanel({ id: "listProjectsAndServices", method: "GET", path: "/listProjectsAndServices" }), { revalidateOnFocus: false });
  const { data: actionData } = useSWR(connected ? "easypanel/overview/actions" : null, () => callEasypanel({ id: "listActions", method: "GET", path: "/listActions" }), { revalidateOnFocus: false });
  const liveProjects = normalizeProjectsAndServices(projectData?.data);
  const liveServices = liveProjects.flatMap((project) => project.services);
  const metricKey = connected && liveServices.length ? liveServices.map((service) => `${service.projectName}/${service.name}`).join("|") : null;
  const { data: serviceMetrics } = useSWR<Record<string, { cpu?: number; memory?: number }>>(metricKey ? ["easypanel/dashboard-metrics", metricKey] : null, () => loadDashboardMetrics(liveServices), { refreshInterval: 1000, dedupingInterval: 750, revalidateOnFocus: false });
  const online = liveServices.filter((service) => /online|running|active|ready/.test(service.status)).length;
  const actions = normalizeActions(actionData?.data);
  const displayServices = connected ? liveServices.slice(0, 5).map((service, index) => { const metric = serviceMetrics?.[`${service.projectName}/${service.name}`]; return { name: service.name, project: service.projectName, type: service.type, status: /online|running|active|ready/.test(service.status) ? "online" : service.status, version: service.image ?? "—", cpu: metric?.cpu, memory: metric?.memory, color: ["cyan", "violet", "coral", "amber", "blue"][index % 5] }; }) : services;
  return <main className="dashboard">
    <header className="page-heading"><div><span className="eyebrow">PAINEL OPERACIONAL</span><h1>Visão geral</h1><p>{isLoading ? "Consultando sua instância…" : "Dados carregados diretamente do Easypanel."}</p></div><div className="heading-actions"><button className="secondary-button" onClick={onExplorer}><Terminal size={16} />Abrir console</button><button className="primary-button" onClick={onServices}><Plus size={16} />Gerenciar serviços</button></div></header>
    <section className="stat-grid">
      <Stat icon={Blocks} label="PROJETOS" value={connected ? String(liveProjects.length) : "6"} suffix="" detail="ambientes isolados" spark={[19,25,22,34,31,44,36]} />
      <Stat icon={Box} label="SERVIÇOS" value={connected ? String(liveServices.length) : "18"} suffix="" detail="cargas configuradas" spark={[32,29,37,43,39,48,46]} />
      <Stat icon={Activity} label="ONLINE" value={connected ? String(online) : "16"} suffix="" detail="serviços ativos" spark={[17,21,22,25,28,32,36]} />
      <Stat icon={Braces} label="OPERAÇÕES DA API" value="375" suffix="" detail="catálogo oficial" spark={[47,47,47,45,47,47,47]} />
    </section>
    <SystemMonitor connected={connected} />
    <section className="dashboard-grid">
      <article className="panel topology-panel"><div className="panel-heading"><div><span className="panel-kicker">MAPA AO VIVO</span><h2>Topologia do servidor</h2></div><span className="status-good"><i />{connected ? "conectado" : "demo"}</span></div><Topology services={displayServices} /><div className="topology-legend"><span><i className="cyan" />Aplicações <b>{connected ? liveServices.filter((service) => /app|compose|box|wordpress/.test(service.type)).length : 9}</b></span><span><i className="violet" />Dados <b>{connected ? liveServices.filter((service) => /postgres|mysql|maria|mongo|redis/.test(service.type)).length : 5}</b></span><span><i className="coral" />Total <b>{connected ? liveServices.length : 18}</b></span></div></article>
      <article className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">ÚLTIMOS EVENTOS</span><h2>Atividade</h2></div><button onClick={onExplorer}>Ver todas</button></div><div className="timeline">
        {(connected && actions.length ? actions.slice(0, 4) : demoActions).map((action, index) => <Timeline key={`${action.title}-${index}`} color={["coral", "cyan", "violet", "blue"][index]} icon={index === 0 ? Sparkles : index === 1 ? ShieldCheck : index === 2 ? Globe2 : Database} title={action.title} detail={action.detail} time={action.time} />)}
      </div></article>
    </section>
    <section className="panel services-panel"><div className="panel-heading"><div><span className="panel-kicker">CARGAS ATIVAS</span><h2>Serviços</h2></div><div className="service-summary"><span><i className="online" />{online} online</span><button onClick={onServices}>Gerenciar todos</button></div></div><div className="service-table"><div className="service-head"><span>Serviço</span><span>Tipo</span><span>Status</span><span>CPU</span><span>Memória</span><span>Versão</span></div>{displayServices.map((service) => <div className="service-row" key={`${service.project}/${service.name}`}><span className="service-identity"><i className={service.color}>{service.name[0].toUpperCase()}</i><span><b>{service.name}</b><small>{service.project}</small></span></span><span>{service.type}</span><span className={`service-status ${service.status}`}><i />{service.status}</span><Metric value={service.cpu} /><Metric value={service.memory} /><code>{service.version}</code></div>)}</div></section>
  </main>;
}

function Stat({ icon: Icon, label, value, suffix, detail, delta, spark }: { icon: typeof Gauge; label: string; value: string; suffix: string; detail?: string; delta?: string; spark: number[] }) {
  const points = spark.map((point, index) => `${index * 16.6},${52 - point}`).join(" ");
  return <article className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon size={16} /></span><span>{label}</span></div><div className="stat-value"><b>{value}</b><span>{suffix}</span></div><div className="stat-bottom">{delta ? <span className="delta">{delta}</span> : <span>{detail}</span>}<svg viewBox="0 0 100 40" preserveAspectRatio="none"><defs><linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14cfd0" stopOpacity=".28"/><stop offset="1" stopColor="#14cfd0" stopOpacity="0"/></linearGradient></defs><polygon points={`0,40 ${points} 100,40`} fill={`url(#grad-${label})`} /><polyline points={points} fill="none" stroke="#14cfd0" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg></div></article>;
}

function Topology({ services: nodes }: { services: Array<{name:string;type:string}> }) { return <div className="topology"><svg viewBox="0 0 560 270" aria-hidden="true"><path d="M280 135 L125 62 M280 135 L440 58 M280 135 L95 200 M280 135 L445 210 M280 135 L280 238"/><path className="pulse-line" d="M280 135 L440 58"/></svg><div className="core-node"><span><Server size={26} /></span><b>Easypanel</b><small>control plane</small></div><Node className="node-one" icon={Cloud} name={nodes[0]?.name ?? "sem serviço"} type={nodes[0]?.type ?? "—"} /><Node className="node-two" icon={Database} name={nodes[1]?.name ?? "sem serviço"} type={nodes[1]?.type ?? "—"} /><Node className="node-three" icon={Box} name={nodes[2]?.name ?? "sem serviço"} type={nodes[2]?.type ?? "—"} /><Node className="node-four" icon={CircleDot} name={nodes[3]?.name ?? "sem serviço"} type={nodes[3]?.type ?? "—"} /><Node className="node-five" icon={Blocks} name={nodes[4]?.name ?? "sem serviço"} type={nodes[4]?.type ?? "—"} /></div>; }
function Node({ className, icon: Icon, name, type }: { className: string; icon: typeof Cloud; name: string; type: string }) { return <div className={`topology-node ${className}`}><span><Icon size={16} /></span><div><b>{name}</b><small>{type}</small></div></div>; }
function Timeline({ color, icon: Icon, title, detail, time }: { color: string; icon: typeof Sparkles; title: string; detail: string; time: string }) { return <div className="timeline-item"><span className={`timeline-icon ${color}`}><Icon size={15} /></span><div><b>{title}</b><span>{detail}</span></div><time>{time}</time></div>; }
function Metric({ value }: { value?: number }) { return <span className="metric"><span><i style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} /></span><b>{value === undefined ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</b></span>; }

async function loadDashboardMetrics(services: ReturnType<typeof normalizeProjectsAndServices>[number]["services"]): Promise<Record<string, { cpu?: number; memory?: number }>> {
  const results = await Promise.all(services.map(async (service) => {
    try {
      const result = await callEasypanel({ id: "getLegacyMonitorServiceStats", method: "GET", path: "/getLegacyMonitorServiceStats", query: { projectName: service.projectName, serviceName: service.name } });
      const stats = asRecord(result.data); const cpu = numberValue(asRecord(stats.cpu).percent); const memory = numberValue(asRecord(stats.memory).percent);
      return [`${service.projectName}/${service.name}`, { cpu, memory }] as const;
    } catch { return [`${service.projectName}/${service.name}`, {}] as const; }
  }));
  return Object.fromEntries(results);
}
function numberValue(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : undefined; }

const demoActions = [
  { title: "Deploy concluído", detail: "storefront · build #847", time: "agora" },
  { title: "Backup verificado", detail: "postgres-primary · 2.8 GB", time: "12 min" },
  { title: "Domínio atualizado", detail: "api.orbit.local", time: "1 h" },
  { title: "Snapshot criado", detail: "mongo-analytics", time: "3 h" },
];

function normalizeActions(payload: unknown) {
  const source = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { actions?: unknown[] }).actions) ? (payload as { actions: unknown[] }).actions : [];
  return source.map((item) => { const action = item && typeof item === "object" ? item as Record<string, unknown> : {}; return { title: String(action.name ?? action.type ?? action.action ?? "Ação executada"), detail: String(action.message ?? action.serviceName ?? action.projectName ?? action.status ?? "Easypanel"), time: String(action.createdAt ?? action.date ?? "recente") }; });
}
