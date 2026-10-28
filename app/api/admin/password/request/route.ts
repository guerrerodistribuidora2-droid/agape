import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/runtime-env";
import { getDatabase } from "@/lib/turso";
import { adminSessionFromCookie, verifyAdminCredentials } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
const message = "Si la solicitud corresponde al administrador, recibirás un enlace en el correo de recuperación.";
const error = (text: string, status: number) => Response.json({ error: text }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return error("Origen no permitido.", 403);
  const db = getDatabase(env);
  if (!db || !env.RESEND_API_KEY || !env.AGAPE_EMAIL_FROM || !env.AGAPE_ADMIN_RECOVERY_EMAIL || !env.SITE_BASE_URL || !env.AGAPE_ADMIN_USERNAME) {
    return error("La recuperación por correo todavía no está configurada. Contacta al propietario.", 503);
  }
  let base: URL;
  try {
    base = new URL(env.SITE_BASE_URL);
    if (base.protocol !== "https:" || base.username || base.password) throw new Error("invalid");
  } catch { return error("La recuperación por correo todavía no está configurada.", 503); }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (body.mode === "change") {
    const session = await adminSessionFromCookie(request.headers.get("cookie"));
    const password = typeof body.password === "string" ? body.password : "";
    if (!session || !await verifyAdminCredentials(session.username, password)) return error("Revisa tu contraseña actual.", 401);
    if (session.username !== username) return error("No se pudo verificar el usuario.", 401);
  } else if (body.mode !== "recover") return error("Solicitud no válida.", 400);
  if (username !== env.AGAPE_ADMIN_USERNAME) return Response.json({ message }, { headers: { "Cache-Control": "no-store" } });

  const rate = await db.prepare(`INSERT INTO admin_password_rate(username,last_request_at) VALUES (?, CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET last_request_at = CURRENT_TIMESTAMP
    WHERE last_request_at <= datetime('now', '-60 seconds') RETURNING username`).bind(username).first();
  if (!rate) return error("Espera un minuto antes de solicitar otro enlace.", 429);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db.prepare(`INSERT INTO admin_password_tokens(username,token_hash,expires_at,created_at) VALUES (?,?,datetime('now','+20 minutes'),CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,created_at=excluded.created_at`).bind(username, tokenHash).run();
  const link = new URL("/admin/restablecer", base.origin);
  link.hash = token;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.AGAPE_EMAIL_FROM, to: [env.AGAPE_ADMIN_RECOVERY_EMAIL], subject: "Ágape · Recuperar acceso al administrador", html: `<p>Se solicitó cambiar la contraseña del panel Ágape.</p><p><a href="${link.href}">Elegir una nueva contraseña</a></p><p>Este enlace vence en 20 minutos y solo se puede usar una vez. Si no solicitaste el cambio, ignora este mensaje.</p>` }),
    });
    if (!response.ok) throw new Error("mail unavailable");
  } catch {
    await db.prepare("DELETE FROM admin_password_tokens WHERE username = ? AND token_hash = ?").bind(username, tokenHash).run();
    return error("No se pudo enviar el correo. Inténtalo más tarde.", 503);
  }
  return Response.json({ message }, { headers: { "Cache-Control": "no-store" } });
}
