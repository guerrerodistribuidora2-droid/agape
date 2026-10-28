import { createHash } from "node:crypto";
import { env } from "@/lib/runtime-env";
import { getDatabase } from "@/lib/turso";
import { clearAdminSessionCookie, hashAdminPassword } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  const db = getDatabase(env);
  if (!db || !env.AGAPE_ADMIN_USERNAME) return Response.json({ error: "El servicio no está disponible." }, { status: 503, headers });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || password.length < 4 || password.length > 1024) return Response.json({ error: "Enlace o contraseña no válidos. La contraseña debe tener al menos 4 caracteres." }, { status: 400, headers });
  const hash = createHash("sha256").update(token).digest("hex");
  const credential = await hashAdminPassword(password);
  const consumed = await db.prepare("DELETE FROM admin_password_tokens WHERE username = ? AND token_hash = ? AND expires_at > CURRENT_TIMESTAMP RETURNING username").bind(env.AGAPE_ADMIN_USERNAME, hash).first();
  if (!consumed) return Response.json({ error: "El enlace ya se utilizó o venció. Solicita otro." }, { status: 400, headers });
  await db.prepare(`INSERT INTO admin_credentials(username,salt,password_hash,version,updated_at) VALUES (?,?,?,1,CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash,version=admin_credentials.version+1,updated_at=CURRENT_TIMESTAMP`).bind(env.AGAPE_ADMIN_USERNAME, credential.salt, credential.hash).run();
  return Response.json({ message: "Contraseña actualizada. Inicia sesión nuevamente." }, { headers: { ...headers, "Set-Cookie": clearAdminSessionCookie() } });
}
