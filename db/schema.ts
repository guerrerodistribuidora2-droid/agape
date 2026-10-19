import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  venue: text("venue").notNull(),
  description: text("description").notNull().default(""),
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
