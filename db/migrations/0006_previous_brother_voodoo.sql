ALTER TABLE `clients` ADD `unit_length` text DEFAULT 'cm' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `unit_weight` text DEFAULT 'kg' NOT NULL;--> statement-breakpoint
ALTER TABLE `mesures_circonferences` ADD `poids_kg` real;