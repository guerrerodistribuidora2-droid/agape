import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  venue: text("venue").notNull(),
  description: text("description").notNull().default(""),
  imageKey: text("image_key"),
  eventDate: text("event_date").notNull(),
  arrivalTime: text("arrival_time").notNull(),
  startTime: text("start_time").notNull(),
  minAge: integer("min_age").notNull(),
  maxAge: integer("max_age").notNull(),
  womenCapacity: integer("women_capacity").notNull().default(0),
  menCapacity: integer("men_capacity").notNull().default(0),
  womenPriceCents: integer("women_price_cents").notNull().default(0),
  menPriceCents: integer("men_price_cents").notNull().default(0),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const galleryImages = sqliteTable("gallery_images", {
  id: text("id").primaryKey(),
  caption: text("caption").notNull().default(""),
  altText: text("alt_text").notNull().default("Imagen de una noche Ágape"),
  storageKey: text("storage_key").notNull(),
  position: integer("position").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const coupons = sqliteTable("coupons", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(),
  amount: integer("amount").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const reservations = sqliteTable("reservations", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  eventId: text("event_id").notNull(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  social: text("social").notNull().default(""),
  cedula: text("cedula").notNull(),
  cocktail: text("cocktail").notNull(),
  intention: text("intention").notNull(),
  couponCode: text("coupon_code"),
  totalCents: integer("total_cents").notNull(),
  status: text("status").notNull().default("pending_payment"),
  consentAt: text("consent_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
