"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, LoaderCircle, Play, RefreshCw, Search, TerminalSquare } from "lucide-react";
import { callEasypanel, normalizeProjectsAndServices } from "@/lib/easypanel-client";

const loadServices = () => callEasypanel({ id: "listProjectsAndServices", method: "GET", path: "/listProjectsAndServices" });

export default function LogsViewer() {
  const { data: serviceData, error: serviceError } = useSWR("easypanel/services", loadServices, { revalidateOnFocus: false });
  const services = useMemo(() => normalizeProjectsAndServices(serviceData?.data).flatMap((project) => project.services), [serviceData?.data]);
  const [serviceKey, setServiceKey] = useState(""); const [search, setSearch] = useState("");
  const [request, setRequest] = useState<{projectName:string;serviceName:string}|null>(null);
  const selectedKey = serviceKey || (services[0] ? `${services[0].projectName}/${services[0].name}` : "");
  const live = useServiceLogStream(request);
  const entries = live.lines.filter((line) => line.message.toLowerCase().includes(search.toLowerCase()));

  function query(event?: FormEvent) { event?.preventDefault(); const selected = services.find((item) => `${item.projectName}/${item.name}` === selectedKey); if (!selected) return; setRequest({ projectName: selected.projectName, serviceName: selected.name }); }
  return <main className="resource-view logs-view">
    <header className="page-heading"><div><span className="eyebrow">OBSERVABILIDADE</span><h1>Logs de serviços</h1><p>Acompanhe stdout e stderr ao vivo, diretamente pelo stream WebSocket da instância.</p></div><button className="secondary-button" disabled={!request} onClick={live.reconnect}><RefreshCw size={15}/>Reconectar</button></header>
    <form className="log-query" onSubmit={query}><label><span>Serviço</span><select value={selectedKey} onChange={(event) => setServiceKey(event.target.value)}>{services.map((service) => <option key={`${service.projectName}/${service.name}`} value={`${service.projectName}/${service.name}`}>{service.projectName} / {service.name}</option>)}</select></label><label className="log-search"><span>Filtrar no conteúdo</span><div><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="erro, request id, mensagem…"/></div></label><button className="primary-button" disabled={!selectedKey}><Play size={15}/>{request?"Trocar stream":"Conectar"}</button></form>
    {serviceError ? <LogState icon={AlertTriangle} title="Não foi possível carregar os serviços" copy={serviceError.message}/> : !request ? <LogState icon={TerminalSquare} title="Escolha um serviço" copy="Selecione um serviço para abrir os logs em tempo real."/> : live.error ? <LogState icon={AlertTriangle} title="Stream de logs interrompido" copy={live.error}/> : live.loading ? <LogState icon={LoaderCircle} title="Conectando ao stream…" copy="Abrindo o WebSocket seguro da instância." spin/> : <section className="log-console"><header><span><i/>ao vivo</span><b>{entries.length} linhas</b></header><div>{entries.map((entry, index) => <article key={`${entry.receivedAt}-${index}`} className={/error|fail|exception|stderr/i.test(entry.message) ? "stderr" : ""}><time>{new Date(entry.receivedAt).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",second:"2-digit"})}</time><span>stream</span><pre>{entry.message}</pre></article>)}{!entries.length ? <p className="console-empty">Aguardando linhas do serviço…</p> : null}</div></section>}
  </main>;
}

type LiveLine={message:string;receivedAt:number};
function useServiceLogStream(service:{projectName:string;serviceName:string}|null){const[lines,setLines]=useState<LiveLine[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");const[retry,setRetry]=useState(0);const projectName=service?.projectName;const serviceName=service?.serviceName;useEffect(()=>{if(!projectName||!serviceName)return;const source=new EventSource(`/api/logs/stream?${new URLSearchParams({projectName,serviceName,compose:"false"})}`);source.onopen=()=>setLoading(false);source.onmessage=(event)=>{const message=decode(event.data).trim();if(message)setLines(current=>[...current,{message,receivedAt:Date.now()}].slice(-500))};source.onerror=()=>{setLoading(false);setError("Não foi possível manter a conexão com o stream.");source.close()};return()=>source.close()},[projectName,serviceName,retry]);return{lines,loading,error,reconnect:()=>setRetry(value=>value+1)}}
function decode(value:string){try{let parsed:unknown=JSON.parse(value);if(typeof parsed==="string"){try{parsed=JSON.parse(parsed)}catch{return String(parsed)}}if(parsed&&typeof parsed==="object"&&"output" in parsed)return String((parsed as {output:unknown}).output??"");return typeof parsed==="string"?parsed:JSON.stringify(parsed)}catch{return value}}
function LogState({ icon: Icon, title, copy, spin = false }: { icon: typeof TerminalSquare; title: string; copy: string; spin?: boolean }) { return <section className="resource-state log-state"><Icon className={spin ? "spin" : ""} size={28}/><h2>{title}</h2><p>{copy}</p></section>; }
