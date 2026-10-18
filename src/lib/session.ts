import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "easypanel_control";

export type Connection = { baseUrl: string; token: string };

// Stable in local development so Fast Refresh does not invalidate a connection.
// Production still requires SESSION_SECRET; without it, sessions expire on restart.
const fallbackSecret = process.env.NODE_ENV === "development"
  ? "orbit-panel-local-development-session-key-v1"
  : randomBytes(32).toString("hex");
const key = createHash("sha256")
  .update(process.env.SESSION_SECRET || fallbackSecret)
  .digest();

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
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(connection), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted].map((item) => item.toString("base64url")).join(".");
}

export function decryptConnection(value: string): Connection | null {
  try {
    const [iv, tag, encrypted] = value.split(".").map((item) => Buffer.from(item, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

export async function getConnection(): Promise<Connection | null> {
  if (process.env.EASYPANEL_URL && (process.env.EASYPANEL_API_KEY || process.env.EASYPANEL_TOKEN)) {
    return {
      baseUrl: normalizeBaseUrl(process.env.EASYPANEL_URL),
      token: process.env.EASYPANEL_API_KEY || process.env.EASYPANEL_TOKEN || "",
    };
  }
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value ? decryptConnection(value) : null;
}
