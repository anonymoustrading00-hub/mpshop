import { relations } from "drizzle-orm";
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. Nullable para usuarios tradicionales. */
  openId: varchar("openId", { length: 64 }).unique().notNull().default(""),
  /** Username para login tradicional */
  username: varchar("username", { length: 100 }).unique(),
  /** Password hasheada con bcrypt */
  passwordHash: text("passwordHash"),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
  isDefault: int("isDefault").default(0).notNull(), // 1 para la sucursal por defecto del usuario
});

export type UserBranch = typeof userBranches.$inferSelect;
export type InsertUserBranch = typeof userBranches.$inferInsert;

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
  interestHealthFitness: int("interestHealthFitness").notNull().default(0),
  interestNaturalFood: int("interestNaturalFood").notNull().default(0),
  interestDigestiveIssues: int("interestDigestiveIssues").notNull().default(0),
  lifestyleGym: int("lifestyleGym").notNull().default(0),
  lifestyleVegan: int("lifestyleVegan").notNull().default(0),
  taxId: varchar("taxId", { length: 50 }), // NIT o CI
  creditLimit: int("creditLimit").notNull().default(0), // Limite de credito en centavos (ej: 500000 = Bs 5000)
  creditDays: int("creditDays").notNull().default(30), // Dias de credito permitidos
  allowCredit: int("allowCredit").notNull().default(1), // 1 permite venta a credito, 0 prohibido
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// Tabla de productos
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // Código personalizado del producto
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["finished_product", "raw_material", "supplies", "insumo"]).notNull().default("finished_product"), // Producto terminado, Materia prima, Suministro, Insumo
  price: int("price").notNull(), // Precio de Compra en centavos
  salePrice: int("salePrice").notNull().default(0), // Precio de Venta Unitario en centavos
  wholesalePrice: int("wholesalePrice").notNull().default(0), // Precio de Venta por Mayor en centavos
  discountPrice: int("discountPrice").notNull().default(0), // Precio de Venta con Descuento en centavos
  wholesaleDiscountType: mysqlEnum("wholesaleDiscountType", ["percentage", "fixed"]).default("percentage"), // Tipo de descuento por mayor
  wholesaleDiscountValue: int("wholesaleDiscountValue").notNull().default(0), // Valor del descuento por mayor (% o centavos)
  unit: varchar("unit", { length: 20 }).notNull().default("unidad"), // Unidad operativa: L, ml, kg, g, unidad
  presentationQuantity: int("presentationQuantity").notNull().default(1), // Cantidad por presentacion en la unidad operativa
  presentationUnit: varchar("presentationUnit", { length: 20 }).notNull().default("unidad"), // Unidad de compra/presentacion
  presentationVolumeMl: int("presentationVolumeMl").notNull().default(0), // Volumen por envase/bolsa para balance de masa
  presentationWeightGr: int("presentationWeightGr").notNull().default(0), // Peso por envase/paquete para balance de masa
  productionRole: mysqlEnum("productionRole", ["none", "milk", "sugar", "culture", "bottle", "cap", "label", "packaging", "finished_good", "other"]).notNull().default("none"),
  storageLocation: varchar("storageLocation", { length: 100 }),
  supplierName: varchar("supplierName", { length: 255 }),
  productionNotes: text("productionNotes"),
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("active"),
  imageUrl: varchar("imageUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// Tabla de inventario
export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id),
  branchId: int("branchId").notNull().default(1).references(() => branches.id), // Nuevo: Sucursal
  batchNumber: varchar("batchNumber", { length: 50 }), // Nuevo: Número de lote
  quantity: int("quantity").notNull().default(0),
  minStock: int("minStock").notNull().default(10),
  expiryDate: varchar("expiryDate", { length: 10 }), // Formato: YYYY-MM-DD
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
});

