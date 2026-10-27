import { env } from "@/lib/runtime-env";
import type { ChatGPTUser } from "../app/chatgpt-auth";

const SESSION_COOKIE = "agape_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;
const encoder = new TextEncoder();

function encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function isOrganizer(email: string): boolean {
  const allowlist = (env.AGAPE_ADMIN_EMAILS ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}

export function organizerLabel(user: ChatGPTUser): string {
  return user.fullName ?? user.email;
}

export async function verifyAdminCredentials(username: string, password: string) {
  const expectedUser = env.AGAPE_ADMIN_USERNAME ?? "";
  const saltText = env.AGAPE_ADMIN_PASSWORD_SALT ?? "";
  const expectedHash = env.AGAPE_ADMIN_PASSWORD_HASH ?? "";
  if (!expectedUser || !saltText || !expectedHash || username.length > 100 || password.length > 1024) return false;
  const userMatch = constantTimeEqual(encoder.encode(username.trim()), encoder.encode(expectedUser));
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    // Cloudflare Workers caps Web Crypto PBKDF2 deriveBits at 100,000 iterations.
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: decode(saltText), iterations: 100_000, hash: "SHA-256" }, key, 256);
    return userMatch && constantTimeEqual(new Uint8Array(bits), decode(expectedHash));
  } catch {
    return false;
  }
}

async function signingKey() {
  const secret = env.AGAPE_ADMIN_SESSION_SECRET ?? "";
  if (secret.length < 32) return null;
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createAdminSessionCookie(username: string) {
  const key = await signingKey();
  if (!key) throw new Error("Falta configurar la sesión segura del panel.");
  const payload = encode(encoder.encode(JSON.stringify({ username, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  const signature = encode(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
  return `${SESSION_COOKIE}=${payload}.${signature}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export async function adminSessionFromCookie(cookieHeader: string | null) {
  const raw = cookieHeader?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!raw) return null;
  const [payload, signature, extra] = raw.split(".");
  if (!payload || !signature || extra) return null;
  const key = await signingKey();
  if (!key) return null;
  try {
    if (!await crypto.subtle.verify("HMAC", key, decode(signature), encoder.encode(payload))) return null;
    const data = JSON.parse(new TextDecoder().decode(decode(payload))) as { username?: unknown; exp?: unknown };
    if (data.username !== env.AGAPE_ADMIN_USERNAME || typeof data.exp !== "number" || data.exp <= Date.now() / 1000) return null;
    return { username: String(data.username) };
  } catch { return null; }
}

export async function isAdminRequest(request: Request) {
  if (await adminSessionFromCookie(request.headers.get("cookie"))) return true;
  const { getChatGPTUser } = await import("../app/chatgpt-auth");
  const user = await getChatGPTUser();
  return Boolean(user && isOrganizer(user.email));
}

export function clearAdminSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
