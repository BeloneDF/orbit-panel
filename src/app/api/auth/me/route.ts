import { NextResponse } from "next/server";
import { currentActor } from "@/lib/auth";
export async function GET(){const actor=await currentActor();return actor?NextResponse.json({user:actor}):NextResponse.json({error:"Não autenticado"},{status:401});}
