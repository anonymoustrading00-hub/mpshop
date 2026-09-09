# 🔍 AUDITORÍA FINANCIERA COMPLETA DEL SISTEMA
## Control de Pedidos - Módulo Vendedor y Áreas Financieras

**Fecha de Auditoría:** 9 de Septiembre, 2026  
**Auditor:** Sistema Kiro AI  
**Alcance:** Todos los módulos financieros, cajas, ventas, compras, gastos, KPIs, analítica y reportes

---

## 📊 RESUMEN EJECUTIVO

### ✅ Fortalezas Identificadas
1. ✅ Sistema de cajas de vendedor con turnos múltiples
2. ✅ Registro automático de ventas en cajas
3. ✅ Trazabilidad de transacciones financieras
4. ✅ Cuentas por cobrar y pagar implementadas
5. ✅ Reportes financieros en Excel
6. ✅ Control de gastos operacionales

### ⚠️ Riesgos Críticos Identificados
1. 🔴 **CRÍTICO**: Inconsistencias en sincronización de ventas antiguas
2. 🔴 **CRÍTICO**: Falta de validación de cierres de caja vs ventas reales
3. 🟡 **MEDIO**: No hay reconciliación automática de métodos de pago
4. 🟡 **MEDIO**: Costos de venta (COGS) no se calculan automáticamente en todos los casos
5. 🟡 **MEDIO**: Falta dashboard de rentabilidad en tiempo real

---

## 1️⃣ MÓDULO DE CAJAS DE VENDEDOR

### 📋 Análisis del Flujo Actual

#### Estado de Implementación
```typescript
// Archivo: server/routers/sellerCash.ts
// Líneas clave: 35-905

FLUJOS IMPLEMENTADOS:
✅ Apertura de caja (solicitud + aprobación)
✅ Registro automático de ventas
✅ Entregas parciales de efectivo
✅ Gastos operacionales del vendedor
✅ Cierre de caja (solicitud + aprobación)
✅ Múltiples turnos por día (turnNumber)
```

#### Campos Financieros de Caja
| Campo | Tipo | Propósito | Estado |
|-------|------|-----------|--------|
| `initialCash` | int (centavos) | Efectivo inicial declarado | ✅ Funciona |
| `salesCash` | int (centavos) | Ventas en efectivo | ✅ Auto-actualiza |
| `salesQr` | int (centavos) | Ventas por QR | ✅ Auto-actualiza |
| `salesTransfer` | int (centavos) | Ventas por transferencia | ✅ Auto-actualiza |
| `partialDeliveriesCash` | int (centavos) | Entregas parciales | ✅ Funciona |
| `totalExpenses` | int (centavos) | Gastos aprobados | ✅ Funciona |
| `reportedCash` | int (centavos) | Efectivo reportado al cierre | ✅ Funciona |
| `reportedQr` | int (centavos) | QR reportado al cierre | ✅ Funciona |
| `reportedTransfer` | int (centavos) | Transfer reportado al cierre | ✅ Funciona |
| `differenceCash` | int (centavos) | Diferencia declarada vs sistema | ⚠️ Se calcula en UI |

### 🔴 HALLAZGO CRÍTICO #1: Cálculo de Diferencias
**Problema:** El campo `differenceCash` no se calcula automáticamente en el backend al momento del cierre.

**Impacto:** 
- Riesgo de manipulación de datos
- Inconsistencias entre frontend y backend
- Dificultad para auditorías históricas

**Ubicación:**
```typescript
// client/src/pages/admin/SellerBoxesManagement.tsx
// Línea ~388 (cálculo en frontend)
const sysCash = (cr.initialCash ?? 0) + (cr.salesCash ?? 0) 
  - (cr.partialDeliveriesCash ?? 0) - (cr.totalExpenses ?? 0);
const diffCash = (cr.reportedCash ?? 0) - sysCash;
```

**Recomendación:**
```typescript
// DEBE implementarse en server/routers/sellerCash.ts
// En endpoint requestClosing:
const systemCash = cashRegister.initialCash + cashRegister.salesCash 
  - cashRegister.partialDeliveriesCash - cashRegister.totalExpenses;

const differenceCash = input.reportedCash - systemCash;
const differenceQr = input.reportedQr - cashRegister.salesQr;
const differenceTransfer = input.reportedTransfer - cashRegister.salesTransfer;

await db.update(sellerCashRegisters).set({
  differenceCash,
  differenceQr: differenceQr,
  differenceTransfer: differenceTransfer,
  // ... resto de campos
});
```

