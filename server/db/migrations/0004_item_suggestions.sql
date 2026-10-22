CREATE TABLE `item_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`type` text NOT NULL,
	`text` text NOT NULL,
	`normalized` text NOT NULL,
	`last_quantity` text,
	`use_count` integer DEFAULT 1 NOT NULL,
	`last_used_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "item_suggestions_type_check" CHECK("item_suggestions"."type" in ('shopping', 'todo'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_suggestions_household_type_text_idx` ON `item_suggestions` (`household_id`,`type`,`normalized`);