CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`discount_type` text NOT NULL,
	`amount` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `gallery_images` (
	`id` text PRIMARY KEY NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`alt_text` text DEFAULT 'Imagen de una noche Ágape' NOT NULL,
	`storage_key` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`gender` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`social` text DEFAULT '' NOT NULL,
	`cedula` text NOT NULL,
	`cocktail` text NOT NULL,
	`intention` text NOT NULL,
	`coupon_code` text,
	`total_cents` integer NOT NULL,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`consent_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservations_reference_unique` ON `reservations` (`reference`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
