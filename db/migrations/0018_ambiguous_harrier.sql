ALTER TABLE `clients` ADD `nutrition_macro_manual` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `nutrition_manual_protein_g` real;--> statement-breakpoint
ALTER TABLE `clients` ADD `nutrition_manual_fat_g` real;