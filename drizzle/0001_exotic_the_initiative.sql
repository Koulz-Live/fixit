CREATE TABLE `artisan_disciplines` (
	`id` text PRIMARY KEY NOT NULL,
	`artisan_tenant_id` text NOT NULL,
	`discipline_id` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`years_experience` integer,
	FOREIGN KEY (`artisan_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_artisan_discipline` ON `artisan_disciplines` (`artisan_tenant_id`,`discipline_id`);--> statement-breakpoint
CREATE TABLE `artisan_profiles` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`public_slug` text NOT NULL,
	`trading_name` text NOT NULL,
	`biography` text NOT NULL,
	`years_experience` integer DEFAULT 0 NOT NULL,
	`base_hourly_rate_minor` integer DEFAULT 0 NOT NULL,
	`currency_code` text DEFAULT 'ZAR' NOT NULL,
	`callout_fee_minor` integer,
	`pricing_model` text DEFAULT 'hourly' NOT NULL,
	`availability_status` text DEFAULT 'available' NOT NULL,
	`verification_status` text DEFAULT 'pending' NOT NULL,
	`profile_status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artisan_profiles_public_slug_unique` ON `artisan_profiles` (`public_slug`);--> statement-breakpoint
CREATE TABLE `artisan_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`client_tenant_id` text NOT NULL,
	`artisan_tenant_id` text NOT NULL,
	`rating_overall` integer NOT NULL,
	`review_text` text,
	`moderation_status` text DEFAULT 'published' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artisan_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artisan_reviews_job_id_unique` ON `artisan_reviews` (`job_id`);--> statement-breakpoint
CREATE TABLE `artisan_service_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`artisan_tenant_id` text NOT NULL,
	`country_code` text NOT NULL,
	`province_region` text NOT NULL,
	`municipality_city` text NOT NULL,
	`locality` text,
	`public_label` text NOT NULL,
	FOREIGN KEY (`artisan_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `client_profiles` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`client_type` text NOT NULL,
	`preferred_contact_method` text DEFAULT 'in_app' NOT NULL,
	`profile_status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `disciplines` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `disciplines_code_unique` ON `disciplines` (`code`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`client_tenant_id` text NOT NULL,
	`artisan_tenant_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`currency_code` text DEFAULT 'ZAR' NOT NULL,
	`total_minor` integer NOT NULL,
	`amount_paid_minor` integer DEFAULT 0 NOT NULL,
	`amount_due_minor` integer NOT NULL,
	`due_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artisan_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`accepted_quote_id` text,
	`client_tenant_id` text NOT NULL,
	`artisan_tenant_id` text NOT NULL,
	`job_number` text NOT NULL,
	`title` text NOT NULL,
	`scope_baseline` text NOT NULL,
	`area_label` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`planned_start_at` integer,
	`planned_end_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`accepted_quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artisan_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_job_number_unique` ON `jobs` (`job_number`);--> statement-breakpoint
CREATE TABLE `marketplace_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_tenant_id` text NOT NULL,
	`active_role` text NOT NULL,
	`correlation_id` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`outcome` text NOT NULL,
	`reason_code` text,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`service_request_id` text,
	`client_tenant_id` text NOT NULL,
	`artisan_tenant_id` text NOT NULL,
	`quote_number` text NOT NULL,
	`version_number` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`currency_code` text DEFAULT 'ZAR' NOT NULL,
	`subtotal_minor` integer NOT NULL,
	`tax_minor` integer DEFAULT 0 NOT NULL,
	`total_minor` integer NOT NULL,
	`valid_until` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`service_request_id`) REFERENCES `service_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artisan_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`client_tenant_id` text NOT NULL,
	`discipline_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`area_label` text NOT NULL,
	`budget_min_minor` integer,
	`budget_max_minor` integer,
	`currency_code` text DEFAULT 'ZAR' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_request_tenant_id` ON `service_requests` (`client_tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `tenant_role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_code` text NOT NULL,
	`granted_by` text NOT NULL,
	`granted_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_role_active` ON `tenant_role_assignments` (`tenant_id`,`user_id`,`role_code`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `tenant_type` text DEFAULT 'platform_internal' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `country_code` text DEFAULT 'ZA' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `created_by` text;