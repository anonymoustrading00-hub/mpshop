import { relations } from "drizzle-orm";
import { int, mysqlEnum, mysqlTable, text, longtext, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique().notNull().default(""),
  username: varchar("username", { length: 100 }).unique(),
  passwordHash: text("passwordHash"),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "technician", "seller", "cashier", "user"]).default("seller").notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  allowedModules: text("allowedModules"), // JSON array of module keys or null for full access
  specialPermissions: text("specialPermissions"), // JSON object of special booleans
  assignedBranchIds: text("assignedBranchIds"), // JSON array of branch IDs or ["all"]
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Tabla de sesiones
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// Tabla de sucursales
export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  isMainWarehouse: int("isMainWarehouse").default(0).notNull(), // 1 para Bodega Principal
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Branch = typeof branches.$inferSelect;
export type InsertBranch = typeof branches.$inferInsert;

// Tabla intermedia Usuarios - Sucursales
export const userBranches = mysqlTable("userBranches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  branchId: int("branchId").notNull().references(() => branches.id),
  isDefault: int("isDefault").default(0).notNull(),
});

export type UserBranch = typeof userBranches.$inferSelect;
export type InsertUserBranch = typeof userBranches.$inferInsert;

// Configuración global del sistema
export const systemSettings = mysqlTable("systemSettings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// Tabla de clientes
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  clientNumber: varchar("clientNumber", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  zone: varchar("zone", { length: 100 }),
  address: text("address"),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  age: int("age"),
  gender: varchar("gender", { length: 30 }),
  socioeconomicLevel: varchar("socioeconomicLevel", { length: 50 }),
  sourceChannel: mysqlEnum("sourceChannel", ["facebook", "tiktok", "marketplace", "referral", "other"]).default("other"),
  customerType: mysqlEnum("customerType", ["retail", "wholesale"]).default("retail").notNull(),
  taxId: varchar("taxId", { length: 50 }), // NIT o CI
  creditLimit: int("creditLimit").notNull().default(0), // Limite en centavos
  creditDays: int("creditDays").notNull().default(30),
  allowCredit: int("allowCredit").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// Lotes de códigos pre-generados
export const generatedCodeBatches = mysqlTable("generatedCodeBatches", {
  id: int("id").autoincrement().primaryKey(),
  quantity: int("quantity").notNull(),
  type: mysqlEnum("type", ["qr", "barcode"]).notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedCodeBatch = typeof generatedCodeBatches.$inferSelect;
export type InsertGeneratedCodeBatch = typeof generatedCodeBatches.$inferInsert;

// Códigos individuales generados
export const generatedCodes = mysqlTable("generatedCodes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  type: mysqlEnum("type", ["qr", "barcode"]).notNull(),
  status: mysqlEnum("status", ["unassigned", "assigned"]).default("unassigned").notNull(),
  batchId: int("batchId").notNull().references(() => generatedCodeBatches.id),
  assignedUnitId: int("assignedUnitId"), // FK logica a units.id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  assignedAt: timestamp("assignedAt"),
});

export type GeneratedCode = typeof generatedCodes.$inferSelect;
export type InsertGeneratedCode = typeof generatedCodes.$inferInsert;

// Tabla de Proveedores
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  taxId: varchar("taxId", { length: 50 }),
  address: text("address"),
  creditDays: int("creditDays").notNull().default(30),
  creditLimit: int("creditLimit").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// Tabla de Compras a Proveedores
export const purchases = mysqlTable("purchases", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull().references(() => suppliers.id),
  purchaseNumber: varchar("purchaseNumber", { length: 50 }).notNull().unique(),
  orderDate: timestamp("orderDate").defaultNow().notNull(),
  totalAmount: int("totalAmount").notNull(), // Centavos
  status: mysqlEnum("status", ["pending", "received", "cancelled"]).default("pending").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid"]).default("pending").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer"]).default("cash"),
  isCredit: int("isCredit").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = typeof purchases.$inferInsert;

// Tabla principal de Unidades (Laptops, Tablets, Celulares, Monitores, Cargadores, Accesorios, Otros)
export const units = mysqlTable("units", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // "LT-0001", "TB-0001", etc.
  // RMA permanente del equipo — se asigna la primera vez que entra al taller y nunca cambia
  rmaNumber: varchar("rmaNumber", { length: 30 }).unique(),
  codeId: int("codeId").references(() => generatedCodes.id),
  type: mysqlEnum("type", ["laptop", "tablet", "phone", "monitor", "charger", "accessory", "other"]).notNull(),
  brand: varchar("brand", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  serialNumber: varchar("serialNumber", { length: 100 }), // IMEI para phones/tablets, S/N para laptops
  specs: text("specs"), // JSON libre: cpu, ram, storage, gpu, screenSize, resolution, batteryDuration, etc.
  condition: int("condition"), // 1-10 (nullable para accesorios/cargadores)
  batteryHealth: mysqlEnum("batteryHealth", ["good", "fair", "bad_plugged_only", "n_a"]).default("n_a").notNull(),
  damageChecklist: text("damageChecklist"), // JSON: ver checklist por tipo en /client/src/pages/RegisterUnit.tsx
  damageNotes: text("damageNotes"),
  functionalTestPassed: int("functionalTestPassed").default(1), // 1=true, 0=false (para accesorios)
  status: mysqlEnum("status", ["in_diagnosis", "in_repair", "available", "sold", "returned"]).default("in_diagnosis").notNull(),
  purchaseId: int("purchaseId").references(() => purchases.id),
  purchasePrice: int("purchasePrice").notNull(), // centavos
  salePrice: int("salePrice"), // centavos - Precio Venta Unit
  discountPrice: int("discountPrice"), // centavos - Precio Descuento
  wholesalePrice: int("wholesalePrice"), // centavos - Precio Mayor
  supplierId: int("supplierId").references(() => suppliers.id),
  purchaseDate: varchar("purchaseDate", { length: 10 }), // YYYY-MM-DD
  photos: longtext("photos"), // JSON array of base64 image strings
  tiktokUrl: varchar("tiktokUrl", { length: 500 }), // Enlace a video de TikTok
  branchId: int("branchId").notNull().default(1).references(() => branches.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Unit = typeof units.$inferSelect;
export type InsertUnit = typeof units.$inferInsert;

// Historial de eventos / estados de cada unidad
export const unitEvents = mysqlTable("unitEvents", {
  id: int("id").autoincrement().primaryKey(),
  unitId: int("unitId").notNull().references(() => units.id),
  eventType: varchar("eventType", { length: 50 }).notNull(), // "created", "status_change", "repair_start", "sold", "returned"
  fromStatus: varchar("fromStatus", { length: 50 }),
  toStatus: varchar("toStatus", { length: 50 }),
  userId: int("userId").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UnitEvent = typeof unitEvents.$inferSelect;
export type InsertUnitEvent = typeof unitEvents.$inferInsert;

// Tabla de Taller / Reparaciones
export const repairs = mysqlTable("repairs", {
  id: int("id").autoincrement().primaryKey(),
  // rmaNumber: referencia al RMA permanente de la unidad (units.rmaNumber) — solo para display rápido
  rmaNumber: varchar("rmaNumber", { length: 30 }).unique(),
  // otNumber: número de Orden de Trabajo — nuevo por cada entrada al taller
  otNumber: varchar("otNumber", { length: 30 }).unique(),
  unitId: int("unitId").notNull().references(() => units.id),
  technicianId: int("technicianId").references(() => users.id),
  startDate: timestamp("startDate").defaultNow().notNull(),
  endDate: timestamp("endDate"),
  partsUsed: text("partsUsed"), // JSON
  laborCost: int("laborCost").default(0).notNull(), // centavos
  partsCost: int("partsCost").default(0).notNull(), // centavos
  status: mysqlEnum("status", ["in_progress", "completed", "cancelled"]).default("in_progress").notNull(),
  resolutionType: mysqlEnum("resolutionType", ["return_to_customer", "return_to_inventory"]),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Repair = typeof repairs.$inferSelect;
export type InsertRepair = typeof repairs.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// Tabla de Empleados
// ─────────────────────────────────────────────────────────────────────────────
export const employees = mysqlTable("employees", {
  id:           int("id").autoincrement().primaryKey(),
  // Identificación
  fullName:     varchar("fullName", { length: 255 }).notNull(),
  ci:           varchar("ci", { length: 20 }),                     // Cédula de Identidad
  // Rol laboral en el negocio
  role: mysqlEnum("role", [
    "repartidor",   // delivery
    "ventas",       // sales
    "almacen",      // warehouse
    "tecnico",      // technician
    "administracion",
    "otro",
  ]).notNull().default("otro"),
  // Vínculo opcional con usuario del sistema (técnicos, repartidores ya registrados)
  userId:       int("userId").references(() => users.id),
  // Datos de pago
  baseSalary:   int("baseSalary").notNull().default(0),     // centavos Bs.
  // Descuentos fijos mensuales (AFP, seguro, etc.) — JSON: [{name, amount}]
  fixedDeductions: text("fixedDeductions"),
  // Datos de contacto
  phone:        varchar("phone", { length: 20 }),
  address:      varchar("address", { length: 255 }),
  // Fechas
  startDate:    varchar("startDate", { length: 10 }),       // YYYY-MM-DD
  birthDate:    varchar("birthDate", { length: 10 }),       // YYYY-MM-DD
  // Estado
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("active"),
  // Notas adicionales
  notes:        text("notes"),
  branchId:     int("branchId").notNull().default(1).references(() => branches.id),
  createdAt:    timestamp("createdAt").defaultNow().notNull(),
  updatedAt:    timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Employee    = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  deliveryPersonId: int("deliveryPersonId").references(() => users.id),
  zone: varchar("zone", { length: 100 }),
  status: mysqlEnum("status", ["pending", "assigned", "in_transit", "delivered", "cancelled", "rescheduled"]).default("pending").notNull(),
  totalPrice: int("totalPrice").notNull(), // centavos
  paymentMethod: mysqlEnum("paymentMethod", ["qr", "cash", "transfer"]),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "completed", "failed"]).default("pending").notNull(),
  notes: text("notes"),
  sourceChannel: mysqlEnum("sourceChannel", ["facebook", "tiktok", "marketplace", "referral", "other"]).default("other"),
  cancelledBy: mysqlEnum("cancelledBy", ["client", "company", "system"]),
  cancelReason: text("cancelReason"),
  rescheduleReason: text("rescheduleReason"),
  deliveryDate: varchar("deliveryDate", { length: 10 }),
  deliveryTime: varchar("deliveryTime", { length: 5 }),
  rescheduleRequested: int("rescheduleRequested").default(0),
  requestedDate: varchar("requestedDate", { length: 10 }),
  requestedTime: varchar("requestedTime", { length: 5 }),
  cancellationRequested: int("cancellationRequested").default(0),
  cancellationReason: text("cancellationReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deliveredAt: timestamp("deliveredAt"),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// Items del pedido (referenciando unidad única)
export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  unitId: int("unitId").notNull().references(() => units.id),
  quantity: int("quantity").notNull().default(1),
  price: int("price").notNull(), // Precio venta unitario en centavos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// Tabla de Ventas Presenciales/Directas
export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  saleNumber: varchar("saleNumber", { length: 50 }).notNull().unique(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id),
  customerId: int("customerId").references(() => customers.id),
  customerName: varchar("customerName", { length: 255 }),
  saleChannel: mysqlEnum("saleChannel", ["local", "delivery"]).notNull().default("local"),
  status: mysqlEnum("status", ["completed", "cancelled"]).notNull().default("completed"),
  orderId: int("orderId").references(() => orders.id),
  soldBy: int("soldBy").notNull().references(() => users.id),
  subtotal: int("subtotal").notNull(),
  discountType: mysqlEnum("discountType", ["none", "percentage", "fixed"]).notNull().default("none"),
  discountValue: int("discountValue").notNull().default(0),
  discountAmount: int("discountAmount").notNull().default(0),
  total: int("total").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer", "credit"]).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "completed"]).default("completed").notNull(),
  dueDate: varchar("dueDate", { length: 10 }),
  warrantyDays: int("warrantyDays").default(30).notNull(),
  adminOverrideUserId: int("adminOverrideUserId").references(() => users.id),
  notes: text("notes"),
  cancelReason: text("cancelReason"),
  cancelledAt: timestamp("cancelledAt"),
  cancelledBy: int("cancelledBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

// Items de la venta
export const saleItems = mysqlTable("saleItems", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull().references(() => sales.id),
  productId: int("productId"),                                                    // nullable — inventario general
  unitId: int("unitId"),                                                          // nullable — equipos/unidades
  pricingType: mysqlEnum("pricingType", ["unit", "wholesale", "discount"]).notNull().default("unit"),
  quantity: int("quantity").notNull().default(1),
  basePrice: int("basePrice").notNull(),
  discountType: mysqlEnum("discountType", ["none", "percentage", "fixed"]).notNull().default("none"),
  discountValue: int("discountValue").notNull().default(0),
  discountAmount: int("discountAmount").notNull().default(0),
  finalUnitPrice: int("finalUnitPrice").notNull().default(0),
  subtotal: int("subtotal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = typeof saleItems.$inferInsert;

// Tabla de Garantías
export const warranties = mysqlTable("warranties", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").references(() => sales.id),
  orderId: int("orderId").references(() => orders.id),
  unitId: int("unitId").notNull().references(() => units.id),
  days: int("days").notNull(), // Días de garantía (ej: 30, 90, 180)
  startDate: timestamp("startDate").defaultNow().notNull(),
  endDate: timestamp("endDate").notNull(),
  status: mysqlEnum("status", ["active", "expired", "claimed"]).default("active").notNull(),
  pausedAt: timestamp("pausedAt"),
  remainingDaysAtPause: int("remainingDaysAtPause"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Warranty = typeof warranties.$inferSelect;
export type InsertWarranty = typeof warranties.$inferInsert;

// Tabla de Devoluciones (RMA)
export const returns = mysqlTable("returns", {
  id: int("id").autoincrement().primaryKey(),
  warrantyId: int("warrantyId").references(() => warranties.id),
  unitId: int("unitId").notNull().references(() => units.id),
  // Si hay venta asociada (para poder anularla o registrar el reembolso)
  saleId: int("saleId").references(() => sales.id),
  returnDate: timestamp("returnDate").defaultNow().notNull(),
  reason: text("reason").notNull(),
  resolution: text("resolution"),
  reenteredRepair: int("reenteredRepair").default(0).notNull(),
  // Devolución de dinero: monto en centavos y método de caja por donde sale
  refundAmount: int("refundAmount"),
  refundPaymentMethod: varchar("refundPaymentMethod", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReturnRma = typeof returns.$inferSelect;
export type InsertReturnRma = typeof returns.$inferInsert;

// Items de compra
export const purchaseItems = mysqlTable("purchaseItems", {
  id: int("id").autoincrement().primaryKey(),
  purchaseId: int("purchaseId").notNull().references(() => purchases.id),
  productId: int("productId"),             // nullable — solo se usa en compras de inventario de productos
  unitId: int("unitId"),                   // nullable — se usa en compras de unidades/equipos
  quantity: int("quantity").notNull().default(1),
  price: int("price").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type InsertPurchaseItem = typeof purchaseItems.$inferInsert;

// Cuentas por Pagar (CXP)
export const accountsPayable = mysqlTable("accountsPayable", {
  id: int("id").autoincrement().primaryKey(),
  purchaseId: int("purchaseId").notNull().references(() => purchases.id),
  supplierId: int("supplierId").notNull().references(() => suppliers.id),
  totalAmount: int("totalAmount").notNull(),
  paidAmount: int("paidAmount").notNull().default(0),
  balance: int("balance").notNull(),
  dueDate: varchar("dueDate", { length: 10 }),
  status: mysqlEnum("status", ["unpaid", "partially_paid", "paid", "overdue"]).default("unpaid").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountsPayable = typeof accountsPayable.$inferSelect;
export type InsertAccountsPayable = typeof accountsPayable.$inferInsert;

// Cuentas por Cobrar (CXC)
export const accountsReceivable = mysqlTable("accountsReceivable", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull().references(() => sales.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  totalAmount: int("totalAmount").notNull(),
  paidAmount: int("paidAmount").notNull().default(0),
  balance: int("balance").notNull(),
  dueDate: varchar("dueDate", { length: 10 }),
  status: mysqlEnum("status", ["unpaid", "partially_paid", "paid", "overdue"]).default("unpaid").notNull(),
  adminOverrideUserId: int("adminOverrideUserId").references(() => users.id),
  adminOverrideReason: text("adminOverrideReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountsReceivable = typeof accountsReceivable.$inferSelect;
export type InsertAccountsReceivable = typeof accountsReceivable.$inferInsert;

// Historial de Pagos / Abonos
export const creditPayments = mysqlTable("creditPayments", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["receivable", "payable"]).notNull(),
  accountsReceivableId: int("accountsReceivableId").references(() => accountsReceivable.id),
  accountsPayableId: int("accountsPayableId").references(() => accountsPayable.id),
  customerId: int("customerId").references(() => customers.id),
  supplierId: int("supplierId").references(() => suppliers.id),
  amount: int("amount").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer"]).notNull().default("cash"),
  reference: varchar("reference", { length: 255 }),
  notes: text("notes"),
  userId: int("userId").notNull().references(() => users.id),
  receiptNumber: varchar("receiptNumber", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditPayment = typeof creditPayments.$inferSelect;
export type InsertCreditPayment = typeof creditPayments.$inferInsert;

// Gastos de repartidor
export const deliveryExpenses = mysqlTable("deliveryExpenses", {
  id: int("id").autoincrement().primaryKey(),
  deliveryPersonId: int("deliveryPersonId").notNull().references(() => users.id),
  orderId: int("orderId").references(() => orders.id),
  amount: int("amount").notNull(),
  type: mysqlEnum("type", ["fuel", "subsistence", "other"]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DeliveryExpense = typeof deliveryExpenses.$inferSelect;
export type InsertDeliveryExpense = typeof deliveryExpenses.$inferInsert;

// Gastos operacionales
export const operationalExpenses = mysqlTable("operationalExpenses", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id),
  description: varchar("description", { length: 255 }).notNull(),
  category: mysqlEnum("category", [
    "facebook_ads",
    "google_ads",
    "electricity",
    "water",
    "internet",
    "telephone",
    "rent",
    "salaries",
    "maintenance",
    "supplies",
    "taxes",
    "insurance",
    "bank_fees",
    // Costos directos del negocio (se crean automáticamente)
    "repair_cost",
    "warranty_repair_cost",
    "warranty_replacement_cost",
    "cogs",
    "other"
  ]).notNull(),
  // Clasificación de alto nivel: "direct_cost" | "repair_cost" | "warranty_cost" | "operational_expense" | "admin_expense"
  costType: varchar("costType", { length: 50 }),
  // Referencia al origen del costo (repair, sale, warranty, return)
  referenceType: varchar("referenceType", { length: 50 }),
  referenceId: int("referenceId"),
  // 1 = generado automáticamente por el sistema, 0 = ingresado manualmente
  isAutomatic: int("isAutomatic").notNull().default(0),
  amount: int("amount").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer"]).notNull(),
  expenseDate: timestamp("expenseDate").defaultNow().notNull(),
  dueDate: timestamp("dueDate"),
  status: mysqlEnum("status", ["pending", "paid"]).default("pending").notNull(),
  supplierName: varchar("supplierName", { length: 255 }),
  invoiceNumber: varchar("invoiceNumber", { length: 100 }),
  notes: text("notes"),
  userId: int("userId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OperationalExpense = typeof operationalExpenses.$inferSelect;
export type InsertOperationalExpense = typeof operationalExpenses.$inferInsert;

// Transacciones financieras (Libro Diario)
export const financialTransactions = mysqlTable("financialTransactions", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer"]).default("cash"),
  amount: int("amount").notNull(),
  // Para COGS: costo de adquisición de la unidad vendida (centavos)
  unitCost: int("unitCost"),
  userId: int("userId").references(() => users.id),
  referenceId: int("referenceId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type InsertFinancialTransaction = typeof financialTransactions.$inferInsert;

// GPS Tracking
export const gpsTracking = mysqlTable("gpsTracking", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  deliveryPersonId: int("deliveryPersonId").notNull().references(() => users.id),
  latitude: varchar("latitude", { length: 50 }).notNull(),
  longitude: varchar("longitude", { length: 50 }).notNull(),
  accuracy: int("accuracy"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type GPSTracking = typeof gpsTracking.$inferSelect;
export type InsertGPSTracking = typeof gpsTracking.$inferInsert;

// Cierres de Caja
export const cashClosures = mysqlTable("cash_closures", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id),
  userId: int("userId").notNull().references(() => users.id),
  date: varchar("date", { length: 10 }).notNull(),
  initialCash: int("initialCash").default(0),
  reportedCash: int("reportedCash").default(0),
  reportedQr: int("reportedQr").default(0),
  reportedTransfer: int("reportedTransfer").default(0),
  expectedCash: int("expectedCash").default(0),
  expectedQr: int("expectedQr").default(0),
  expectedTransfer: int("expectedTransfer").default(0),
  expenses: int("expenses").default(0),
  pendingOrders: int("pendingOrders").default(0),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CashClosure = typeof cashClosures.$inferSelect;
export type InsertCashClosure = typeof cashClosures.$inferInsert;

// Aperturas de Caja
export const cashOpenings = mysqlTable("cash_openings", {
  id: int("id").autoincrement().primaryKey(),
  openingDate: varchar("openingDate", { length: 10 }).notNull(),
  openingAmount: int("openingAmount").notNull().default(0),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer"]).default("cash"),
  responsibleUserId: int("responsibleUserId").notNull().references(() => users.id),
  openedByUserId: int("openedByUserId").notNull().references(() => users.id),
  status: mysqlEnum("status", ["open", "closed"]).notNull().default("open"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CashOpening = typeof cashOpenings.$inferSelect;
export type InsertCashOpening = typeof cashOpenings.$inferInsert;

// Audit Log
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: int("entityId").notNull(),
  action: mysqlEnum("action", ["CREATE", "UPDATE", "DELETE"]).notNull(),
  userId: int("userId").references(() => users.id),
  oldValues: text("oldValues"),
  newValues: text("newValues"),
  description: text("description"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// Cotizaciones
export const quotations = mysqlTable("quotations", {
  id: int("id").autoincrement().primaryKey(),
  quotationNumber: varchar("quotationNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId").references(() => customers.id),
  customerName: varchar("customerName", { length: 255 }),
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).notNull().default("pending"),
  subtotal: int("subtotal").notNull(),
  discountType: mysqlEnum("discountType", ["none", "percentage", "fixed"]).notNull().default("none"),
  discountValue: int("discountValue").notNull().default(0),
  discountAmount: int("discountAmount").notNull().default(0),
  total: int("total").notNull(),
  validUntil: timestamp("validUntil"),
  notes: text("notes"),
  termsAndConditions: text("termsAndConditions"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

// Items de Cotización
export const quotationItems = mysqlTable("quotationItems", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull().references(() => quotations.id),
  unitId: int("unitId").notNull().references(() => units.id),
  quantity: int("quantity").notNull().default(1),
  basePrice: int("basePrice").notNull(),
  discountType: mysqlEnum("discountType", ["none", "percentage", "fixed"]).notNull().default("none"),
  discountValue: int("discountValue").notNull().default(0),
  discountAmount: int("discountAmount").notNull().default(0),
  finalUnitPrice: int("finalUnitPrice").notNull().default(0),
  subtotal: int("subtotal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = typeof quotationItems.$inferInsert;

// Traspasos entre Sucursales
export const inventoryTransfers = mysqlTable("inventory_transfers", {
  id: int("id").autoincrement().primaryKey(),
  transferNumber: varchar("transferNumber", { length: 50 }).notNull().unique(),
  direction: mysqlEnum("direction", ["branch_transfer"]).notNull().default("branch_transfer"),
  sourceBranchId: int("sourceBranchId").notNull().default(1).references(() => branches.id),
  destinationBranchId: int("destinationBranchId").notNull().default(1).references(() => branches.id),
  status: mysqlEnum("status", ["pending", "in_transit", "completed", "cancelled"]).default("pending").notNull(),
  userId: int("userId").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryTransfer = typeof inventoryTransfers.$inferSelect;
export type InsertInventoryTransfer = typeof inventoryTransfers.$inferInsert;

export const inventoryTransferItems = mysqlTable("inventory_transfer_items", {
  id: int("id").autoincrement().primaryKey(),
  transferId: int("transferId").notNull().references(() => inventoryTransfers.id),
  unitId: int("unitId").notNull().references(() => units.id),
  quantity: int("quantity").notNull().default(1),
  unitCode: varchar("unitCode", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryTransferItem = typeof inventoryTransferItems.$inferSelect;
export type InsertInventoryTransferItem = typeof inventoryTransferItems.$inferInsert;

// Relaciones Drizzle API
export const unitsRelations = relations(units, ({ one, many }) => ({
  branch: one(branches, {
    fields: [units.branchId],
    references: [branches.id],
  }),
  supplier: one(suppliers, {
    fields: [units.supplierId],
    references: [suppliers.id],
  }),
  purchase: one(purchases, {
    fields: [units.purchaseId],
    references: [purchases.id],
  }),
  generatedCode: one(generatedCodes, {
    fields: [units.codeId],
    references: [generatedCodes.id],
  }),
  events: many(unitEvents),
  repairs: many(repairs),
  warranties: many(warranties),
}));

export const unitEventsRelations = relations(unitEvents, ({ one }) => ({
  unit: one(units, {
    fields: [unitEvents.unitId],
    references: [units.id],
  }),
  user: one(users, {
    fields: [unitEvents.userId],
    references: [users.id],
  }),
}));

export const repairsRelations = relations(repairs, ({ one }) => ({
  unit: one(units, {
    fields: [repairs.unitId],
    references: [units.id],
  }),
  technician: one(users, {
    fields: [repairs.technicianId],
    references: [users.id],
  }),
}));

export const warrantiesRelations = relations(warranties, ({ one, many }) => ({
  unit: one(units, {
    fields: [warranties.unitId],
    references: [units.id],
  }),
  sale: one(sales, {
    fields: [warranties.saleId],
    references: [sales.id],
  }),
  order: one(orders, {
    fields: [warranties.orderId],
    references: [orders.id],
  }),
  returns: many(returns),
}));

export const returnsRelations = relations(returns, ({ one }) => ({
  warranty: one(warranties, {
    fields: [returns.warrantyId],
    references: [warranties.id],
  }),
  unit: one(units, {
    fields: [returns.unitId],
    references: [units.id],
  }),
}));

export const generatedCodesRelations = relations(generatedCodes, ({ one }) => ({
  batch: one(generatedCodeBatches, {
    fields: [generatedCodes.batchId],
    references: [generatedCodeBatches.id],
  }),
  assignedUnit: one(units, {
    fields: [generatedCodes.assignedUnitId],
    references: [units.id],
  }),
}));

export const generatedCodeBatchesRelations = relations(generatedCodeBatches, ({ one, many }) => ({
  creator: one(users, {
    fields: [generatedCodeBatches.createdBy],
    references: [users.id],
  }),
  codes: many(generatedCodes),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  deliveryPerson: one(users, {
    fields: [orders.deliveryPersonId],
    references: [users.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  unit: one(units, {
    fields: [orderItems.unitId],
    references: [units.id],
  }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  items: many(saleItems),
  order: one(orders, {
    fields: [sales.orderId],
    references: [orders.id],
  }),
  seller: one(users, {
    fields: [sales.soldBy],
    references: [users.id],
  }),
  warranties: many(warranties),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  unit: one(units, {
    fields: [saleItems.unitId],
    references: [units.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  sales: many(sales),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(userBranches),
  units: many(units),
  sales: many(sales),
  orders: many(orders),
}));

export const userBranchesRelations = relations(userBranches, ({ one }) => ({
  user: one(users, {
    fields: [userBranches.userId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [userBranches.branchId],
    references: [branches.id],
  }),
}));
