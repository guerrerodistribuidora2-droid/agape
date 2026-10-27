import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../../lib/turso";
import { isAdminRequest } from "../../../../../lib/admin-auth";
import { sendConfirmationEmail } from "../../../../../lib/reservation-email";
import { ensurePaymentSchema } from "../../../../../lib/payment-schema";

export const dynamic = "force-dynamic";
const statuses = new Set(["pending_payment", "payment_review", "payment_confirmed", "approved", "declined", "expired", "cancelled", "refunded"]);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!getDatabase(env)) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  await ensurePaymentSchema(getDatabase(env));
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { status?: unknown; action?: unknown } | null;
  if (body?.action === "resend_confirmation") {
    await getDatabase(env).prepare("UPDATE reservations SET confirmation_email_sent_at = NULL, email_sending_at = NULL WHERE id = ? AND status IN ('payment_confirmed', 'approved')").bind(id).run();
    try {
      const result = await sendConfirmationEmail(id, new URL(request.url).origin);
      return Response.json({ ok: true, emailSent: true, alreadySent: result.alreadySent });
    } catch (error) {
      return Response.json({ ok: false, emailSent: false, error: error instanceof Error ? error.message : "No se pudo enviar el correo." }, { status: 502 });
    }
  }
  if (typeof body?.status !== "string" || !statuses.has(body.status)) return Response.json({ error: "Estado no válido." }, { status: 400 });
  const result = await getDatabase(env).prepare("UPDATE reservations SET status = ? WHERE id = ?").bind(body.status, id).run();
  if (!result.meta.changes) return Response.json({ error: "No se encontró la solicitud." }, { status: 404 });
  if (["payment_confirmed", "approved"].includes(body.status)) {
    try {
      const email = await sendConfirmationEmail(id, new URL(request.url).origin);
      return Response.json({ ok: true, emailSent: email.sent, alreadySent: email.alreadySent });
    } catch (error) {
      return Response.json({ ok: true, emailSent: false, emailError: error instanceof Error ? error.message : "No se pudo enviar el correo." });
    }
  }
  return Response.json({ ok: true, emailSent: false });
}
