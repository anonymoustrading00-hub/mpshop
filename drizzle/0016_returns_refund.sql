-- Migración 0016: Agrega campos de devolución de dinero a la tabla returns
ALTER TABLE `returns`
  ADD COLUMN `refundAmount` int NULL AFTER `reenteredRepair`,
  ADD COLUMN `refundPaymentMethod` varchar(20) NULL AFTER `refundAmount`,
  ADD COLUMN `saleId` int NULL AFTER `refundPaymentMethod`;