### 🔴 HALLAZGO CRÍTICO #2: Registro de Ventas con Timezone
**Problema:** Se corrigió recientemente (commit acbe079) pero hay datos históricos inconsistentes.

**Estado Actual:**
- ✅ Ventas nuevas usan `getLocalDateKey()` (UTC-4 Bolivia)
- ❌ Ventas antiguas pueden tener fechas incorrectas

**Datos Afectados:**
```sql
-- Query para identificar registros inconsistentes:
SELECT 
  scr.id as caja_id,
  scr.date as fecha_caja,
  scr.openedAt as hora_apertura,
  scr.salesCash,
  COUNT(s.id) as ventas_reales,
  SUM(CASE WHEN s.paymentMethod='cash' THEN s.total ELSE 0 END) as total_ventas_db
FROM seller_cash_registers scr
LEFT JOIN sales s ON s.soldBy = scr.sellerId 
  AND DATE(s.createdAt) = scr.date
  AND s.createdAt >= scr.openedAt
WHERE scr.salesCash != COALESCE(SUM(CASE WHEN s.paymentMethod='cash' THEN s.total ELSE 0 END), 0)
GROUP BY scr.id;
```

**Recomendación:**
1. Ejecutar script de limpieza de datos históricos
2. Mantener log de auditoría de correcciones
3. Implementar validación pre-cierre

---

## 2️⃣ MÓDULO DE VENTAS

### 📋 Análisis del Flujo

#### Registro de Ventas
```typescript
// Archivo: server/routers/sales.ts
// Líneas: 129-349

FLUJO ACTUAL:
1. Validación de unidades disponibles ✅
2. Expansión de items (fungibles vs únicos) ✅
3. Cálculo de precios y descuentos ✅
4. Creación de venta en DB ✅
5. Actualización automática de caja del vendedor ✅ (NUEVO)
6. Cambio de estado de unidades a "sold" ✅
```

#### Campos Financieros de Ventas
| Campo | Tipo | Cálculo | Validación |
|-------|------|---------|------------|
| `subtotal` | int (centavos) | Suma de items | ✅ Backend |
| `discountAmount` | int (centavos) | Por tipo de descuento | ✅ Backend |
| `total` | int (centavos) | subtotal - discountAmount | ✅ Backend |
| `paymentMethod` | enum | cash/qr/transfer/credit | ✅ Requerido |
| `paymentStatus` | enum | pending/completed | ✅ Auto si no es crédito |

### ✅ PUNTO FUERTE: Cálculo de Precios
```typescript
// server/routers/sales.ts - líneas 23-75
function getLinePricing(basePrice, quantity, discountType, discountValue) {
  // CORRECTO: maneja descuentos a nivel de línea
  // CORRECTO: redondeo a centavos
  // CORRECTO: validación de valores negativos
}

function getGlobalDiscountAmount(subtotal, discountType, discountValue) {
  // CORRECTO: descuentos globales sobre subtotal
  // CORRECTO: límites de porcentaje (max 100%)
}
```

### 🟡 HALLAZGO MEDIO #3: COGS (Cost of Goods Sold)
**Problema:** El costo de venta se registra en `financial_transactions` pero no siempre está presente.

**Análisis:**
```typescript
// server/db.ts - línea ~2180
// En createSaleWithItems():
await tx.insert(financialTransactions).values({
  type: "expense",
  category: "cogs",
  amount: item.unit.purchasePrice, // ⚠️ Puede ser NULL
  unitCost: item.unit.purchasePrice,
  paymentMethod: paymentMethod,
  // ...
});
```

**Impacto:**
- Reportes de rentabilidad incompletos
- Márgenes de ganancia inexactos
- Dificultad para análisis de productos más rentables

**Casos Problemáticos:**
1. Unidades sin `purchasePrice` (valor NULL en DB)
2. Productos fungibles sin costo unitario definido
3. Ventas de servicios (garantías, reparaciones)

