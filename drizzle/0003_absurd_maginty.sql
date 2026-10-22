ALTER TABLE `reservations` ADD `payment_method` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `payment_client_transaction_id` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `payment_provider_transaction_id` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `proof_storage_key` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `proof_file_name` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `proof_uploaded_at` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `upload_token_hash` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `confirmation_email_sent_at` text;--> statement-breakpoint
ALTER TABLE `reservations` ADD `email_sending_at` text;