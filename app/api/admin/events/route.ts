import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../lib/turso";
import { isAdminRequest } from "../../../../lib/admin-auth";

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
  imageKey: string | null;
};

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === new URL(request.url).origin;
}

function parsePayload(value: unknown, id: string): EventPayload | null {
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
  const imageKey = data.imageKey === null || data.imageKey === undefined ? null : data.imageKey === id ? id : undefined;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && !Number.isNaN(Date.parse(`${eventDate}T12:00:00Z`));
  const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  if (
    !title || !venue || !validDate || !validTime(arrivalTime) || !validTime(startTime) ||
    minAge === null || maxAge === null || minAge > maxAge ||
    womenCapacity === null || menCapacity === null || womenPriceCents === null ||
    menPriceCents === null || !status || imageKey === undefined
  ) return null;

  return {
    title, venue, description, eventDate, arrivalTime, startTime,
    minAge, maxAge, womenCapacity, menCapacity,
    womenPriceCents, menPriceCents, status, imageKey,
  };
}

function values(payload: EventPayload) {
  return [
    payload.title, payload.venue, payload.description, payload.eventDate,
    payload.arrivalTime, payload.startTime, payload.minAge, payload.maxAge,
    payload.womenCapacity, payload.menCapacity, payload.womenPriceCents,
    payload.menPriceCents, payload.status, payload.imageKey,
  ];
}

async function readSubmission(request: Request) {
  if (!(request.headers.get("content-type") || "").includes("multipart/form-data")) {
    return { body: await request.json().catch(() => null) as Record<string, unknown> | null, image: null as File | null };
  }
  const form = await request.formData();
  const body = JSON.parse(String(form.get("payload") || "null")) as Record<string, unknown> | null;
  const file = form.get("image");
  return { body, image: file instanceof File && file.size ? file : null };
}

const maxImageBytes = 5 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function storeImage(image: File, id: string) {
  if (!acceptedImageTypes.has(image.type) || image.size > maxImageBytes) return "invalid";
  const bytes = new Uint8Array(await image.slice(0, 12).arrayBuffer());
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(image.type === "image/png" && png) && !(image.type === "image/jpeg" && jpeg) && !(image.type === "image/webp" && webp)) return "invalid";
  if (!env.BUCKET) return "unavailable";
  await env.BUCKET.put(`${id}/cover`, image.stream(), {
    httpMetadata: { contentType: image.type, cacheControl: "public, max-age=3600" },
  });
  return `${id}/cover`;
}