**Recomendación:**
```typescript
// Validación obligatoria en RegisterUnit:
if (input.purchasePrice <= 0 && input.type !== 'service') {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "El precio de compra es obligatorio para calcular rentabilidad"
  });
}

// Costo promedio para fungibles:
const avgCost = await calculateAverageCost(brand, model);
```

---

## 3️⃣ MÓDULO DE COMPRAS

### 📋 Análisis del Flujo

```typescript
// Archivo: server/routers/purchases.ts
// Archivo: server/routers/units.ts (compras desde registro de unidades)

FLUJOS IDENTIFICADOS:
1. Compras tradicionales (COM-XXXXX) ✅
2. Compras desde registro de unidades (COMP-UNIT-XXXXX) ✅
3. Unificación en listAll() ✅
```

### 🟡 HALLAZGO MEDIO #4: Duplicación de Compras
**Problema:** Riesgo de duplicar compras si se registra una unidad Y se crea una compra tradicional.

**Código Actual:**
```typescript
// server/routers/purchases.ts - línea 70
const filteredUnitRows = unitRows.filter((u) => {
  const unit = (units as any[]).find((x: any) => x.id === u.unitId);
  if (unit?.purchaseId && traditionalPurchaseIds.has(unit.purchaseId)) 
    return false; // ✅ CORRECTO: evita duplicados
  return true;
});
```

**Estado:** ✅ Ya está implementada la deduplicación

### ⚠️ Falta de Validación de Stock
**Problema:** No hay validación de que las compras recibidas incrementen el inventario.

**Recomendación:**
```typescript
// Al marcar compra como "received":
// DEBE crear/actualizar unidades en tabla units
// O actualizar campo quantity si son productos fungibles
```

---

## 4️⃣ MÓDULO DE GASTOS

### 📋 Análisis del Flujo

```typescript
// Archivo: server/routers/expenses.ts
// Archivo: server/routers/sellerCash.ts (gastos de vendedor)

TIPOS DE GASTOS:
1. Gastos operacionales generales ✅
2. Gastos de repartidor (fuel, subsistence, other) ✅
3. Gastos de vendedor (desde su caja) ✅
```

### Campos Financieros de Gastos
| Campo | Tipo | Validación | Impacto Financiero |
|-------|------|------------|-------------------|
| `amount` | int (centavos) | > 0 | ✅ Deduce de caja |
| `paymentMethod` | enum | cash/qr/transfer | ✅ Afecta método específico |
| `category` | varchar | libre | ⚠️ Sin estandarización |
| `isAutomatic` | int | 0 o 1 | ✅ Diferencia auto vs manual |

### 🟡 HALLAZGO MEDIO #5: Categorización de Gastos
**Problema:** Las categorías de gastos son texto libre sin normalización.

**Impacto:**
- Reportes inconsistentes
- Dificultad para analizar gastos por tipo
- No se pueden hacer presupuestos por categoría

**Ejemplos de Inconsistencia:**
```
"Combustible" vs "combustible" vs "COMBUSTIBLE" vs "gasolina"
"Almuerzo" vs "almuerzo" vs "Comida" vs "comida"
```

**Recomendación:**
```typescript
// Crear enum de categorías estándar:
export const expenseCategories = mysqlEnum("category", [
  "fuel",           // Combustible
  "meals",          // Alimentación
  "transportation", // Transporte
  "maintenance",    // Mantenimiento
  "supplies",       // Suministros
  "utilities",      // Servicios (luz, agua, etc.)
  "marketing",      // Marketing
  "rent",           // Alquiler
  "salaries",       // Salarios
  "other"           // Otros
]);

// O crear tabla de categorías:
CREATE TABLE expense_categories (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  parent_id INT,
  is_active BOOLEAN
);
```

---

## 5️⃣ MÓDULO DE CUENTAS POR COBRAR (C/COBRAR)

### 📋 Estado de Implementación

```typescript
// Archivo: drizzle/schema.ts - línea 452
export const accountsReceivable = mysqlTable("accounts_receivable", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull().references(() => sales.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  totalAmount: int("totalAmount").notNull(),
  paidAmount: int("paidAmount").notNull().default(0),
  balance: int("balance").notNull(),
  dueDate: varchar("dueDate", { length: 10 }),
  status: mysqlEnum("status", ["pending", "paid", "overdue", "cancelled"]),
  // ...
});
```

