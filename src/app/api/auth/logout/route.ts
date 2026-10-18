import { NextResponse } from "next/server";
import { audit, clearSessionCookies, currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
export async function POST(){const actor=await currentActor();if(actor){await db.session.updateMany({where:{id:actor.sessionId},data:{revokedAt:new Date()}});await audit({actor,action:"LOGOUT",category:"AUTH",statusCode:200});}await clearSessionCookies();return NextResponse.json({ok:true});}
