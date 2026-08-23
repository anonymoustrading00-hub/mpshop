-- Migración 0018: Agregar columnas faltantes a users
-- Estas columnas existen en el schema pero pueden no estar en la DB de Railway
-- Usamos IF NOT EXISTS / ignoramos errores si ya existen

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `phone` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS `allowedModules` text NULL,
  ADD COLUMN IF NOT EXISTS `specialPermissions` text NULL,
  ADD COLUMN IF NOT EXISTS `assignedBranchIds` text NULL;
