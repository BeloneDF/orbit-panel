export type EasypanelCall = {
  id: string;
  method: "GET" | "POST";
  path: `/${string}`;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

export type ApiResult<T = unknown> = { ok: boolean; status: number; data: T };

export async function callEasypanel<T = unknown>(operation: EasypanelCall): Promise<ApiResult<T>> {
  const response = await fetch("/api/easypanel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(operation),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.data?.message || `A API respondeu HTTP ${response.status}.`);
  return result as ApiResult<T>;
}

export type LiveProject = {
  name: string;
  services: LiveService[];
  raw: Record<string, unknown>;
};

export type LiveService = {
  name: string;
  projectName: string;
  type: string;
  status: string;
  image?: string;
  raw: Record<string, unknown>;
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function findNamedArray(value: unknown, keys: string[], acceptRootArray = false): unknown[] {
  if (acceptRootArray && Array.isArray(value)) return value;
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const record = asRecord(current);
    for (const key of keys) if (Array.isArray(record[key])) return record[key] as unknown[];
    for (const nested of Object.values(record)) {
      if (nested && typeof nested === "object" && !Array.isArray(nested)) queue.push(nested);
    }
  }
  return [];
}

export function findNamedObject(value: unknown, keys: string[]): Record<string, unknown> {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const record = asRecord(current);
    for (const key of keys) {
      const candidate = record[key];
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return asRecord(candidate);
    }
    for (const nested of Object.values(record)) if (nested && typeof nested === "object") queue.push(nested);
  }
  return {};
}

export function unwrapApiData(value: unknown): unknown {
  let current = value;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !Array.isArray(current) && !seen.has(current)) {
    seen.add(current);
    const record = asRecord(current);
    const key = ["data", "result", "json", "body"].find((candidate) => candidate in record);
    if (!key) break;
    current = record[key];
  }
  return current;
}

export function normalizeCollection(payload: unknown, keys: string[]): Record<string, unknown>[] {
  return findNamedArray(payload, keys, true).map(asRecord);
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function serviceType(raw: Record<string, unknown>) {
  return String(raw.type ?? raw.serviceType ?? raw.kind ?? raw.template ?? "app").toLowerCase();
}

export function normalizeProjects(payload: unknown): LiveProject[] {
  return findNamedArray(payload, ["projects", "items"], true).map((item, index) => {
    const raw = asRecord(item);
    const name = String(raw.name ?? raw.projectName ?? raw.id ?? `project-${index + 1}`);
    const services = Array.isArray(raw.services) ? raw.services.map((service, serviceIndex) => normalizeService(service, name, serviceIndex)) : [];
    return { name, services, raw };
  });
}

export function normalizeService(value: unknown, projectName: string, index = 0): LiveService {
  const raw = asRecord(value);
  const type = serviceType(raw);
  const statusSource = String(raw.status ?? raw.state ?? raw.deployStatus ?? (raw.enabled === true ? "active" : raw.enabled === false ? "stopped" : "unknown")).toLowerCase();
  return {
    name: String(raw.name ?? raw.serviceName ?? raw.id ?? `service-${index + 1}`),
    projectName,
    type,
    status: statusSource,
    image: typeof raw.image === "string" ? raw.image : undefined,
    raw,
  };
}

export function normalizeProjectsAndServices(payload: unknown): LiveProject[] {
  const projects = normalizeProjects(payload);
  const services = findNamedArray(payload, ["services"]);
  const grouped = new Map<string, LiveService[]>();
  services.forEach((value, index) => {
    const raw = asRecord(value);
    const projectName = String(raw.projectName ?? raw.project ?? "sem-projeto");
    grouped.set(projectName, [...(grouped.get(projectName) ?? []), normalizeService(raw, projectName, index)]);
  });
  if (!projects.length) return [...grouped].map(([name, projectServices]) => ({ name, services: projectServices, raw: { name } }));
  const projectNames = new Set(projects.map((project) => project.name));
  const merged = projects.map((project) => {
    const separateServices = grouped.get(project.name) ?? [];
    const known = new Set(project.services.map((service) => service.name));
    return { ...project, services: [...project.services, ...separateServices.filter((service) => !known.has(service.name))] };
  });
  for (const [name, projectServices] of grouped) {
    if (!projectNames.has(name)) merged.push({ name, services: projectServices, raw: { name } });
  }
  return merged;
}

export function serviceOperation(service: LiveService, action: "start" | "stop" | "restart" | "deploy"): EasypanelCall | null {
  const baseBody = { projectName: service.projectName, serviceName: service.name };
  const normalized = service.type.replace(/[^a-z]/g, "");
  const databaseMap: Record<string, string> = {
    postgres: "Postgres", postgresql: "Postgres", mysql: "MySQL", mariadb: "MariaDB", mongodb: "MongoDB", redis: "Redis",
  };
  if (normalized === "app" || normalized.includes("appservice")) {
    const id = action === "start" ? "startAppService" : action === "stop" ? "stopAppService" : action === "restart" ? "restartAppService" : "deployAppService";
    return { id, method: "POST", path: `/${id}`, body: baseBody };
  }
  if (normalized.includes("compose")) {
    const id = action === "start" ? "startComposeService" : action === "stop" ? "stopComposeService" : action === "restart" ? "restartComposeService" : "deployComposeService";
    return { id, method: "POST", path: `/${id}`, body: baseBody };
  }
  if (normalized.includes("wordpress")) {
    const id = action === "start" ? "startWordPressService" : action === "stop" ? "stopWordPressService" : action === "restart" ? "restartWordPressService" : "rebuildWordPressDockerImage";
    return { id, method: "POST", path: `/${id}`, body: baseBody };
  }
  if (normalized.includes("box")) {
    const id = action === "start" ? "startBoxService" : action === "stop" ? "stopBoxService" : action === "restart" ? "restartBoxService" : "runBoxDeployScript";
    return { id, method: "POST", path: `/${id}`, body: baseBody };
  }
  const database = Object.entries(databaseMap).find(([key]) => normalized.includes(key))?.[1];
  if (database && (action === "start" || action === "stop")) {
    const id = `${action === "start" ? "enable" : "disable"}${database}Service`;
    return { id, method: "POST", path: `/${id}`, body: baseBody };
  }
  return null;
}
