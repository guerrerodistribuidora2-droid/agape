import { env } from "cloudflare:workers";
import { getDatabase } from "../../../../lib/turso";
import { isAdminRequest } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";
function sameOrigin(request: Request) { const origin = request.headers.get("origin"); return Boolean(origin && new URL(origin).origin === new URL(request.url).origin); }

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!getDatabase(env)) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  const rows = await getDatabase(env).prepare("SELECT id, code, discount_type, amount, active, starts_at, ends_at, max_uses, used_count FROM coupons ORDER BY created_at DESC").all<Record<string, unknown>>();
  return Response.json({ coupons: rows.results.map((r) => ({ id:r.id, code:r.code, discountType:r.discount_type, amount:r.amount, active:Boolean(r.active), startsAt:r.starts_at, endsAt:r.ends_at, maxUses:r.max_uses, usedCount:r.used_count })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!getDatabase(env)) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const type = body?.discountType;
  const amount = Number(body?.amount);
  const maxUses = body?.maxUses === "" || body?.maxUses == null ? null : Number(body.maxUses);
  const startsAt = typeof body?.startsAt === "string" && body.startsAt ? body.startsAt : null;
  const endsAt = typeof body?.endsAt === "string" && body.endsAt ? body.endsAt : null;
  if (!/^[A-Z0-9_-]{3,24}$/.test(code) || (type !== "percent" && type !== "fixed") || !Number.isInteger(amount) || amount < 1 || (type === "percent" && amount > 10000) || (type === "fixed" && amount > 10000000) || (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1))) return Response.json({ error: "Revisa el código y el descuento." }, { status: 400 });
  const id = crypto.randomUUID();
  try {
    await getDatabase(env).prepare("INSERT INTO coupons (id, code, discount_type, amount, starts_at, ends_at, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, code, type, amount, startsAt, endsAt, maxUses).run();
  } catch { return Response.json({ error: "Ese código ya existe." }, { status: 409 }); }
  return Response.json({ id }, { status: 201 });
}
