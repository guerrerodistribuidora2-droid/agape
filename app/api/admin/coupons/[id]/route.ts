import { env } from "cloudflare:workers";
import { getDatabase } from "../../../../../lib/turso";
import { isAdminRequest } from "../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!getDatabase(env)) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  const { id } = await context.params;
  await getDatabase(env).prepare("UPDATE coupons SET active = 0 WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}
