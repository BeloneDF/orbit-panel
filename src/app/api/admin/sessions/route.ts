import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(request:Request){try{await requireActor(true);const q=new URL(request.url).searchParams;const active=q.get("active")!=="false";const sessions=await db.session.findMany({where:active?{revokedAt:null}:{},include:{user:{select:{name:true,email:true,role:true,status:true}}},orderBy:{createdAt:"desc"},take:200});return NextResponse.json({sessions});}catch(e){return NextResponse.json({error:e instanceof Error&&e.message==="FORBIDDEN"?"Acesso negado.":"Não autenticado."},{status:e instanceof Error&&e.message==="FORBIDDEN"?403:401});}}
