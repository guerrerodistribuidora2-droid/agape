import { createClient, type Client, type InStatement, type Value } from "@libsql/client/web";

type RuntimeEnv = Cloudflare.Env & { TURSO_DATABASE_URL?: string; TURSO_AUTH_TOKEN?: string };
type LegacyResult<T = Record<string, unknown>> = { results: T[]; success: true; meta: { changes: number; last_row_id: number | null; duration: number } };
type BoundStatement = { sql: string; args: Value[] };

let client: Client | null = null;
let initialized: Promise<void> | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS app_events (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, venue TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', event_date TEXT NOT NULL, arrival_time TEXT NOT NULL, start_time TEXT NOT NULL, min_age INTEGER NOT NULL, max_age INTEGER NOT NULL, women_capacity INTEGER NOT NULL DEFAULT 0, men_capacity INTEGER NOT NULL DEFAULT 0, women_price_cents INTEGER NOT NULL DEFAULT 0, men_price_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, image_key TEXT)`,
  `CREATE TABLE IF NOT EXISTS app_coupons (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, discount_type TEXT NOT NULL, amount INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, starts_at TEXT, ends_at TEXT, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS app_reservations (id TEXT PRIMARY KEY NOT NULL, reference TEXT NOT NULL UNIQUE, event_id TEXT NOT NULL, name TEXT NOT NULL, age INTEGER NOT NULL, gender TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, social TEXT NOT NULL DEFAULT '', cedula TEXT NOT NULL, cocktail TEXT NOT NULL, intention TEXT NOT NULL, coupon_code TEXT, total_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending_payment', consent_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, payment_method TEXT, payment_client_transaction_id TEXT, payment_provider_transaction_id TEXT, proof_storage_key TEXT, proof_file_name TEXT, proof_uploaded_at TEXT, upload_token_hash TEXT, confirmation_email_sent_at TEXT, email_sending_at TEXT, expires_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS gallery_images (id TEXT PRIMARY KEY NOT NULL, caption TEXT NOT NULL DEFAULT '', alt_text TEXT NOT NULL DEFAULT 'Imagen de una noche Ágape', storage_key TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS agape_schema_migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS app_reservations_event_status_idx ON app_reservations(event_id, status)`,
  `CREATE INDEX IF NOT EXISTS app_reservations_expiry_idx ON app_reservations(status, expires_at)`,
  `CREATE INDEX IF NOT EXISTS app_events_status_date_idx ON app_events(status, event_date)`,
  `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, venue TEXT NOT NULL, date TEXT NOT NULL, times TEXT NOT NULL, min_age INTEGER NOT NULL CHECK(min_age >= 0), max_age INTEGER NOT NULL CHECK(max_age >= min_age), total_capacity INTEGER NOT NULL CHECK(total_capacity >= 0), price REAL NOT NULL CHECK(price >= 0), description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('DRAFT','PUBLISHED','COMPLETED','CANCELLED')), cover_image_r2_url TEXT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, women_capacity INTEGER NOT NULL DEFAULT 0, men_capacity INTEGER NOT NULL DEFAULT 0, women_price_cents INTEGER NOT NULL DEFAULT 0, men_price_cents INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS coupons (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, discount_type TEXT NOT NULL CHECK(discount_type IN ('PERCENTAGE','FIXED')), discount_value REAL NOT NULL CHECK(discount_value >= 0), valid_until DATETIME, max_uses INTEGER CHECK(max_uses IS NULL OR max_uses >= 0), uses_count INTEGER NOT NULL DEFAULT 0 CHECK(uses_count >= 0), is_active BOOLEAN NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)))`,
  `CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, event_id TEXT NOT NULL REFERENCES events(id), coupon_id TEXT REFERENCES coupons(id), name TEXT NOT NULL, age INTEGER NOT NULL CHECK(age >= 0), gender TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, social_user TEXT NOT NULL DEFAULT '', national_id TEXT NOT NULL, cocktail_choice TEXT NOT NULL, intent TEXT NOT NULL, final_price REAL NOT NULL CHECK(final_price >= 0), consent_accepted BOOLEAN NOT NULL CHECK(consent_accepted IN (0,1)), status TEXT NOT NULL CHECK(status IN ('PENDING_PAYMENT','PAYMENT_REVIEW','CONFIRMED','REJECTED','EXPIRED','CANCELLED','REFUNDED')), expires_at DATETIME, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY NOT NULL, reservation_id TEXT NOT NULL REFERENCES reservations(id), method TEXT NOT NULL CHECK(method IN ('TRANSFER','CARD')), transaction_ref TEXT, receipt_r2_url TEXT, amount REAL NOT NULL CHECK(amount >= 0), status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED','REFUNDED')), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY NOT NULL, user_id TEXT, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, details TEXT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS reservations_event_status_idx ON reservations(event_id, status, expires_at)`,
  `CREATE INDEX IF NOT EXISTS payments_reservation_idx ON payments(reservation_id, created_at)`,
  `CREATE TRIGGER IF NOT EXISTS mirror_event_insert AFTER INSERT ON app_events BEGIN INSERT INTO events(id,name,venue,date,times,min_age,max_age,total_capacity,price,description,status,cover_image_r2_url,created_at,women_capacity,men_capacity,women_price_cents,men_price_cents) VALUES(NEW.id,NEW.title,NEW.venue,NEW.event_date,NEW.arrival_time||' · '||NEW.start_time,NEW.min_age,NEW.max_age,NEW.women_capacity+NEW.men_capacity,MAX(NEW.women_price_cents,NEW.men_price_cents)/100.0,NEW.description,CASE NEW.status WHEN 'published' THEN 'PUBLISHED' WHEN 'completed' THEN 'COMPLETED' WHEN 'cancelled' THEN 'CANCELLED' ELSE 'DRAFT' END,CASE WHEN NEW.image_key IS NULL THEN NULL ELSE 'r2://'||NEW.image_key END,NEW.created_at,NEW.women_capacity,NEW.men_capacity,NEW.women_price_cents,NEW.men_price_cents) ON CONFLICT(id) DO UPDATE SET name=excluded.name,venue=excluded.venue,date=excluded.date,times=excluded.times,min_age=excluded.min_age,max_age=excluded.max_age,total_capacity=excluded.total_capacity,price=excluded.price,description=excluded.description,status=excluded.status,cover_image_r2_url=excluded.cover_image_r2_url,women_capacity=excluded.women_capacity,men_capacity=excluded.men_capacity,women_price_cents=excluded.women_price_cents,men_price_cents=excluded.men_price_cents; END`,
  `CREATE TRIGGER IF NOT EXISTS mirror_event_update AFTER UPDATE ON app_events BEGIN INSERT INTO events(id,name,venue,date,times,min_age,max_age,total_capacity,price,description,status,cover_image_r2_url,created_at,women_capacity,men_capacity,women_price_cents,men_price_cents) VALUES(NEW.id,NEW.title,NEW.venue,NEW.event_date,NEW.arrival_time||' · '||NEW.start_time,NEW.min_age,NEW.max_age,NEW.women_capacity+NEW.men_capacity,MAX(NEW.women_price_cents,NEW.men_price_cents)/100.0,NEW.description,CASE NEW.status WHEN 'published' THEN 'PUBLISHED' WHEN 'completed' THEN 'COMPLETED' WHEN 'cancelled' THEN 'CANCELLED' ELSE 'DRAFT' END,CASE WHEN NEW.image_key IS NULL THEN NULL ELSE 'r2://'||NEW.image_key END,NEW.created_at,NEW.women_capacity,NEW.men_capacity,NEW.women_price_cents,NEW.men_price_cents) ON CONFLICT(id) DO UPDATE SET name=excluded.name,venue=excluded.venue,date=excluded.date,times=excluded.times,min_age=excluded.min_age,max_age=excluded.max_age,total_capacity=excluded.total_capacity,price=excluded.price,description=excluded.description,status=excluded.status,cover_image_r2_url=excluded.cover_image_r2_url,women_capacity=excluded.women_capacity,men_capacity=excluded.men_capacity,women_price_cents=excluded.women_price_cents,men_price_cents=excluded.men_price_cents; END`,
  `CREATE TRIGGER IF NOT EXISTS mirror_coupon_insert AFTER INSERT ON app_coupons BEGIN INSERT INTO coupons(id,code,discount_type,discount_value,valid_until,max_uses,uses_count,is_active) VALUES(NEW.id,NEW.code,CASE NEW.discount_type WHEN 'percent' THEN 'PERCENTAGE' ELSE 'FIXED' END,CASE NEW.discount_type WHEN 'percent' THEN NEW.amount/100.0 ELSE NEW.amount/100.0 END,NEW.ends_at,NEW.max_uses,NEW.used_count,NEW.active) ON CONFLICT(id) DO UPDATE SET code=excluded.code,discount_type=excluded.discount_type,discount_value=excluded.discount_value,valid_until=excluded.valid_until,max_uses=excluded.max_uses,uses_count=excluded.uses_count,is_active=excluded.is_active; END`,
  `CREATE TRIGGER IF NOT EXISTS mirror_coupon_update AFTER UPDATE ON app_coupons BEGIN INSERT INTO coupons(id,code,discount_type,discount_value,valid_until,max_uses,uses_count,is_active) VALUES(NEW.id,NEW.code,CASE NEW.discount_type WHEN 'percent' THEN 'PERCENTAGE' ELSE 'FIXED' END,NEW.amount/100.0,NEW.ends_at,NEW.max_uses,NEW.used_count,NEW.active) ON CONFLICT(id) DO UPDATE SET code=excluded.code,discount_type=excluded.discount_type,discount_value=excluded.discount_value,valid_until=excluded.valid_until,max_uses=excluded.max_uses,uses_count=excluded.uses_count,is_active=excluded.is_active; END`,
  `CREATE TRIGGER IF NOT EXISTS mirror_reservation_insert AFTER INSERT ON app_reservations BEGIN INSERT INTO reservations(id,code,event_id,coupon_id,name,age,gender,phone,email,social_user,national_id,cocktail_choice,intent,final_price,consent_accepted,status,expires_at,created_at) VALUES(NEW.id,NEW.reference,NEW.event_id,(SELECT id FROM app_coupons WHERE code=NEW.coupon_code),NEW.name,NEW.age,NEW.gender,NEW.phone,NEW.email,NEW.social,NEW.cedula,NEW.cocktail,NEW.intention,NEW.total_cents/100.0,CASE WHEN NEW.consent_at IS NULL OR NEW.consent_at='' THEN 0 ELSE 1 END,CASE NEW.status WHEN 'payment_review' THEN 'PAYMENT_REVIEW' WHEN 'payment_confirmed' THEN 'CONFIRMED' WHEN 'approved' THEN 'CONFIRMED' WHEN 'declined' THEN 'REJECTED' WHEN 'expired' THEN 'EXPIRED' WHEN 'cancelled' THEN 'CANCELLED' WHEN 'refunded' THEN 'REFUNDED' ELSE 'PENDING_PAYMENT' END,COALESCE(NEW.expires_at,datetime(NEW.created_at,'+15 minutes')),NEW.created_at) ON CONFLICT(id) DO UPDATE SET code=excluded.code,event_id=excluded.event_id,coupon_id=excluded.coupon_id,name=excluded.name,age=excluded.age,gender=excluded.gender,phone=excluded.phone,email=excluded.email,social_user=excluded.social_user,national_id=excluded.national_id,cocktail_choice=excluded.cocktail_choice,intent=excluded.intent,final_price=excluded.final_price,consent_accepted=excluded.consent_accepted,status=excluded.status,expires_at=excluded.expires_at; INSERT INTO payments(id,reservation_id,method,transaction_ref,receipt_r2_url,amount,status) SELECT 'legacy-'||NEW.id,NEW.id,CASE WHEN NEW.payment_method='card' THEN 'CARD' ELSE 'TRANSFER' END,COALESCE(NEW.payment_provider_transaction_id,NEW.payment_client_transaction_id),CASE WHEN NEW.proof_storage_key IS NULL THEN NULL ELSE 'r2://'||NEW.proof_storage_key END,NEW.total_cents/100.0,CASE WHEN NEW.status IN ('payment_confirmed','approved') THEN 'APPROVED' WHEN NEW.status='refunded' THEN 'REFUNDED' WHEN NEW.status='declined' THEN 'REJECTED' ELSE 'PENDING' END WHERE NEW.payment_method IS NOT NULL OR NEW.proof_storage_key IS NOT NULL ON CONFLICT(id) DO UPDATE SET method=excluded.method,transaction_ref=excluded.transaction_ref,receipt_r2_url=excluded.receipt_r2_url,amount=excluded.amount,status=excluded.status; END`,
  `CREATE TRIGGER IF NOT EXISTS mirror_reservation_update AFTER UPDATE ON app_reservations BEGIN INSERT INTO reservations(id,code,event_id,coupon_id,name,age,gender,phone,email,social_user,national_id,cocktail_choice,intent,final_price,consent_accepted,status,expires_at,created_at) VALUES(NEW.id,NEW.reference,NEW.event_id,(SELECT id FROM app_coupons WHERE code=NEW.coupon_code),NEW.name,NEW.age,NEW.gender,NEW.phone,NEW.email,NEW.social,NEW.cedula,NEW.cocktail,NEW.intention,NEW.total_cents/100.0,CASE WHEN NEW.consent_at IS NULL OR NEW.consent_at='' THEN 0 ELSE 1 END,CASE NEW.status WHEN 'payment_review' THEN 'PAYMENT_REVIEW' WHEN 'payment_confirmed' THEN 'CONFIRMED' WHEN 'approved' THEN 'CONFIRMED' WHEN 'declined' THEN 'REJECTED' WHEN 'expired' THEN 'EXPIRED' WHEN 'cancelled' THEN 'CANCELLED' WHEN 'refunded' THEN 'REFUNDED' ELSE 'PENDING_PAYMENT' END,COALESCE(NEW.expires_at,datetime(NEW.created_at,'+15 minutes')),NEW.created_at) ON CONFLICT(id) DO UPDATE SET code=excluded.code,event_id=excluded.event_id,coupon_id=excluded.coupon_id,name=excluded.name,age=excluded.age,gender=excluded.gender,phone=excluded.phone,email=excluded.email,social_user=excluded.social_user,national_id=excluded.national_id,cocktail_choice=excluded.cocktail_choice,intent=excluded.intent,final_price=excluded.final_price,consent_accepted=excluded.consent_accepted,status=excluded.status,expires_at=excluded.expires_at; INSERT INTO payments(id,reservation_id,method,transaction_ref,receipt_r2_url,amount,status) SELECT 'legacy-'||NEW.id,NEW.id,CASE WHEN NEW.payment_method='card' THEN 'CARD' ELSE 'TRANSFER' END,COALESCE(NEW.payment_provider_transaction_id,NEW.payment_client_transaction_id),CASE WHEN NEW.proof_storage_key IS NULL THEN NULL ELSE 'r2://'||NEW.proof_storage_key END,NEW.total_cents/100.0,CASE WHEN NEW.status IN ('payment_confirmed','approved') THEN 'APPROVED' WHEN NEW.status IN ('declined','refunded') THEN CASE WHEN NEW.status='refunded' THEN 'REFUNDED' ELSE 'REJECTED' END ELSE 'PENDING' END WHERE NEW.payment_method IS NOT NULL OR NEW.proof_storage_key IS NOT NULL ON CONFLICT(id) DO UPDATE SET method=excluded.method,transaction_ref=excluded.transaction_ref,receipt_r2_url=excluded.receipt_r2_url,amount=excluded.amount,status=excluded.status; INSERT INTO audit_logs(id,user_id,action,target_type,target_id,details) SELECT lower(hex(randomblob(16))),'system','reservation_status_changed','reservation',NEW.id,NEW.status WHERE OLD.status IS NOT NEW.status; END`,
];

