import { env } from "cloudflare:workers";
import { ensurePaymentSchema } from "../../../../../../lib/payment-schema";

export const dynamic = "force-dynamic";
const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
};
async function hash(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  await ensurePaymentSchema(env.DB);
  if (!env.PAYPHONE_TOKEN || !env.PAYPHONE_STORE_ID) return Response.json({ error: "El pago con tarjeta aún no está conectado." }, { status: 503 });
  const body = await request.json().catch(() => null) as { reference?: unknown; uploadToken?: unknown } | null;
  const reference = typeof body?.reference === "string" ? body.reference.slice(0, 40) : "";
  const uploadToken = typeof body?.uploadToken === "string" ? body.uploadToken : "";
  if (!reference || !/^[a-f0-9]{64}$/.test(uploadToken)) return Response.json({ error: "No se pudo validar la orden." }, { status: 400 });
  const row = await env.DB.prepare("SELECT id, total_cents, status, upload_token_hash FROM reservations WHERE reference = ?").bind(reference).first<{ id: string; total_cents: number; status: string; upload_token_hash: string | null }>();
  if (!row || !row.upload_token_hash || await hash(uploadToken) !== row.upload_token_hash) return Response.json({ error: "No se pudo validar la orden." }, { status: 403 });
  if (!Number.isSafeInteger(row.total_cents) || row.total_cents <= 0 || !["pending_payment", "payment_review"].includes(row.status)) return Response.json({ error: "Esta orden no puede iniciar un nuevo pago." }, { status: 409 });
  const origin = new URL(request.url).origin;
  const clientTransactionId = [...crypto.getRandomValues(new Uint8Array(8))].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 15);
  await env.DB.prepare("UPDATE reservations SET payment_method = 'card', payment_client_transaction_id = ? WHERE id = ?").bind(clientTransactionId, row.id).run();
  const response = await fetch("https://pay.payphonetodoesposible.com/api/button/Prepare", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.PAYPHONE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: row.total_cents,
      amountWithoutTax: row.total_cents,
      amountWithTax: 0,
      tax: 0,
      service: 0,
      tip: 0,
      currency: "USD",
      clientTransactionId,
      reference,
      storeId: env.PAYPHONE_STORE_ID,
      responseUrl: `${origin}/api/public/payments/payphone/return`,
      cancellationUrl: `${origin}/agape.html?payment=cancelled&ref=${encodeURIComponent(reference)}`,
    }),
  });
  const result = await response.json().catch(() => null) as { payWithCard?: unknown } | null;
  if (!response.ok || typeof result?.payWithCard !== "string") return Response.json({ error: "PayPhone no pudo crear el pago. Puedes reintentar o usar transferencia." }, { status: 502 });
  let cardUrl: URL;
  try { cardUrl = new URL(result.payWithCard); } catch { return Response.json({ error: "PayPhone devolvió un enlace de pago inválido." }, { status: 502 }); }
  if (cardUrl.protocol !== "https:" || !["pay.payphonetodoesposible.com", "checkout.payphonetodoesposible.com"].includes(cardUrl.hostname)) return Response.json({ error: "PayPhone devolvió un enlace de pago no autorizado." }, { status: 502 });
  return Response.json({ payWithCard: cardUrl.toString() }, { headers: { "Cache-Control": "no-store" } });
}
