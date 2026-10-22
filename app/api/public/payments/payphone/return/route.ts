import { env } from "cloudflare:workers";
import { getDatabase } from "../../../../../../lib/turso";
import { sendConfirmationEmail } from "../../../../../../lib/reservation-email";
import { ensurePaymentSchema } from "../../../../../../lib/payment-schema";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (getDatabase(env)) await ensurePaymentSchema(getDatabase(env));
  const clientTransactionId = url.searchParams.get("clientTransactionId") || "";
  const transactionId = url.searchParams.get("id") || "";
  if (!getDatabase(env) || !env.PAYPHONE_TOKEN || !/^[a-f0-9]{15}$/.test(clientTransactionId) || !/^\d{1,20}$/.test(transactionId)) return Response.redirect(new URL("/agape.html?payment=failed", url.origin), 303);
  const row = await getDatabase(env).prepare("SELECT id, reference, total_cents FROM reservations WHERE payment_client_transaction_id = ? AND payment_method = 'card'").bind(clientTransactionId).first<{ id: string; reference: string; total_cents: number }>();
  if (!row) return Response.redirect(new URL("/agape.html?payment=failed", url.origin), 303);
  try {
    const result = await fetch("https://pay.payphonetodoesposible.com/api/button/V2/Confirm", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PAYPHONE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(transactionId), clientTxId: clientTransactionId }),
      signal: AbortSignal.timeout(4500),
    });
    const confirmation = await result.json().catch(() => null) as { statusCode?: number; transactionId?: number; clientTransactionId?: string; amount?: number } | null;
    if (!result.ok || confirmation?.statusCode !== 3 || confirmation.clientTransactionId !== clientTransactionId || (confirmation.transactionId !== undefined && String(confirmation.transactionId) !== transactionId) || (confirmation.amount !== undefined && confirmation.amount !== row.total_cents)) {
      return Response.redirect(new URL(`/agape.html?payment=failed&ref=${encodeURIComponent(row.reference)}`, url.origin), 303);
    }
    await getDatabase(env).prepare("UPDATE reservations SET status = 'payment_confirmed', payment_provider_transaction_id = ? WHERE id = ?").bind(transactionId, row.id).run();
    try { await sendConfirmationEmail(row.id, url.origin); }
    catch { /* Payment remains verified; an administrator can retry the receipt email. */ }
    return Response.redirect(new URL(`/agape.html?payment=confirmed&ref=${encodeURIComponent(row.reference)}`, url.origin), 303);
  } catch {
    return Response.redirect(new URL(`/agape.html?payment=processing&ref=${encodeURIComponent(row.reference)}`, url.origin), 303);
  }
}
