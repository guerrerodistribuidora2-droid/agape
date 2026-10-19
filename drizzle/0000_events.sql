CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`venue` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`event_date` text NOT NULL,
	`arrival_time` text NOT NULL,
	`start_time` text NOT NULL,
	`min_age` integer NOT NULL,
	`max_age` integer NOT NULL,
	`women_capacity` integer DEFAULT 0 NOT NULL,
	`men_capacity` integer DEFAULT 0 NOT NULL,
	`women_price_cents` integer DEFAULT 0 NOT NULL,
	`men_price_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
