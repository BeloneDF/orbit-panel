import { NextResponse } from "next/server";
import {
  encryptConnection,
  normalizeBaseUrl,
  SESSION_COOKIE,
} from "@/lib/session";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { baseUrl?: string; token?: string };
    if (!input.baseUrl || !input.token) {
      return NextResponse.json({ error: "Informe a URL e o token da API." }, { status: 400 });
    }
    const connection = { baseUrl: normalizeBaseUrl(input.baseUrl), token: input.token.trim() };
    const check = await fetch(`${connection.baseUrl}/getSession`, {
      headers: { Authorization: `Bearer ${connection.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!check.ok) {
      return NextResponse.json(
        { error: `A instância respondeu ${check.status}. Verifique a URL e o token.` },
        { status: 401 },
      );
    }
    const response = NextResponse.json({ connected: true, baseUrl: connection.baseUrl });
    response.cookies.set(SESSION_COOKIE, encryptConnection(connection), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível conectar." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ connected: false });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