### ✅ IMPLEMENTACIÓN CORRECTA
- ✅ Registro automático cuando `paymentMethod = 'credit'`
- ✅ Balance calculado (totalAmount - paidAmount)
- ✅ Estados de pago claros
- ✅ Referencia a venta y cliente

### 🟡 HALLAZGO MEDIO #6: Falta de Notificaciones
**Problema:** No hay sistema de recordatorios para cuentas vencidas.

**Recomendación:**
```typescript
// Agregar en server/routers/credit.ts:
export const creditRouter = router({
  // ... endpoints existentes
  
  getOverdueAccounts: protectedProcedure.query(async ({ ctx }) => {
    const today = getLocalDateKey();
    return db.select()
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.status, "pending"),
          sql`${accountsReceivable.dueDate} < ${today}`
        )
      );
  }),
  
  // Enviar recordatorios automáticos
  sendPaymentReminders: protectedProcedure.mutation(async ({ ctx }) => {
    const overdue = await getOverdueAccounts();
    // TODO: Implementar envío de SMS/WhatsApp/Email
  })
});
```

---

## 6️⃣ MÓDULO DE CUENTAS POR PAGAR (C/PAGAR)

### 📋 Estado de Implementación

```typescript
// Archivo: drizzle/schema.ts - línea 435
export const accountsPayable = mysqlTable("accounts_payable", {
  id: int("id").autoincrement().primaryKey(),
  purchaseId: int("purchaseId").notNull().references(() => purchases.id),
  supplierId: int("supplierId").references(() => suppliers.id),
  totalAmount: int("totalAmount").notNull(),
  paidAmount: int("paidAmount").notNull().default(0),
  balance: int("balance").notNull(),
  dueDate: varchar("dueDate", { length: 10 }),
  status: mysqlEnum("status", ["pending", "paid", "overdue", "cancelled"]),
  // ...
});
```

### ✅ IMPLEMENTACIÓN CORRECTA
- ✅ Registro automático cuando `isCredit = 1` en compras
- ✅ Balance calculado
- ✅ Referencia a compra y proveedor

### 🟡 HALLAZGO MEDIO #7: Falta de Flujo de Caja Proyectado
**Problema:** No hay vista de flujo de caja futuro considerando C/Cobrar y C/Pagar.

**Recomendación:**
```typescript
// Nuevo endpoint en finance.ts:
getCashFlowProjection: protectedProcedure
  .input(z.object({ days: z.number().default(30) }))
  .query(async ({ ctx, input }) => {
    const today = getLocalDateKey();
    const endDate = addDays(today, input.days);
    
    // Cuentas por cobrar futuras
    const receivables = await db.select()
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.status, "pending"),
          between(accountsReceivable.dueDate, today, endDate)
        )
      );
    
    // Cuentas por pagar futuras
    const payables = await db.select()
      .from(accountsPayable)
      .where(
        and(
          eq(accountsPayable.status, "pending"),
          between(accountsPayable.dueDate, today, endDate)
        )
      );
    
    // Proyección día a día
    return buildDailyCashFlowProjection(receivables, payables);
  })
```

---

## 7️⃣ MÓDULO DE FINANZAS (TRANSACCIONES)

### 📋 Análisis de financial_transactions

```typescript
// Archivo: drizzle/schema.ts - línea 557
export const financialTransactions = mysqlTable("financial_transactions", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer"]),
  amount: int("amount").notNull(),
  unitCost: int("unitCost"), // Para COGS
  // ...
});
```

### CATEGORÍAS REGISTRADAS AUTOMÁTICAMENTE
| Categoría | Tipo | Origen | Validación |
|-----------|------|--------|------------|
| `sale` | income | Ventas completadas | ✅ |
| `cogs` | expense | Costo de unidad vendida | ⚠️ Puede ser NULL |
| `purchase` | expense | Compras pagadas | ✅ |
| `delivery_expense` | expense | Gastos de repartidor | ✅ |
| `cash_opening` | income | Apertura de caja | ✅ |
| `cash_closure` | expense | Cierre de caja | ✅ |

### 🟡 HALLAZGO MEDIO #8: Falta de Reconciliación
**Problema:** No hay proceso de reconciliación entre:
- `financial_transactions` 
- `seller_cash_registers`
- `sales`

