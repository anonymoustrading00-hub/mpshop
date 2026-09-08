-- Agregar columna turnNumber para permitir múltiples cajas por vendedor por día
ALTER TABLE seller_cash_registers ADD COLUMN turnNumber INT NOT NULL DEFAULT 1 AFTER date;

-- Actualizar constraint único para incluir turnNumber (permite múltiples turnos)
-- Nota: Si ya existe un constraint único en (sellerId, date), primero hay que eliminarlo
-- ALTER TABLE seller_cash_registers DROP INDEX idx_seller_date; -- Solo si existe
-- CREATE UNIQUE INDEX idx_seller_date_turn ON seller_cash_registers(sellerId, date, turnNumber);

-- Comentario: La constraint única se maneja a nivel de aplicación para mayor flexibilidad
