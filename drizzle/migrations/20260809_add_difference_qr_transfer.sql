-- Migración: Agregar campos differenceQr y differenceTransfer
-- Fecha: 2026-08-09
-- Descripción: CRÍTICO #1 - Cálculo automático de diferencias para todos los métodos de pago

ALTER TABLE `seller_cash_registers` 
ADD COLUMN `differenceQr` INT NOT NULL DEFAULT 0 COMMENT 'Diferencia QR = reportado - esperado (centavos)' AFTER `differenceCash`,
ADD COLUMN `differenceTransfer` INT NOT NULL DEFAULT 0 COMMENT 'Diferencia Transfer = reportado - esperado (centavos)' AFTER `differenceQr`;

-- Actualizar registros existentes: calcular diferencias históricas
UPDATE `seller_cash_registers` 
SET 
  `differenceQr` = `reportedQr` - `salesQr`,
  `differenceTransfer` = `reportedTransfer` - `salesTransfer`
WHERE `closingStatus` IN ('pending', 'approved', 'rejected');