**Impacto:**
- Posibles inconsistencias entre módulos
- Dificultad para auditorías
- Riesgo de pérdida de trazabilidad

**Recomendación:**
```typescript
// Nuevo endpoint de reconciliación:
reconcileFinancialData: protectedProcedure
  .input(z.object({ date: z.string(), userId: z.number() }))
  .query(async ({ ctx, input }) => {
    // 1. Obtener caja del vendedor
    const cashRegister = await getCashRegister(input.userId, input.date);
    
    // 2. Obtener ventas del día
    const sales = await getSalesByUserAndDate(input.userId, input.date);
    
    // 3. Obtener transacciones financieras
    const transactions = await getTransactionsByUserAndDate(input.userId, input.date);
    
    // 4. Comparar totales
    const cashRegisterTotal = cashRegister.salesCash + cashRegister.salesQr + cashRegister.salesTransfer;
    const salesTotal = sales.reduce((sum, s) => sum + s.total, 0);
    const transactionsTotal = transactions
      .filter(t => t.category === 'sale')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      cashRegisterTotal,
      salesTotal,
      transactionsTotal,
      isConsistent: cashRegisterTotal === salesTotal && salesTotal === transactionsTotal,
      differences: {
        cashVsSales: cashRegisterTotal - salesTotal,
        cashVsTransactions: cashRegisterTotal - transactionsTotal,
        salesVsTransactions: salesTotal - transactionsTotal,
      }
    };
  })
```

---

## 8️⃣ MÓDULO DE KPIs Y ANALÍTICA

### 📋 Análisis de Dashboards

```typescript
// Archivos revisados:
// - server/routers/analytics.ts
// - server/routers/dashboard.ts
// - server/routers/stats.ts
```

### KPIs DISPONIBLES

#### Dashboard Principal
| KPI | Cálculo | Tiempo Real | Fuente |
|-----|---------|-------------|--------|
| Total Ventas | SUM(sales.total) | ❌ | sales table |
| Unidades Vendidas | COUNT(saleItems) | ❌ | sale_items |
| Ingreso Promedio | AVG(sales.total) | ❌ | sales |
| Efectivo en Caja | SUM(cashRegisters.cash) | ⚠️ | seller_cash_registers |

### 🔴 HALLAZGO CRÍTICO #9: KPIs No Actualizados en Tiempo Real
**Problema:** Los KPIs se calculan on-demand consultando toda la tabla, sin caché ni actualización incremental.

**Impacto:**
- Lentitud en dashboards con muchos datos
- Carga innecesaria en la base de datos
- No escalable a largo plazo

**Recomendación:**
```sql
-- Crear tabla de KPIs agregados:
CREATE TABLE kpi_snapshots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date DATE NOT NULL,
  branch_id INT,
  user_id INT,
  metric_name VARCHAR(100),
  metric_value DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date_branch (date, branch_id),
  INDEX idx_metric (metric_name, date)
);

-- Proceso diario de agregación:
INSERT INTO kpi_snapshots (date, branch_id, metric_name, metric_value)
SELECT 
  DATE(createdAt) as date,
  branchId,
  'total_sales' as metric_name,
  SUM(total)/100 as metric_value
FROM sales
WHERE DATE(createdAt) = CURDATE() - INTERVAL 1 DAY
GROUP BY DATE(createdAt), branchId;
```

---

## 9️⃣ MÓDULO DE REPORTES

### 📋 Reportes Disponibles

```typescript
// Archivo: server/routers/reports.ts

REPORTES IMPLEMENTADOS:
1. ✅ Reporte de Ventas (Excel/PDF)
2. ✅ Reporte de Inventario (Excel)
3. ✅ Reporte de Cuentas por Cobrar (Excel)
4. ✅ Reporte de Compras (Excel)
5. ✅ Estado de Resultados (Excel)
```

### ✅ PUNTO FUERTE: Exportación a Excel
```typescript
// server/routers/reports.ts - línea 705
function buildXlsx(sheets: { name: string; data: any[][] }[]): string {
  // ✅ Usa librería xlsx
  // ✅ Soporta múltiples hojas
  // ✅ Formato descargable
}
```

### 🟡 HALLAZGO MEDIO #10: Falta Reporte de Rentabilidad
**Problema:** No existe reporte específico de rentabilidad por producto/categoría.

