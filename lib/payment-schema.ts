const additions = [
  ["payment_method", "TEXT"],
  ["payment_client_transaction_id", "TEXT"],
  ["payment_provider_transaction_id", "TEXT"],
  ["proof_storage_key", "TEXT"],
  ["proof_file_name", "TEXT"],
  ["proof_uploaded_at", "TEXT"],
  ["upload_token_hash", "TEXT"],
  ["confirmation_email_sent_at", "TEXT"],
  ["email_sending_at", "TEXT"],
  ["expires_at", "TEXT"],
] as const;

let ready: Promise<void> | null = null;
/** Additive compatibility for the live D1 database before a release migration is applied. */
export function ensurePaymentSchema(db: D1Database): Promise<void> {
  if (!ready) ready = (async () => {
    const columns = await db.prepare("PRAGMA table_info(reservations)").all<{ name: string }>();
    if (!columns.results?.length) throw new Error("La tabla de reservas no está disponible.");
    const present = new Set(columns.results.map((column) => column.name));
    for (const [name, type] of additions) {
      if (present.has(name)) continue;
      try { await db.prepare(`ALTER TABLE reservations ADD COLUMN ${name} ${type}`).run(); }
      catch {
        const refreshed = await db.prepare("PRAGMA table_info(reservations)").all<{ name: string }>();
        if (!refreshed.results?.some((column) => column.name === name)) throw new Error(`No se pudo actualizar el campo de pagos ${name}.`);
      }
    }
  })().catch((error) => { ready = null; throw error; });
  return ready;
}
