-- Migración 0015: RMA permanente por unidad + Orden de Trabajo por entrada
--
-- CONCEPTO:
--   units.rmaNumber   = identificador de vida del equipo (asignado una vez, permanente)
--   repairs.otNumber  = número de orden de trabajo por cada entrada al taller

-- 1. Agregar rmaNumber a units (nullable al inicio para equipos ya registrados)
ALTER TABLE `units`
  ADD COLUMN `rmaNumber` varchar(30) NULL UNIQUE AFTER `code`;

-- 2. Agregar otNumber a repairs (la nueva orden de trabajo)
ALTER TABLE `repairs`
  ADD COLUMN `otNumber` varchar(30) NULL UNIQUE AFTER `rmaNumber`;

-- 3. Migrar datos existentes: el rmaNumber actual de repairs pasa a ser el otNumber
--    (los RMAs existentes eran realmente OTs, los preservamos como OTs)
UPDATE `repairs` SET `otNumber` = `rmaNumber` WHERE `otNumber` IS NULL AND `rmaNumber` IS NOT NULL;

-- 4. Asignar rmaNumber permanente a units que ya tienen al menos una reparación
--    Tomamos el primer rmaNumber cronológico de repairs como el RMA del equipo
UPDATE `units` u
  INNER JOIN (
    SELECT unitId, MIN(rmaNumber) as firstRma
    FROM `repairs`
    WHERE rmaNumber IS NOT NULL
    GROUP BY unitId
  ) r ON u.id = r.unitId
SET u.rmaNumber = r.firstRma
WHERE u.rmaNumber IS NULL;
