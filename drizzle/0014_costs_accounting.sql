-- Migración 0014: Modelo contable completo
-- Agrega soporte para costos directos, COGS, costos de reparación y costos de garantía

-- 1. Agregar nuevos campos a operationalExpenses
ALTER TABLE `operationalExpenses`
  ADD COLUMN `costType` varchar(50) NULL AFTER `category`,
  ADD COLUMN `referenceType` varchar(50) NULL AFTER `costType`,
  ADD COLUMN `referenceId` int NULL AFTER `referenceType`,
  ADD COLUMN `isAutomatic` tinyint NOT NULL DEFAULT 0 AFTER `referenceId`;

-- 2. Modificar el enum de category en operationalExpenses
-- MySQL no permite ALTER COLUMN para ENUMs directamente de forma simple,
-- así que lo hacemos recreando la columna con el nuevo ENUM.
ALTER TABLE `operationalExpenses`
  MODIFY COLUMN `category` ENUM(
    'facebook_ads',
    'google_ads',
    'electricity',
    'water',
    'internet',
    'telephone',
    'rent',
    'salaries',
    'maintenance',
    'supplies',
    'taxes',
    'insurance',
    'bank_fees',
    'repair_cost',
    'warranty_repair_cost',
    'warranty_replacement_cost',
    'cogs',
    'other'
  ) NOT NULL;

-- 3. Agregar campo unitCost a financialTransactions para rastrear COGS por unidad
ALTER TABLE `financialTransactions`
  ADD COLUMN `unitCost` int NULL AFTER `amount`;
