import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../lib/turso";
import { getCapacity } from "../../../../lib/turso";
import { ensurePaymentSchema } from "../../../../lib/payment-schema";

export const dynamic = "force-dynamic";
const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const db = getDatabase(env);
  if (!db) return Response.json({ error: "Las reservas no están disponibles por el momento." }, { status: 503 });
  await ensurePaymentSchema(db);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || body.consentAccepted !== true) return Response.json({ error: "Autoriza el tratamiento de datos para continuar." }, { status: 400 });
  const text = (key: string, max: number) => typeof body[key] === "string" ? body[key].trim().slice(0, max) : "";
  const eventId = text("eventId", 64);
  const name = text("name", 120);
  const age = Number(body.age);
  const gender = text("gender", 20);
  const phone = text("phone", 40);
  const email = text("email", 200).toLowerCase();
  const social = text("social", 120);
  const cedula = text("cedula", 10).replace(/\D/g, "");
  const cocktail = text("cocktail", 80);
  const intention = text("intention", 80);
  const couponCode = text("couponCode", 24).toUpperCase() || null;
  if (!eventId || !name || !Number.isInteger(age) || age < 18 || age > 100 || !["Mujer", "Hombre", "Otro"].includes(gender) || phone.replace(/\D/g, "").length < 7 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{10}$/.test(cedula) || !cocktail || !intention) return Response.json({ error: "Revisa los datos obligatorios del formulario." }, { status: 400 });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
  const event = await db.prepare("SELECT title, event_date, min_age, max_age, women_capacity, men_capacity, women_price_cents, men_price_cents FROM events WHERE id = ? AND status = 'published'").bind(eventId).first<{ title: string; event_date: string; min_age: number; max_age: number; women_capacity: number; men_capacity: number; women_price_cents: number; men_price_cents: number }>();
  if (!event || event.event_date < today) return Response.json({ error: "Esta fecha ya no recibe solicitudes." }, { status: 404 });
  if (age < event.min_age || age > event.max_age) return Response.json({ error: "Tu edad no corresponde al rango de esta edición." }, { status: 400 });
  const capacity = gender === "Hombre" ? event.men_capacity : event.women_capacity;
  const used = await getCapacity(db, eventId, gender);
  if (used >= capacity) return Response.json({ error: "Este cupo ya se completó. Elige otra fecha." }, { status: 409 });

  let totalCents = Math.max(0, Number(gender === "Hombre" ? event.men_price_cents : event.women_price_cents));
  if (couponCode) {
    const coupon = await db.prepare("SELECT discount_type, amount, starts_at, ends_at, max_uses, used_count FROM coupons WHERE code = ? AND active = 1").bind(couponCode).first<{ discount_type: string; amount: number; starts_at: string | null; ends_at: string | null; max_uses: number | null; used_count: number }>();
    if (!coupon || (coupon.starts_at && coupon.starts_at > today) || (coupon.ends_at && coupon.ends_at < today) || (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)) return Response.json({ error: "El cupón ya no es válido." }, { status: 400 });
    const reduction = coupon.discount_type === "percent" ? Math.round(totalCents * coupon.amount / 10000) : coupon.amount;
    totalCents = Math.max(0, totalCents - reduction);
  }

  const id = crypto.randomUUID();
  const reference = `AG-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const uploadToken = [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const uploadTokenHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(uploadToken)).then((hash) => [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join(""));
  try {
    await db.prepare(`INSERT INTO reservations (id, reference, event_id, name, age, gender, phone, email, social, cedula, cocktail, intention, coupon_code, total_cents, status, upload_token_hash, consent_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, CURRENT_TIMESTAMP, datetime('now', '+15 minutes'))`)
      .bind(id, reference, eventId, name, age, gender, phone, email, social, cedula, cocktail, intention, couponCode, totalCents, uploadTokenHash).run();
    if (couponCode) await db.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?").bind(couponCode).run();
  } catch { return Response.json({ error: "No se pudo guardar la solicitud. Inténtalo nuevamente." }, { status: 500 }); }
  return Response.json({ reference, uploadToken, totalCents, status: "pending_payment" }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