**Recomendación:**
```typescript
// Nuevo reporte de rentabilidad:
getProfitabilityReport: protectedProcedure
  .input(z.object({
    startDate: z.string(),
    endDate: z.string(),
    groupBy: z.enum(['product', 'category', 'brand', 'seller'])
  }))
  .query(async ({ ctx, input }) => {
    // Query con JOIN de sales, saleItems, units
    const query = sql`
      SELECT 
        u.brand,
        u.model,
        COUNT(DISTINCT s.id) as total_sales,
        SUM(si.subtotal) as revenue,
        SUM(u.purchasePrice * si.quantity) as cogs,
        SUM(si.subtotal) - SUM(u.purchasePrice * si.quantity) as gross_profit,
        (SUM(si.subtotal) - SUM(u.purchasePrice * si.quantity)) / SUM(si.subtotal) * 100 as margin_percentage
      FROM sales s
      JOIN sale_items si ON si.saleId = s.id
      JOIN units u ON u.id = si.unitId
      WHERE DATE(s.createdAt) BETWEEN ${input.startDate} AND ${input.endDate}
        AND s.status != 'cancelled'
      GROUP BY u.brand, u.model
      ORDER BY gross_profit DESC
    `;
    
    return db.execute(query);
  })
```

---

## 🔟 MÓDULO DE RENTABILIDAD

### 📋 Análisis de Cálculo de Márgenes

**Estado Actual:** ⚠️ PARCIALMENTE IMPLEMENTADO

```typescript
// Cálculo actual en analytics.ts:
// - Margin bruto = (revenue - COGS) / revenue
// - Margin neto = no implementado (falta deducir gastos operacionales)
```

### Fórmulas Financieras Correctas

#### 1. Margen Bruto
```
Margen Bruto (%) = ((Ventas - Costo de Ventas) / Ventas) × 100
```
**Estado:** ✅ IMPLEMENTADO (cuando COGS existe)

#### 2. Margen Operativo
```
Margen Operativo (%) = ((Ventas - COGS - Gastos Operativos) / Ventas) × 100
```
**Estado:** ❌ NO IMPLEMENTADO

#### 3. Margen Neto
```
Margen Neto (%) = ((Ventas - COGS - Gastos - Impuestos) / Ventas) × 100
```
**Estado:** ❌ NO IMPLEMENTADO

### 🔴 HALLAZGO CRÍTICO #10: Rentabilidad Incompleta
**Problema:** No se calculan márgenes operativos ni netos, solo margen bruto parcial.

**Recomendación:**
```typescript
// Nuevo módulo de rentabilidad:
export const profitabilityRouter = router({
  getCompleteProfitability: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      branchId: z.number().optional()
    }))
    .query(async ({ ctx, input }) => {
      // 1. Total de Ventas
      const sales = await getTotalSales(input.startDate, input.endDate);
      
      // 2. Costo de Ventas (COGS)
      const cogs = await getTotalCOGS(input.startDate, input.endDate);
      
      // 3. Gastos Operacionales
      const operationalExpenses = await getTotalExpenses(
        input.startDate, 
        input.endDate,
        ['fuel', 'meals', 'supplies', 'utilities']
      );
      
      // 4. Gastos Administrativos
      const adminExpenses = await getTotalExpenses(
        input.startDate,
        input.endDate,
        ['salaries', 'rent', 'marketing']
      );
      
      // Cálculos
      const grossProfit = sales - cogs;
      const grossMargin = (grossProfit / sales) * 100;
      
      const operatingProfit = grossProfit - operationalExpenses;
      const operatingMargin = (operatingProfit / sales) * 100;
      
      const netProfit = operatingProfit - adminExpenses;
      const netMargin = (netProfit / sales) * 100;
      
      return {
        sales,
        cogs,
        grossProfit,
        grossMargin,
        operationalExpenses,
        operatingProfit,
        operatingMargin,
        adminExpenses,
        netProfit,
        netMargin
      };
    })
});
```

---

## 📝 RESUMEN DE HALLAZGOS

### 🔴 CRÍTICOS (Requieren Acción Inmediata)

1. **Diferencias de Caja no se Calculan en Backend**
   - Módulo: Cajas de Vendedor
   - Riesgo: Manipulación de datos
   - Acción: Implementar cálculo automático en `requestClosing`

