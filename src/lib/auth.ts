import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

export const AUTH_COOKIE = "orbit_session";
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || "development-only-change-me");
export type Actor = { id:string; name:string; email:string; role:"ADMINISTRADOR"|"DEV"; sessionId:string };
export const hashToken = (value:string) => createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export async function passwordHash(value:string) { return argon2.hash(value, { type: argon2.argon2id }); }
export async function verifyPassword(hash:string, value:string) { return argon2.verify(hash, value); }
export function passwordError(value:string) { return value.length < 12 || !/[a-z]/i.test(value) || !/\d/.test(value) ? "Use ao menos 12 caracteres, incluindo letras e números." : null; }
export async function issueSession(user: {id:string;name:string;email:string;role:"ADMINISTRADOR"|"DEV"}, request:Request) { const refresh=token(); const session=await db.session.create({data:{userId:user.id,refreshTokenHash:hashToken(refresh),expiresAt:new Date(Date.now()+1000*60*60*24*30),ipAddress:request.headers.get("x-forwarded-for")?.split(",")[0]??null,userAgent:request.headers.get("user-agent")}}); const jwt=await new SignJWT({sub:user.id,sid:session.id,role:user.role,name:user.name,email:user.email}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("15m").sign(secret()); return {jwt,refresh,session}; }
export async function setSessionCookies(jwt:string, refresh:string) { const jar=await cookies(); const common={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/"}; jar.set(AUTH_COOKIE,jwt,{...common,maxAge:900}); jar.set("orbit_refresh",refresh,{...common,maxAge:60*60*24*30}); }
export async function clearSessionCookies(){const jar=await cookies(); jar.set(AUTH_COOKIE,"",{path:"/",maxAge:0});jar.set("orbit_refresh","",{path:"/",maxAge:0});}
export async function currentActor():Promise<Actor|null>{const raw=(await cookies()).get(AUTH_COOKIE)?.value;if(!raw)return null;try{const {payload}=await jwtVerify(raw,secret());if(!payload.sub||typeof payload.sid!=="string"||typeof payload.role!=="string")return null;const session=await db.session.findUnique({where:{id:payload.sid},include:{user:true}});if(!session||session.revokedAt||session.expiresAt<new Date()||session.user.status!=="ACTIVE"||session.user.deletedAt)return null;return {id:session.user.id,name:session.user.name,email:session.user.email,role:session.user.role,sessionId:session.id};}catch{return null;}}
export async function requireActor(admin=false){const actor=await currentActor();if(!actor)throw new Error("UNAUTHORIZED");if(admin&&actor.role!=="ADMINISTRADOR")throw new Error("FORBIDDEN");return actor;}
export function assertSameOrigin(request:Request){const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw new Error("CSRF");}
export async function audit(input:{actor?:Actor|null;action:string;category:string;resource?:string;resourceId?:string;success?:boolean;statusCode?:number;metadata?:object;previousData?:object;newData?:object;errorMessage?:string}){const h=await headers(); await db.auditLog.create({data:{userId:input.actor?.id,sessionId:input.actor?.sessionId,action:input.action,category:input.category,resource:input.resource,resourceId:input.resourceId,success:input.success??true,statusCode:input.statusCode,metadata:input.metadata,previousData:input.previousData,newData:input.newData,errorMessage:input.errorMessage,ipAddress:h.get("x-forwarded-for")?.split(",")[0]??null,userAgent:h.get("user-agent")??null}});}
