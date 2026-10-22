CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  date TEXT NOT NULL,
  times TEXT NOT NULL,
  min_age INTEGER NOT NULL CHECK (min_age >= 0),
  max_age INTEGER NOT NULL CHECK (max_age >= min_age),
  total_capacity INTEGER NOT NULL CHECK (total_capacity >= 0),
  price REAL NOT NULL CHECK (price >= 0),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED')),
  cover_image_r2_url TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  women_capacity INTEGER NOT NULL DEFAULT 0,
  men_capacity INTEGER NOT NULL DEFAULT 0,
  women_price_cents INTEGER NOT NULL DEFAULT 0,
  men_price_cents INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
  discount_value REAL NOT NULL CHECK (discount_value >= 0),
  valid_until DATETIME,
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses >= 0),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL REFERENCES events(id),
  coupon_id TEXT REFERENCES coupons(id),
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 0),
  gender TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  social_user TEXT NOT NULL DEFAULT '',
  national_id TEXT NOT NULL,
  cocktail_choice TEXT NOT NULL,
  intent TEXT NOT NULL,
  final_price REAL NOT NULL CHECK (final_price >= 0),
  consent_accepted BOOLEAN NOT NULL CHECK (consent_accepted IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('PENDING_PAYMENT', 'PAYMENT_REVIEW', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'REFUNDED')),
  expires_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  reservation_id TEXT NOT NULL REFERENCES reservations(id),
  method TEXT NOT NULL CHECK (method IN ('TRANSFER', 'CARD')),
  transaction_ref TEXT,
  receipt_r2_url TEXT,
  amount REAL NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS reservations_event_status_idx ON reservations(event_id, status, expires_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payments_reservation_idx ON payments(reservation_id, created_at);
