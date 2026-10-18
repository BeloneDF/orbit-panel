"use client";

import { Activity, Cpu, HardDrive, MemoryStick, Network, RefreshCw, Server, TableProperties } from "lucide-react";
import useSWR from "swr";
import { asRecord, callEasypanel, findNamedArray, unwrapApiData } from "@/lib/easypanel-client";

type Point = { value: number; at: number };
type MonitorMetric = { label: string; value: string; detail: string; percent?: number; tone: "cyan" | "blue" | "mint" | "violet"; icon: typeof Cpu };
type MonitorRow = { name: string; project: string; cpu?: number; memory?: number; network?: number; status: string };
type MonitorSnapshot = { metrics: MonitorMetric[]; rows: MonitorRow[]; sampledAt: Date };
const metricHistory: Record<string, Point[]> = {};

async function loadMonitor(): Promise<MonitorSnapshot> {
  const [system, storage, table] = await Promise.allSettled([
    callEasypanel({ id: "getLegacyMonitorSystemStats", method: "GET", path: "/getLegacyMonitorSystemStats" }),
    callEasypanel({ id: "getStorageStats", method: "GET", path: "/getStorageStats" }),
    callEasypanel({ id: "getMonitorTableData", method: "GET", path: "/getMonitorTableData" }),
  ]);
  const systemPayload = system.status === "fulfilled" ? unwrapApiData(system.value.data) : null;
  const storagePayload = storage.status === "fulfilled" ? unwrapApiData(storage.value.data) : null;
  const tablePayload = table.status === "fulfilled" ? unwrapApiData(table.value.data) : null;
  const metrics = buildMetrics(systemPayload, storagePayload);
  recordMetricHistory(metrics);
  return { metrics, rows: buildRows(tablePayload), sampledAt: new Date() };
}

