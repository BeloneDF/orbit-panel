import { NextResponse } from "next/server";
import catalog from "@/data/endpoints.json";
import { getConnection } from "@/lib/session";
import { audit, requireActor } from "@/lib/auth";

type Invocation = {
  id?: string;
  method?: string;
  path?: string;
  query?: Record<string, unknown>;
  body?: unknown;
};

const rpcFallbacks: Record<string, string> = {
  getMetricsServiceStats: "metrics/getServiceStats",
  getAllServicesStats: "metrics/getAllServicesStats",
  getMetricsStats: "metrics/getStats",
  getMetricsSystemStats: "metrics/getSystemStats",
  getLegacyMonitorServiceStats: "monitorOld/getServiceStats",
  getMonitorTableData: "monitorOld/getMonitorTableData",
  queryServiceLogs: "logs/queryServiceLogs",
  queryComposeServiceLogs: "logs/queryComposeServiceLogs",
};
// Polling de monitoramento é realizado a cada segundo; nunca deve virar evento de auditoria.
const nonAuditableOperations = new Set(["getLegacyMonitorServiceStats", "getMetricsServiceStats", "getAllServicesStats", "getMetricsStats", "getMetricsSystemStats", "getMonitorTableData"]);

async function readResponse(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

function unwrapRpcPayload(value: unknown): unknown {
  let current = value;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !Array.isArray(current) && !seen.has(current)) {
    seen.add(current);
    const record = current as Record<string, unknown>;
    if ("json" in record) current = record.json;
    else if ("result" in record) current = record.result;
    else if ("data" in record) current = record.data;
    else break;
  }
  return current;
}

function upstreamMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  const nested = unwrapRpcPayload(data);
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    return String(nestedRecord.message ?? nestedRecord.error ?? record.message ?? record.error ?? fallback);
  }
  return String(record.message ?? record.error ?? fallback);
}

export async function POST(request: Request) {
  let actor;
  try { actor = await requireActor(); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Acesso negado." : "Sessão expirada." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }); }
  const connection = await getConnection();
  if (!connection) {
    return NextResponse.json({ error: "Conecte uma instância Easypanel antes de executar." }, { status: 401 });
  }

  try {
    const input = (await request.json()) as Invocation;
    const endpoint = catalog.endpoints.find(
      (item) => item.id === input.id && item.method === input.method && item.path === input.path,
    );
    if (!endpoint) return NextResponse.json({ error: "Operação fora do catálogo oficial." }, { status: 400 });

    const target = new URL(`${connection.baseUrl}${endpoint.path}`);
    if (endpoint.method === "GET" && input.query) {
      for (const [name, value] of Object.entries(input.query)) {
        if (value !== "" && value !== undefined && value !== null) target.searchParams.set(name, String(value));
      }
    }

    let upstream: Response | null = null;
    let data: unknown = null;
    let restFailure = "";
    try {
      upstream = await fetch(target, {
        method: endpoint.method,
        headers: {
          // The REST API uses the standard Bearer authorization scheme.
          Authorization: `Bearer ${connection.token}`,
          ...(endpoint.method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        body: endpoint.method === "POST" ? JSON.stringify(input.body ?? {}) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      data = await readResponse(upstream);
      if (upstream.ok && !containsUpstreamError(data)) {
        const body = input.body && typeof input.body === "object" ? input.body as Record<string, unknown> : {};
        const serviceName = input.query?.serviceName ?? body.serviceName;
        if (!input.id || !nonAuditableOperations.has(input.id)) await audit({ actor, action: input.id ?? "EASYPANEL_READ", category: "EASYPANEL", resource: serviceName ? "Service" : "Easypanel", resourceId: serviceName ? String(serviceName) : undefined, statusCode: upstream.status });
        return NextResponse.json({ ok: true, status: upstream.status, data });
      }
      restFailure = upstreamMessage(data, `A instância respondeu ${upstream.status}.`);
    } catch (error) {
      restFailure = error instanceof Error ? error.message : "Falha de rede ao chamar a instância.";
    }

    const rpcOperation = rpcFallbacks[endpoint.id];
    if (rpcOperation) {
      try {
        const rpc = await fetch(`${connection.baseUrl}/rpc/${rpcOperation}`, {
          method: "POST",
          // The legacy RPC client sends the API key verbatim (not Bearer).
          headers: { Authorization: connection.token, "Content-Type": "application/json" },
          body: JSON.stringify({ json: endpoint.method === "GET" ? input.query ?? null : input.body ?? null }),
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        });
        const rpcData = await readResponse(rpc);
        if (rpc.ok) return NextResponse.json({ ok: true, status: rpc.status, data: unwrapRpcPayload(rpcData) });
        return NextResponse.json({ error: upstreamMessage(rpcData, restFailure), data: rpcData }, { status: rpc.status });
      } catch (error) {
        const rpcFailure = error instanceof Error ? error.message : "Falha de rede ao consultar o fallback RPC.";
        return NextResponse.json({ error: `${restFailure} Fallback RPC: ${rpcFailure}` }, { status: 502 });
      }
    }

    return NextResponse.json({ error: restFailure, data }, { status: upstream?.status ?? 502 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao executar a operação." },
      { status: 500 },
    );
  }
}

function containsUpstreamError(value: unknown): boolean {
  const data = unwrapRpcPayload(value);
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const record = data as Record<string, unknown>;
  return typeof record.error === "string" || typeof record.message === "string" && (record.status === "error" || record.ok === false);
}