// Tabla de movimientos de inventario
export const inventoryMovements = mysqlTable("inventoryMovements", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id),
  branchId: int("branchId").notNull().default(1).references(() => branches.id), // Nuevo: Sucursal
  type: mysqlEnum("type", ["entry", "exit", "adjustment"]).notNull(), // Entrada, Salida, Ajuste
  quantity: int("quantity").notNull(),
  reason: varchar("reason", { length: 255 }), // Razón del movimiento
  notes: text("notes"),
  userId: int("userId").references(() => users.id), // Nuevo: Usuario que realizó el movimiento
  orderId: int("orderId").references(() => orders.id), // Nuevo: Pedido vinculado
  saleId: int("saleId").references(() => sales.id), // Nuevo: Venta vinculada
  batchNumber: varchar("batchNumber", { length: 50 }), // Nuevo: Lote asociado al movimiento
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovements.$inferInsert;

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

// Tabla de pedidos
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id), // Nuevo: Sucursal
  customerId: int("customerId").notNull().references(() => customers.id),
  deliveryPersonId: int("deliveryPersonId").references(() => users.id),
  zone: varchar("zone", { length: 100 }),
  status: mysqlEnum("status", ["pending", "assigned", "in_transit", "delivered", "cancelled", "rescheduled"]).default("pending").notNull(),
  totalPrice: int("totalPrice").notNull(), // Precio total en centavos
  paymentMethod: mysqlEnum("paymentMethod", ["qr", "cash", "transfer"]),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "completed", "failed"]).default("pending").notNull(),
  notes: text("notes"),
  sourceChannel: mysqlEnum("sourceChannel", ["facebook", "tiktok", "marketplace", "referral", "other"]).default("other"),
  cancelledBy: mysqlEnum("cancelledBy", ["client", "company", "system"]),
  cancelReason: text("cancelReason"),
  rescheduleReason: text("rescheduleReason"),
  deliveryDate: varchar("deliveryDate", { length: 10 }), // Formato: YYYY-MM-DD
  deliveryTime: varchar("deliveryTime", { length: 5 }), // Formato: HH:MM
  rescheduleRequested: int("rescheduleRequested").default(0), // 1 si se solicitó reprogramación
  requestedDate: varchar("requestedDate", { length: 10 }),
  requestedTime: varchar("requestedTime", { length: 5 }),
  cancellationRequested: int("cancellationRequested").default(0), // 1 si se solicitó baja
  cancellationReason: text("cancellationReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deliveredAt: timestamp("deliveredAt"),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// Tabla de items del pedido
export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  productId: int("productId").notNull().references(() => products.id),
  pricingType: mysqlEnum("pricingType", ["unit", "wholesale", "discount"]).notNull().default("unit"),
  quantity: int("quantity").notNull(),
  price: int("price").notNull(), // Precio unitario en centavos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// Tabla de pagos
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  amount: int("amount").notNull(), // Monto en centavos
  method: mysqlEnum("method", ["qr", "cash", "transfer"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  reference: varchar("reference", { length: 255 }), // Referencia de transferencia o QR
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// Tabla de proveedores
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  taxId: varchar("taxId", { length: 50 }), // NIT o CI
  address: text("address"),
  creditDays: int("creditDays").notNull().default(30), // Dias de credito del proveedor
  creditLimit: int("creditLimit").notNull().default(0), // Limite de credito en centavos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// Tabla de compras
export const purchases = mysqlTable("purchases", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull().references(() => suppliers.id),
  purchaseNumber: varchar("purchaseNumber", { length: 50 }).notNull().unique(),
  orderDate: timestamp("orderDate").defaultNow().notNull(),
  totalAmount: int("totalAmount").notNull(),
  status: mysqlEnum("status", ["pending", "received", "cancelled"]).default("pending").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid"]).default("pending").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer"]).default("cash"),
  isCredit: int("isCredit").default(0), // 1 para crédito, 0 para contado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = typeof purchases.$inferInsert;

// Tabla de items de compra
export const purchaseItems = mysqlTable("purchaseItems", {
  id: int("id").autoincrement().primaryKey(),
  purchaseId: int("purchaseId").notNull().references(() => purchases.id),
  productId: int("productId").notNull().references(() => products.id),
  quantity: int("quantity").notNull(),
  price: int("price").notNull(),
  batchNumber: varchar("batchNumber", { length: 50 }), // Nuevo: Lote
  expiryDate: varchar("expiryDate", { length: 10 }), // Lote con fecha de vencimiento
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type InsertPurchaseItem = typeof purchaseItems.$inferInsert;

// Tabla de cuentas por pagar (CXP)
export const accountsPayable = mysqlTable("accountsPayable", {
  id: int("id").autoincrement().primaryKey(),
  purchaseId: int("purchaseId").notNull().references(() => purchases.id),
  supplierId: int("supplierId").notNull().references(() => suppliers.id),
  totalAmount: int("totalAmount").notNull(), // Monto total en centavos
  paidAmount: int("paidAmount").notNull().default(0), // Monto pagado hasta la fecha
  balance: int("balance").notNull(), // Saldo pendiente en centavos
  dueDate: varchar("dueDate", { length: 10 }), // YYYY-MM-DD
  status: mysqlEnum("status", ["unpaid", "partially_paid", "paid", "overdue"]).default("unpaid").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountsPayable = typeof accountsPayable.$inferSelect;
export type InsertAccountsPayable = typeof accountsPayable.$inferInsert;

// Tabla de cuentas por cobrar (CXC)
export const accountsReceivable = mysqlTable("accountsReceivable", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull().references(() => sales.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  totalAmount: int("totalAmount").notNull(), // Monto total en centavos
  paidAmount: int("paidAmount").notNull().default(0), // Monto abonado
  balance: int("balance").notNull(), // Saldo pendiente en centavos
  dueDate: varchar("dueDate", { length: 10 }), // YYYY-MM-DD
  status: mysqlEnum("status", ["unpaid", "partially_paid", "paid", "overdue"]).default("unpaid").notNull(),
  adminOverrideUserId: int("adminOverrideUserId").references(() => users.id),
  adminOverrideReason: text("adminOverrideReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountsReceivable = typeof accountsReceivable.$inferSelect;
export type InsertAccountsReceivable = typeof accountsReceivable.$inferInsert;

// Tabla de historial de abonos / pagos a deudas (CXC y CXP)
export const creditPayments = mysqlTable("creditPayments", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["receivable", "payable"]).notNull(), // receivable (CXC) o payable (CXP)
  accountsReceivableId: int("accountsReceivableId").references(() => accountsReceivable.id),
  accountsPayableId: int("accountsPayableId").references(() => accountsPayable.id),
  customerId: int("customerId").references(() => customers.id),
  supplierId: int("supplierId").references(() => suppliers.id),
  amount: int("amount").notNull(), // Monto abonado en centavos
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer"]).notNull().default("cash"),
  reference: varchar("reference", { length: 255 }), // Numero de recibo o comprobante de pago
  notes: text("notes"),
  userId: int("userId").notNull().references(() => users.id), // Quien cobró o pagó
  receiptNumber: varchar("receiptNumber", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditPayment = typeof creditPayments.$inferSelect;
export type InsertCreditPayment = typeof creditPayments.$inferInsert;

// Tabla de gastos de repartidor
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

// Tabla de gastos operativos (servicios, publicidad, alquiler, etc.)
export const operationalExpenses = mysqlTable("operationalExpenses", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id), // Nuevo: Sucursal
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
    "other"
  ]).notNull(),
  amount: int("amount").notNull(), // Monto en centavos
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer"]).notNull(),
  expenseDate: timestamp("expenseDate").defaultNow().notNull(), // Fecha del gasto
  dueDate: timestamp("dueDate"), // Fecha de vencimiento (para gastos pendientes)
  status: mysqlEnum("status", ["pending", "paid"]).default("pending").notNull(),
  supplierName: varchar("supplierName", { length: 255 }), // Empresa/proveedor del servicio
  invoiceNumber: varchar("invoiceNumber", { length: 100 }), // Número de factura/comprobante
  notes: text("notes"),
  userId: int("userId").references(() => users.id), // Usuario que registró
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OperationalExpense = typeof operationalExpenses.$inferSelect;
export type InsertOperationalExpense = typeof operationalExpenses.$inferInsert;

// Tabla de transacciones financieras (Libro Diario)
export const financialTransactions = mysqlTable("financialTransactions", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id), // Nuevo: Sucursal
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  category: varchar("category", { length: 100 }).notNull(), // sale, purchase, salary, fuel, etc.
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer"]).default("cash"),
  amount: int("amount").notNull(),
  userId: int("userId").references(() => users.id), // Usuario que generó la transacción
  referenceId: int("referenceId"), // ID del pedido o compra
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type InsertFinancialTransaction = typeof financialTransactions.$inferInsert;

// Tabla de rastreo GPS
export const gpsTracking = mysqlTable("gpsTracking", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  deliveryPersonId: int("deliveryPersonId").notNull().references(() => users.id),
  latitude: varchar("latitude", { length: 50 }).notNull(),
  longitude: varchar("longitude", { length: 50 }).notNull(),
  accuracy: int("accuracy"), // Precisión en metros
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type GPSTracking = typeof gpsTracking.$inferSelect;
export type InsertGPSTracking = typeof gpsTracking.$inferInsert;

// Tabla de cierres de caja (NUEVO)
export const cashClosures = mysqlTable("cash_closures", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id), // Nuevo: Sucursal
  userId: int("userId").notNull().references(() => users.id),
  date: varchar("date", { length: 10 }).notNull(), // Formato YYYY-MM-DD
  initialCash: int("initialCash").default(0), // Monto asignado
  reportedCash: int("reportedCash").default(0),
  reportedQr: int("reportedQr").default(0),
  reportedTransfer: int("reportedTransfer").default(0),
  expectedCash: int("expectedCash").default(0),
  expectedQr: int("expectedQr").default(0),
  expectedTransfer: int("expectedTransfer").default(0),
  expenses: int("expenses").default(0),
  pendingOrders: int("pendingOrders").default(0), // Monto pendiente de órdenes sin entregar
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CashClosure = typeof cashClosures.$inferSelect;
export type InsertCashClosure = typeof cashClosures.$inferInsert;

// Tabla de aperturas de caja
export const cashOpenings = mysqlTable("cash_openings", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id), // Nuevo: Sucursal
  openingDate: varchar("openingDate", { length: 10 }).notNull(), // Formato YYYY-MM-DD
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

// Tabla de Ventas
export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  saleNumber: varchar("saleNumber", { length: 50 }).notNull().unique(),
  branchId: int("branchId").notNull().default(1).references(() => branches.id), // Nuevo: Sucursal
  customerId: int("customerId").references(() => customers.id), // Nulo = venta anónima
  customerName: varchar("customerName", { length: 255 }), // Para ventas anónimas
  saleChannel: mysqlEnum("saleChannel", ["local", "delivery"]).notNull().default("local"),
  status: mysqlEnum("status", ["completed", "cancelled"]).notNull().default("completed"),
  orderId: int("orderId").references(() => orders.id), // Vinculado a pedido si es entrega
  soldBy: int("soldBy").notNull().references(() => users.id),
  subtotal: int("subtotal").notNull(), // Suma de items antes de descuento global
  discountType: mysqlEnum("discountType", ["none", "percentage", "fixed"]).notNull().default("none"),
  discountValue: int("discountValue").notNull().default(0), // Porcentaje entero o monto fijo en centavos
  discountAmount: int("discountAmount").notNull().default(0), // Descuento global adicional
  total: int("total").notNull(), // Total final en centavos
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "qr", "transfer", "credit"]).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "completed"]).default("completed").notNull(),
  dueDate: varchar("dueDate", { length: 10 }), // YYYY-MM-DD para ventas a credito
  adminOverrideUserId: int("adminOverrideUserId").references(() => users.id), // Admin que autorizó excepcion
  notes: text("notes"),
  cancelReason: text("cancelReason"),
  cancelledAt: timestamp("cancelledAt"),
  cancelledBy: int("cancelledBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

// Tabla de items de Ventas
export const saleItems = mysqlTable("saleItems", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull().references(() => sales.id),
  productId: int("productId").notNull().references(() => products.id),
  pricingType: mysqlEnum("pricingType", ["unit", "wholesale", "discount"]).notNull().default("unit"),
  quantity: int("quantity").notNull(),
  basePrice: int("basePrice").notNull(), // Precio base (salePrice o wholesalePrice del producto)
  discountType: mysqlEnum("discountType", ["none", "percentage", "fixed"]).notNull().default("none"),
  discountValue: int("discountValue").notNull().default(0), // Porcentaje entero o monto fijo en centavos por unidad
  discountAmount: int("discountAmount").notNull().default(0), // Descuento total aplicado a la línea
  finalUnitPrice: int("finalUnitPrice").notNull().default(0),
  subtotal: int("subtotal").notNull(), // (basePrice - discountValue) * quantity
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = typeof saleItems.$inferInsert;

// Tabla de Auditoría (Historial de Cambidos)
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  /** Entidad afectada (orders, customers, products, inventory, etc.) */
  entityType: varchar("entityType", { length: 100 }).notNull(),
  /** ID de la entidad afectada */
  entityId: int("entityId").notNull(),
  /** Tipo de acción: CREATE, UPDATE, DELETE */
  action: mysqlEnum("action", ["CREATE", "UPDATE", "DELETE"]).notNull(),
  /** ID del usuario que realizó el cambio */
  userId: int("userId").references(() => users.id),
  /** JSON con los valores anteriores (para UPDATE/DELETE) */
  oldValues: text("oldValues"),
  /** JSON con los valores nuevos (para CREATE/UPDATE) */
  newValues: text("newValues"),
  /** Descripción legible del cambio */
  description: text("description"),
  /** IP del usuario */
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// Tabla de Cotizaciones (Quotations)
export const quotations = mysqlTable("quotations", {
  id: int("id").autoincrement().primaryKey(),
  quotationNumber: varchar("quotationNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId").references(() => customers.id), // Nulo = cotización anónima
  customerName: varchar("customerName", { length: 255 }), // Para clientes no registrados
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

// Tabla de items de Cotizaciones
export const quotationItems = mysqlTable("quotationItems", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull().references(() => quotations.id),
  productId: int("productId").notNull().references(() => products.id),
  pricingType: mysqlEnum("pricingType", ["unit", "wholesale", "discount"]).notNull().default("unit"),
  quantity: int("quantity").notNull(),
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

// Tabla de Carga Extra de Repartidor (Muestras, Venta Libre, etc.)
export const deliveryExtraLoad = mysqlTable("delivery_extra_load", {
  id: int("id").autoincrement().primaryKey(),
  deliveryPersonId: int("deliveryPersonId").notNull().references(() => users.id),
  productId: int("productId").notNull().references(() => products.id),
  quantity: int("quantity").notNull(),
  type: mysqlEnum("type", ["sale", "sample"]).default("sale").notNull(), // sale = Venta Libre, sample = Degustación
  status: mysqlEnum("status", ["loaded", "sold", "used", "returned"]).default("loaded").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // Formato YYYY-MM-DD
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeliveryExtraLoad = typeof deliveryExtraLoad.$inferSelect;
export type InsertDeliveryExtraLoad = typeof deliveryExtraLoad.$inferInsert;

// Tabla de Lotes de Producción (Planta)
export const productionBatches = mysqlTable("production_batches", {
  id: int("id").autoincrement().primaryKey(),
  batchNumber: varchar("batchNumber", { length: 50 }).notNull().unique(),
  type: mysqlEnum("type", ["kefir_production", "nodule_washing", "maintenance"]).notNull(),
  status: mysqlEnum("status", ["in_progress", "completed", "cancelled"]).default("in_progress").notNull(),
  startDate: timestamp("startDate").defaultNow().notNull(),
  endDate: timestamp("endDate"), // Cuando se completa el lote
  registeredBy: int("registeredBy").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductionBatch = typeof productionBatches.$inferSelect;
export type InsertProductionBatch = typeof productionBatches.$inferInsert;

// Tabla de Resultados de Producción (Subproductos y Producto Principal)
export const productionOutputs = mysqlTable("production_outputs", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull().references(() => productionBatches.id),
  productId: int("productId").notNull().references(() => products.id),
  quantity: int("quantity").notNull(), // Cantidad en la unidad base del producto
  expectedQuantity: int("expectedQuantity"), // Opcional, para medir rendimiento
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductionOutput = typeof productionOutputs.$inferSelect;
export type InsertProductionOutput = typeof productionOutputs.$inferInsert;

// Tabla de Insumos Consumidos en Producción
export const productionInputs = mysqlTable("production_inputs", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull().references(() => productionBatches.id),
  productId: int("productId").notNull().references(() => products.id),
  quantity: int("quantity").notNull(), // Cantidad de materia prima consumida
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductionInput = typeof productionInputs.$inferSelect;
export type InsertProductionInput = typeof productionInputs.$inferInsert;

// Tabla de Inventario en Planta (Almacén de Producción)
export const productionInventory = mysqlTable("production_inventory", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id),
  quantity: int("quantity").notNull().default(0),
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
});

export type ProductionInventory = typeof productionInventory.$inferSelect;
export type InsertProductionInventory = typeof productionInventory.$inferInsert;

// Definición de Relaciones (Drizzle Relational API)
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
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
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
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  sales: many(sales),
}));

export const productsRelations = relations(products, ({ many }) => ({
  orderItems: many(orderItems),
  saleItems: many(saleItems),
  inventory: many(inventory),
  inventoryTransferItems: many(inventoryTransferItems),
}));

// Tabla de Traspasos de Inventario (Sucursal <-> Sucursal y Producción)
export const inventoryTransfers = mysqlTable("inventory_transfers", {
  id: int("id").autoincrement().primaryKey(),
  transferNumber: varchar("transferNumber", { length: 50 }).notNull().unique(),
  direction: mysqlEnum("direction", ["to_production", "to_general", "branch_transfer"]).notNull().default("branch_transfer"),
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
  productId: int("productId").notNull().references(() => products.id),
  quantity: int("quantity").notNull(),
  productName: varchar("productName", { length: 255 }),
  productUnit: varchar("productUnit", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryTransferItem = typeof inventoryTransferItems.$inferSelect;
export type InsertInventoryTransferItem = typeof inventoryTransferItems.$inferInsert;

export const inventoryTransfersRelations = relations(inventoryTransfers, ({ one, many }) => ({
  user: one(users, {
    fields: [inventoryTransfers.userId],
    references: [users.id],
  }),
  sourceBranch: one(branches, {
    fields: [inventoryTransfers.sourceBranchId],
    references: [branches.id],
    relationName: "sourceTransfers",
  }),
  destinationBranch: one(branches, {
    fields: [inventoryTransfers.destinationBranchId],
    references: [branches.id],
    relationName: "destinationTransfers",
  }),
  items: many(inventoryTransferItems),
}));

export const inventoryTransferItemsRelations = relations(inventoryTransferItems, ({ one }) => ({
  transfer: one(inventoryTransfers, {
    fields: [inventoryTransferItems.transferId],
    references: [inventoryTransfers.id],
  }),
  product: one(products, {
    fields: [inventoryTransferItems.productId],
    references: [products.id],
  }),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(userBranches),
  inventory: many(inventory),
  sales: many(sales),
  orders: many(orders),
  transfersFrom: many(inventoryTransfers, { relationName: "sourceTransfers" }),
  transfersTo: many(inventoryTransfers, { relationName: "destinationTransfers" }),
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
