import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../../../lib/turso";
import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { isOrganizer } from "../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!getDatabase(env) || !env.BUCKET) return new Response("No disponible", { status: 404 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });
  const row = await getDatabase(env).prepare("SELECT image_key, status FROM events WHERE id = ?")
    .bind(id).first<{ image_key: string | null; status: string }>();
  if (!row?.image_key || row.image_key !== `${id}/cover`) return new Response("No encontrado", { status: 404 });
  if (row.status !== "published") {
    const user = await getChatGPTUser();
    if (!user || !isOrganizer(user.email)) return new Response("No encontrado", { status: 404 });
  }
  const image = await env.BUCKET.get(row.image_key);
  if (!image) return new Response("No encontrado", { status: 404 });
  return new Response(image.body, {
    headers: {
      "Content-Type": image.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
