import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../../../lib/turso";
import { ensurePaymentSchema } from "../../../../../../lib/payment-schema";

export const dynamic = "force-dynamic";
const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
};
async function sha256(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function allowed(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/webp") return String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  if (type === "application/pdf") return String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
  return false;
}
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const db = getDatabase(env);
  const bucket = env.BUCKET;
  if (!db || !bucket) return Response.json({ error: "La carga de comprobantes no está disponible." }, { status: 503 });
  await ensurePaymentSchema(db);
  const { reference } = await context.params;
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("uploadToken") || "");
  const file = form?.get("proof");
  if (!/^[a-f0-9]{64}$/.test(token) || !(file instanceof File)) return Response.json({ error: "Falta el comprobante o el permiso temporal de carga." }, { status: 400 });
  if (file.size < 1 || file.size > 10 * 1024 * 1024) return Response.json({ error: "El archivo debe pesar hasta 10 MB." }, { status: 400 });
  const reservation = await db.prepare("SELECT id, status, upload_token_hash FROM reservations WHERE reference = ?").bind(reference).first<{ id: string; status: string; upload_token_hash: string | null }>();
  if (!reservation || !reservation.upload_token_hash || await sha256(token) !== reservation.upload_token_hash) return Response.json({ error: "No se pudo validar esta orden. Vuelve a iniciar la solicitud." }, { status: 403 });
  if (["payment_confirmed", "approved", "cancelled", "refunded"].includes(reservation.status)) return Response.json({ error: "Esta orden no puede recibir un comprobante en su estado actual." }, { status: 409 });
  const type = file.type.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!allowed(bytes, type)) return Response.json({ error: "El contenido no coincide con un JPG, PNG, WebP o PDF válido." }, { status: 415 });
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as Record<string, string>)[type];
  const key = `receipts/${reservation.id}/${crypto.randomUUID()}.${extension}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: type } });
  try {
    await db.prepare("UPDATE reservations SET payment_method = 'transfer', proof_storage_key = ?, proof_file_name = ?, proof_uploaded_at = CURRENT_TIMESTAMP, status = 'payment_review' WHERE id = ?")
      .bind(key, file.name.replace(/[\\/\0-\x1f]/g, "_").slice(0, 180) || `comprobante.${extension}`, reservation.id).run();
  } catch (error) {
    await bucket.delete(key);
    throw error;
  }
  return Response.json({ ok: true, status: "payment_review" }, { headers: { "Cache-Control": "no-store" } });
}
