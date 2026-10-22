import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.DB) return Response.json({ images: [] });
  const rows = await env.DB.prepare("SELECT id, caption, alt_text, position FROM gallery_images WHERE active = 1 ORDER BY position, created_at DESC LIMIT 12").all<{ id: string; caption: string; alt_text: string; position: number }>();
  return Response.json({ images: rows.results.map((row) => ({ ...row, imageUrl: `/api/public/gallery/${row.id}` })) }, { headers: { "Cache-Control": "public, max-age=60" } });
}
