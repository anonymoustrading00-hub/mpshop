-- Script para agregar campo warrantyStatus a tabla units existente
-- Ejecuta este script directamente en tu base de datos MySQL

-- 1. Agregar campo warrantyStatus (si no existe)
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS warrantyStatus ENUM('active', 'expired', 'n_a') DEFAULT 'n_a';

-- 2. Actualizar enum de status para incluir 'reserved' y 'scrapped' (si no están)
ALTER TABLE units 
MODIFY COLUMN status ENUM('in_diagnosis', 'in_repair', 'available', 'reserved', 'sold', 'returned', 'scrapped') 
NOT NULL DEFAULT 'in_diagnosis';

-- Verificar que los cambios se aplicaron correctamente
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'units' 
AND COLUMN_NAME IN ('status', 'warrantyStatus');
