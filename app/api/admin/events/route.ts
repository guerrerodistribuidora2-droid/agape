import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isOrganizer } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

type EventPayload = {
  title: string;
  venue: string;
  description: string;
  eventDate: string;
  arrivalTime: string;
  startTime: string;
  minAge: number;
  maxAge: number;
  womenCapacity: number;
  menCapacity: number;
  womenPriceCents: number;
  menPriceCents: number;
  status: "draft" | "published";
};

async function authorized() {
  const user = await getChatGPTUser();
  return user && isOrganizer(user.email) ? user : null;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === new URL(request.url).origin;
}

function parsePayload(value: unknown): EventPayload | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const text = (key: string, max: number) =>
    typeof data[key] === "string" ? data[key].trim().slice(0, max) : "";
  const number = (key: string, min: number, max: number) => {
    const n = Number(data[key]);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const title = text("title", 100);
  const venue = text("venue", 120);
  const description = text("description", 500);
  const eventDate = text("eventDate", 10);
  const arrivalTime = text("arrivalTime", 5);
  const startTime = text("startTime", 5);
  const minAge = number("minAge", 18, 99);
  const maxAge = number("maxAge", 18, 99);
  const womenCapacity = number("womenCapacity", 0, 5000);
  const menCapacity = number("menCapacity", 0, 5000);
  const womenPriceCents = number("womenPriceCents", 0, 10000000);
  const menPriceCents = number("menPriceCents", 0, 10000000);
  const status = data.status === "published" ? "published" : data.status === "draft" ? "draft" : null;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && !Number.isNaN(Date.parse(`${eventDate}T12:00:00Z`));
  const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  if (
    !title || !venue || !validDate || !validTime(arrivalTime) || !validTime(startTime) ||
    minAge === null || maxAge === null || minAge > maxAge ||
    womenCapacity === null || menCapacity === null || womenPriceCents === null ||
    menPriceCents === null || !status
  ) return null;

  return {
    title, venue, description, eventDate, arrivalTime, startTime,
    minAge, maxAge, womenCapacity, menCapacity,
    womenPriceCents, menPriceCents, status,
  };
}

function values(payload: EventPayload) {
  return [
    payload.title, payload.venue, payload.description, payload.eventDate,
    payload.arrivalTime, payload.startTime, payload.minAge, payload.maxAge,
    payload.womenCapacity, payload.menCapacity, payload.womenPriceCents,
    payload.menPriceCents, payload.status,
  ];
}

export async function GET() {
  if (!(await authorized())) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "La base de eventos no está disponible." }, { status: 503 });

  const { results } = await env.DB.prepare(
    `SELECT id, title, venue, description, event_date, arrival_time, start_time,
            min_age, max_age, women_capacity, men_capacity,
            women_price_cents, men_price_cents, status, created_at, updated_at
       FROM events ORDER BY event_date ASC, start_time ASC`,
  ).all();
  const events = results.map((row) => ({
    id: row.id, title: row.title, venue: row.venue, description: row.description,
    eventDate: row.event_date, arrivalTime: row.arrival_time, startTime: row.start_time,
    minAge: row.min_age, maxAge: row.max_age, womenCapacity: row.women_capacity,
    menCapacity: row.men_capacity, womenPriceCents: row.women_price_cents,
    menPriceCents: row.men_price_cents, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }));
  return Response.json({ events }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await authorized())) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "La base de eventos no está disponible." }, { status: 503 });

  const payload = parsePayload(await request.json().catch(() => null));
  if (!payload) return Response.json({ error: "Revisa los campos del evento." }, { status: 400 });
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO events (id, title, venue, description, event_date, arrival_time,
      start_time, min_age, max_age, women_capacity, men_capacity,
      women_price_cents, men_price_cents, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, ...values(payload)).run();
  return Response.json({ id }, { status: 201 });
}

export async function PUT(request: Request) {
  if (!(await authorized())) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "La base de eventos no está disponible." }, { status: 503 });

  const body = await request.json().catch(() => null) as (Record<string, unknown> | null);
  const id = typeof body?.id === "string" ? body.id : "";
  const payload = parsePayload(body);
  if (!id || !payload) return Response.json({ error: "Revisa los campos del evento." }, { status: 400 });
  const result = await env.DB.prepare(
    `UPDATE events SET title = ?, venue = ?, description = ?, event_date = ?,
      arrival_time = ?, start_time = ?, min_age = ?, max_age = ?, women_capacity = ?,
      men_capacity = ?, women_price_cents = ?, men_price_cents = ?, status = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).bind(...values(payload), id).run();
  if (!result.meta.changes) return Response.json({ error: "No se encontró el evento." }, { status: 404 });
  return Response.json({ ok: true });
}
