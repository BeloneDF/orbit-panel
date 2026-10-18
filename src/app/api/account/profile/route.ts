import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, audit, requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(){try{const actor=await requireActor();const user=await db.user.findUnique({where:{id:actor.id},select:{id:true,name:true,email:true,role:true,status:true,lastLoginAt:true,createdAt:true}});return NextResponse.json({user});}catch{return NextResponse.json({error:"Não autenticado."},{status:401});}}
export async function PATCH(request:Request){try{assertSameOrigin(request);const actor=await requireActor();const input=z.object({name:z.string().min(2).max(100)}).parse(await request.json());const user=await db.user.update({where:{id:actor.id},data:input,select:{id:true,name:true,email:true,role:true}});await audit({actor,action:"PROFILE_UPDATED",category:"ACCOUNT",resource:"User",resourceId:actor.id,newData:input});return NextResponse.json({user});}catch{return NextResponse.json({error:"Não foi possível atualizar o perfil."},{status:400});}}
