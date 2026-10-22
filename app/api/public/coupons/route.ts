import { env } from "cloudflare:workers";
import { getDatabase } from "../../../../lib/turso";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!getDatabase(env)) return Response.json({ error: "La validación no está disponible." }, { status: 503 });
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").trim().toUpperCase();
  const subtotal = Number(url.searchParams.get("subtotal"));
  if (!/^[A-Z0-9_-]{3,24}$/.test(code) || !Number.isInteger(subtotal) || subtotal < 0) return Response.json({ error: "El código no es válido." }, { status: 400 });
  const coupon = await getDatabase(env).prepare("SELECT discount_type, amount, starts_at, ends_at, max_uses, used_count FROM coupons WHERE code = ? AND active = 1").bind(code).first<{ discount_type: string; amount: number; starts_at: string | null; ends_at: string | null; max_uses: number | null; used_count: number }>();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
  if (!coupon || (coupon.starts_at && coupon.starts_at > today) || (coupon.ends_at && coupon.ends_at < today) || (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)) return Response.json({ error: "El cupón no existe, venció o agotó sus usos." }, { status: 404 });
  const discountCents = Math.min(subtotal, coupon.discount_type === "percent" ? Math.round(subtotal * coupon.amount / 10000) : coupon.amount);
  return Response.json({ code, discountCents }, { headers: { "Cache-Control": "no-store" } });
}
