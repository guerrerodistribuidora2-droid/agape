import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.DB) {
    return Response.json({ error: "La base de eventos no está disponible." }, { status: 503 });
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
  }).format(new Date());
  const { results } = await env.DB.prepare(
    `SELECT id, title, venue, description, event_date, arrival_time, start_time,
            min_age, max_age, women_capacity, men_capacity,
            women_price_cents, men_price_cents, image_key
       FROM events
      WHERE status = 'published' AND event_date >= ?
      ORDER BY event_date ASC, start_time ASC`,
  )
    .bind(today)
    .all();

  const events = results.map((row) => ({
    id: row.id,
    title: row.title,
    venue: row.venue,
    description: row.description,
    eventDate: row.event_date,
    arrivalTime: row.arrival_time,
    startTime: row.start_time,
    minAge: row.min_age,
    maxAge: row.max_age,
    womenCapacity: row.women_capacity,
    menCapacity: row.men_capacity,
    womenPriceCents: row.women_price_cents,
    menPriceCents: row.men_price_cents,
    imageUrl: typeof row.image_key === "string" ? `/api/public/events/media/${row.id}` : null,
  }));

  return Response.json({ events }, { headers: { "Cache-Control": "no-store" } });
}
