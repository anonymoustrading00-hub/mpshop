-- Migración 0017: Tabla de Empleados
CREATE TABLE IF NOT EXISTS `employees` (
  `id`               int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `fullName`         varchar(255) NOT NULL,
  `ci`               varchar(20),
  `role`             enum('repartidor','ventas','almacen','tecnico','administracion','otro') NOT NULL DEFAULT 'otro',
  `userId`           int REFERENCES `users`(`id`),
  `baseSalary`       int NOT NULL DEFAULT 0,
  `fixedDeductions`  text,
  `phone`            varchar(20),
  `address`          varchar(255),
  `startDate`        varchar(10),
  `birthDate`        varchar(10),
  `status`           enum('active','inactive') NOT NULL DEFAULT 'active',
  `notes`            text,
  `branchId`         int NOT NULL DEFAULT 1 REFERENCES `branches`(`id`),
  `createdAt`        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
