import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../lib/turso";
import { occupancyPercent } from "../../../../lib/turso";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!getDatabase(env)) {
    return Response.json({ error: "La base de eventos no está disponible." }, { status: 503 });
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
  }).format(new Date());
  const { results } = await getDatabase(env).prepare(
    `SELECT id, title, venue, description, event_date, arrival_time, start_time,
            min_age, max_age, women_capacity, men_capacity,
            women_price_cents, men_price_cents, image_key,
            COALESCE(paid.confirmed_seats, 0) AS confirmed_seats
       FROM events
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS confirmed_seats
           FROM reservations
          WHERE status IN ('payment_confirmed', 'approved')
          GROUP BY event_id
       ) paid ON paid.event_id = events.id
      WHERE events.status = 'published' AND events.event_date >= ?
      ORDER BY events.event_date ASC, events.start_time ASC`,
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
    totalCapacity: Number(row.women_capacity || 0) + Number(row.men_capacity || 0),
    confirmedSeats: Number(row.confirmed_seats || 0),
    occupancyPercent: occupancyPercent(Number(row.confirmed_seats || 0), Number(row.women_capacity || 0) + Number(row.men_capacity || 0)),
    imageUrl: typeof row.image_key === "string" ? `/api/public/events/media/${row.id}` : null,
  }));

  return Response.json({ events }, { headers: { "Cache-Control": "no-store" } });
}
