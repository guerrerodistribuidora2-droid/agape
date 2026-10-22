import { env } from "cloudflare:workers";
import { makeTicketUrl } from "../../../../../lib/reservation-email";

export const dynamic = "force-dynamic";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  if (!env.DB) return new Response("Servicio no disponible.", { status: 503 });
  const { reference } = await context.params;
  const url = new URL(request.url);
  const expected = await makeTicketUrl(reference, url.origin);
  const expectedSig = new URL(expected).searchParams.get("sig");
  if (!expectedSig || url.searchParams.get("sig") !== expectedSig) return new Response("Pase no válido.", { status: 403 });
  const row = await env.DB.prepare(`SELECT r.reference, r.status, e.title AS event_title, e.event_date, e.venue, e.arrival_time FROM reservations r LEFT JOIN events e ON e.id = r.event_id WHERE r.reference = ?`).bind(reference).first<{ reference: string; status: string; event_title: string | null; event_date: string | null; venue: string | null; arrival_time: string | null }>();
  if (!row || !["payment_confirmed", "approved"].includes(row.status)) return new Response("Este pase todavía no está activo.", { status: 404 });
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pase Ágape · ${escapeHtml(row.reference)}</title><style>body{margin:0;background:#0c0607;color:#f4e9db;font:16px/1.6 Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.card{width:min(90vw,480px);padding:34px;border:1px solid #805d2a;border-radius:20px;background:#190a0c;text-align:center}small{letter-spacing:.22em;color:#d9b45e}h1{font:38px Georgia,serif;color:#d9b45e;margin:12px 0}p{color:#c5b6a8}.ref{margin-top:28px;padding:14px;border:1px solid #55341e;border-radius:10px;letter-spacing:.14em}</style><main class="card"><small>ÁGAPE · CONEXIÓN HUMANA REAL</small><h1>Pase confirmado</h1><p>${escapeHtml(row.event_title || "Noche Ágape")}</p><p>${escapeHtml(row.event_date || "")} · ${escapeHtml(row.arrival_time || "")}<br>${escapeHtml(row.venue || "Quito")}</p><div class="ref">${escapeHtml(row.reference)}</div><p>Presenta este código QR adjunto en tu correo junto con tu cédula.</p></main></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
