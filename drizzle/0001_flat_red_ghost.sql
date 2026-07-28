CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`isMainWarehouse` int NOT NULL DEFAULT 0,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_inputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_inputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userBranches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`branchId` int NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	CONSTRAINT `userBranches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inventory_transfers` MODIFY COLUMN `status` enum('pending','in_transit','completed','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `cash_closures` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `cash_openings` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `financialTransactions` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_transfers` ADD `sourceBranchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_transfers` ADD `destinationBranchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `operationalExpenses` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `branchId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `production_inputs` ADD CONSTRAINT `production_inputs_batchId_production_batches_id_fk` FOREIGN KEY (`batchId`) REFERENCES `production_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_inputs` ADD CONSTRAINT `production_inputs_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_inventory` ADD CONSTRAINT `production_inventory_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userBranches` ADD CONSTRAINT `userBranches_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userBranches` ADD CONSTRAINT `userBranches_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_closures` ADD CONSTRAINT `cash_closures_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_openings` ADD CONSTRAINT `cash_openings_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financialTransactions` ADD CONSTRAINT `financialTransactions_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD CONSTRAINT `inventoryMovements_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_transfers` ADD CONSTRAINT `inventory_transfers_sourceBranchId_branches_id_fk` FOREIGN KEY (`sourceBranchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_transfers` ADD CONSTRAINT `inventory_transfers_destinationBranchId_branches_id_fk` FOREIGN KEY (`destinationBranchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operationalExpenses` ADD CONSTRAINT `operationalExpenses_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;