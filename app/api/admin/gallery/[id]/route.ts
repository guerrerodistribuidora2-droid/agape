import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../../lib/turso";
import { isAdminRequest } from "../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const db = getDatabase(env);
  if (!db) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  const { id } = await context.params;
  const row = await db.prepare("SELECT storage_key FROM gallery_images WHERE id = ?").bind(id).first<{ storage_key: string }>();
  if (!row) return Response.json({ error: "No se encontró la imagen." }, { status: 404 });
  await db.prepare("DELETE FROM gallery_images WHERE id = ?").bind(id).run();
  const bucket = env.BUCKET;
  if (bucket) await bucket.delete(row.storage_key);
  return Response.json({ ok: true });
}
