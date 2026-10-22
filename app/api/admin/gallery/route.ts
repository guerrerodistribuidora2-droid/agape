import { env } from "cloudflare:workers";
import { isAdminRequest } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";
const maxBytes = 5 * 1024 * 1024;
const accepted = new Set(["image/jpeg", "image/png", "image/webp"]);
function sameOrigin(request: Request) { const origin = request.headers.get("origin"); return Boolean(origin && new URL(origin).origin === new URL(request.url).origin); }

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
  const rows = await env.DB.prepare("SELECT id, caption, alt_text, position, active FROM gallery_images ORDER BY position, created_at DESC").all<{ id: string; caption: string; alt_text: string; position: number; active: number }>();
  return Response.json({ images: rows.results.map((row) => ({ id: row.id, caption: row.caption, altText: row.alt_text, position: row.position, active: Boolean(row.active), imageUrl: `/api/public/gallery/${row.id}` })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!env.DB || !env.BUCKET) return Response.json({ error: "El almacenamiento de imágenes no está disponible." }, { status: 503 });
  const form = await request.formData();
  const image = form.get("image");
  const caption = String(form.get("caption") || "").trim().slice(0, 100);
  const altText = String(form.get("altText") || "").trim().slice(0, 180);
  if (!(image instanceof File) || image.size < 1 || image.size > maxBytes || !accepted.has(image.type) || !caption || !altText) return Response.json({ error: "Sube JPG, PNG o WebP de hasta 5 MB e indica su título y descripción." }, { status: 400 });
  const head = new Uint8Array(await image.slice(0, 12).arrayBuffer());
  const valid = image.type === "image/png" ? head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 : image.type === "image/jpeg" ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff : String.fromCharCode(...head.slice(0, 4)) === "RIFF" && String.fromCharCode(...head.slice(8, 12)) === "WEBP";
  if (!valid) return Response.json({ error: "El archivo no parece ser una imagen válida." }, { status: 400 });
  const id = crypto.randomUUID();
  await env.BUCKET.put(`gallery/${id}`, image.stream(), { httpMetadata: { contentType: image.type, cacheControl: "public, max-age=3600" } });
  const next = await env.DB.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM gallery_images").first<{ position: number }>();
  await env.DB.prepare("INSERT INTO gallery_images (id, caption, alt_text, storage_key, position, active) VALUES (?, ?, ?, ?, ?, 1)").bind(id, caption, altText, `gallery/${id}`, next?.position ?? 0).run();
  return Response.json({ id }, { status: 201 });
}