export default function SystemMonitor({ connected }: { connected: boolean }) {
  const { data, error, isLoading, mutate, isValidating } = useSWR(connected ? "easypanel/monitor/system" : null, loadMonitor, { refreshInterval: 1000, dedupingInterval: 750, revalidateOnFocus: false });
  if (!connected) return null;

  return <section className="monitor-panel" aria-label="Monitoramento do servidor">
    <header className="monitor-heading">
      <div><span className="panel-kicker">TELEMETRIA DO HOST</span><h2>Monitoramento operacional</h2><p>CPU, memória, disco, rede e containers em execução. Atualização automática a cada segundo.</p></div>
      <div className="monitor-actions"><span className="monitor-live"><i className={isValidating ? "syncing" : ""} />{data ? `Atualizado ${data.sampledAt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Conectando"}</span><button className="secondary-button" onClick={() => mutate()} disabled={isValidating}><RefreshCw className={isValidating ? "spin" : ""} size={15}/>Atualizar</button></div>
    </header>
    {isLoading ? <MonitorLoading /> : error ? <MonitorError detail={error.message} retry={() => mutate()} /> : <>
      <div className="monitor-metrics">{(data?.metrics ?? []).map((metric) => <MetricCard key={metric.label} metric={metric} points={metricHistory[metric.label] ?? []}/>)}</div>
      <div className="monitor-table-wrap"><div className="monitor-table-head"><div><TableProperties size={16}/><span>Containers e serviços</span><small>{data?.rows.length ?? 0} carga{data?.rows.length === 1 ? "" : "s"} retornada{data?.rows.length === 1 ? "" : "s"} pelo monitor</small></div><span className="monitor-source"><Server size={13}/>monitorOld/getMonitorTableData</span></div><div className="monitor-table"><div className="monitor-columns"><span>Projeto / serviço</span><span>CPU</span><span>Memória</span><span>Rede</span><span>Status</span></div>{data?.rows.length ? data.rows.map((row, index) => <MonitorRowView key={`${row.project}/${row.name}/${index}`} row={row}/>) : <p className="monitor-empty">A instância não retornou containers monitoráveis neste momento.</p>}</div></div>
    </>}
  </section>;
}

function MetricCard({ metric, points }: { metric: MonitorMetric; points: Point[] }) { const Icon = metric.icon; return <article className={`monitor-metric ${metric.tone}`}><div className="monitor-metric-top"><span>{metric.label}</span><Icon size={16}/></div><b>{metric.value}</b><small>{metric.detail}</small><Sparkline points={points} tone={metric.tone}/></article>; }
function Sparkline({ points, tone }: { points: Point[]; tone: MonitorMetric["tone"] }) { const values = points.map((point) => point.value); const max = Math.max(...values, 1); const min = Math.min(...values, 0); const distance = Math.max(max - min, 1); const polyline = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${39 - ((value - min) / distance) * 32}`).join(" "); return <svg className={`monitor-spark ${tone}`} viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true"><polyline points={polyline || "0,36 100,36"}/></svg>; }
function MonitorRowView({ row }: { row: MonitorRow }) { return <div className="monitor-row"><span className="monitor-service"><i>{row.name.slice(0, 1).toUpperCase()}</i><span><b>{row.name}</b><small>{row.project || "sem projeto"}</small></span></span><MetricCell value={row.cpu} suffix="%"/><MetricCell value={row.memory} suffix="%"/><span className="monitor-network">{row.network === undefined ? "—" : `${formatBytes(row.network)}/s`}</span><span className={`monitor-status ${statusTone(row.status)}`}><i />{row.status || "desconhecido"}</span></div>; }
function MetricCell({ value, suffix }: { value?: number; suffix: string }) { const bounded = Math.max(0, Math.min(100, value ?? 0)); return <span className="monitor-value"><i><em style={{ width: `${bounded}%` }}/></i><b>{value === undefined ? "—" : `${formatNumber(value)}${suffix}`}</b></span>; }
function MonitorLoading() { return <div className="monitor-state"><Activity className="spin" size={24}/><b>Consultando telemetria do host…</b><p>Coletando estatísticas do sistema, armazenamento e containers.</p></div>; }
function MonitorError({ detail, retry }: { detail: string; retry: () => void }) { return <div className="monitor-state error"><Activity size={24}/><b>Não foi possível atualizar o monitoramento</b><p>{detail}</p><button className="secondary-button" onClick={retry}><RefreshCw size={14}/>Tentar novamente</button></div>; }

function recordMetricHistory(metrics: MonitorMetric[]) { const now = Date.now(); for (const metric of metrics) { const value = metric.percent ?? numeric(metric.value) ?? 0; metricHistory[metric.label] = [...(metricHistory[metric.label] ?? []), { value, at: now }].slice(-24); } }

function buildMetrics(system: unknown, storage: unknown): MonitorMetric[] {
  const source = [system, storage];
  const cpu = findNumber(source, ["cpuPercent", "cpuUsage", "cpu", "usage", "percent"], ["cpu"]);
  const memoryUsed = findNumber(source, ["memoryUsed", "memoryUsage", "used", "usage"], ["memory", "mem"]);
  const memoryTotal = findNumber(source, ["memoryTotal", "total"], ["memory", "mem"]);
  const memoryPercent = findNumber(source, ["memoryPercent", "percent"], ["memory", "mem"]) ?? percentage(memoryUsed, memoryTotal);
  const diskUsed = findNumber(source, ["diskUsed", "used", "usage"], ["disk", "storage", "root"]);
  const diskTotal = findNumber(source, ["diskTotal", "total", "size"], ["disk", "storage", "root"]);
  const diskPercent = findNumber(source, ["diskPercent", "percent"], ["disk", "storage", "root"]) ?? percentage(diskUsed, diskTotal);
  const networkIn = findNumber(source, ["networkIn", "rxBytes", "received", "in"], ["network", "net"]);
  const networkOut = findNumber(source, ["networkOut", "txBytes", "sent", "out"], ["network", "net"]);
  const cores = findNumber(source, ["cores", "cpuCores", "cpus"], []);
  return [
    { label: "CPU", value: cpu === undefined ? "—" : `${formatNumber(asPercent(cpu))}%`, detail: cores ? `${cores} core${cores === 1 ? "" : "s"} disponíveis` : "uso atual do host", percent: cpu === undefined ? undefined : asPercent(cpu), tone: "cyan", icon: Cpu },
    { label: "MEMÓRIA", value: memoryPercent === undefined ? "—" : `${formatNumber(asPercent(memoryPercent))}%`, detail: memoryUsed === undefined ? "uso da memória" : `${formatBytes(memoryUsed)}${memoryTotal ? ` / ${formatBytes(memoryTotal)}` : ""}`, percent: memoryPercent === undefined ? undefined : asPercent(memoryPercent), tone: "blue", icon: MemoryStick },
    { label: "DISCO", value: diskPercent === undefined ? "—" : `${formatNumber(asPercent(diskPercent))}%`, detail: diskUsed === undefined ? "uso do armazenamento" : `${formatBytes(diskUsed)}${diskTotal ? ` / ${formatBytes(diskTotal)}` : ""}`, percent: diskPercent === undefined ? undefined : asPercent(diskPercent), tone: "mint", icon: HardDrive },
    { label: "REDE", value: networkIn === undefined && networkOut === undefined ? "—" : `${formatBytes(networkIn ?? 0)}/s`, detail: `entrada ${formatBytes(networkIn ?? 0)} · saída ${formatBytes(networkOut ?? 0)}`, percent: undefined, tone: "violet", icon: Network },
  ];
}

function buildRows(payload: unknown): MonitorRow[] {
  const list = findNamedArray(payload, ["services", "containers", "items", "data", "rows"], true);
  return list.map(asRecord).map((record, index) => {
    const project = textAt(record, ["projectName", "project", "project_name"]);
    const name = textAt(record, ["serviceName", "service", "name", "containerName", "container"]) || `container-${index + 1}`;
    return { name, project, cpu: numberAt(record.cpu ?? record.cpuPercent ?? asRecord(record.stats).cpu), memory: numberAt(record.memoryPercent ?? record.memory ?? asRecord(record.stats).memory), network: numberAt(record.network ?? record.networkIn ?? asRecord(record.stats).network), status: textAt(record, ["status", "state", "health"]) || "ativo" };
  });
}

function findNumber(values: unknown[], keys: string[], contexts: string[]): number | undefined { for (const source of values) { const result = searchMetric(source, new Set(keys.map((key) => key.toLowerCase())), contexts.map((context) => context.toLowerCase())); if (result !== undefined) return result; } return undefined; }
function searchMetric(value: unknown, keys: Set<string>, contexts: string[]): number | undefined { const queue: Array<{ value: unknown; path: string }> = [{ value, path: "" }]; const seen = new Set<unknown>(); while (queue.length) { const current = queue.shift()!; if (!current.value || typeof current.value !== "object" || seen.has(current.value)) continue; seen.add(current.value); const record = asRecord(current.value); for (const [key, candidate] of Object.entries(record)) { const path = `${current.path}.${key}`.toLowerCase(); if (keys.has(key.toLowerCase()) && (!contexts.length || contexts.some((context) => path.includes(context)))) { const number = numberAt(candidate); if (number !== undefined) return number; } if (candidate && typeof candidate === "object") queue.push({ value: candidate, path }); } } return undefined; }
function textAt(record: Record<string, unknown>, keys: string[]) { for (const key of keys) { const value = record[key]; if (typeof value === "string" && value) return value; } return ""; }
function numberAt(value: unknown): number | undefined { const raw = typeof value === "object" && value ? asRecord(value).percent ?? asRecord(value).value ?? asRecord(value).usage : value; const number = typeof raw === "string" ? Number(raw.replace(/[^0-9,.-]/g, "").replace(",", ".")) : Number(raw); return Number.isFinite(number) ? number : undefined; }
function percentage(used?: number, total?: number) { return used !== undefined && total ? used / total * 100 : undefined; }
function asPercent(value: number) { return value <= 1 ? value * 100 : value; }
function numeric(value: string) { const match = value.match(/[\d.,]+/); return match ? Number(match[0].replace(",", ".")) : undefined; }
function formatNumber(value: number) { return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }); }
function formatBytes(value: number) { if (!Number.isFinite(value)) return "—"; const units = ["B", "KB", "MB", "GB", "TB"]; let unit = 0; let result = Math.max(0, value); while (result >= 1024 && unit < units.length - 1) { result /= 1024; unit++; } return `${result.toLocaleString("pt-BR", { maximumFractionDigits: result < 10 && unit ? 1 : 0 })} ${units[unit]}`; }
function statusTone(status: string) { return /running|active|online|ready|healthy|up|ativo/i.test(status) ? "ok" : /fail|error|down|stop|exit/i.test(status) ? "bad" : "wait"; }
