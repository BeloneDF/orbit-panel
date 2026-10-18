import { ControlRoom } from "@/components/control-room";
import { currentActor } from "@/lib/auth";
import { getConnection } from "@/lib/session";
import { notFound, redirect } from "next/navigation";

const routes={
  projetos:"projects", servicos:"services", "bancos-de-dados":"databases", "dominios-e-rede":"network", backups:"backups", logs:"logs", observabilidade:"monitoring", infraestrutura:"infrastructure", usuarios:"users", auditoria:"audit", conta:"profile", "api-explorer":"explorer",
} as const;
type View=typeof routes[keyof typeof routes]|"sessions"|"security";

export default async function RoutedPanel({params}:{params:Promise<{route:string[]}>}){
  const {route}=await params; const [segment,subsegment]=route;
  let initialView:View=routes[segment as keyof typeof routes]; let initialProject:string|undefined;
  if(segment==="conta"&&subsegment==="sessoes")initialView="sessions";
  else if(segment==="conta"&&subsegment==="seguranca")initialView="security";
  else if(segment==="projetos"&&subsegment){initialView="projects";initialProject=decodeURIComponent(subsegment)}
  if(!initialView||route.length>(segment==="projetos"||segment==="conta"?2:1))notFound();
  const actor=await currentActor(); if(!actor)redirect("/login"); const connection=await getConnection();
  return <ControlRoom initialView={initialView} initialProject={initialProject} initialConnection={connection?{connected:true,baseUrl:connection.baseUrl}:{connected:false}} actor={actor}/>;
}