function getClient(env: RuntimeEnv): Client | null {
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) return null;
  if (!client) client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
  return client;
}

async function ensureSchema(db: Client) {
  await db.batch(schemaStatements.map((sql) => ({ sql, args: [] })), "write");
}

async function tableRows(db: D1Database, table: string): Promise<Array<Record<string, unknown>>> {
  try {
    const result = await db.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>();
    return result.results || [];
  } catch {
    return [];
  }
}

async function migrateD1Once(db: Client, source?: D1Database) {
  const marker = await db.execute("SELECT id FROM agape_schema_migrations WHERE id = 'd1_to_turso_v1'");
  if (marker.rows.length || !source) return;
  const columns = await source.prepare("PRAGMA table_info(reservations)").all<{ name: string }>().catch(() => ({ results: [] } as { results: { name: string }[] }));
  if (columns.results.length) {
    const present = new Set(columns.results.map((column) => column.name));
    const additions: Array<[string, string]> = [
      ["payment_method", "TEXT"], ["payment_client_transaction_id", "TEXT"], ["payment_provider_transaction_id", "TEXT"],
      ["proof_storage_key", "TEXT"], ["proof_file_name", "TEXT"], ["proof_uploaded_at", "TEXT"], ["upload_token_hash", "TEXT"],
      ["confirmation_email_sent_at", "TEXT"], ["email_sending_at", "TEXT"],
    ];
    for (const [name, type] of additions) if (!present.has(name)) await source.prepare(`ALTER TABLE reservations ADD COLUMN ${name} ${type}`).run();
  }
  for (const table of ["events", "coupons", "reservations", "gallery_images", "site_settings"]) {
    const rows = await tableRows(source, table);
    for (let offset = 0; offset < rows.length; offset += 40) {
      const statements: InStatement[] = rows.slice(offset, offset + 40).map((row) => {
        const entries = Object.entries(row).filter(([key]) => key !== "expires_at");
        const names = entries.map(([key]) => key);
        const values = entries.map(([, value]) => value === undefined ? null : value as Value);
        let placeholders = names.map(() => "?").join(",");
        if (table === "reservations") {
          names.push("expires_at");
          values.push((row.created_at || null) as Value);
          placeholders += ",datetime(?, '+15 minutes')";
        }
        return { sql: `INSERT OR IGNORE INTO ${(["events","coupons","reservations"].includes(table) ? `app_${table}` : table)} (${names.join(",")}) VALUES (${placeholders})`, args: values };
      });
      if (statements.length) await db.batch(statements, "write");
    }
  }
  await db.execute("INSERT OR IGNORE INTO agape_schema_migrations(id) VALUES ('d1_to_turso_v1')");
}

