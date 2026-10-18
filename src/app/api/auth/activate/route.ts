import { NextResponse } from "next/server";
import { z } from "zod";
import { AccessTokenType } from "@/generated/prisma/client";
import { audit, hashToken, passwordError, passwordHash } from "@/lib/auth";
import { db } from "@/lib/db";
const schema=z.object({token:z.string().min(32),password:z.string().min(12)});
export async function POST(request:Request){try{const input=schema.parse(await request.json());const message=passwordError(input.password);if(message)return NextResponse.json({error:message},{status:400});const record=await db.accessToken.findUnique({where:{tokenHash:hashToken(input.token)}});if(!record||record.type!==AccessTokenType.ACTIVATE||record.usedAt||record.expiresAt<new Date())return NextResponse.json({error:"Este link de ativação é inválido, expirou ou já foi usado."},{status:400});await db.$transaction(async tx=>{await tx.user.update({where:{id:record.userId},data:{passwordHash:await passwordHash(input.password),status:"ACTIVE",mustChangePassword:false}});await tx.accessToken.update({where:{id:record.id},data:{usedAt:new Date()}});});await audit({action:"ACCOUNT_ACTIVATED",category:"AUTH",resource:"User",resourceId:record.userId,statusCode:200});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"Não foi possível ativar esta conta."},{status:400});}}