2. **Inconsistencias en Datos Históricos de Ventas**
   - Módulo: Cajas de Vendedor + Ventas
   - Riesgo: Reportes financieros incorrectos
   - Acción: Script de limpieza + validación pre-cierre

3. **COGS Incompletos en Ventas**
   - Módulo: Ventas + Rentabilidad
   - Riesgo: Márgenes de ganancia incorrectos
   - Acción: Validar purchasePrice obligatorio + costo promedio

4. **KPIs No Actualizados en Tiempo Real**
   - Módulo: Dashboards
   - Riesgo: Lentitud + sobrecarga DB
   - Acción: Implementar tabla de KPIs agregados

5. **Rentabilidad Incompleta**
   - Módulo: Rentabilidad
   - Riesgo: Decisiones de negocio sin datos completos
   - Acción: Implementar márgenes operativos y netos

### 🟡 MEDIOS (Mejoras Importantes)

6. **Falta Reconciliación entre Módulos**
   - Acción: Endpoint de reconciliación automática

7. **Categorías de Gastos Sin Normalizar**
   - Acción: Enum o tabla de categorías estándar

8. **Falta Flujo de Caja Proyectado**
   - Acción: Vista de proyección basada en C/Cobrar y C/Pagar

9. **Sin Notificaciones de Cuentas Vencidas**
   - Acción: Sistema de recordatorios automáticos

10. **Falta Reporte de Rentabilidad por Producto**
    - Acción: Reporte específico con márgenes

---

## 🎯 PLAN DE ACCIÓN RECOMENDADO

### Fase 1: Corrección de Críticos (1-2 semanas)
```
PRIORIDAD MÁXIMA:
☐ 1. Implementar cálculo automático de diferencias en caja
☐ 2. Script de limpieza de datos históricos
☐ 3. Validación de purchasePrice en registro de unidades
☐ 4. Implementar reconciliación básica
☐ 5. Agregar COGS promedio para fungibles
```

### Fase 2: Optimización de Performance (1 semana)
```
☐ 1. Tabla de KPIs agregados
☐ 2. Proceso diario de agregación
☐ 3. Índices en tablas financieras
☐ 4. Caché de reportes frecuentes
```

### Fase 3: Rentabilidad Completa (2 semanas)
```
☐ 1. Módulo de rentabilidad completo
☐ 2. Reporte de rentabilidad por producto
☐ 3. Dashboard de márgenes
☐ 4. Alertas de productos con margen bajo
```

### Fase 4: Mejoras de UX (1 semana)
```
☐ 1. Notificaciones de cuentas vencidas
☐ 2. Flujo de caja proyectado
☐ 3. Categorización de gastos
☐ 4. Validaciones pre-cierre de caja
```

---

## 📊 MÉTRICAS DE ÉXITO

### KPIs de Auditoría
- ✅ 100% de cajas con diferencias calculadas automáticamente
- ✅ 0% de ventas sin COGS registrado
- ✅ < 2 segundos para cargar dashboards principales
- ✅ 100% de reconciliaciones diarias exitosas
- ✅ Márgenes operativos y netos calculados diariamente

### Validaciones Automáticas
- ✅ Pre-cierre: validar que salesCash coincida con ventas reales
- ✅ Diario: reconciliar financial_transactions vs sales
- ✅ Semanal: reporte de productos sin purchasePrice
- ✅ Mensual: análisis de rentabilidad por categoría

---

## 🔒 CONCLUSIONES

### Fortalezas del Sistema Actual
1. ✅ Arquitectura sólida con separación de módulos
2. ✅ Registro automático de transacciones financieras
3. ✅ Trazabilidad de ventas desde caja del vendedor
4. ✅ Soporte para múltiples métodos de pago
5. ✅ Reportes exportables a Excel

### Áreas de Mejora Crítica
1. 🔴 Validaciones financieras en backend
2. 🔴 Cálculo completo de rentabilidad
3. 🔴 Performance de dashboards
4. 🔴 Reconciliación entre módulos

### Riesgo Financiero Actual
**MEDIO-ALTO**: Existen inconsistencias que pueden afectar reportes financieros y decisiones de negocio, pero la arquitectura permite corregirlas.

---

**Fin de la Auditoría**  
**Próxima Revisión:** Después de implementar Fase 1 del Plan de Acción
