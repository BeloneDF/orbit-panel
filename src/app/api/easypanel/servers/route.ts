import { NextResponse } from "next/server";
import { audit, assertSameOrigin, requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptApiKey, normalizeBaseUrl, selectServerCookie, SESSION_COOKIE } from "@/lib/session";

const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 };
const cleanPanelUrl = (input: string) => { const url = new URL(input.trim()); if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Use uma URL HTTP ou HTTPS sem credenciais."); url.pathname = url.pathname.replace(/\/$/, ""); url.search = ""; url.hash = ""; return url.toString().replace(/\/$/, ""); };

export async function GET() {
  try {
    await requireActor();
    const servers = await db.easypanelServer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, panelUrl: true, apiUrl: true, updatedAt: true } });
    return NextResponse.json({ servers });
  } catch { return NextResponse.json({ error: "Sessão expirada." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const input = await request.json() as { name?: string; panelUrl?: string; apiUrl?: string; apiKey?: string };
    const name = input.name?.trim();
    if (!name || !input.panelUrl || !input.apiUrl || !input.apiKey?.trim()) return NextResponse.json({ error: "Informe nome, URL do painel, URL da API e a chave." }, { status: 400 });
    const panelUrl = cleanPanelUrl(input.panelUrl);
    const apiUrl = normalizeBaseUrl(input.apiUrl);
    const apiKey = input.apiKey.trim();
    const check = await fetch(`${apiUrl}/getSession`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!check.ok) return NextResponse.json({ error: `A API respondeu ${check.status}. Verifique a URL e a chave.` }, { status: 401 });
    const server = await db.easypanelServer.create({ data: { name, panelUrl, apiUrl, apiKeyCiphertext: encryptApiKey(apiKey) }, select: { id: true, name: true, panelUrl: true, apiUrl: true } });
    await audit({ actor, action: "EASYPANEL_SERVER_CREATED", category: "EASYPANEL", resource: "EasypanelServer", resourceId: server.id, newData: { name, panelUrl, apiUrl }, statusCode: 201 });
    const response = NextResponse.json({ server }, { status: 201 }); response.cookies.set(SESSION_COOKIE, selectServerCookie(server.id), cookieOptions); return response;
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF") return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Esse servidor já foi cadastrado." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível adicionar o servidor." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request); const actor = await requireActor(); const { id } = await request.json() as { id?: string };
    const server = id ? await db.easypanelServer.findUnique({ where: { id }, select: { id: true, name: true } }) : null;
    if (!server) return NextResponse.json({ error: "Servidor não encontrado." }, { status: 404 });
    await audit({ actor, action: "EASYPANEL_SERVER_SELECTED", category: "EASYPANEL", resource: "EasypanelServer", resourceId: server.id, metadata: { name: server.name }, statusCode: 200 });
    const response = NextResponse.json({ server }); response.cookies.set(SESSION_COOKIE, selectServerCookie(server.id), cookieOptions); return response;
  } catch { return NextResponse.json({ error: "Não foi possível selecionar o servidor." }, { status: 400 }); }
}
