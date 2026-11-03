import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "easypanel_control";

export type Connection = { baseUrl: string; token: string };
type SelectedServer = { serverId: string };
type EncryptedApiKey = { token: string };

// Stable in local development so Fast Refresh does not invalidate a connection.
// Production still requires SESSION_SECRET; without it, sessions expire on restart.
const fallbackSecret = process.env.NODE_ENV === "development"
  ? "orbit-panel-local-development-session-key-v1"
  : randomBytes(32).toString("hex");
const key = createHash("sha256")
  .update(process.env.SESSION_SECRET || fallbackSecret)
  .digest();

function credentialKey() {
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET é obrigatório para armazenar servidores com segurança.");
  }
  return key;
}

export function normalizeBaseUrl(input: string) {
  const url = new URL(input.trim());
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use uma URL HTTP ou HTTPS.");
  if (url.username || url.password) throw new Error("Não inclua credenciais na URL.");
  url.pathname = `${url.pathname.replace(/\/$/, "").replace(/\/api$/, "")}/api`;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function encryptConnection(connection: Connection) {
  return encryptValue(connection);
}

function encryptValue(value: Connection | SelectedServer | EncryptedApiKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted].map((item) => item.toString("base64url")).join(".");
}

export function decryptConnection(value: string): Connection | null {
  try {
    const [iv, tag, encrypted] = value.split(".").map((item) => Buffer.from(item, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", credentialKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

export function encryptApiKey(apiKey: string) { return encryptValue({ token: apiKey }); }
export function decryptApiKey(ciphertext: string): string | null { return decryptConnection(ciphertext)?.token ?? null; }
export function selectServerCookie(serverId: string) { return encryptValue({ serverId }); }

export async function getConnection(): Promise<Connection | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const selected = decryptConnection(value) as SelectedServer | null;
  if (!selected || !("serverId" in selected)) return null;
  const server = await db.easypanelServer.findUnique({ where: { id: selected.serverId }, select: { apiUrl: true, apiKeyCiphertext: true } });
  const token = server ? decryptApiKey(server.apiKeyCiphertext) : null;
  return server && token ? { baseUrl: server.apiUrl, token } : null;
}
