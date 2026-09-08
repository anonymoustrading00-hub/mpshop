-- Migración: Sistema de Cajas para Vendedores
-- Fecha: 2026-08-07
-- Descripción: Tablas para gestionar las cajas personales de vendedores

-- Tabla principal de registros de cajas de vendedores
CREATE TABLE IF NOT EXISTS `seller_cash_registers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sellerId` INT NOT NULL,
  `branchId` INT NOT NULL,
  `date` VARCHAR(10) NOT NULL,
  
  -- Apertura
  `openingStatus` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `initialCash` INT NOT NULL DEFAULT 0,
  `openedAt` TIMESTAMP NULL,
  `openingApprovedBy` INT NULL,
  `openingApprovedAt` TIMESTAMP NULL,
  `openingNotes` TEXT NULL,
  
  -- Ventas
  `salesCash` INT NOT NULL DEFAULT 0,
  `salesQr` INT NOT NULL DEFAULT 0,
  `salesTransfer` INT NOT NULL DEFAULT 0,
  
  -- Entregas parciales
  `partialDeliveriesCash` INT NOT NULL DEFAULT 0,
  
  -- Gastos
  `totalExpenses` INT NOT NULL DEFAULT 0,
  
  -- Cierre
  `closingStatus` ENUM('open', 'pending', 'approved', 'rejected', 'forced_closed') NOT NULL DEFAULT 'open',
  `reportedCash` INT DEFAULT 0,
  `reportedQr` INT DEFAULT 0,
  `reportedTransfer` INT DEFAULT 0,
  `differenceCash` INT DEFAULT 0,
  `differenceJustification` TEXT NULL,
  `closedAt` TIMESTAMP NULL,
  `closingApprovedBy` INT NULL,
  `closingApprovedAt` TIMESTAMP NULL,
  `closingNotes` TEXT NULL,
  
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`openingApprovedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`closingApprovedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  
  INDEX `idx_seller_date` (`sellerId`, `date`),
  INDEX `idx_branch_date` (`branchId`, `date`),
  INDEX `idx_opening_status` (`openingStatus`),
  INDEX `idx_closing_status` (`closingStatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de entregas parciales de efectivo
CREATE TABLE IF NOT EXISTS `seller_partial_deliveries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cashRegisterId` INT NOT NULL,
  `sellerId` INT NOT NULL,
  `amount` INT NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `requestedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approvedBy` INT NULL,
  `approvedAt` TIMESTAMP NULL,
  `notes` TEXT NULL,
  `adminNotes` TEXT NULL,
  
  FOREIGN KEY (`cashRegisterId`) REFERENCES `seller_cash_registers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  
  INDEX `idx_status` (`status`),
  INDEX `idx_seller` (`sellerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de gastos desde caja de vendedor
CREATE TABLE IF NOT EXISTS `seller_cash_expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cashRegisterId` INT NOT NULL,
  `sellerId` INT NOT NULL,
  `amount` INT NOT NULL,
  `concept` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `requestedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approvedBy` INT NULL,
  `approvedAt` TIMESTAMP NULL,
  `notes` TEXT NULL,
  `adminNotes` TEXT NULL,
  `receiptUrl` TEXT NULL,
  
  FOREIGN KEY (`cashRegisterId`) REFERENCES `seller_cash_registers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  
  INDEX `idx_status` (`status`),
  INDEX `idx_seller` (`sellerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
