ALTER TABLE `clients` ADD `nutrition_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `nutrition_target_body_fat` real;--> statement-breakpoint
ALTER TABLE `clients` ADD `nutrition_activity_level` text;