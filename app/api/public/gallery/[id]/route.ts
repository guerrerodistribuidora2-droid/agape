import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!env.DB || !env.BUCKET) return new Response("No disponible", { status: 404 });
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT storage_key FROM gallery_images WHERE id = ? AND active = 1").bind(id).first<{ storage_key: string }>();
  if (!row) return new Response("No encontrado", { status: 404 });
  const object = await env.BUCKET.get(row.storage_key);
  if (!object) return new Response("No encontrado", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType || "application/octet-stream", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
