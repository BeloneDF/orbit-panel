import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = "https://easypanel.io/docs/api/projects/createProject";
const html = await (await fetch(source)).text();
const startMarker = String.raw`\"bundled\":`;
const endMarker = String.raw`,\"proxyUrl\":`;
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker, start);

if (start < 0 || end < 0) throw new Error("OpenAPI bundle not found in Easypanel docs");

const raw = html.slice(start + startMarker.length, end);
const decoded = JSON.parse(`"${raw}"`);
const spec = JSON.parse(decoded);
const endpoints = [];

for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    if (!operation || typeof operation !== "object" || !operation.operationId) continue;
    endpoints.push({
      id: operation.operationId,
      method: method.toUpperCase(),
      path,
      title: operation.summary ?? operation.operationId,
      description: operation.description ?? "",
      group: operation.tags?.[0] ?? "Other",
      parameters: operation.parameters ?? [],
      body: operation.requestBody?.content?.["application/json"]?.schema ?? null,
      bodyRequired: operation.requestBody?.required ?? false,
    });
  }
}

endpoints.sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title));
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "src/data/endpoints.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ version: spec.info.version, syncedAt: new Date().toISOString(), endpoints }, null, 2)}\n`);
console.log(`Synced ${endpoints.length} operations from Easypanel API ${spec.info.version}`);