export function getDatabase(env: RuntimeEnv): D1Database | undefined {
  const db = getClient(env);
  if (!db) return env.DB;
  if (!initialized) initialized = (async () => {
    await ensureSchema(db);
    await migrateD1Once(db, env.DB);
  })().catch((error) => { initialized = null; throw error; });
  const ready = () => initialized || Promise.resolve();
  const mapLegacySql = (sql: string) => sql.replace(/\b(events|coupons|reservations)\b/g, "app_$1");
  return {
    prepare(sql: string) {
      let args: Value[] = [];
      const statement: BoundStatement = { sql: mapLegacySql(sql), args };
      const api = {
        get sql() { return statement.sql; },
        get args() { return statement.args; },
        get statement() { return statement; },
        bind(...values: unknown[]) { args = values.map((value) => value as Value); statement.args = args; return api; },
        async run() {
          await ready();
          const result = await db.execute({ sql: statement.sql, args: statement.args });
          return { success: true, meta: { changes: result.rowsAffected, last_row_id: result.lastInsertRowid ? Number(result.lastInsertRowid) : null, duration: 0 } };
        },
        async all<T = Record<string, unknown>>() {
          await ready();
          const result = await db.execute({ sql: statement.sql, args: statement.args });
          return { results: result.rows as unknown as T[], success: true, meta: { changes: result.rowsAffected, last_row_id: result.lastInsertRowid ? Number(result.lastInsertRowid) : null, duration: 0 } } as LegacyResult<T>;
        },
        async first<T = Record<string, unknown>>(column?: string) {
          await ready();
          const result = await db.execute({ sql: statement.sql, args: statement.args });
          const row = result.rows[0] as unknown as T | undefined;
          return column && row && typeof row === "object" ? (row as Record<string, unknown>)[column] as T : row ?? null;
        },
      };
      return api;
    },
    async batch(statements: Array<{ sql?: string; bind?: (...args: unknown[]) => unknown }>) {
      await ready();
      const normalized = statements.map((item) => {
        const bound = item as unknown as { statement?: BoundStatement; sql?: string; args?: Value[] };
        if (bound.statement) return { sql: bound.statement.sql, args: bound.statement.args };
        return { sql: bound.sql || "", args: bound.args || [] };
      });
      return db.batch(normalized, "write");
    },
  } as unknown as D1Database;
}

export async function getCapacity(db: D1Database, eventId: string, gender?: string) {
  await db.prepare("UPDATE reservations SET status = 'expired' WHERE status = 'pending_payment' AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP").run();
  const sql = `SELECT COUNT(*) AS used FROM reservations WHERE event_id = ? AND (status IN ('payment_confirmed','approved') OR (status='pending_payment' AND expires_at > CURRENT_TIMESTAMP))${gender ? " AND gender = ?" : ""}`;
  const query = db.prepare(sql).bind(...(gender ? [eventId, gender] : [eventId]));
  const result = await query.first<{ used: number }>();
  return Number(result?.used || 0);
}

export function occupancyPercent(confirmed: number, totalCapacity: number) {
  if (totalCapacity <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(confirmed / totalCapacity * 100)));
}
