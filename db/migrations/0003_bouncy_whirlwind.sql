CREATE TABLE `mesures_circonferences` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`cou` real,
	`epaule_g` real,
	`epaule_d` real,
	`biceps_g` real,
	`biceps_d` real,
	`poitrine` real,
	`taille` real,
	`abdomen` real,
	`hanche` real,
	`cuisse_g` real,
	`cuisse_d` real,
	`mollet_g` real,
	`mollet_d` real,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mesures_plis_cutanes` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`triceps` real NOT NULL,
	`biceps` real NOT NULL,
	`sousscapulaire` real NOT NULL,
	`iliaque` real NOT NULL,
	`somme_4_plis` real NOT NULL,
	`densite_corporelle` real NOT NULL,
	`pourcentage_gras_siri` real NOT NULL,
	`pourcentage_gras_brozek` real NOT NULL,
	`age_au_calcul` integer NOT NULL,
	`sexe_au_calcul` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `birthdate` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `sex` text;