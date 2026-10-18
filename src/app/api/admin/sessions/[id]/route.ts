import { NextResponse } from "next/server";
import { assertSameOrigin, audit, requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{assertSameOrigin(request);const actor=await requireActor(true);const id=(await params).id;const result=await db.session.updateMany({where:{id,revokedAt:null},data:{revokedAt:new Date()}});if(!result.count)return NextResponse.json({error:"Sessão não encontrada."},{status:404});await audit({actor,action:"ADMIN_SESSION_REVOKED",category:"SECURITY",resource:"Session",resourceId:id});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"Não foi possível encerrar a sessão."},{status:400});}}
