"use client";

import { FormEvent, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, Blocks, Box, LoaderCircle, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { callEasypanel, normalizeProjectsAndServices } from "@/lib/easypanel-client";
import ServicesManager from "./services-manager";

const listProjects = () => callEasypanel({ id: "listProjectsAndServices", method: "GET", path: "/listProjectsAndServices" });

export default function ProjectsManager({initialProject,onOpenProject,onBack}:{initialProject?:string;onOpenProject:(name:string)=>void;onBack:()=>void}) {
  const { data, error, isLoading, mutate } = useSWR("easypanel/projects", listProjects, { revalidateOnFocus: false });
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteProject, setDeleteProject] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const projects = normalizeProjectsAndServices(data?.data).filter((project) => project.name.toLowerCase().includes(search.toLowerCase()));

  if(initialProject)return <ServicesManager projectName={initialProject} onBack={onBack}/>;
  return <main className="resource-view">
    <header className="page-heading"><div><span className="eyebrow">RECURSOS REAIS</span><h1>Projetos</h1><p>Crie, inspecione e remova os ambientes isolados da sua instância.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => mutate()}><RefreshCw size={15} />Atualizar</button><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} />Novo projeto</button></div></header>
    <section className="resource-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar projeto…" /></label><span>{projects.length} projeto{projects.length === 1 ? "" : "s"}</span></section>
    {notice ? <div className="success-banner">{notice}<button onClick={() => setNotice("")}><X size={14} /></button></div> : null}
    {error ? <ErrorState message={error.message} retry={() => mutate()} /> : isLoading ? <LoadingCards /> : projects.length ? <section className="project-grid">{projects.map((project) => <article className="project-card clickable-project" key={project.name} onClick={()=>onOpenProject(project.name)}><header><span><Blocks size={18} /></span><button className="danger-icon" onClick={(event) => {event.stopPropagation();setDeleteProject(project.name)}} aria-label={`Excluir ${project.name}`}><Trash2 size={15} /></button></header><h2>{project.name}</h2><p>{project.services.length} serviço{project.services.length === 1 ? "" : "s"}</p><div className="project-services">{project.services.slice(0, 4).map((service) => <span key={service.name}><Box size={12} />{service.name}</span>)}{project.services.length > 4 ? <span>+{project.services.length - 4}</span> : null}</div><span className="project-open">Abrir serviços →</span></article>)}</section> : <EmptyProjects onCreate={() => setCreateOpen(true)} />}
    {createOpen ? <CreateProject onClose={() => setCreateOpen(false)} onCreated={async (name) => { setCreateOpen(false); setNotice(`Projeto “${name}” criado com sucesso.`); await mutate(); }} /> : null}
    {deleteProject ? <DeleteProject name={deleteProject} onClose={() => setDeleteProject(null)} onDeleted={async () => { const name = deleteProject; setDeleteProject(null); setNotice(`Projeto “${name}” removido.`); await mutate(); }} /> : null}
  </main>;
}

function CreateProject({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => Promise<void> }) {
  const [name, setName] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setPending(true); setError(""); try { await callEasypanel({ id: "createProject", method: "POST", path: "/createProject", body: { name } }); await onCreated(name); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao criar."); } finally { setPending(false); } }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal compact-modal" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button modal-close" onClick={onClose}><X size={17} /></button><div className="modal-kicker"><Blocks size={15} /> novo ambiente</div><h2>Criar projeto</h2><p className="modal-copy">Um projeto cria uma rede Docker isolada para seus serviços.</p><form className="connect-form" onSubmit={submit}><label><span>Nome do projeto</span><div className="input-shell"><Blocks size={16} /><input required pattern="[a-z0-9-_]+" value={name} onChange={(event) => setName(event.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))} placeholder="minha-plataforma" autoFocus /></div></label>{error ? <p className="form-error">{error}</p> : null}<button className="primary-button full-button" disabled={pending || !name}>{pending ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}{pending ? "Criando…" : "Criar projeto"}</button></form></section></div>;
}

function DeleteProject({ name, onClose, onDeleted }: { name: string; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function remove() { setPending(true); setError(""); try { await callEasypanel({ id: "destroyProject", method: "POST", path: "/destroyProject", body: { name } }); await onDeleted(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao excluir."); } finally { setPending(false); } }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal compact-modal" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button modal-close" onClick={onClose}><X size={17} /></button><div className="modal-kicker danger-kicker"><AlertTriangle size={15} /> ação irreversível</div><h2>Excluir {name}?</h2><p className="modal-copy">Serviços, arquivos, rede e configurações deste projeto serão removidos. Digite <b>{name}</b> para confirmar.</p><div className="connect-form"><label><span>Confirmação</span><div className="input-shell"><Trash2 size={16} /><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={name} autoFocus /></div></label>{error ? <p className="form-error">{error}</p> : null}<button className="danger-button full-button" disabled={pending || confirmation !== name} onClick={remove}>{pending ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}{pending ? "Excluindo…" : "Excluir definitivamente"}</button></div></section></div>;
}

function LoadingCards() { return <section className="project-grid">{[1,2,3].map((item) => <div className="project-card skeleton" key={item}><i /><i /><i /></div>)}</section>; }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <section className="resource-state error-state"><AlertTriangle size={24} /><h2>Não foi possível carregar</h2><p>{message}</p><button className="secondary-button" onClick={retry}><RefreshCw size={15} />Tentar novamente</button></section>; }
function EmptyProjects({ onCreate }: { onCreate: () => void }) { return <section className="resource-state"><Blocks size={26} /><h2>Nenhum projeto encontrado</h2><p>Crie o primeiro projeto para começar a publicar seus serviços.</p><button className="primary-button" onClick={onCreate}><Plus size={15} />Criar projeto</button></section>; }
