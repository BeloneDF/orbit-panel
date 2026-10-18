import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(){try{const actor=await requireActor();const sessions=await db.session.findMany({where:{userId:actor.id},select:{id:true,ipAddress:true,userAgent:true,createdAt:true,expiresAt:true,revokedAt:true},orderBy:{createdAt:"desc"}});return NextResponse.json({sessions:sessions.map(x=>({...x,current:x.id===actor.sessionId}))});}catch{return NextResponse.json({error:"Não autenticado."},{status:401});}}
