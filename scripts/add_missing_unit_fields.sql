-- Agregar campos faltantes a la tabla units si no existen

-- Agregar warrantyStatus si no existe
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS warrantyStatus ENUM('active', 'expired', 'n_a') NOT NULL DEFAULT 'n_a';

-- Actualizar enum de status para incluir reserved y scrapped
-- Nota: En MySQL no se puede modificar directamente un ENUM, 
-- pero si usas Drizzle ORM, esto se sincronizará automáticamente

-- Comentario: Si la tabla ya existe y tiene datos, ejecuta:
-- ALTER TABLE units MODIFY COLUMN status ENUM('in_diagnosis', 'in_repair', 'available', 'reserved', 'sold', 'returned', 'scrapped') NOT NULL DEFAULT 'in_diagnosis';