function eventImageUrl(key: unknown) {
  return typeof key === "string" && key ? `/api/public/events/media/${key.split("/")[0]}` : null;
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  const db = getDatabase(env);
  if (!db) return Response.json({ error: "La base de eventos no está disponible." }, { status: 503 });

  const { results } = await db.prepare(
    `SELECT id, title, venue, description, event_date, arrival_time, start_time,
            min_age, max_age, women_capacity, men_capacity,
            women_price_cents, men_price_cents, status, image_key, created_at, updated_at,
            COALESCE(paid.confirmed_seats, 0) AS confirmed_seats
       FROM events
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS confirmed_seats
           FROM reservations
          WHERE status IN ('payment_confirmed', 'approved')
          GROUP BY event_id
       ) paid ON paid.event_id = events.id
      ORDER BY events.event_date ASC, events.start_time ASC`,
  ).all();
  const events = results.map((row) => ({
    id: row.id, title: row.title, venue: row.venue, description: row.description,
    eventDate: row.event_date, arrivalTime: row.arrival_time, startTime: row.start_time,
    minAge: row.min_age, maxAge: row.max_age, womenCapacity: row.women_capacity,
    menCapacity: row.men_capacity, womenPriceCents: row.women_price_cents,
    menPriceCents: row.men_price_cents, status: row.status, imageUrl: eventImageUrl(row.image_key),
    confirmedSeats: Number(row.confirmed_seats || 0),
    createdAt: row.created_at, updatedAt: row.updated_at,
  }));
  return Response.json({ events }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const db = getDatabase(env);
  if (!db) return Response.json({ error: "La base de eventos no está disponible." }, { status: 503 });

  const { body, image } = await readSubmission(request);
  if (body?.action === "seed_demo") {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
    const base = new Date(`${today}T12:00:00Z`);
    const samples = [
      { key: "bolera", title: "DEMO · La Bolera · Jueves", days: 14, minAge: 30, maxAge: 45, capacity: 12, price: 3000 },
      { key: "sobremesa", title: "DEMO · Conversaciones de sábado", days: 21, minAge: 40, maxAge: 55, capacity: 12, price: 2800 },
      { key: "noches", title: "DEMO · Noches por edades", days: 28, minAge: 25, maxAge: 37, capacity: 18, price: 2500 },
    ];
    const existing = await db.prepare("SELECT title FROM events WHERE title LIKE 'DEMO · %'").all<{ title: string }>();
    const existingTitles = new Set(existing.results.map((row) => row.title));
    let created = 0;
    for (const sample of samples) {
      if (existingTitles.has(sample.title)) continue;
      const date = new Date(base);
      date.setUTCDate(date.getUTCDate() + sample.days);
      await db.prepare(
        `INSERT INTO events (id, title, venue, description, event_date, arrival_time,
          start_time, min_age, max_age, women_capacity, men_capacity,
          women_price_cents, men_price_cents, status, image_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL)`,
      ).bind(
        crypto.randomUUID(), sample.title, "Quito · sede por confirmar",
        "BORRADOR DE EJEMPLO: reemplaza fecha, sede, descripción y portada antes de publicar.",
        date.toISOString().slice(0, 10), "19:00", "19:30", sample.minAge,
        sample.maxAge, sample.capacity, sample.capacity, sample.price, sample.price,
      ).run();
      created += 1;
    }
    return Response.json({ created, message: created ? `${created} borradores de ejemplo creados. No son visibles para clientes.` : "Los borradores de ejemplo ya existen." }, { status: 201 });
  }
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : crypto.randomUUID();
  const payload = parsePayload(body, id);
  if (!payload) return Response.json({ error: "Revisa los campos del evento." }, { status: 400 });
  if (image) {
    const stored = await storeImage(image, id);
    if (stored === "invalid") return Response.json({ error: "La imagen debe ser JPG, PNG o WebP y pesar máximo 5 MB." }, { status: 400 });
    if (stored === "unavailable") return Response.json({ error: "El almacenamiento de imágenes no está disponible." }, { status: 503 });
    payload.imageKey = id;
  }
  await db.prepare(
    `INSERT INTO events (id, title, venue, description, event_date, arrival_time,
      start_time, min_age, max_age, women_capacity, men_capacity,
      women_price_cents, men_price_cents, status, image_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, ...values(payload)).run();
  return Response.json({ id }, { status: 201 });
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const db = getDatabase(env);
  if (!db) return Response.json({ error: "La base de eventos no está disponible." }, { status: 503 });

  const { body, image } = await readSubmission(request);
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : "";
  const payload = id ? parsePayload(body, id) : null;
  if (!id || !payload) return Response.json({ error: "Revisa los campos del evento." }, { status: 400 });
  const previous = await db.prepare("SELECT image_key FROM events WHERE id = ?").bind(id).first<{ image_key: string | null }>();
  if (image) {
    const stored = await storeImage(image, id);
    if (stored === "invalid") return Response.json({ error: "La imagen debe ser JPG, PNG o WebP y pesar máximo 5 MB." }, { status: 400 });
    if (stored === "unavailable") return Response.json({ error: "El almacenamiento de imágenes no está disponible." }, { status: 503 });
    payload.imageKey = id;
  }
  const result = await db.prepare(
    `UPDATE events SET title = ?, venue = ?, description = ?, event_date = ?,
      arrival_time = ?, start_time = ?, min_age = ?, max_age = ?, women_capacity = ?,
      men_capacity = ?, women_price_cents = ?, men_price_cents = ?, status = ?,
      image_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).bind(...values(payload), id).run();
  if (!result.meta.changes) return Response.json({ error: "No se encontró el evento." }, { status: 404 });
  const bucket = env.BUCKET;
  if (previous?.image_key && payload.imageKey === null && bucket) await bucket.delete(previous.image_key);
  return Response.json({ ok: true });
}
