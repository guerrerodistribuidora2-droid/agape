import { clearAdminSessionCookie, createAdminSessionCookie, verifyAdminCredentials } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; since: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (body?.action === "logout") {
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearAdminSessionCookie(), "Cache-Control": "no-store" } });
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const previous = attempts.get(ip);
  const state = !previous || now - previous.since > WINDOW_MS ? { count: 0, since: now } : previous;
  if (state.count >= MAX_ATTEMPTS) return Response.json({ error: "Demasiados intentos. Espera 15 minutos e inténtalo nuevamente." }, { status: 429 });

  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!await verifyAdminCredentials(username, password)) {
    attempts.set(ip, { count: state.count + 1, since: state.since });
    return Response.json({ error: "Usuario o contraseña incorrectos." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  attempts.delete(ip);
  return Response.json({ ok: true }, {
    headers: { "Set-Cookie": await createAdminSessionCookie(username.trim()), "Cache-Control": "no-store" },
  });
}
