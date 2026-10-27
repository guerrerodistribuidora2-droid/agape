import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../lib/turso";
import { isAdminRequest } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";
const allowed = new Set(["contact_email", "whatsapp_number", "instagram_url", "bank_primary", "bank_other", "hero_title", "hero_lede", "agenda_intro", "story_title", "story_text", "closing_title"]);
const defaults: Record<string, string> = {
  contact_email: "eventosagape.ec@gmail.com",
  whatsapp_number: "593994239868",
  instagram_url: "https://www.instagram.com/agape.experiencias/",
  bank_primary: "Banco: Pichincha\nCuenta: 2210975691 (Ahorros)\nTitular: Miguel Vega\nRUC / Cédula: 1725423774\nConfirmar a: miguelangel26278@gmail.com",
  bank_other: "Produbanco · Cuenta Digital\nNúmero: 20003680663 · Titular: Miguel Ángel Vega\nRUC: 1725423774 · Correo: miguelangel26278@gmail.com · Celular: 0981898561\n\nBanco Guayaquil · Ahorros 0019775679\nCorreo: miguelangel26278@gmail.com · CI: 1725423774 · SWIFT: GUAYECEG",
  hero_title: "Que la conexión vuelva a sentirse.",
  hero_lede: "Una mesa compartida. Una conversación que empieza sin deslizar. Una noche para encontrarte con personas de verdad.",
  agenda_intro: "Cada edición tiene su propia energía, grupo de edad y aforo cuidado. Elige una noche que se sienta como tú.",
  story_title: "La conexión sucede cuando nos encontramos.",
  story_text: "Una mesa, una bienvenida cálida y espacio para que la conversación encuentre su ritmo.",
  closing_title: "La próxima conversación puede empezar aquí.",
};

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  const db = getDatabase(env);
  if (!db) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  const rows = await db.prepare("SELECT key, value FROM site_settings").all<{ key: string; value: string }>();
  const settings = { ...defaults };
  for (const row of rows.results) if (allowed.has(row.key)) settings[row.key] = row.value;
  return Response.json({ settings }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const db = getDatabase(env);
  if (!db) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Object.keys(body).some((key) => !allowed.has(key))) return Response.json({ error: "Contenido no válido." }, { status: 400 });
  const statements = Object.entries(body).map(([key, raw]) => {
    if (typeof raw !== "string" || raw.length > (key.startsWith("bank_") ? 5000 : 250)) throw new Error("El contenido supera el límite permitido.");
    return db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(key, raw.trim());
  });
  try { if (statements.length) await db.batch(statements); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "No se pudo guardar." }, { status: 400 }); }
  return Response.json({ ok: true });
}
