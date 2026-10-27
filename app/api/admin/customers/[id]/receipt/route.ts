import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../../../lib/turso";
import { isAdminRequest } from "../../../../../../lib/admin-auth";
import { ensurePaymentSchema } from "../../../../../../lib/payment-schema";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  const db = getDatabase(env);
  const bucket = env.BUCKET;
  if (!db || !bucket) return Response.json({ error: "El comprobante no está disponible." }, { status: 503 });
  await ensurePaymentSchema(db);
  const { id } = await context.params;
  const row = await db.prepare("SELECT proof_storage_key, proof_file_name FROM reservations WHERE id = ?").bind(id).first<{ proof_storage_key: string | null; proof_file_name: string | null }>();
  if (!row?.proof_storage_key) return Response.json({ error: "Esta solicitud no tiene comprobante." }, { status: 404 });
  const object = await bucket.get(row.proof_storage_key);
  if (!object) return Response.json({ error: "El archivo ya no está disponible." }, { status: 404 });
  const type = object.httpMetadata?.contentType;
  if (!type || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(type)) return Response.json({ error: "Tipo de archivo no permitido." }, { status: 415 });
  return new Response(object.body, { headers: { "Content-Type": type, "Content-Disposition": `inline; filename="${(row.proof_file_name || "comprobante").replace(/["\\\r\n]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
