# 🚂 CÓMO ACTUALIZAR LA BASE DE DATOS EN RAILWAY

## ⚠️ PROBLEMA
Tu tabla `units` en Railway no tiene el campo `warrantyStatus`, por eso falla el traspaso a taller.

---

## ✅ SOLUCIÓN: Ejecutar SQL en Railway

### **Opción 1: Desde el Dashboard de Railway (RECOMENDADA)**

1. **Ir a Railway Dashboard:**
   - Abre tu navegador
   - Ve a: https://railway.app
   - Haz login con tu cuenta

2. **Abrir tu Proyecto:**
   - Busca el proyecto "control-pedidos-app" o como lo hayas llamado
   - Click en el proyecto

3. **Abrir Base de Datos MySQL:**
   - Busca el servicio de MySQL en tu proyecto
   - Click en el servicio MySQL
   - Ve a la pestaña **"Data"** o **"Query"**

4. **Ejecutar este SQL:**
   ```sql
   -- 1. Agregar campo warrantyStatus
   ALTER TABLE units 
   ADD COLUMN warrantyStatus ENUM('active', 'expired', 'n_a') DEFAULT 'n_a';

   -- 2. Actualizar enum de status
   ALTER TABLE units 
   MODIFY COLUMN status ENUM('in_diagnosis', 'in_repair', 'available', 'reserved', 'sold', 'returned', 'scrapped') 
   NOT NULL DEFAULT 'in_diagnosis';
   ```

5. **Verificar:**
   ```sql
   -- Ver la estructura actualizada
   DESCRIBE units;
   ```

6. **¡Listo!** Reinicia tu aplicación en Railway si es necesario.

---

### **Opción 2: Con MySQL Workbench / DBeaver (Si tienes las credenciales)**

1. **Conseguir credenciales de Railway:**
   - En Railway Dashboard → Tu proyecto → MySQL service
   - Click en **"Connect"** o **"Variables"**
   - Copia:
     - `MYSQL_HOST`
     - `MYSQL_PORT`
     - `MYSQL_USER`
     - `MYSQL_PASSWORD`
     - `MYSQL_DATABASE`

2. **Abrir MySQL Workbench o DBeaver:**
   - Crear nueva conexión
   - Pegar las credenciales de Railway
   - Conectar

3. **Ejecutar el SQL:**
   ```sql
   ALTER TABLE units 
   ADD COLUMN warrantyStatus ENUM('active', 'expired', 'n_a') DEFAULT 'n_a';

   ALTER TABLE units 
   MODIFY COLUMN status ENUM('in_diagnosis', 'in_repair', 'available', 'reserved', 'sold', 'returned', 'scrapped') 
   NOT NULL DEFAULT 'in_diagnosis';
   ```

---

### **Opción 3: Instalar Railway CLI y ejecutar desde terminal**

1. **Instalar Railway CLI:**
   ```powershell
   npm install -g @railway/cli
   ```

2. **Login:**
   ```powershell
   railway login
   ```

3. **Conectar a tu proyecto:**
   ```powershell
   railway link
   ```

4. **Abrir shell de MySQL:**
   ```powershell
   railway run mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE
   ```

5. **Ejecutar el SQL:**
   ```sql
   ALTER TABLE units 
   ADD COLUMN warrantyStatus ENUM('active', 'expired', 'n_a') DEFAULT 'n_a';

   ALTER TABLE units 
   MODIFY COLUMN status ENUM('in_diagnosis', 'in_repair', 'available', 'reserved', 'sold', 'returned', 'scrapped') 
   NOT NULL DEFAULT 'in_diagnosis';
   ```

---

## 🎯 DESPUÉS DE EJECUTAR EL SQL

1. **Reinicia tu aplicación** en Railway (si no se reinicia automáticamente)
2. **Prueba el traspaso a taller** nuevamente
3. **Debería funcionar sin errores** ✅

---

## 📝 NOTAS

- Este cambio **NO afecta** los datos existentes
- Todas las unidades existentes tendrán `warrantyStatus = 'n_a'` por defecto
- El código en GitHub ya está actualizado para usar este campo
- Solo necesitas ejecutar el SQL **UNA VEZ**

---

## ❓ ¿PROBLEMAS?

Si no puedes acceder a Railway o necesitas ayuda, avísame y te guío paso a paso.
