ALTER TABLE `mesures_circonferences` ADD `epaule` real;--> statement-breakpoint
UPDATE `mesures_circonferences` SET `epaule` = COALESCE((`epaule_g` + `epaule_d`) / 2, `epaule_g`, `epaule_d`) WHERE `epaule` IS NULL;--> statement-breakpoint
ALTER TABLE `mesures_circonferences` DROP COLUMN `epaule_g`;--> statement-breakpoint
ALTER TABLE `mesures_circonferences` DROP COLUMN `epaule_d`;
