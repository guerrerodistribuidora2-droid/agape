import { env } from "cloudflare:workers";
import { isAdminRequest } from "../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (!env.DB) return Response.json({ error: "La base de eventos no está disponible." }, { status: 503 });
  const { id } = await context.params;
  const result = await env.DB.prepare(
    "UPDATE events SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).bind(id).run();
  if (!result.meta.changes) return Response.json({ error: "No se encontró el evento." }, { status: 404 });
  return Response.json({ ok: true });
}
