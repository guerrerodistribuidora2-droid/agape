import { env } from "@/lib/runtime-env";
import { getDatabase } from "./turso";
import QRCode from "qrcode";
import { ensurePaymentSchema } from "./payment-schema";

type Reservation = { reference: string; name: string; email: string; total_cents: number; status: string; event_title: string | null; event_date: string | null; venue: string | null; arrival_time: string | null };

function hex(bytes: Uint8Array) { return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function signature(reference: string) {
  if (!env.AGAPE_TICKET_SIGNING_SECRET) throw new Error("Falta configurar la firma segura de los pases.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.AGAPE_TICKET_SIGNING_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(reference))));
}
function base64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
export async function makeTicketUrl(reference: string, origin?: string) {
  const base = (origin || env.SITE_BASE_URL || "https://agape-noches.bsgp-17.chatgpt.site").replace(/\/$/, "");
  return `${base}/api/public/tickets/${encodeURIComponent(reference)}?sig=${await signature(reference)}`;
}

export async function sendConfirmationEmail(reservationId: string, origin?: string) {
  const db = getDatabase(env);
  if (!db) throw new Error("La base de datos no está disponible.");
  await ensurePaymentSchema(db);
  if (!env.RESEND_API_KEY || !env.AGAPE_EMAIL_FROM) throw new Error("El correo aún no está conectado. Configura el proveedor y el remitente verificado.");
  const claim = await db.prepare(`UPDATE reservations SET email_sending_at = CURRENT_TIMESTAMP WHERE id = ? AND confirmation_email_sent_at IS NULL AND (email_sending_at IS NULL OR email_sending_at < datetime('now', '-10 minutes'))`).bind(reservationId).run();
  if (!claim.meta.changes) {
    const current = await db.prepare("SELECT confirmation_email_sent_at FROM reservations WHERE id = ?").bind(reservationId).first<{ confirmation_email_sent_at: string | null }>();
    if (current?.confirmation_email_sent_at) return { sent: true, alreadySent: true };
    throw new Error("Ya se está preparando este correo. Espera un momento e inténtalo de nuevo.");
  }
  try {
    const row = await db.prepare(`SELECT r.reference, r.name, r.email, r.total_cents, r.status, e.title AS event_title, e.event_date, e.venue, e.arrival_time FROM reservations r LEFT JOIN events e ON e.id = r.event_id WHERE r.id = ?`).bind(reservationId).first<Reservation>();
    if (!row) throw new Error("No se encontró la reserva.");
    if (!["payment_confirmed", "approved"].includes(row.status)) throw new Error("Confirma el pago antes de emitir el pase.");
    const ticketUrl = await makeTicketUrl(row.reference, origin);
    const png = new Uint8Array(await QRCode.toBuffer(ticketUrl, { type: "png", width: 420, margin: 2, errorCorrectionLevel: "M" }));
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.AGAPE_EMAIL_FROM,
        to: [row.email],
        subject: `Tu pase Ágape · ${row.reference}`,
        html: `<div style="font-family:Arial,sans-serif;color:#2b1a13;line-height:1.6"><h1 style="color:#a77b2b">Tu pago está confirmado</h1><p>Hola ${escapeHtml(row.name)}, tu reserva para <b>${escapeHtml(row.event_title || "una noche Ágape")}</b> está confirmada.</p><p>${escapeHtml(row.event_date || "")} · ${escapeHtml(row.arrival_time || "")} · ${escapeHtml(row.venue || "Quito")}</p><p>Referencia: <b>${escapeHtml(row.reference)}</b> · Total pagado: <b>$${(row.total_cents / 100).toFixed(2)}</b></p><p>Presenta el código QR adjunto en la entrada. Es personal y válido solo para esta edición.</p><p><a href="${ticketUrl}" style="color:#8b6423">Abrir pase digital</a></p><p>Ágape · Conexión humana real</p></div>`,
        attachments: [{ filename: `pase-agape-${row.reference}.png`, content: base64(png) }],
      }),
    });
    if (!result.ok) {
      const detail = await result.json().catch(() => ({})) as { message?: string };
      throw new Error(detail.message || "El proveedor de correo rechazó el envío.");
    }
    await db.prepare("UPDATE reservations SET confirmation_email_sent_at = CURRENT_TIMESTAMP, email_sending_at = NULL WHERE id = ?").bind(reservationId).run();
    return { sent: true, alreadySent: false };
  } catch (error) {
    await db.prepare("UPDATE reservations SET email_sending_at = NULL WHERE id = ?").bind(reservationId).run();
    throw error;
  }
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
