import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../lib/turso";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { ensurePaymentSchema } from "../../../../lib/payment-schema";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!getDatabase(env)) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  await ensurePaymentSchema(getDatabase(env));
  const rows = await getDatabase(env).prepare(`SELECT r.id, r.reference, r.event_id, r.name, r.age, r.gender, r.phone, r.email, r.social, r.cedula, r.cocktail, r.intention, r.coupon_code, r.total_cents, r.status, r.created_at, r.payment_method, r.payment_provider_transaction_id, r.proof_storage_key, r.proof_file_name, r.proof_uploaded_at, r.confirmation_email_sent_at, e.title AS event_title, e.event_date
    FROM reservations r LEFT JOIN events e ON e.id = r.event_id ORDER BY r.created_at DESC LIMIT 500`).all<Record<string, unknown>>();
  return Response.json({ customers: rows.results.map((r) => ({ id:r.id, reference:r.reference, eventId:r.event_id, eventTitle:r.event_title, eventDate:r.event_date, name:r.name, age:r.age, gender:r.gender, phone:r.phone, email:r.email, social:r.social, cedula:r.cedula, cocktail:r.cocktail, intention:r.intention, couponCode:r.coupon_code, totalCents:r.total_cents, status:r.status, createdAt:r.created_at, paymentMethod:r.payment_method, providerTransactionId:r.payment_provider_transaction_id, hasReceipt:Boolean(r.proof_storage_key), receiptFileName:r.proof_file_name, proofUploadedAt:r.proof_uploaded_at, confirmationEmailSentAt:r.confirmation_email_sent_at })) }, { headers: { "Cache-Control": "no-store" } });
}
