-- 🔴 CRÍTICO #4: Tabla de KPIs agregados para dashboards rápidos
-- Migración: Agregar tabla kpi_snapshots para almacenar métricas diarias pre-calculadas

CREATE TABLE IF NOT EXISTS `kpi_snapshots` (
  `id` int AUTO_INCREMENT NOT NULL,
  `date` varchar(10) NOT NULL COMMENT 'Fecha en formato YYYY-MM-DD (UTC-4 Bolivia)',
  `branchId` int NOT NULL DEFAULT 1,
  `metricName` varchar(100) NOT NULL COMMENT 'Nombre de la métrica (daily_revenue, daily_cogs, etc.)',
  `metricValue` int NOT NULL DEFAULT 0 COMMENT 'Valor de la métrica en centavos o cantidad entera',
  `metricMetadata` text COMMENT 'JSON opcional con desglose adicional',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_date_branch` (`date`, `branchId`),
  KEY `idx_metric_name` (`metricName`),
  KEY `idx_date_branch_metric` (`date`, `branchId`, `metricName`),
  CONSTRAINT `kpi_snapshots_branchId_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Snapshots diarios de KPIs para dashboards rápidos';

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS `idx_kpi_date_range` ON `kpi_snapshots` (`branchId`, `date`, `metricName`);
