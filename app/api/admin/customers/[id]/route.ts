import { env } from "cloudflare:workers";
import { isAdminRequest } from "../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";
const statuses = new Set(["pending_payment", "payment_review", "payment_confirmed", "approved", "declined", "cancelled", "refunded"]);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (typeof body?.status !== "string" || !statuses.has(body.status)) return Response.json({ error: "Estado no válido." }, { status: 400 });
  const result = await env.DB.prepare("UPDATE reservations SET status = ? WHERE id = ?").bind(body.status, id).run();
  if (!result.meta.changes) return Response.json({ error: "No se encontró la solicitud." }, { status: 404 });
  return Response.json({ ok: true });
}
