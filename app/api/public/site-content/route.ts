import { env } from "@/lib/runtime-env";
import { getDatabase } from "../../../../lib/turso";

export const dynamic = "force-dynamic";
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

export async function GET() {
  const settings = { ...defaults };
  if (getDatabase(env)) {
    const rows = await getDatabase(env).prepare("SELECT key, value FROM site_settings").all<{ key: string; value: string }>();
    for (const row of rows.results) if (Object.hasOwn(settings, row.key)) settings[row.key] = row.value;
  }
  return Response.json({ settings }, { headers: { "Cache-Control": "public, max-age=60" } });
}
