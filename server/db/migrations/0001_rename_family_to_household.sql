-- Rename lists.family_id to household_id (data is kept)
ALTER TABLE `lists` RENAME COLUMN `family_id` TO `household_id`;--> statement-breakpoint
DROP INDEX `lists_family_type_idx`;--> statement-breakpoint
CREATE INDEX `lists_household_type_idx` ON `lists` (`household_id`,`type`);
