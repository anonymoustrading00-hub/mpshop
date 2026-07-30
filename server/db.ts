import { and, desc, eq, ne, sql, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import * as schema from "../drizzle/schema";

function getInsertId(result: any): number {
  if (Array.isArray(result) && result.length > 0) {
    return result[0].insertId;
  }
  return result?.insertId || 0;
}

import {
  InsertUser,
  users,
  customers,
  products,
  inventory,
  inventoryMovements,
  orders,
  orderItems,
  payments,
  suppliers,
  purchases,
  purchaseItems,
  accountsPayable,
  deliveryExpenses,
  operationalExpenses,
  InsertOperationalExpense,
  financialTransactions,
  gpsTracking,
  sessions,
  cashClosures,
  cashOpenings,
  InsertCustomer,
  InsertProduct,
  InsertInventory,
  InsertInventoryMovement,
  InsertOrder,
  InsertOrderItem,
  InsertPayment,
  InsertGPSTracking,
  InsertCashClosure,
  InsertCashOpening,
  sales,
  saleItems,
  InsertSaleItem,
  auditLog,
  InsertAuditLog,
  quotations,
  quotationItems,
  InsertQuotation,
  InsertQuotationItem,
  deliveryExtraLoad,
  InsertDeliveryExtraLoad,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { getSession } from "./auth";
import { getLocalDateKey, pad2, toValidDate } from "./_core/date_utils";

let _db: any = null;
let _pool: any = null;

const MOCK_DATA_FILE = path.join(process.cwd(), "server", "demo_data.json");

// Memoria para modo demo (persistente mientras el servidor corra)
export const MOCK_USERS: any[] = [
  { id: 999, username: "admin", passwordHash: "", name: "Administrador (Modo Demo)", role: "admin", openId: "demo_admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), email: "admin@demo.com", loginMethod: "traditional" },
  { id: 1000, username: "admin_root", passwordHash: "$2b$10$9Sg2Com1gCSFtFhWjxkBbuLzPA9ar0ucdiPLycgbOogdudS60Uwlu", name: "Administrador Principal", role: "admin", openId: "admin_root", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), email: "root@vitaliapro.com", loginMethod: "traditional" }
];
export const MOCK_CUSTOMERS: any[] = [];
export const MOCK_PRODUCTS: any[] = [];
export const MOCK_INVENTORY: any[] = [];
export const MOCK_ORDERS: any[] = [];
export const MOCK_ORDER_ITEMS: any[] = [];
export const MOCK_MOVEMENTS: any[] = [];
export const MOCK_PAYMENTS: any[] = [];
export const MOCK_SUPPLIERS: any[] = [];
export const MOCK_PURCHASES: any[] = [];
export const MOCK_PURCHASE_ITEMS: any[] = [];
export const MOCK_ACCOUNTS_PAYABLE: any[] = [];
export const MOCK_DELIVERY_EXPENSES: any[] = [];
export const MOCK_OPERATIONAL_EXPENSES: any[] = [];
export const MOCK_FINANCIAL_TRANSACTIONS: any[] = [];
export const MOCK_CASH_CLOSURES: any[] = [];
export const MOCK_CASH_OPENINGS: any[] = [];
export const MOCK_SALES: any[] = [];
export const MOCK_SALE_ITEMS: any[] = [];
export const MOCK_QUOTATIONS: any[] = [];
export const MOCK_QUOTATION_ITEMS: any[] = [];
export const MOCK_DELIVERY_EXTRA_LOAD: any[] = [];
export const MOCK_PRODUCTION_BATCHES: any[] = [];
export const MOCK_PRODUCTION_OUTPUTS: any[] = [];
export const MOCK_PRODUCTION_INPUTS: any[] = [];
export const MOCK_PRODUCTION_INVENTORY: any[] = [];
export const MOCK_INVENTORY_TRANSFERS: any[] = [];
export const MOCK_INVENTORY_TRANSFER_ITEMS: any[] = [];
export const MOCK_ACCOUNTS_RECEIVABLE: any[] = [];
export const MOCK_CREDIT_PAYMENTS: any[] = [];
export const MOCK_BRANCHES: any[] = [];

export function syncMocksToDisk() {
  if (process.env.DATABASE_URL) return;
  const data = {
    MOCK_CUSTOMERS,
    MOCK_USERS,
    MOCK_PRODUCTS,
    MOCK_INVENTORY,
    MOCK_ORDERS,
    MOCK_ORDER_ITEMS,
    MOCK_PAYMENTS,
    MOCK_MOVEMENTS,
    MOCK_SUPPLIERS,
    MOCK_PURCHASES,
    MOCK_PURCHASE_ITEMS,
    MOCK_ACCOUNTS_PAYABLE,
    MOCK_DELIVERY_EXPENSES,
    MOCK_OPERATIONAL_EXPENSES,
    MOCK_FINANCIAL_TRANSACTIONS,
    MOCK_CASH_CLOSURES,
    MOCK_CASH_OPENINGS,
    MOCK_SALES,
    MOCK_SALE_ITEMS,
    MOCK_QUOTATIONS,
    MOCK_QUOTATION_ITEMS,
    MOCK_DELIVERY_EXTRA_LOAD,
    MOCK_PRODUCTION_BATCHES,
    MOCK_PRODUCTION_OUTPUTS,
    MOCK_PRODUCTION_INPUTS,
    MOCK_PRODUCTION_INVENTORY,
    MOCK_INVENTORY_TRANSFERS,
    MOCK_INVENTORY_TRANSFER_ITEMS,
    MOCK_ACCOUNTS_RECEIVABLE,
    MOCK_CREDIT_PAYMENTS,
    MOCK_BRANCHES,
  };
  try {
    fs.writeFileSync(MOCK_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to sync mocks to disk:", err);
  }
}

function loadMocks() {
  if (process.env.DATABASE_URL || !fs.existsSync(MOCK_DATA_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(MOCK_DATA_FILE, "utf-8"));
    const arrays: Record<string, any[]> = {
      MOCK_CUSTOMERS, MOCK_USERS, MOCK_PRODUCTS, MOCK_INVENTORY,
      MOCK_ORDERS, MOCK_ORDER_ITEMS, MOCK_PAYMENTS, MOCK_MOVEMENTS,
      MOCK_SUPPLIERS, MOCK_PURCHASES, MOCK_PURCHASE_ITEMS,
      MOCK_ACCOUNTS_PAYABLE, MOCK_DELIVERY_EXPENSES,
      MOCK_OPERATIONAL_EXPENSES,
      MOCK_FINANCIAL_TRANSACTIONS, MOCK_CASH_CLOSURES,
      MOCK_CASH_OPENINGS, MOCK_SALES, MOCK_SALE_ITEMS,
      MOCK_QUOTATIONS, MOCK_QUOTATION_ITEMS,
      MOCK_DELIVERY_EXTRA_LOAD,
      MOCK_PRODUCTION_BATCHES, MOCK_PRODUCTION_OUTPUTS,
      MOCK_PRODUCTION_INPUTS, MOCK_PRODUCTION_INVENTORY,
      MOCK_INVENTORY_TRANSFERS, MOCK_INVENTORY_TRANSFER_ITEMS,
      MOCK_ACCOUNTS_RECEIVABLE, MOCK_CREDIT_PAYMENTS, MOCK_BRANCHES
    };
    for (const [key, arr] of Object.entries(arrays)) {
      if (data[key] && Array.isArray(data[key])) {
        arr.length = 0;
        arr.push(...data[key]);
      }
    }

    // Normalizar fechas de cierres antiguos (cuando venían guardados con fecha UTC por error)
    for (const closure of MOCK_CASH_CLOSURES as any[]) {
      const localDate = getLocalDateKey(closure.createdAt);
      if (localDate && closure.date && closure.date !== localDate) {
        closure.date = localDate;
      }
    }

    // Normalizar canal de origen en clientes/pedidos (cuando el campo aún no existía)
    for (const customer of MOCK_CUSTOMERS as any[]) {
      if (!customer.sourceChannel) customer.sourceChannel = "other";
    }
    for (const order of MOCK_ORDERS as any[]) {
      if (!order.sourceChannel) order.sourceChannel = "other";
    }
    console.log("[DB] Demo Mode: Data loaded from disk");
  } catch (err) {
    console.error("Failed to load mocks from disk:", err);
  }
}
loadMocks();

// Lazily create the drizzle instance so local tooling can run without a DB.
let _dbInitError: string | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (!_pool) {
        _pool = mysql.createPool(process.env.DATABASE_URL);
        console.log("[Database] Pool created successfully");
      }
      _db = drizzle(_pool, { schema, mode: "default" });
      console.log("[Database] Drizzle instance initialized");
      
      // Asegurar que existan las nuevas tablas para los traspasos (PlanetScale)
      if (!(typeof (_pool as any).tablesEnsured !== 'undefined')) {
        (_pool as any).tablesEnsured = true;
        _pool.execute(`
          CREATE TABLE IF NOT EXISTS inventory_transfers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            transferNumber VARCHAR(50) NOT NULL UNIQUE,
            direction ENUM('to_production', 'to_general') NOT NULL,
            status ENUM('completed', 'cancelled') NOT NULL DEFAULT 'completed',
            userId INT NOT NULL,
            notes TEXT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )
        `).catch(console.error);
        
        _pool.execute(`
          CREATE TABLE IF NOT EXISTS inventory_transfer_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            transferId INT NOT NULL,
            productId INT NOT NULL,
            quantity INT NOT NULL,
            productName VARCHAR(255),
            productUnit VARCHAR(50),
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )
        `).catch(console.error);
        
        // Agregar columna createdAt por si la tabla se creó con la versión anterior del código
        _pool.execute(`
          ALTER TABLE inventory_transfer_items ADD COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        `).catch(() => {}); // ignorar error si la columna ya existe
        
        _pool.execute(`
          CREATE TABLE IF NOT EXISTS kefir_storage (
            storage_key VARCHAR(100) PRIMARY KEY,
            storage_value LONGTEXT NOT NULL,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `).catch(console.error);
        
        _pool.execute(`
          CREATE TABLE IF NOT EXISTS kefir_movements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            productId VARCHAR(100) NOT NULL,
            productName VARCHAR(255) NOT NULL,
            category VARCHAR(50),
            previousQuantity FLOAT NOT NULL,
            newQuantity FLOAT NOT NULL,
            changeAmount FLOAT NOT NULL,
            reason VARCHAR(255),
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )
        `).catch(console.error);

        _pool.execute(`
          CREATE TABLE IF NOT EXISTS production_inputs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            batchId INT NOT NULL,
            productId INT NOT NULL,
            quantity INT NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )
        `).catch(console.error);

        _pool.execute(`
          CREATE TABLE IF NOT EXISTS production_inventory (
            id INT AUTO_INCREMENT PRIMARY KEY,
            productId INT NOT NULL,
            quantity INT NOT NULL DEFAULT 0,
            lastUpdated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
          )
        `).catch(console.error);
      }
    } catch (error) {
      _dbInitError = error instanceof Error ? error.message : String(error);
      console.error("[Database] Error in getDb:", _dbInitError);
      _db = null;
    }
  }
  return _db;
}

export function getDbInitError() {
  return _dbInitError;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  // openId es requerido solo para usuarios OAuth
  if (!user.openId && !user.username) {
    throw new Error("Either openId or username is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // Si es un usuario tradicional (tiene username), actualizar por username
    if (user.username) {
      const result = await db.select().from(users).where(eq(users.username, user.username)).limit(1);

      if (result.length > 0) {
        // Usuario existe, actualizar
        const updateData: any = {};
        if (user.lastSignedIn !== undefined) updateData.lastSignedIn = user.lastSignedIn;
        if (user.name !== undefined) updateData.name = user.name;
        if (user.email !== undefined) updateData.email = user.email;
        if (user.role !== undefined) updateData.role = user.role;

        if (Object.keys(updateData).length > 0) {
          await db.update(users).set(updateData).where(eq(users.username, user.username));
        }
        return;
      }
    }

    // Para usuarios OAuth o nuevos usuarios tradicionales
    if (!user.openId) {
      user.openId = "";
    }

    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "username", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) {
    return MOCK_USERS.find(u => u.username === username);
  }

  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = Math.floor(Math.random() * 1000) + 100;
    const newUser = { ...data, id: newId, createdAt: new Date(), updatedAt: new Date() };
    MOCK_USERS.push(newUser);
    console.log("[DB] Demo Mode: User registered in memory", data.username);
    return { insertId: newId };
  }
  
  if (!data.openId) {
    data.openId = `local_${crypto.randomUUID()}`;
  }

  return await db.insert(users).values(data);
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) {
    return MOCK_USERS;
  }
  return await db.select().from(users);
}

export async function updateUser(id: number, data: any) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_USERS.findIndex(u => u.id === id);
    if (index !== -1) {
      MOCK_USERS[index] = { ...MOCK_USERS[index], ...data, updatedAt: new Date() };
      console.log("[DB] Demo Mode: User updated in memory", id);
      return { success: true };
    }
    return { success: false };
  }
  return await db.update(users).set(data).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_USERS.findIndex(u => u.id === id);
    if (index !== -1) {
      MOCK_USERS.splice(index, 1);
      console.log("[DB] Demo Mode: User deleted from memory", id);
      return { success: true };
    }
    return { success: false };
  }
  return await db.delete(users).where(eq(users.id, id));
}

export async function getUserById(id: number) {
  // Fallback para administrador predeterminado
  if (id === 999) {
    return {
      id: 999,
      username: "admin",
      name: "Administrador (Modo Demo)",
      role: "admin" as const,
      openId: "demo_admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      email: "admin@demo.com",
      loginMethod: "traditional"
    };
  }

  const db = await getDb();
  if (!db) {
    const user = MOCK_USERS.find(u => u.id === id);
    if (user) return user;
    console.warn("[Database] User not found in memory (Demo Mode):", id);
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateLastSignedInById(userId: number) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_USERS.findIndex(u => u.id === userId);
    if (index !== -1) {
      MOCK_USERS[index].lastSignedIn = new Date();
    }
    return;
  }

  try {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
  } catch (error) {
    console.warn("[Database] Failed to update lastSignedIn:", error);
  }
}

// Clientes

export async function getCustomerByNumber(clientNumber: string) {
  const db = await getDb();
  if (!db) {
    return MOCK_CUSTOMERS.find(c => c.clientNumber === clientNumber) || null;
  }
  const result = await db.select().from(customers).where(eq(customers.clientNumber, clientNumber)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getCustomerById(customerId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_CUSTOMERS.find((customer) => customer.id === customerId) || null;
  }
  const result = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllCustomers() {
  const db = await getDb();
  if (!db) return MOCK_CUSTOMERS;
  return await db.select().from(customers);
}

export async function searchCustomers(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const allCustomers = await getAllCustomers();
  return allCustomers
    .filter((customer: any) =>
      customer.clientNumber?.toLowerCase().includes(normalizedQuery) ||
      customer.name?.toLowerCase().includes(normalizedQuery) ||
      customer.phone?.toLowerCase().includes(normalizedQuery) ||
      customer.whatsapp?.toLowerCase().includes(normalizedQuery) ||
      customer.zone?.toLowerCase().includes(normalizedQuery)
    )
    .slice(0, 8);
}



export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_CUSTOMERS.length + 1;
    const newCustomer = { ...data, id: newId, createdAt: new Date() };
    MOCK_CUSTOMERS.push(newCustomer);
    return { insertId: newId };
  }
  return await db.insert(customers).values(data);
}

export async function updateCustomer(customerId: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_CUSTOMERS.findIndex((customer) => customer.id === customerId);
    if (index !== -1) {
      MOCK_CUSTOMERS[index] = { ...MOCK_CUSTOMERS[index], ...data, updatedAt: new Date() };
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }

  return await db.update(customers).set(data).where(eq(customers.id, customerId));
}

// Productos
export async function updateProductPrice(productId: number, price: number) {
  const db = await getDb();
  if (!db) return; // Ignorar en modo demo
  return await db.update(products).set({ price }).where(eq(products.id, productId));
}

export async function updateProduct(productId: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_PRODUCTS.findIndex(p => p.id === productId);
    if (index !== -1) {
      MOCK_PRODUCTS[index] = { ...MOCK_PRODUCTS[index], ...data, updatedAt: new Date() };
      syncMocksToDisk();
    }
    return;
  }
  // Limpiar valores undefined para evitar desajuste de parametros SQL
  const cleanData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }

  return await db.update(products).set(cleanData).where(eq(products.id, productId));
}

export async function getProductById(productId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_PRODUCTS.find((product) => product.id === productId);
  }
  const result = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Productos

export async function getAllProducts() {
  const db = await getDb();
  if (!db) return MOCK_PRODUCTS;
  return await db.select().from(products);
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_PRODUCTS.length + 1;
    const newProduct = { ...data, id: newId, salePrice: data.salePrice || 0, createdAt: new Date(), updatedAt: new Date() };
    MOCK_PRODUCTS.push(newProduct);

    // Crear registro de inventario mock
    MOCK_INVENTORY.push({
      id: MOCK_INVENTORY.length + 1,
      productId: newId,
      quantity: 0,
      minStock: 10,
      lastUpdated: new Date()
    });

    syncMocksToDisk();
    console.log("[DB] Demo Mode: Product created in memory", newProduct);
    return { insertId: newId };
  }

  try {
    // Usar SQL raw para evitar problemas con columnas DEFAULT en MySQL
    // Drizzle genera DEFAULT para columnas no proporcionadas, pero la BD real puede no tenerlas
    const pool = _pool!;
    const sql = `
      INSERT INTO products (code, name, category, price, salePrice, wholesalePrice, discountPrice,
        wholesaleDiscountType, wholesaleDiscountValue, unit, presentationQuantity, presentationUnit,
        presentationVolumeMl, presentationWeightGr, productionRole, storageLocation, supplierName,
        productionNotes, status, imageUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.code,
      data.name,
      data.category || "finished_product",
      data.price,
      data.salePrice ?? 0,
      data.wholesalePrice ?? 0,
      data.discountPrice ?? 0,
      data.wholesaleDiscountType || "percentage",
      data.wholesaleDiscountValue ?? 0,
      data.unit || "unidad",
      data.presentationQuantity ?? 1,
      data.presentationUnit || "unidad",
      data.presentationVolumeMl ?? 0,
      data.presentationWeightGr ?? 0,
      data.productionRole || "none",
      data.storageLocation || null,
      data.supplierName || null,
      data.productionNotes || null,
      data.status || "active",
      data.imageUrl || null,
    ];

    console.log("[DB] Creating product with raw SQL, params:", JSON.stringify(params));
    const [result] = await pool.execute(sql, params) as any;

    const productId = result?.insertId;

    // Crear automáticamente un registro de inventario con stock inicial de 0
    if (productId) {
      await pool.execute(
        `INSERT INTO inventory (productId, quantity, minStock) VALUES (?, 0, 5)`,
        [productId]
      );
    }

    return { insertId: productId };
  } catch (error: any) {
    console.error("[DB] Error creating product:", error);
    throw error;
  }
}

// Inventario
export async function getInventoryByProductId(productId: number, branchId?: number) {
  const db = await getDb();
  const targetBranchId = branchId || 1;
  if (!db) {
    return MOCK_INVENTORY.find(inv => inv.productId === productId && (inv.branchId || 1) === targetBranchId);
  }
  const result = await db.select().from(inventory).where(
    and(
      eq(inventory.productId, productId),
      eq(inventory.branchId, targetBranchId)
    )
  ).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllInventory(branchId?: number) {
  const db = await getDb();
  if (!db) {
    let list = MOCK_INVENTORY;
    if (branchId) {
      list = list.filter(inv => (inv.branchId || 1) === branchId);
    }
    return list.map(inv => ({
      ...inv,
      product: MOCK_PRODUCTS.find(p => p.id === inv.productId)
    }));
  }

  let query = db.select({
    inventory: inventory,
    product: products
  })
  .from(inventory)
  .leftJoin(products, eq(inventory.productId, products.id))
  .$dynamic();

  if (branchId) {
    query = query.where(eq(inventory.branchId, branchId));
  }

  const results = await query;

  return results.map(r => ({
    ...r.inventory,
    product: r.product
  }));
}

export async function updateInventory(
  productId: number, 
  quantity: number, 
  expiryDate?: string | null, 
  batchNumber?: string | null,
  branchId?: number
) {
  const db = await getDb();
  const targetBranchId = branchId || 1;
  if (!db) {
    // Modo Demo: Buscar lote específico en la sucursal o crear uno nuevo
    let inv = MOCK_INVENTORY.find(inv => 
      inv.productId === productId && 
      (inv.branchId || 1) === targetBranchId &&
      (batchNumber ? inv.batchNumber === batchNumber : !inv.batchNumber)
    );

    if (inv) {
      inv.quantity = quantity;
      inv.branchId = targetBranchId;
      if (expiryDate !== undefined) inv.expiryDate = expiryDate ? new Date(expiryDate) : null;
      inv.lastUpdated = new Date();
    } else {
      MOCK_INVENTORY.push({
        id: MOCK_INVENTORY.length + 1,
        productId,
        branchId: targetBranchId,
        batchNumber: batchNumber || null,
        quantity,
        minStock: 5,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        lastUpdated: new Date()
      });
    }
    syncMocksToDisk();
    return;
  }

  // Real DB: Buscar lote por productId, batchNumber y branchId
  const existing = await db.select().from(inventory).where(and(
    eq(inventory.productId, productId),
    eq(inventory.branchId, targetBranchId),
    batchNumber ? eq(inventory.batchNumber, batchNumber) : isNull(inventory.batchNumber)
  )).limit(1);

  if (existing.length > 0) {
    const updateData: any = { quantity, lastUpdated: new Date() };
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate || null;
    return await db.update(inventory).set(updateData).where(eq(inventory.id, existing[0].id));
  } else {
    // Crear nuevo lote
    return await db.insert(inventory).values({
      productId,
      branchId: targetBranchId,
      batchNumber: batchNumber || null,
      quantity,
      expiryDate: expiryDate || null,
      lastUpdated: new Date()
    });
  }
}

// Pedidos

export async function getOrderByNumber(orderNumber: string) {
  const db = await getDb();
  if (!db) return MOCK_ORDERS.find(o => o.orderNumber === orderNumber);
  const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllOrders(branchId?: number) {
  const db = await getDb();
  if (!db) {
    let list = MOCK_ORDERS;
    if (branchId) {
      list = list.filter((o: any) => (o.branchId || 1) === branchId);
    }
    return list.map(order => {
      const deliveryPerson = MOCK_USERS.find(u => u.id === order.deliveryPersonId);
      const customer = MOCK_CUSTOMERS.find(c => c.id === order.customerId);
      const adminName = order.deliveryPersonId === 999 ? "Administrador (Demo)" : null;
      return {
        ...order,
        deliveryPersonName: deliveryPerson?.name || adminName || null,
        customerPhone: customer?.phone || null,
        customerWhatsapp: customer?.whatsapp || null,
      };
    });
  }
  let query = db.select({
    ...orders,
    deliveryPersonName: users.name,
    customerPhone: customers.phone,
    customerWhatsapp: customers.whatsapp,
    customerNumber: customers.clientNumber,
  }).from(orders)
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .$dynamic();
  if (branchId) {
    query = query.where(eq(orders.branchId, branchId));
  }
  return await query;
}

export async function getRepurchaseSuggestions() {
  const db = await getDb();
  let ordersData: any[];

  if (!db) {
    ordersData = [...MOCK_ORDERS].filter(o => o.status === "delivered");
    // Attach customer info for mock
    ordersData = ordersData.map(o => {
      const customer = MOCK_CUSTOMERS.find(c => c.id === o.customerId);
      return { ...o, customerPhone: customer?.phone, customerWhatsapp: customer?.whatsapp };
    });
  } else {
    ordersData = await db.select({
      id: orders.id,
      customerId: orders.customerId,
      customerName: orders.customerName,
      createdAt: orders.createdAt,
      status: orders.status,
      customerPhone: customers.phone,
      customerWhatsapp: customers.whatsapp,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.status, "delivered"));
  }

  // Sort by date desc
  ordersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const customerMap: Map<number, any[]> = new Map();
  ordersData.forEach(o => {
    if (!customerMap.has(o.customerId)) customerMap.set(o.customerId, []);
    customerMap.get(o.customerId)!.push(o);
  });

  const suggestions: any[] = [];
  const now = new Date();

  for (const [customerId, customerOrders] of customerMap.entries()) {
    if (customerOrders.length < 2) continue;

    let totalDiff = 0;
    let count = 0;
    for (let i = 0; i < customerOrders.length - 1; i++) {
      const d1 = new Date(customerOrders[i].createdAt);
      const d2 = new Date(customerOrders[i+1].createdAt);
      const diff = (d1.getTime() - d2.getTime()) / (1000 * 3600 * 24);
      if (diff > 0.5) { // Evitar pedidos el mismo día
        totalDiff += diff;
        count++;
      }
    }
    
    if (count === 0) continue;
    const avgDays = totalDiff / count;
    
    const lastOrder = customerOrders[0];
    const lastOrderDate = new Date(lastOrder.createdAt);
    const daysSinceLast = (now.getTime() - lastOrderDate.getTime()) / (1000 * 3600 * 24);

    // Sugerir si estamos en la ventana de recompra (promedio +/- 2 días)
    if (daysSinceLast >= Math.max(3, avgDays - 2) && daysSinceLast <= avgDays + 4) {
      suggestions.push({
        customerId,
        customerName: lastOrder.customerName,
        customerPhone: lastOrder.customerPhone,
        customerWhatsapp: lastOrder.customerWhatsapp,
        avgDays: Math.round(avgDays),
        lastOrderDate: lastOrder.createdAt,
        daysSinceLast: Math.floor(daysSinceLast),
      });
    }
  }

  return suggestions.sort((a, b) => b.daysSinceLast - a.daysSinceLast);
}

export async function getOrdersByDeliveryPerson(userId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_ORDERS.filter(o => o.deliveryPersonId === userId).map(order => {
      const deliveryPerson = MOCK_USERS.find(u => u.id === order.deliveryPersonId);
      const customer = MOCK_CUSTOMERS.find(c => c.id === order.customerId);
      return {
        ...order,
        deliveryPersonName: deliveryPerson?.name || null,
        customerPhone: customer?.phone || null,
        customerWhatsapp: customer?.whatsapp || null,
      };
    });
  }
  return await db.select({
    ...orders,
    deliveryPersonName: users.name,
    customerPhone: customers.phone,
    customerWhatsapp: customers.whatsapp,
    customerNumber: customers.clientNumber,
  }).from(orders)
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.deliveryPersonId, userId));
}

// Deduce inventory when an order is created (FEFO: First Expired, First Out)
export async function deductInventoryForOrder(orderId: number, orderNumber: string, items: InsertOrderItem[]) {
  const db = await getDb();
  if (!db) {
    for (const item of items) {
      // En modo demo, buscamos lotes del producto ordenados por fecha de vencimiento
      const batches = MOCK_INVENTORY
        .filter(i => i.productId === item.productId)
        .sort((a, b) => {
          if (!a.expiryDate) return 1;
          if (!b.expiryDate) return -1;
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        });

      let remainingToDeduct = item.quantity;
      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(batch.quantity, remainingToDeduct);
        batch.quantity -= deduct;
        remainingToDeduct -= deduct;
      }

      // Si falta stock, restamos del primer lote (permitir stock negativo en demo si es necesario)
      if (remainingToDeduct > 0 && batches.length > 0) {
        batches[0].quantity -= remainingToDeduct;
      }

      MOCK_MOVEMENTS.push({
        id: MOCK_MOVEMENTS.length + 1,
        productId: item.productId,
        type: "exit",
        quantity: item.quantity,
        reason: `Pedido reservado ${orderNumber}`,
        orderId: orderId,
        createdAt: new Date()
      });
    }
    syncMocksToDisk();
    return;
  }

  await db.transaction(async (tx: any) => {
    for (const item of items) {
      // Buscar lotes ordenados por fecha de vencimiento (FEFO)
      const batches = await tx.select()
        .from(inventory)
        .where(eq(inventory.productId, item.productId))
        .orderBy(inventory.expiryDate);

      let remainingToDeduct = item.quantity;
      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(batch.quantity, remainingToDeduct);
        if (deduct > 0) {
          await (tx as any).update(inventory)
            .set({ quantity: batch.quantity - deduct, lastUpdated: new Date() })
            .where(eq(inventory.id, batch.id));
          
          await tx.insert(inventoryMovements).values({
            productId: item.productId,
            type: "exit",
            quantity: deduct,
            batchNumber: batch.batchNumber,
            reason: `Pedido reservado ${orderNumber}`,
            orderId: orderId,
            createdAt: new Date()
          });

          remainingToDeduct -= deduct;
        }
      }

      // Si aún queda por descontar (stock insuficiente en lotes registrados), 
      // Si falta stock (sobre-venta), restamos del primer lote el excedente
      if (remainingToDeduct > 0 && batches.length > 0) {
        const firstBatch = batches[0];
        await (tx as any).update(inventory)
          .set({ quantity: firstBatch.quantity - remainingToDeduct, lastUpdated: new Date() })
          .where(eq(inventory.id, firstBatch.id));
        
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          type: "exit",
          quantity: remainingToDeduct,
          batchNumber: firstBatch.batchNumber,
          reason: `Pedido reservado (EXCEDENTE) ${orderNumber}`,
          orderId: orderId,
          createdAt: new Date()
        });
      }
    }
  });
}

// Restore inventory when an order is cancelled
export async function restoreInventoryForOrder(orderId: number, orderNumber: string, items: InsertOrderItem[]) {
  const db = await getDb();
  if (!db) {
    for (const item of items) {
      const inv = MOCK_INVENTORY.find(i => i.productId === item.productId);
      if (inv) {
        inv.quantity += item.quantity;
        inv.lastUpdated = new Date();
      }
      MOCK_MOVEMENTS.push({
        id: MOCK_MOVEMENTS.length + 1,
        productId: item.productId,
        type: "entry",
        quantity: item.quantity,
        reason: `Pedido cancelado ${orderNumber}`,
        orderId: orderId,
        createdAt: new Date()
      });
    }
    syncMocksToDisk();
    return;
  }

  await db.transaction(async (tx: any) => {
    for (const item of items) {
      const invRows = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
      const inv = invRows[0];
      if (inv) {
        await (tx as any).update(inventory).set({ quantity: inv.quantity + item.quantity, lastUpdated: new Date() })
          .where(eq(inventory.productId, item.productId));
      }
      await tx.insert(inventoryMovements).values({
        productId: item.productId,
        type: "entry",
        quantity: item.quantity,
        reason: `Pedido cancelado ${orderNumber}`,
        orderId: orderId,
        createdAt: new Date()
      });
    }
  });
}

export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_ORDERS.length + 1;
    const newOrder = { ...data, id: newId, createdAt: new Date(), updatedAt: new Date(), deliveryPersonName: null };
    MOCK_ORDERS.push(newOrder);
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(orders).values(data);
}

export async function updateOrder(orderId: number, data: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_ORDERS.findIndex(o => o.id === orderId);
    if (index !== -1) {
      const oldStatus = MOCK_ORDERS[index].status;
      MOCK_ORDERS[index] = { ...MOCK_ORDERS[index], ...data, updatedAt: new Date() };

      // Si el estado cambia a delivered, registrar ingreso automático
      if (data.status === "delivered" && oldStatus !== "delivered") {
        MOCK_FINANCIAL_TRANSACTIONS.push({
          id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
          type: "income",
          category: "order_delivery",
          amount: MOCK_ORDERS[index].totalPrice,
          referenceId: orderId,
          notes: "Venta Pedido " + MOCK_ORDERS[index].orderNumber,
          paymentMethod: MOCK_ORDERS[index].paymentMethod || "cash",
          createdAt: new Date()
        });
      }
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }
  return await db.update(orders).set(data).where(eq(orders.id, orderId));
}

// Repartidores
export async function getAllDeliveryPersons() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).where(eq(users.role, "user"));
}

export async function createDeliveryPerson(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(users).values(data);
}

export async function updateDeliveryPerson(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(users).set(data).where(eq(users.id, userId));
}

export async function deleteDeliveryPerson(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(users).where(eq(users.id, userId));
}

export async function getOrderById(orderId: number) {
  const db = await getDb();
  if (!db) return MOCK_ORDERS.find(o => o.id === orderId);
  const result = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}


export async function completeOrderDelivery(orderId: number, method: "cash" | "qr" | "transfer") {
  const db = await getDb();
  if (!db) {
    // Modo demo: actualizar estado y movimiento de entrega en mock
    const order = MOCK_ORDERS.find(o => o.id === orderId);
    if (order && order.status !== "delivered") {
      order.status = "delivered";
      order.paymentStatus = "completed";
      order.paymentMethod = method;
      order.deliveredAt = new Date();
      order.updatedAt = new Date();

      // Registrar movimiento de entrega (stock ya descontado al crear pedido)
      const items = MOCK_ORDER_ITEMS.filter(item => item.orderId === orderId);
      for (const item of items) {
        MOCK_MOVEMENTS.push({
          id: MOCK_MOVEMENTS.length + 1,
          productId: item.productId,
          type: "exit",
          quantity: item.quantity,
          reason: `Entrega Pedido ${order.orderNumber}`,
          orderId: orderId,
          createdAt: new Date()
        });
      }

      // Registrar transacción financiera inmediata
      MOCK_FINANCIAL_TRANSACTIONS.push({
        id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
        type: "income",
        category: "order_delivery",
        amount: order.totalPrice,
        referenceId: orderId,
        userId: order.deliveryPersonId,
        notes: `Entrega Pedido ${order.orderNumber}`,
        paymentMethod: method,
        createdAt: new Date()
      });
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }

  // Real DB Transaction
  return await db.transaction(async (tx: any) => {
    const orderRows = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    const order = orderRows[0];
    if (!order || order.status === "delivered") return { success: false };

    // Validar que la caja esté abierta para el método de pago seleccionado ANTES de cualquier cambio
    const today = getLocalDateKey(new Date());
    if (today && order.deliveryPersonId) {
      await checkCashRegisterOpening(tx, order.deliveryPersonId, method, today);
    }

    await tx.update(orders).set({
      status: "delivered",
      paymentStatus: "completed",
      paymentMethod: method,
      deliveredAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(orders.id, orderId));

    // Registrar movimiento de entrega (stock ya descontado al crear pedido)
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const item of items) {
      await tx.insert(inventoryMovements).values({
        productId: item.productId,
        type: "exit",
        quantity: item.quantity,
        reason: `Entrega Pedido ${order.orderNumber}`,
        orderId: orderId,
        userId: order.deliveryPersonId,
        createdAt: new Date()
      });
    }

    await tx.insert(financialTransactions).values({
      type: "income",
      category: "order_delivery",
      amount: order.totalPrice,
      referenceId: orderId,
      userId: order.deliveryPersonId,
      notes: `Entrega Pedido ${order.orderNumber}`,
      paymentMethod: method,
      createdAt: new Date()
    });
    return { success: true };
  });
}


// Items de Pedidos

export async function createOrderItem(data: InsertOrderItem) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_ORDER_ITEMS.length + 1;
    MOCK_ORDER_ITEMS.push({ ...data, id: newId });
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(orderItems).values(data);
}

export async function deleteOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) {
    const originalLength = MOCK_ORDER_ITEMS.length;
    // Filtrar items que NO pertenezcan a este pedido
    const filtered = MOCK_ORDER_ITEMS.filter(item => item.orderId !== orderId);
    MOCK_ORDER_ITEMS.length = 0;
    MOCK_ORDER_ITEMS.push(...filtered);
    syncMocksToDisk();
    return { success: true };
  }
  return await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
}
// Pagos

export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) {
    const newPayment = { ...data, id: MOCK_PAYMENTS.length + 1, createdAt: new Date() };
    MOCK_PAYMENTS.push(newPayment);
    // Actualizar el estado de pago del pedido en mock
    const order = MOCK_ORDERS.find((o: any) => o.id === data.orderId);
    if (order) {
      order.paymentStatus = "completed";
      order.paymentMethod = data.method;
    }
    syncMocksToDisk();
    return newPayment;
  }
  return await db.insert(payments).values(data);
}

export async function updatePayment(paymentId: number, data: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) {
    const idx = MOCK_PAYMENTS.findIndex((p: any) => p.id === paymentId);
    if (idx >= 0) {
      MOCK_PAYMENTS[idx] = { ...MOCK_PAYMENTS[idx], ...data };
      // Actualizar el estado de pago del pedido en mock
      const order = MOCK_ORDERS.find((o: any) => o.id === MOCK_PAYMENTS[idx].orderId);
      if (order) {
        order.paymentStatus = "completed";
        if (data.method) order.paymentMethod = data.method;
      }
    }
    syncMocksToDisk();
    return;
  }
  return await db.update(payments).set(data).where(eq(payments.id, paymentId));
}

// Rastreo GPS
export async function createGPSTracking(data: InsertGPSTracking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(gpsTracking).values(data);
}

export async function getLatestGPSTracking(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gpsTracking).where(eq(gpsTracking.orderId, orderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getGPSTrackingHistory(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(gpsTracking).where(eq(gpsTracking.orderId, orderId));
}

// Movimientos de Inventario

export async function createInventoryMovement(data: InsertInventoryMovement) {
  const db = await getDb();
  if (!db) {
    MOCK_MOVEMENTS.push({ ...data, id: MOCK_MOVEMENTS.length + 1, createdAt: new Date() });
    syncMocksToDisk();
    return;
  }
  return await db.insert(inventoryMovements).values(data);
}

export async function getInventoryMovements(productId: number) {
  const db = await getDb();
  if (!db) {
    const movements = MOCK_MOVEMENTS.filter(m => m.productId === productId);
    return movements.map(m => {
      const u = MOCK_USERS.find(user => user.id === m.userId);
      const o = MOCK_ORDERS.find(order => order.id === m.orderId);
      const s = MOCK_SALES.find(sale => sale.id === m.saleId);
      const dp = o ? MOCK_USERS.find(user => user.id === o.deliveryPersonId) : null;
      return {
        ...m,
        userName: u?.name || u?.username || null,
        userRole: u?.role || null,
        orderNumber: o?.orderNumber || null,
        saleNumber: s?.saleNumber || null,
        deliveryPersonName: dp?.name || null,
        orderStatus: o?.status || null,
      };
    });
  }

  return await db.select({
    id: inventoryMovements.id,
    productId: inventoryMovements.productId,
    type: inventoryMovements.type,
    quantity: inventoryMovements.quantity,
    reason: inventoryMovements.reason,
    notes: inventoryMovements.notes,
    userId: inventoryMovements.userId,
    orderId: inventoryMovements.orderId,
    saleId: inventoryMovements.saleId,
    createdAt: inventoryMovements.createdAt,
    userName: users.name,
    userRole: users.role,
    orderNumber: orders.orderNumber,
    saleNumber: sales.saleNumber,
    deliveryPersonName: sql<string>`(select name from ${users} where ${users.id} = (select ${orders.deliveryPersonId} from ${orders} where ${orders.id} = ${inventoryMovements.orderId}))`,
    orderStatus: sql<string>`(select ${orders.status} from ${orders} where ${orders.id} = ${inventoryMovements.orderId})`,
  })
    .from(inventoryMovements)
    .leftJoin(users, eq(inventoryMovements.userId, users.id))
    .leftJoin(orders, eq(inventoryMovements.orderId, orders.id))
    .leftJoin(sales, eq(inventoryMovements.saleId, sales.id))
    .where(eq(inventoryMovements.productId, productId));
}


export async function getOrderItems(orderId: number) {
  const db = await getDb();

  if (!db) {
    const items = MOCK_ORDER_ITEMS.filter(item => item.orderId === orderId);
    return items.map(item => {
      const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
      return {
        ...item,
        productName: product ? product.name : "Producto #" + item.productId,
        productCode: product ? product.code : ""
      };
    });
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  // Obtener nombres de productos
  const itemsWithProductNames = await Promise.all(
    items.map(async (item: any) => {
      const productResult = await db
        .select({ name: products.name, code: products.code })
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);
      return {
        ...item,
        productName: productResult.length > 0 ? productResult[0].name : "Producto #" + item.productId,
        productCode: productResult.length > 0 ? productResult[0].code : "",
      };
    })
  );

  return itemsWithProductNames;
}



export async function getPaymentByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) {
    const found = (MOCK_PAYMENTS as any[]).find((p: any) => p.orderId === orderId);
    return found || undefined;
  }
  const result = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// --- MÓDULO FINANCIERO Y COMPRAS (DEMO MODE) ---

// Proveedores y Compras

// Proveedores
export async function getAllSuppliers() {
  const db = await getDb();
  if (!db) return MOCK_SUPPLIERS;
  return await db.select().from(suppliers);
}

export async function createSupplier(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_SUPPLIERS.length + 1;
    const newSupplier = { ...data, id: newId, createdAt: new Date(), updatedAt: new Date() };
    MOCK_SUPPLIERS.push(newSupplier);
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(suppliers).values(data);
}

export async function getPurchaseById(id: number) {
  const db = await getDb();
  if (!db) {
    const purchase = MOCK_PURCHASES.find(p => p.id === id);
    if (purchase) {
      const supplier = MOCK_SUPPLIERS.find(s => s.id === purchase.supplierId);
      return { ...purchase, supplierName: supplier?.name || "Proveedor Desconocido" };
    }
    return null;
  }
  const result = await db.select({
    ...purchases,
    supplierName: suppliers.name,
  }).from(purchases).leftJoin(suppliers, eq(purchases.supplierId, suppliers.id)).where(eq(purchases.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Compras
export async function getAllPurchases(branchId?: number) {
  const db = await getDb();
  if (!db) {
    let list = MOCK_PURCHASES;
    if (branchId) {
      list = list.filter((p: any) => (p.branchId || 1) === branchId);
    }
    return list.map(p => {
      const supplier = MOCK_SUPPLIERS.find(s => s.id === p.supplierId);
      return { ...p, supplierName: supplier?.name || "Proveedor Desconocido" };
    });
  }
  return await db.select({
    ...purchases,
    supplierName: suppliers.name,
  }).from(purchases).leftJoin(suppliers, eq(purchases.supplierId, suppliers.id));
}

export async function getPurchaseItems(purchaseId: number) {
  const db = await getDb();
  if (!db) {
    const items = MOCK_PURCHASE_ITEMS.filter(i => i.purchaseId === purchaseId);
    return items.map(item => {
      const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
      return {
        ...item,
        productName: product?.name || "Producto #" + item.productId,
        productCode: product?.code || ""
      };
    });
  }

  const result = await db.select({
    id: purchaseItems.id,
    purchaseId: purchaseItems.purchaseId,
    productId: purchaseItems.productId,
    quantity: purchaseItems.quantity,
    price: purchaseItems.price,
    expiryDate: purchaseItems.expiryDate,
    createdAt: purchaseItems.createdAt,
    productName: products.name,
    productCode: products.code,
  })
    .from(purchaseItems)
    .leftJoin(products, eq(purchaseItems.productId, products.id))
    .where(eq(purchaseItems.purchaseId, purchaseId));

  return result;
}

export async function getPurchasesByProductId(productId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_PURCHASE_ITEMS
      .filter((item: any) => item.productId === productId)
      .map((item: any) => {
        const purchase = MOCK_PURCHASES.find((entry: any) => entry.id === item.purchaseId);
        const supplier = MOCK_SUPPLIERS.find((entry: any) => entry.id === purchase?.supplierId);

        return {
          ...item,
          purchaseNumber: purchase?.purchaseNumber || `COMPRA-${item.purchaseId}`,
          purchaseStatus: purchase?.status || "pending",
          supplierName: supplier?.name || "Proveedor desconocido",
          orderDate: purchase?.orderDate || purchase?.createdAt || item.createdAt,
          purchaseCreatedAt: purchase?.createdAt || item.createdAt,
        };
      });
  }

  return await db
    .select({
      id: purchaseItems.id,
      purchaseId: purchaseItems.purchaseId,
      productId: purchaseItems.productId,
      quantity: purchaseItems.quantity,
      price: purchaseItems.price,
      expiryDate: purchaseItems.expiryDate,
      createdAt: purchaseItems.createdAt,
      purchaseNumber: purchases.purchaseNumber,
      purchaseStatus: purchases.status,
      orderDate: purchases.orderDate,
      purchaseCreatedAt: purchases.createdAt,
      supplierName: suppliers.name,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .where(eq(purchaseItems.productId, productId));
}

export async function createPurchase(purchaseData: any, items: any[], userId?: number) {
  const db = await getDb();
  if (!db) {
    const purchaseId = MOCK_PURCHASES.length + 1;
    const newPurchase = {
      ...purchaseData,
      id: purchaseId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: purchaseData.status || "pending"
    };
    MOCK_PURCHASES.push(newPurchase);

    // Agregar items
    for (const item of items) {
      MOCK_PURCHASE_ITEMS.push({
        ...item,
        id: MOCK_PURCHASE_ITEMS.length + 1,
        purchaseId,
        createdAt: new Date()
      });
    }

    // Si es a crédito, crear cuenta por pagar automáticamente
    if (newPurchase.isCredit === 1) {
      let dueDateObj: Date;
      if (purchaseData.dueDate) {
        dueDateObj = new Date(purchaseData.dueDate + "T00:00:00");
      } else {
        dueDateObj = new Date();
        dueDateObj.setDate(dueDateObj.getDate() + 30);
      }
      const supplier = MOCK_SUPPLIERS.find((s: any) => s.id === newPurchase.supplierId);
      MOCK_ACCOUNTS_PAYABLE.push({
        id: MOCK_ACCOUNTS_PAYABLE.length + 1,
        purchaseId,
        supplierId: newPurchase.supplierId || null,
        supplierName: supplier?.name || "Sin Proveedor",
        purchaseNumber: newPurchase.purchaseNumber,
        totalAmount: newPurchase.totalAmount,
        paidAmount: 0,
        balance: newPurchase.totalAmount,
        dueDate: dueDateObj.toISOString(),
        status: "unpaid",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Si se recibe inmediatamente, procesar stock
    if (newPurchase.status === "received") {
      await processPurchaseImpact(purchaseId, items, newPurchase);
    }
    syncMocksToDisk();
    return { insertId: purchaseId };
  }


  // Real DB logic
  return await db.transaction(async (tx: any) => {
    // 0. Validar que la caja esté abierta para el método de pago seleccionado
    if (purchaseData.paymentMethod) {
      const today = getLocalDateKey(new Date());
      if (today && userId) {
        await checkCashRegisterOpening(tx, userId, purchaseData.paymentMethod, today);
      }
    }

    // 1. Asegurar que haya un supplierId (campo obligatorio)
    let finalSupplierId = purchaseData.supplierId;
    if (!finalSupplierId) {
      const supplierName = "Compra Rapida (Sistema)";
      console.log(`[DB] No supplierId provided, looking for/creating: ${supplierName}`);
      const supplierRows = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.name, supplierName))
        .limit(1);
      
      finalSupplierId = supplierRows[0]?.id;
      
      if (!finalSupplierId) {
        console.log(`[DB] Creating default supplier: ${supplierName}`);
        const created = await tx.insert(suppliers).values({ name: supplierName });
        finalSupplierId = getInsertId(created);
      }
    }
    console.log(`[DB] Using supplierId: ${finalSupplierId}`);

    // 2. Insertar la compra
    const purchaseToInsert = {
      ...purchaseData,
      supplierId: finalSupplierId,
      orderDate: purchaseData.orderDate ? new Date(purchaseData.orderDate) : new Date(),
    };

    console.log(`[DB] Inserting purchase ${purchaseToInsert.purchaseNumber}...`);
    const result = await tx.insert(purchases).values(purchaseToInsert);
    const id = getInsertId(result);
    console.log(`[DB] Purchase inserted with ID: ${id}`);

    // 3. Insertar items y actualizar stock
    for (const item of items) {
      // Limpiar item para que solo contenga campos de la tabla
      const { productName, ...cleanItem } = item;
      
      await tx.insert(purchaseItems).values({ ...cleanItem, purchaseId: id });

      if (purchaseData.status === "received") {
        const existing = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
        if (existing.length > 0) {
          await (tx as any).update(inventory).set({
            quantity: existing[0].quantity + Number(item.quantity),
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : existing[0].expiryDate,
            lastUpdated: new Date()
          }).where(eq(inventory.productId, item.productId));
        } else {
          await tx.insert(inventory).values({
            productId: item.productId,
            quantity: Number(item.quantity),
            minStock: 10,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            lastUpdated: new Date()
          });
        }

        // Crear registro en inventoryMovements
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          type: "entry",
          quantity: Number(item.quantity),
          reason: `Compra ${purchaseToInsert.purchaseNumber}`,
          notes: item.batchNumber ? `Lote/Marca: ${item.batchNumber}` : "",
          batchNumber: item.batchNumber || null,
          userId: userId || null,
        });
      }
    }

    // 4. Registrar transacción financiera en Caja (Gasto)
    // Se registra siempre que NO sea a crédito (isCredit=0) y haya un método de pago
    const shouldRegisterTransaction = purchaseData.isCredit === 0 && purchaseData.paymentMethod;
    if (shouldRegisterTransaction) {
      await tx.insert(financialTransactions).values({
        type: "expense",
        category: "purchase",
        amount: purchaseData.totalAmount,
        paymentMethod: purchaseData.paymentMethod || "cash",
        referenceId: id,
        userId: userId,
        notes: `Compra ${purchaseData.purchaseNumber}`,
      });
    }

    return result;
  });
}

export async function updatePurchase(purchaseId: number, purchaseData: any, items: any[], userId?: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Update not supported in mock mode");
  }

  return await db.transaction(async (tx: any) => {
    // 0. Fetch existing purchase and items
    const existingPurchases = await tx.select().from(purchases).where(eq(purchases.id, purchaseId));
    if (existingPurchases.length === 0) throw new Error("Purchase not found");
    const existingPurchase = existingPurchases[0];

    const oldItems = await tx.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));

    // 1. Revert Inventory for old items (if it was received)
    if (existingPurchase.status === "received") {
      for (const item of oldItems) {
        const inv = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
        if (inv.length > 0) {
          await (tx as any).update(inventory).set({
            quantity: Math.max(0, inv[0].quantity - Number(item.quantity)),
            lastUpdated: new Date()
          }).where(eq(inventory.productId, item.productId));
        }
      }
    }

    // 2. Revert Financial Transaction
    await tx.delete(financialTransactions).where(
      and(
        eq(financialTransactions.referenceId, purchaseId),
        eq(financialTransactions.category, "purchase")
      )
    );

    // 3. Delete old items
    await tx.delete(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));

    // 4. Validate or Create Supplier
    let finalSupplierId = purchaseData.supplierId;
    if (!finalSupplierId) {
      const supplierName = "Compra Rapida (Sistema)";
      const supplierRows = await tx.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, supplierName)).limit(1);
      finalSupplierId = supplierRows[0]?.id;
      if (!finalSupplierId) {
        const created = await tx.insert(suppliers).values({ name: supplierName });
        finalSupplierId = getInsertId(created);
      }
    }

    // 5. Update the purchase
    await tx.update(purchases).set({
      ...purchaseData,
      supplierId: finalSupplierId,
      orderDate: purchaseData.orderDate ? new Date(purchaseData.orderDate) : new Date(),
    }).where(eq(purchases.id, purchaseId));

    // 6. Insert new items and apply to inventory
    for (const item of items) {
      const { productName, id, purchaseId: pid, createdAt, ...cleanItem } = item;
      await tx.insert(purchaseItems).values({ ...cleanItem, purchaseId: purchaseId });

      if (purchaseData.status === "received") {
        const existing = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
        if (existing.length > 0) {
          await (tx as any).update(inventory).set({
            quantity: existing[0].quantity + Number(item.quantity),
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : existing[0].expiryDate,
            lastUpdated: new Date()
          }).where(eq(inventory.productId, item.productId));
        } else {
          await tx.insert(inventory).values({
            productId: item.productId,
            quantity: Number(item.quantity),
            minStock: 10,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            lastUpdated: new Date()
          });
        }
      }
    }

    // 7. Apply new Financial Transaction
    const shouldRegisterTransaction = purchaseData.isCredit === 0 && purchaseData.paymentMethod;
    if (shouldRegisterTransaction) {
      await tx.insert(financialTransactions).values({
        type: "expense",
        category: "purchase",
        amount: purchaseData.totalAmount,
        paymentMethod: purchaseData.paymentMethod || "cash",
        referenceId: purchaseId,
        userId: userId,
        notes: `Compra ${purchaseData.purchaseNumber} (Editada)`,
        createdAt: new Date()
      });
    }

    return { success: true };
  });
}

// Función interna para procesar impacto de compra (Inventario + Finanzas)
async function processPurchaseImpact(purchaseId: number, items: any[], purchase: any) {
  // 1. Actualizar Stock
  for (const item of items) {
    const productId = Number(item.productId);
    const qtyToAdd = Number(item.quantity);
    const currentInv = MOCK_INVENTORY.find(i => Number(i.productId) === productId);
    if (currentInv) {
      currentInv.quantity += qtyToAdd;
      if (item.expiryDate) currentInv.expiryDate = item.expiryDate;
      currentInv.lastUpdated = new Date();
    } else {
      MOCK_INVENTORY.push({
        id: MOCK_INVENTORY.length + 1,
        productId: item.productId,
        quantity: qtyToAdd,
        minStock: 10,
        expiryDate: item.expiryDate || null,
        lastUpdated: new Date()
      });
    }
  }

  // 2. Transacción Financiera
  MOCK_FINANCIAL_TRANSACTIONS.push({
    id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
    type: "expense",
    category: "purchase",
    amount: purchase.totalAmount,
    referenceId: purchaseId,
    notes: "Compra " + (purchase.purchaseNumber || ""),
    paymentMethod: purchase.paymentMethod || "cash",
    createdAt: new Date()
  });

  // 3. Cuentas por Pagar (si es crédito)
  if (purchase.isCredit) {
    MOCK_ACCOUNTS_PAYABLE.push({
      id: MOCK_ACCOUNTS_PAYABLE.length + 1,
      purchaseId,
      supplierId: purchase.supplierId || null,
      purchaseNumber: purchase.purchaseNumber || `CMP-${purchaseId}`,
      totalAmount: purchase.totalAmount,
      paidAmount: 0,
      balance: purchase.totalAmount,
      status: "unpaid",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  syncMocksToDisk();
}

// Función para registrar una entrada de inventario como una compra financiera
export async function recordInventoryEntryAsPurchase(
  productId: number,
  quantity: number,
  price: number,
  expiryDate?: string | null,
  batchNumber?: string | null,
  reason?: string,
  paymentMethod?: "cash" | "qr" | "transfer",
  userId?: number
) {
  const db = await getDb();
  const method = paymentMethod || "cash";
  if (!db) {
    // Proveedor genÃ©rico para compras rÃ¡pidas (mejor lectura en UI)
    const supplierName = "Compra rÃ¡pida (sistema)";
    let supplier = (MOCK_SUPPLIERS as any[]).find((s: any) => s?.name === supplierName);
    if (!supplier) {
      supplier = {
        id: (MOCK_SUPPLIERS as any[]).length + 1,
        name: supplierName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (MOCK_SUPPLIERS as any[]).push(supplier);
    }

    const purchaseId = MOCK_PURCHASES.length + 1;
    const purchaseNumber = `COMPRA-INV-${purchaseId}`;
    const newPurchase = {
      id: purchaseId,
      purchaseNumber,
      supplierId: supplier.id,
      orderDate: new Date(),
      totalAmount: quantity * price,
      status: "received",
      paymentStatus: "paid",
      paymentMethod: method,
      isCredit: 0,
      notes: (reason || "Entrada manual de inventario") + " (Auto-registrado)",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    MOCK_PURCHASES.push(newPurchase);
    MOCK_PURCHASE_ITEMS.push({
      id: MOCK_PURCHASE_ITEMS.length + 1,
      purchaseId,
      productId,
      quantity,
      price,
      batchNumber: batchNumber || null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      createdAt: new Date()
    });

    MOCK_FINANCIAL_TRANSACTIONS.push({
      id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
      type: "expense",
      category: "purchase",
      amount: quantity * price,
      referenceId: purchaseId,
      notes: `Compra Inventario ${purchaseNumber}`,
      paymentMethod: method,
      userId,
      createdAt: new Date()
    });

    syncMocksToDisk();
    return { insertId: purchaseId };
  }

  // Real DB: crear registro de compra + item + transacciÃ³n financiera (sin reimpactar stock)
  return await db.transaction(async (tx: any) => {
    const supplierName = "Compra rÃ¡pida (sistema)";
    const supplierRows = await tx
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.name, supplierName))
      .limit(1);
    let supplierId = supplierRows[0]?.id as number | undefined;

    if (!supplierId) {
      const created = await tx.insert(suppliers).values({ name: supplierName });
      supplierId = getInsertId(created);
    }

    const purchaseNumber = `COMPRA-INV-${Date.now()}`;
    const totalAmount = quantity * price;

    const purchaseInsert = await tx.insert(purchases).values({
      supplierId,
      purchaseNumber,
      orderDate: new Date(),
      totalAmount,
      status: "received",
      paymentStatus: "paid",
      paymentMethod: method,
      isCredit: 0,
    });

    const purchaseId = getInsertId(purchaseInsert);

    await tx.insert(purchaseItems).values({
      purchaseId,
      productId,
      quantity,
      price,
      batchNumber: batchNumber || null,
      expiryDate: expiryDate || null,
    });

    await tx.insert(financialTransactions).values({
      type: "expense",
      category: "purchase",
      amount: totalAmount,
      paymentMethod: method,
      userId: userId ?? null,
      referenceId: purchaseId,
      notes: `Compra Inventario ${purchaseNumber}`,
      createdAt: new Date(),
    });

    return { insertId: purchaseId };
  });
}

// Finanzas y Gastos
export async function createFinancialTransaction(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_FINANCIAL_TRANSACTIONS.length + 1;
    MOCK_FINANCIAL_TRANSACTIONS.push({ ...data, branchId: data.branchId || 1, id: newId, createdAt: new Date() });
    syncMocksToDisk();
    return { insertId: newId };
  }

  return await db.transaction(async (tx: any) => {
    // Validar que la caja esté abierta para el método de pago seleccionado
    if (data.userId && data.paymentMethod) {
      const today = getLocalDateKey(new Date());
      if (today) {
        await checkCashRegisterOpening(tx, data.userId, data.paymentMethod, today);
      }
    }

    const result = await tx.insert(financialTransactions).values({ ...data, branchId: data.branchId || 1 });
    return result;
  });
}

export async function getFinancialTransactions(userId?: number, branchId?: number) {
  const db = await getDb();
  if (!db) {
    let list = MOCK_FINANCIAL_TRANSACTIONS;
    if (branchId) {
      list = list.filter((t: any) => (t.branchId || 1) === branchId);
    }
    if (userId) {
      return list.filter((t: any) => {
        if (t.userId === userId) return true;
        // Backfill para transacciones antiguas sin userId (ventas)
        if (!t.userId && (t.category === "sale" || t.category === "sale_cancellation") && t.referenceId) {
          const sale = MOCK_SALES.find((s: any) => s.id === t.referenceId);
          return sale?.soldBy === userId;
        }
        return false;
      });
    }
    return list;
  }
  let query = db.select().from(financialTransactions).$dynamic();
  if (branchId) {
    query = query.where(eq(financialTransactions.branchId, branchId));
  }
  if (userId) {
    query = query.where(eq(financialTransactions.userId, userId));
  }
  return await query;
}

export async function createDeliveryExpense(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_DELIVERY_EXPENSES.length + 1;
    const expense = { ...data, id: newId, createdAt: new Date() };
    MOCK_DELIVERY_EXPENSES.push(expense);

    // Impacto financiero automático
    await createFinancialTransaction({
      type: "expense",
      category: data.type === "fuel" ? "fuel" : "subsistence",
      amount: data.amount,
      notes: data.notes || "Gasto de repartidor",
      paymentMethod: "cash",
      userId: data.deliveryPersonId,
      referenceId: data.orderId || null
    });

    syncMocksToDisk();
    return { insertId: newId };
  }
  // Real DB
  return await db.transaction(async (tx: any) => {
    const result = await tx.insert(deliveryExpenses).values(data);
    const insertId = getInsertId(result);

    await tx.insert(financialTransactions).values({
      type: "expense",
      category: data.type === "fuel" ? "fuel" : "subsistence",
      amount: data.amount,
      notes: data.notes || "Gasto de repartidor",
      paymentMethod: "cash", // Los gastos de repartidor suelen ser en efectivo
      userId: data.deliveryPersonId,
      referenceId: data.orderId || null,
      createdAt: new Date()
    });
    return { insertId };
  });
}

// Gastos Operativos
export async function getOperationalExpenses(branchId?: number) {
  const db = await getDb();
  if (!db) {
    let list = MOCK_OPERATIONAL_EXPENSES;
    if (branchId) {
      list = list.filter((e: any) => (e.branchId || 1) === branchId);
    }
    return list.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  let query = db.select().from(operationalExpenses).orderBy(desc(operationalExpenses.createdAt)).$dynamic();
  if (branchId) {
    query = query.where(eq(operationalExpenses.branchId, branchId));
  }
  return await query;
}

export async function getOperationalExpenseById(id: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_OPERATIONAL_EXPENSES.find((e: any) => e.id === id);
  }
  const result = await db.select().from(operationalExpenses).where(eq(operationalExpenses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOperationalExpense(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_OPERATIONAL_EXPENSES.length + 1;
    const expense = { ...data, id: newId, createdAt: new Date(), updatedAt: new Date() };
    MOCK_OPERATIONAL_EXPENSES.push(expense);

    // Si está marcado como pagado, crear transacción financiera automáticamente
    if (data.status === "paid") {
      await createFinancialTransaction({
        type: "expense",
        category: data.category,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.description,
        referenceId: newId
      });
    }

    syncMocksToDisk();
    return { insertId: newId };
  }
  // Real DB
  return await db.transaction(async (tx: any) => {
    const result = await tx.insert(operationalExpenses).values(data);
    const insertId = getInsertId(result);

    // Validar que la caja esté abierta para el método de pago seleccionado ANTES de registrar impacto
    if (data.paymentMethod) {
      const today = getLocalDateKey(new Date());
      if (today && data.userId) {
        await checkCashRegisterOpening(tx, data.userId, data.paymentMethod, today);
      }
    }

    if (data.status === "paid") {
      await tx.insert(financialTransactions).values({
        type: "expense",
        category: data.category,
        amount: data.amount,
        paymentMethod: data.paymentMethod || "cash",
        notes: data.description || "Gasto Operativo",
        userId: data.userId, // Asociar con el usuario que registra
        referenceId: insertId,
        createdAt: new Date()
      });
    }
    return { insertId };
  });
}

export async function updateOperationalExpense(id: number, data: any) {
  const db = await getDb();
  const oldExpense = await getOperationalExpenseById(id);

  if (!db) {
    const index = MOCK_OPERATIONAL_EXPENSES.findIndex((e: any) => e.id === id);
    if (index !== -1) {
      MOCK_OPERATIONAL_EXPENSES[index] = {
        ...MOCK_OPERATIONAL_EXPENSES[index],
        ...data,
        updatedAt: new Date()
      };

      // Si cambia de pendiente a pagado, crear transacción financiera
      if (oldExpense?.status === "pending" && data.status === "paid") {
        await createFinancialTransaction({
          type: "expense",
          category: data.category || oldExpense.category,
          amount: data.amount || oldExpense.amount,
          paymentMethod: data.paymentMethod || oldExpense.paymentMethod,
          notes: data.description || oldExpense.description,
          referenceId: id
        });
      }

      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }

  const result = await db.update(operationalExpenses).set({ ...data, updatedAt: new Date() })
    .where(eq(operationalExpenses.id, id));

  // Si cambia de pendiente a pagado
  if (oldExpense?.status === "pending" && data.status === "paid") {
    await createFinancialTransaction({
      type: "expense",
      category: data.category || oldExpense.category,
      amount: data.amount || oldExpense.amount,
      paymentMethod: data.paymentMethod || oldExpense.paymentMethod,
      notes: data.description || oldExpense.description,
      referenceId: id
    });
  }

  return result;
}

export async function deleteOperationalExpense(id: number) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_OPERATIONAL_EXPENSES.findIndex((e: any) => e.id === id);
    if (index !== -1) {
      // Also delete associated financial transaction
      const expense = MOCK_OPERATIONAL_EXPENSES[index];
      if (expense?.status === "paid") {
        const txIndex = MOCK_FINANCIAL_TRANSACTIONS.findIndex((t: any) => t.referenceId === id && t.type === "expense");
        if (txIndex !== -1) {
          MOCK_FINANCIAL_TRANSACTIONS.splice(txIndex, 1);
        }
      }
      MOCK_OPERATIONAL_EXPENSES.splice(index, 1);
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }
  // Real DB - use transaction to delete both
  return await db.transaction(async (tx: any) => {
    // First get the expense to check if it was paid
    const [expense] = await tx.select().from(operationalExpenses).where(eq(operationalExpenses.id, id)).limit(1);

    // Delete the associated financial transaction if the expense was paid
    if (expense && expense.status === "paid") {
      await tx.delete(financialTransactions)
        .where(and(
          eq(financialTransactions.referenceId, id),
          eq(financialTransactions.type, "expense")
        ));
    }

    // Delete the expense
    return await tx.delete(operationalExpenses).where(eq(operationalExpenses.id, id));
  });
}

// Aperturas de Caja
/**
 * Asegura que una caja esté "abierta" para un método de pago y usuario específico en la fecha actual.
 * Si es QR o Transferencia y no está abierta, la abre automáticamente con fondo 0.
 */
export async function checkCashRegisterOpening(dbOrTx: any, userId: number, paymentMethod: string, dateKey: string) {
  // Validar rol del usuario: los admins pueden saltarse esta validación
  const userRows = await dbOrTx.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (userRows[0]?.role === "admin") return;

  const existing = await dbOrTx
    .select()
    .from(cashOpenings)
    .where(
      and(
        eq(cashOpenings.responsibleUserId, userId),
        sql`(${cashOpenings.paymentMethod} = ${paymentMethod} OR (${cashOpenings.paymentMethod} IS NULL AND ${paymentMethod} = 'cash'))`,
        eq(cashOpenings.status, "open")
      )
    )
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`No existe una apertura de caja activa para ${paymentMethod === 'cash' ? 'Efectivo' : paymentMethod.toUpperCase()}. Por favor, realice la apertura de caja primero.`);
  }
}

export async function autoOpenCashRegisterIfNeeded(dbOrTx: any, userId: number, paymentMethod: string, dateKey: string) {
  // Función mantenida por compatibilidad pero ahora requiere apertura manual
  return checkCashRegisterOpening(dbOrTx, userId, paymentMethod, dateKey);
}

export async function getCashOpeningByUserIdAndDateMethod(userId: number, openingDate: string, paymentMethod: string) {
  const db = await getDb();
  if (!db) {
    // Buscar si existe alguna apertura 'open' para este usuario y método
    return MOCK_CASH_OPENINGS.find((opening) => 
      opening.responsibleUserId === userId && 
      opening.openingDate === openingDate &&
      (opening.paymentMethod === paymentMethod || (!opening.paymentMethod && paymentMethod === "cash")) &&
      opening.status === "open"
    );
  }

  const result = await db
    .select()
    .from(cashOpenings)
    .where(sql`${cashOpenings.responsibleUserId} = ${userId} AND ${cashOpenings.openingDate} = ${openingDate} AND (${cashOpenings.paymentMethod} = ${paymentMethod} OR (${cashOpenings.paymentMethod} IS NULL AND ${paymentMethod} = 'cash')) AND ${cashOpenings.status} = 'open'`)
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getActiveCashOpeningByUserIdAndMethod(userId: number, paymentMethod: string) {
  const db = await getDb();
  if (!db) {
    return MOCK_CASH_OPENINGS.find((opening) => 
      opening.responsibleUserId === userId && 
      (opening.paymentMethod === paymentMethod || (!opening.paymentMethod && paymentMethod === "cash")) &&
      opening.status === "open"
    );
  }

  const result = await db
    .select()
    .from(cashOpenings)
    .where(sql`${cashOpenings.responsibleUserId} = ${userId} AND (${cashOpenings.paymentMethod} = ${paymentMethod} OR (${cashOpenings.paymentMethod} IS NULL AND ${paymentMethod} = 'cash')) AND ${cashOpenings.status} = 'open'`)
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createCashOpening(data: InsertCashOpening) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_CASH_OPENINGS.length + 1;
    const opening = { ...data, id: newId, createdAt: new Date() };
    MOCK_CASH_OPENINGS.push(opening);
    syncMocksToDisk();
    return { insertId: newId };
  }

  return await db.insert(cashOpenings).values(data);
}

export async function updateCashOpeningStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) {
    const idx = MOCK_CASH_OPENINGS.findIndex(o => o.id === id);
    if (idx !== -1) {
      MOCK_CASH_OPENINGS[idx].status = status;
      syncMocksToDisk();
    }
    return;
  }
  return await db.update(cashOpenings).set({ status }).where(eq(cashOpenings.id, id));
}

export async function closeAllActiveOpeningsForUser(userId: number, date: string) {
  const db = await getDb();
  if (!db) {
    let changed = false;
    MOCK_CASH_OPENINGS.forEach(o => {
      if (o.responsibleUserId === userId && o.status === "open") {
        o.status = "closed";
        changed = true;
      }
    });
    if (changed) syncMocksToDisk();
    return;
  }
  
  await db.update(cashOpenings)
    .set({ status: 'closed' })
    .where(and(
      eq(cashOpenings.responsibleUserId, userId),
      eq(cashOpenings.status, 'open')
    ));
}

export async function getAllCashOpenings() {
  const db = await getDb();
  if (!db) {
    return MOCK_CASH_OPENINGS
      .map((opening) => {
        const responsibleUser = MOCK_USERS.find((user) => user.id === opening.responsibleUserId);
        const openedByUser = MOCK_USERS.find((user) => user.id === opening.openedByUserId);

        return {
          ...opening,
          responsibleUserName: responsibleUser?.name || `Usuario #${opening.responsibleUserId}`,
          openedByUserName: openedByUser?.name || `Usuario #${opening.openedByUserId}`,
        };
      })
      .sort((a, b) => `${b.openingDate} ${String(b.id).padStart(5, "0")}`.localeCompare(`${a.openingDate} ${String(a.id).padStart(5, "0")}`));
  }

  return await db
    .select({
      id: cashOpenings.id,
      openingDate: cashOpenings.openingDate,
      openingAmount: cashOpenings.openingAmount,
      paymentMethod: cashOpenings.paymentMethod,
      responsibleUserId: cashOpenings.responsibleUserId,
      openedByUserId: cashOpenings.openedByUserId,
      status: cashOpenings.status,
      notes: cashOpenings.notes,
      createdAt: cashOpenings.createdAt,
      responsibleUserName: sql<string>`(select name from users where users.id = ${cashOpenings.responsibleUserId})`,
      openedByUserName: sql<string>`(select name from users where users.id = ${cashOpenings.openedByUserId})`,
    })
    .from(cashOpenings)
    .orderBy(sql`${cashOpenings.openingDate} desc, ${cashOpenings.id} desc`);
}

// Cierres de Caja
export async function getCashClosureByUserIdAndDate(userId: number, date: string, branchId?: number) {
  const db = await getDb();
  if (!db) {
    // Para validación de "ya existe un cierre", buscamos el que esté 'pending'
    // Para visualización de "mi estado hoy", buscamos el último creado hoy
    const matches = MOCK_CASH_CLOSURES.filter((c: any) => 
      c.userId === userId && 
      c.date === date && 
      (!branchId || c.branchId === branchId)
    );
    if (matches.length === 0) return undefined;
    return matches
      .slice()
      .sort((a: any, b: any) => {
        const aMs = toValidDate(a.createdAt)?.getTime() ?? 0;
        const bMs = toValidDate(b.createdAt)?.getTime() ?? 0;
        return bMs - aMs;
      })[0];
  }
  
  // Buscar cierres del usuario para hoy, ordenados por el más reciente
  let query = db.select().from(cashClosures).where(
    sql`${cashClosures.userId} = ${userId} AND (${cashClosures.date} = ${date} OR DATE(DATE_SUB(${cashClosures.createdAt}, INTERVAL 4 HOUR)) = ${date})`
  ).$dynamic();

  if (branchId) {
    query = query.where(eq(cashClosures.branchId, branchId));
  }

  const result = await query.orderBy(desc(cashClosures.createdAt)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCashClosure(data: InsertCashClosure) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_CASH_CLOSURES.length + 1;
    const closure = { ...data, branchId: data.branchId || 1, id: newId, createdAt: new Date() };
    MOCK_CASH_CLOSURES.push(closure);
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(cashClosures).values(data);
}

export async function getAllCashClosures(branchId?: number) {
  const db = await getDb();
  if (!db) {
    let list = MOCK_CASH_CLOSURES;
    if (branchId) {
      list = list.filter(c => c.branchId === branchId);
    }
    return list.map(c => {
      const user = MOCK_USERS.find(u => u.id === c.userId);
      const branch = MOCK_BRANCHES.find(b => b.id === (c.branchId || 1));
      return { ...c, userName: user?.name || "Usuario #" + c.userId, branchName: branch?.name };
    });
  }

  let query = db.select({
    ...cashClosures,
    userName: users.name,
  }).from(cashClosures).leftJoin(users, eq(cashClosures.userId, users.id)).$dynamic();

  if (branchId) {
    query = query.where(eq(cashClosures.branchId, branchId));
  }

  return await query;
}

export async function getCashClosuresByUserId(userId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_CASH_CLOSURES
      .filter(c => c.userId === userId)
      .slice()
      .sort((a, b) => `${b.date} ${String(b.id).padStart(5, "0")}`.localeCompare(`${a.date} ${String(a.id).padStart(5, "0")}`));
  }

  return await db.select().from(cashClosures).where(eq(cashClosures.userId, userId)).orderBy(desc(cashClosures.createdAt));
}

export async function getCashClosureById(id: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_CASH_CLOSURES.find(c => c.id === id);
  }
  const result = await db.select().from(cashClosures).where(eq(cashClosures.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateCashClosure(id: number, data: any) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_CASH_CLOSURES.findIndex(c => c.id === id);
    if (index !== -1) {
      MOCK_CASH_CLOSURES[index] = { ...MOCK_CASH_CLOSURES[index], ...data };
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }
  return await db.update(cashClosures).set(data).where(eq(cashClosures.id, id));
}

// Total de órdenes pendientes (no entregadas, no canceladas) por repartidor
export async function getPendingOrdersTotal(userId: number) {
  const db = await getDb();
  if (!db) {
    const pendingOrders = MOCK_ORDERS.filter(o =>
      o.deliveryPersonId === userId &&
      !["delivered", "cancelled"].includes(o.status)
    );
    const total = pendingOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    return { total, count: pendingOrders.length };
  }

  const rows = await db.select({
    total: sql<number>`cast(coalesce(sum(${orders.totalPrice}), 0) as signed)`,
    count: sql<number>`cast(count(${orders.id}) as signed)`,
  })
    .from(orders)
    .where(and(
      eq(orders.deliveryPersonId, userId),
      ne(orders.status, "delivered"),
      ne(orders.status, "cancelled")
    ));

  return { total: Number(rows[0]?.total ?? 0), count: Number(rows[0]?.count ?? 0) };
}

export async function createFinancialTransactionsForDeliveries(closureId: number, userId: number, date: string) {
  const db = await getDb();
  if (!db) {
    // Modo demo: crear transacciones financieras para órdenes entregadas por este repartidor
    const deliveredOrders = MOCK_ORDERS.filter(o =>
      o.deliveryPersonId === userId &&
      o.status === "delivered" &&
      getLocalDateKey(o.deliveredAt) === date &&
      !MOCK_FINANCIAL_TRANSACTIONS.some(t => t.referenceId === o.id && t.category === "order_delivery")
    );

    for (const order of deliveredOrders) {
      MOCK_FINANCIAL_TRANSACTIONS.push({
        id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
        type: "income",
        category: "order_delivery",
        amount: order.totalPrice,
        referenceId: order.id,
        userId: order.deliveryPersonId,
        notes: `Cobro Pedido ${order.orderNumber} (Cierre #${closureId})`,
        paymentMethod: order.paymentMethod || "cash",
        createdAt: new Date()
      });
    }
    syncMocksToDisk();
    return { success: true };
  }

  // Real DB: insertar transacciones para órdenes entregadas ese día sin transacción financiera
  const existingRefs = await db.select({ referenceId: financialTransactions.referenceId })
    .from(financialTransactions)
    .where(and(
      eq(financialTransactions.category, "order_delivery"),
      eq(financialTransactions.userId, userId),
      sql`DATE(DATE_SUB(${financialTransactions.createdAt}, INTERVAL 4 HOUR)) = ${date}`
    ));
  const existingIds = new Set(existingRefs.map(r => r.referenceId).filter(Boolean));

  const deliveredOrders = await db.select()
    .from(orders)
    .where(and(
      eq(orders.deliveryPersonId, userId),
      eq(orders.status, "delivered"),
      sql`DATE(DATE_SUB(${orders.deliveredAt}, INTERVAL 4 HOUR)) = ${date}`
    ));

  for (const order of deliveredOrders) {
    if (order.id && !existingIds.has(order.id)) {
      await db.insert(financialTransactions).values({
        type: "income",
        category: "order_delivery",
        amount: order.totalPrice,
        referenceId: order.id,
        userId: order.deliveryPersonId,
        notes: `Cobro Pedido ${order.orderNumber} (Cierre #${closureId})`,
        paymentMethod: order.paymentMethod || "cash",
        createdAt: new Date()
      });
    }
  }

  return { success: true };
}

export async function processFinancialLiquidation(closureId: number, force = false) {
  const db = await getDb();
  if (!db) return;

  const closure = await getCashClosureById(closureId);
  if (!closure) return;

  if (!force) {
    // PROTECCIÓN ANTI-DUPLICADOS: verificar si ya existe un registro de cierre para este ID
    const existingClosureReport = await db
      .select()
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.category, "closure_report" as any),
          eq(financialTransactions.userId, closure.userId),
          sql`${financialTransactions.notes} LIKE ${'%Cierre #' + closureId + '%'}`
        )
      )
      .limit(1);

    // Si ya existe, no procesar de nuevo
    if (existingClosureReport.length > 0) return;
  }

  // 1. Registrar ingresos de ventas (órdenes entregadas)
  await createFinancialTransactionsForDeliveries(closureId, closure.userId, closure.date);
  
  // Nota: Ya no se registra el monto "reportado" como un ingreso nuevo (closure_report)
  // porque el dinero ya fue sumado correctamente en cada entrega y traspaso.
  // Hacerlo causaría que el saldo se duplique erróneamente.
}

export async function cleanupDuplicateClosureReports() {
  const db = await getDb();
  if (!db) return { deleted: 0 };

  // Obtener todas las transacciones de closure_report ordenadas por fecha ASC
  const allReports = await db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.category, "closure_report" as any))
    .orderBy(financialTransactions.createdAt);

  const seenNotes = new Map<string, number>();
  const toDelete: number[] = [];

  for (const tx of allReports) {
    const key = (tx.notes || "") + "|" + tx.paymentMethod;
    if (seenNotes.has(key)) {
      // Es un duplicado - eliminarlo
      toDelete.push(tx.id!);
    } else {
      seenNotes.set(key, tx.id!);
    }
  }

  for (const id of toDelete) {
    await db.delete(financialTransactions).where(eq(financialTransactions.id, id));
  }

  return { deleted: toDelete.length };
}

export async function getExpectedDailyTotals(userId: number, date: string) {
  const db = await getDb();
  const totals = { cash: 0, qr: 0, transfer: 0 };

  if (!db) {
    // Ordenes ENTREGADAS en la fecha
    const userOrders = MOCK_ORDERS.filter(o =>
      o.deliveryPersonId === userId &&
      o.status === "delivered" &&
      getLocalDateKey(o.deliveredAt) === date
    );

    let cash = 0, qr = 0, transfer = 0;
    userOrders.forEach(o => {
      if (o.paymentMethod === "cash") cash += o.totalPrice;
      else if (o.paymentMethod === "qr") qr += o.totalPrice;
      else if (o.paymentMethod === "transfer") transfer += o.totalPrice;
    });

    // Ventas del repartidor
    const userSales = MOCK_SALES.filter((sale: any) =>
      sale.soldBy === userId &&
      sale.status !== "cancelled" &&
      sale.paymentStatus === "completed" &&
      getLocalDateKey(sale.createdAt) === date
    );

    userSales.forEach((sale: any) => {
      if (sale.paymentMethod === "cash") cash += sale.total;
      else if (sale.paymentMethod === "qr") qr += sale.total;
      else if (sale.paymentMethod === "transfer") transfer += sale.total;
    });

    totals.cash = cash;
    totals.qr = qr;
    totals.transfer = transfer;

    // Si ya hubo cierres aprobados en la misma fecha, mostrar solo el saldo pendiente
    const approvedClosures = MOCK_CASH_CLOSURES.filter((c: any) => c.userId === userId && c.date === date && c.status === "approved");
    if (approvedClosures.length > 0) {
      const alreadyExpectedCash = approvedClosures.reduce((sum: number, c: any) => sum + (c.expectedCash || 0), 0);
      const alreadyExpectedQr = approvedClosures.reduce((sum: number, c: any) => sum + (c.expectedQr || 0), 0);
      const alreadyExpectedTransfer = approvedClosures.reduce((sum: number, c: any) => sum + (c.expectedTransfer || 0), 0);

      totals.cash = Math.max(0, totals.cash - alreadyExpectedCash);
      totals.qr = Math.max(0, totals.qr - alreadyExpectedQr);
      totals.transfer = Math.max(0, totals.transfer - alreadyExpectedTransfer);
    }

    return totals;
  }

  // Ordenes entregadas
  const orderResults = await db.select({
    total: sql<number>`cast(ifnull(sum(${orders.totalPrice}), 0) as signed)`,
    method: orders.paymentMethod,
  })
    .from(orders)
    .where(and(
      eq(orders.deliveryPersonId, userId),
      eq(orders.status, "delivered"),
      sql`DATE(DATE_SUB(${orders.deliveredAt}, INTERVAL 4 HOUR)) = ${date}`
    ))
    .groupBy(orders.paymentMethod);

  orderResults.forEach((r: any) => {
    if (r.method === "cash") totals.cash += r.total || 0;
    else if (r.method === "qr") totals.qr += r.total || 0;
    else if (r.method === "transfer") totals.transfer += r.total || 0;
  });

  // Ventas
  const saleResults = await db.select({
    total: sql<number>`cast(ifnull(sum(${sales.total}), 0) as signed)`,
    method: sales.paymentMethod,
  })
    .from(sales)
    .where(and(
      eq(sales.soldBy, userId),
      ne(sales.status, "cancelled"),
      eq(sales.paymentStatus, "completed"),
      sql`DATE(DATE_SUB(${sales.createdAt}, INTERVAL 4 HOUR)) = ${date}`
    ))
    .groupBy(sales.paymentMethod);

  saleResults.forEach((r: any) => {
    if (r.method === "cash") totals.cash += r.total || 0;
    else if (r.method === "qr") totals.qr += r.total || 0;
    else if (r.method === "transfer") totals.transfer += r.total || 0;
  });

  // Restar montos ya cerrados/aprobados en la fecha (para permitir "cierres parciales")
  const approvedClosures = await db
    .select({
      expectedCash: cashClosures.expectedCash,
      expectedQr: cashClosures.expectedQr,
      expectedTransfer: cashClosures.expectedTransfer,
    })
    .from(cashClosures)
    .where(and(
      eq(cashClosures.userId, userId),
      eq(cashClosures.status, "approved" as any),
      // Fallback por si la columna `date` quedÃ³ guardada con desfase UTC en registros antiguos
      sql`(${cashClosures.date} = ${date} OR DATE(DATE_SUB(${cashClosures.createdAt}, INTERVAL 4 HOUR)) = ${date})`,
    ));

  if (approvedClosures.length > 0) {
    const alreadyExpectedCash = approvedClosures.reduce((sum, c) => sum + (c.expectedCash || 0), 0);
    const alreadyExpectedQr = approvedClosures.reduce((sum, c) => sum + (c.expectedQr || 0), 0);
    const alreadyExpectedTransfer = approvedClosures.reduce((sum, c) => sum + (c.expectedTransfer || 0), 0);

    totals.cash = Math.max(0, totals.cash - alreadyExpectedCash);
    totals.qr = Math.max(0, totals.qr - alreadyExpectedQr);
    totals.transfer = Math.max(0, totals.transfer - alreadyExpectedTransfer);
  }

  return totals;
}


// =============================================
// Ventas (Sales)
// =============================================

type SaleDiscountType = "none" | "percentage" | "fixed";
type SalePaymentStatus = "pending" | "completed";
type SaleStatus = "completed" | "cancelled";

type SaleItemCreateInput = {
  productId: number;
  pricingType: "unit" | "wholesale";
  quantity: number;
  basePrice: number;
  discountType: SaleDiscountType;
  discountValue: number;
  discountAmount: number;
  finalUnitPrice: number;
  subtotal: number;
};

type SaleCreatePayload = {
  saleNumber: string;
  customerId?: number;
  customerName?: string;
  saleChannel: "local" | "delivery";
  orderId?: number;
  soldBy: number;
  subtotal: number;
  discountType: SaleDiscountType;
  discountValue: number;
  discountAmount: number;
  total: number;
  paymentMethod: "cash" | "qr" | "transfer" | "credit";
  paymentStatus: SalePaymentStatus;
  creditDays?: number;
  dueDate?: string;
  notes?: string;
  items: SaleItemCreateInput[];
  branchId?: number;
  adminOverrideUserId?: number;
  adminOverrideReason?: string;
};

function getSaleFinanceNote(saleNumber: string) {
  return `Venta ${saleNumber}`;
}

function mapSaleWithRelations(sale: any, usersList: any[], customersList: any[]) {
  const seller = usersList.find((user: any) => user.id === sale.soldBy);
  const customer = customersList.find((item: any) => item.id === sale.customerId);

  return {
    ...sale,
    sellerName: seller?.name || "Desconocido",
    customerDisplayName: customer?.name || sale.customerName || "Anónimo",
    customerCode: customer?.clientNumber || null,
  };
}

export async function getNextSaleNumber() {
  const db = await getDb();
  const allData = db ? await db.select({ saleNumber: sales.saleNumber }).from(sales) : MOCK_SALES;
  const max = allData.length > 0
    ? Math.max(...allData.map((s: any) => parseInt(s.saleNumber.replace('VTA-', '')) || 0))
    : 0;
  return `VTA-${String(max + 1).padStart(3, '0')}`;
}

export async function createSale(data: InsertSale) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_SALES.length + 1;
    MOCK_SALES.push({
      status: "completed",
      discountType: "none",
      discountValue: 0,
      cancelReason: null,
      cancelledAt: null,
      cancelledBy: null,
      ...data,
      id: newId,
      createdAt: new Date(),
    });
    return { insertId: newId };
  }
  return await db.insert(sales).values(data);
}

export async function createSaleItem(data: InsertSaleItem) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_SALE_ITEMS.length + 1;
    MOCK_SALE_ITEMS.push({
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      finalUnitPrice: data.basePrice,
      ...data,
      id: newId,
      createdAt: new Date(),
    });
    return { insertId: newId };
  }
  return await db.insert(saleItems).values(data);
}

export async function getProductsWithStock() {
  const [allProducts, allInventory] = await Promise.all([getAllProducts(), getAllInventory()]);

  return allProducts.map((product: any) => {
    const productBatches = allInventory.filter((item: any) => item.productId === product.id);
    const stock = productBatches.reduce((sum, item) => sum + (item.quantity || 0), 0);
    // Tomamos el stock mínimo del primer lote que tenga uno definido, o por defecto 5
    const minStock = productBatches.find(b => b.minStock != null)?.minStock || 5;

    return {
      ...product,
      stock,
      minStock,
      isLowStock: stock <= minStock,
    };
  });
}

export async function createSaleWithItems(payload: SaleCreatePayload) {
  const db = await getDb();

  if (!db) {
    for (const item of payload.items) {
      const product = MOCK_PRODUCTS.find((entry: any) => entry.id === item.productId);
      if (!product || product.status !== "active") {
        throw new Error(`Producto ${item.productId} no disponible para la venta`);
      }

      const productBatches = MOCK_INVENTORY.filter((entry: any) => entry.productId === item.productId);
      const totalStock = productBatches.reduce((sum, b) => sum + b.quantity, 0);
      if (totalStock < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${totalStock}`);
      }
    }

    const newSaleId = MOCK_SALES.length + 1;
    MOCK_SALES.push({
      id: newSaleId,
      saleNumber: payload.saleNumber,
      customerId: payload.customerId || null,
      customerName: payload.customerId ? null : payload.customerName || "Anónimo",
      saleChannel: payload.saleChannel,
      status: "completed" as SaleStatus,
      orderId: payload.orderId || null,
      soldBy: payload.soldBy,
      subtotal: payload.subtotal,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      discountAmount: payload.discountAmount,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      paymentStatus: payload.paymentStatus,
      notes: payload.notes || null,
      cancelReason: null,
      cancelledAt: null,
      cancelledBy: null,
      createdAt: new Date(),
    });

    for (const item of payload.items) {
      MOCK_SALE_ITEMS.push({
        id: MOCK_SALE_ITEMS.length + 1,
        saleId: newSaleId,
        productId: item.productId,
        pricingType: item.pricingType,
        quantity: item.quantity,
        basePrice: item.basePrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: item.discountAmount,
        finalUnitPrice: item.finalUnitPrice,
        subtotal: item.subtotal,
        createdAt: new Date(),
      });

      if (!payload.orderId) {
        const productBatches = MOCK_INVENTORY
          .filter((entry: any) => entry.productId === item.productId)
          .sort((a, b) => {
            if (!a.expiryDate) return 1;
            if (!b.expiryDate) return -1;
            return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
          });

        let remaining = item.quantity;
        for (const batch of productBatches) {
          if (remaining <= 0) break;
          const deduct = Math.min(batch.quantity, remaining);
          batch.quantity -= deduct;
          remaining -= deduct;
          batch.lastUpdated = new Date();
        }
      }

      await createInventoryMovement({
        productId: item.productId,
        type: "exit",
        quantity: item.quantity,
        reason: payload.orderId ? `Venta Pedido ${payload.orderId}` : `Venta ${payload.saleNumber}`,
        notes: payload.orderId ? `Salida por venta vinculada a pedido` : `Salida por venta ${payload.saleNumber}`,
        saleId: newSaleId,
        orderId: payload.orderId || undefined,
        userId: payload.soldBy,
      });
    }

    if (payload.orderId) {
      const order = MOCK_ORDERS.find(o => o.id === payload.orderId);
      if (order) {
        order.status = "delivered";
        order.paymentStatus = "completed";
        order.updatedAt = new Date();
      }
    }

    // Si es venta a crédito, crear cuenta por cobrar automáticamente
    if (payload.paymentMethod === "credit") {
      const creditDays = payload.creditDays || 30;
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + creditDays);
      const dueDateStr = dueDateObj.toISOString().split("T")[0];
      const customer = payload.customerId ? MOCK_CUSTOMERS.find((c: any) => c.id === payload.customerId) : null;
      MOCK_ACCOUNTS_RECEIVABLE.push({
        id: MOCK_ACCOUNTS_RECEIVABLE.length + 1,
        saleId: newSaleId,
        customerId: payload.customerId || null,
        customerName: customer?.name || payload.customerName || "Anónimo",
        saleNumber: payload.saleNumber,
        totalAmount: payload.total,
        paidAmount: 0,
        balance: payload.total,
        dueDate: dueDateStr,
        status: "unpaid",
        notes: payload.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (payload.paymentStatus === "completed") {
      // Venta normal (no a crédito): registrar en caja
      await createFinancialTransaction({
        type: "income",
        category: payload.saleChannel === "delivery" ? "sale_delivery" : "sale_local",
        amount: payload.total,
        referenceId: newSaleId,
        notes: getSaleFinanceNote(payload.saleNumber),
        paymentMethod: payload.paymentMethod,
        userId: payload.soldBy,
      });
    }
    syncMocksToDisk();
    return { insertId: newSaleId };
  }

  return await db.transaction(async (tx: any) => {
    // 0. Validar que la caja esté abierta para el método de pago seleccionado
    const today = getLocalDateKey(new Date());
    if (today && payload.soldBy && payload.paymentMethod) {
      await checkCashRegisterOpening(tx, payload.soldBy, payload.paymentMethod, today);
    }

    const saleResult = await tx.insert(sales).values({
      saleNumber: payload.saleNumber,
      customerId: payload.customerId,
      customerName: payload.customerId ? null : payload.customerName || "Anónimo",
      saleChannel: payload.saleChannel,
      status: "completed",
      orderId: payload.orderId,
      soldBy: payload.soldBy,
      subtotal: payload.subtotal,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      discountAmount: payload.discountAmount,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      paymentStatus: payload.paymentStatus,
      notes: payload.notes,
    });

    const saleId = getInsertId(saleResult);

    for (const item of payload.items) {
      const productRows = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      const product = productRows[0];
      if (!product || product.status !== "active") {
        throw new Error(`Producto ${item.productId} no disponible para la venta`);
      }

      if (!payload.orderId) {
        const productBatches = await tx.select()
          .from(inventory)
          .where(eq(inventory.productId, item.productId))
          .orderBy(inventory.expiryDate);

        let remaining = item.quantity;
        for (const batch of productBatches) {
          if (remaining <= 0) break;
          const deduct = Math.min(batch.quantity, remaining);
          if (deduct > 0) {
            await (tx as any).update(inventory)
              .set({ quantity: batch.quantity - deduct, lastUpdated: new Date() })
              .where(eq(inventory.id, batch.id));
            
            await tx.insert(inventoryMovements).values({
              productId: item.productId,
              type: "exit",
              quantity: deduct,
              batchNumber: batch.batchNumber,
              reason: `Venta ${payload.saleNumber}`,
              notes: `Salida por venta ${payload.saleNumber}`,
              saleId,
              orderId: payload.orderId,
              userId: payload.soldBy,
            });
            
            remaining -= deduct;
          }
        }

        if (remaining > 0) {
          const defaultInvRows = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
          if (defaultInvRows.length > 0) {
             await (tx as any).update(inventory)
               .set({ quantity: defaultInvRows[0].quantity - remaining, lastUpdated: new Date() })
               .where(eq(inventory.id, defaultInvRows[0].id));
          } else {
             await tx.insert(inventory).values({
                productId: item.productId,
                quantity: -remaining,
                minStock: 10,
                lastUpdated: new Date()
             });
          }
          await tx.insert(inventoryMovements).values({
            productId: item.productId,
            type: "exit",
            quantity: remaining,
            reason: `Venta ${payload.saleNumber}`,
            notes: `Salida por venta ${payload.saleNumber} (Sin stock previo)`,
            saleId,
            orderId: payload.orderId,
            userId: payload.soldBy,
          });
        }
      } else {
        // Si hay orderId, el stock ya fue descontado por deductInventoryForOrder.
        // Solo registramos el movimiento para trazabilidad de la venta.
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          type: "exit",
          quantity: item.quantity,
          reason: `Venta Pedido vinculado`,
          notes: `Salida ya procesada en pedido #${payload.orderId}`,
          saleId,
          orderId: payload.orderId,
          userId: payload.soldBy,
        });
      }
    }

    if (payload.orderId) {
      await tx.update(orders).set({
        status: "delivered",
        paymentStatus: "completed",
        updatedAt: new Date(),
      }).where(eq(orders.id, payload.orderId));
    }

    if (payload.paymentStatus === "completed") {
      await tx.insert(financialTransactions).values({
        type: "income",
        category: payload.saleChannel === "delivery" ? "sale_delivery" : "sale_local",
        amount: payload.total,
        referenceId: saleId,
        notes: getSaleFinanceNote(payload.saleNumber),
        paymentMethod: payload.paymentMethod,
        userId: payload.soldBy,
      });
    }

    return { insertId: saleId };
  });
}

export async function updateSale(saleId: number, data: Partial<InsertSale>) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_SALES.findIndex((sale: any) => sale.id === saleId);
    if (index === -1) return { success: false };
    MOCK_SALES[index] = { ...MOCK_SALES[index], ...data };
    return { success: true };
  }
  return await db.update(sales).set(data).where(eq(sales.id, saleId));
}

export async function markSalePaymentCompleted(saleId: number) {
  const sale = await getSaleById(saleId);
  if (!sale) {
    throw new Error("Venta no encontrada");
  }
  if (sale.status === "cancelled") {
    throw new Error("No se puede cobrar una venta anulada");
  }
  if (sale.paymentStatus === "completed") {
    return { success: true };
  }

  await updateSale(saleId, { paymentStatus: "completed" });
  await createFinancialTransaction({
    type: "income",
    category: sale.saleChannel === "delivery" ? "sale_delivery" : "sale_local",
    amount: sale.total,
    referenceId: saleId,
    notes: getSaleFinanceNote(sale.saleNumber),
    paymentMethod: sale.paymentMethod,
    userId: sale.soldBy,
  });

  return { success: true };
}

export async function cancelSaleRecord(saleId: number, cancelledByUserId: number, reason: string) {
  const sale = await getSaleById(saleId);
  if (!sale) {
    throw new Error("Venta no encontrada");
  }
  if (sale.status === "cancelled") {
    throw new Error("La venta ya fue anulada");
  }

  const items = await getSaleItemsBySaleId(saleId);
  const db = await getDb();

  if (!db) {
    const saleIndex = MOCK_SALES.findIndex((entry: any) => entry.id === saleId);
    if (saleIndex === -1) {
      throw new Error("Venta no encontrada");
    }

    MOCK_SALES[saleIndex] = {
      ...MOCK_SALES[saleIndex],
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: new Date(),
      cancelledBy: cancelledByUserId,
    };

    for (const item of items as any[]) {
      const inventoryItem = MOCK_INVENTORY.find((entry: any) => entry.productId === item.productId);
      if (inventoryItem) {
        inventoryItem.quantity += item.quantity;
        inventoryItem.lastUpdated = new Date();
      }

      await createInventoryMovement({
        productId: item.productId,
        type: "entry",
        quantity: item.quantity,
        reason: `Anulación ${sale.saleNumber}`,
        notes: `Reposición por anulación de venta ${sale.saleNumber}`,
      });
    }

    if (sale.paymentStatus === "completed") {
      await createFinancialTransaction({
        type: "expense",
        category: "sale_cancellation",
        amount: sale.total,
        referenceId: saleId,
        notes: `Anulación ${sale.saleNumber}`,
        paymentMethod: sale.paymentMethod,
        userId: sale.soldBy,
      });
    }

    return { success: true };
  }

  await db.transaction(async (tx: any) => {
    await tx.update(sales).set({
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: new Date(),
      cancelledBy: cancelledByUserId,
    }).where(eq(sales.id, saleId));

    for (const item of items as any[]) {
      const inventoryRows = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
      const inventoryItem = inventoryRows[0];
      const currentStock = inventoryItem?.quantity || 0;

      await (tx as any).update(inventory).set({
        quantity: currentStock + item.quantity,
        lastUpdated: new Date(),
      }).where(eq(inventory.productId, item.productId));

      await tx.insert(inventoryMovements).values({
        productId: item.productId,
        type: "entry",
        quantity: item.quantity,
        reason: `Anulación ${sale.saleNumber}`,
        notes: `Reposición por anulación de venta ${sale.saleNumber}`,
      });
    }

    if (sale.paymentStatus === "completed") {
      await tx.insert(financialTransactions).values({
        type: "expense",
        category: "sale_cancellation",
        amount: sale.total,
        referenceId: saleId,
        notes: `Anulación ${sale.saleNumber}`,
        paymentMethod: sale.paymentMethod,
        userId: sale.soldBy,
      });
    }
  });

  return { success: true };
}

export async function getAllSales(branchId?: number) {
  const db = await getDb();
  if (!db) {
    let list = MOCK_SALES;
    if (branchId) {
      list = list.filter((s: any) => (s.branchId || 1) === branchId);
    }
    return list.map((sale: any) => {
      return mapSaleWithRelations(sale, MOCK_USERS, MOCK_CUSTOMERS);
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  let rawSalesQuery = db.select().from(sales).$dynamic();
  if (branchId) {
    rawSalesQuery = rawSalesQuery.where(eq(sales.branchId, branchId));
  }

  const [rawSales, usersList, customersList] = await Promise.all([
    rawSalesQuery,
    db.select({ id: users.id, name: users.name }).from(users),
    db.select({ id: customers.id, name: customers.name, clientNumber: customers.clientNumber }).from(customers),
  ]);

  return rawSales
    .map((sale: any) => mapSaleWithRelations(sale, usersList, customersList))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getSaleById(saleId: number) {
  const db = await getDb();
  if (!db) {
    const sale = MOCK_SALES.find((entry: any) => entry.id === saleId);
    return sale ? mapSaleWithRelations(sale, MOCK_USERS, MOCK_CUSTOMERS) : null;
  }

  const [result, usersList, customersList] = await Promise.all([
    db.select().from(sales).where(eq(sales.id, saleId)).limit(1),
    db.select({ id: users.id, name: users.name }).from(users),
    db.select({ id: customers.id, name: customers.name, clientNumber: customers.clientNumber }).from(customers),
  ]);

  return result[0] ? mapSaleWithRelations(result[0], usersList, customersList) : null;
}

export async function getSaleItemsBySaleId(saleId: number) {
  const db = await getDb();
  if (!db) {
    const items = MOCK_SALE_ITEMS.filter((i: any) => i.saleId === saleId);
    return items.map((item: any) => {
      const product = MOCK_PRODUCTS.find((p: any) => p.id === item.productId);
      return { ...item, productName: product?.name || 'Producto #' + item.productId, productCode: product?.code || '' };
    });
  }
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  return await Promise.all(items.map(async (item: any) => {
    const prod = await db.select({ name: products.name, code: products.code }).from(products).where(eq(products.id, item.productId)).limit(1);
    return { ...item, productName: prod[0]?.name || '', productCode: prod[0]?.code || '' };
  }));
}

export async function getOnOrderQuantities() {
  const db = await getDb();
  if (!db) {
    // Modo demo
    const result: Record<number, number> = {};
    MOCK_ORDER_ITEMS.forEach(item => {
      const order = MOCK_ORDERS.find(o => o.id === item.orderId);
      if (order && !['delivered', 'cancelled'].includes(order.status)) {
        result[item.productId] = (result[item.productId] || 0) + item.quantity;
      }
    });
    return result;
  }

  const rows = await db
    .select({
      productId: orderItems.productId,
      totalQuantity: sql<number>`cast(sum(${orderItems.quantity}) as signed)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(
      ne(orders.status, 'delivered'),
      ne(orders.status, 'cancelled')
    ))
    .groupBy(orderItems.productId);

  const result: Record<number, number> = {};
  rows.forEach((row: any) => {
    result[row.productId] = Number(row.totalQuantity);
  });
  return result;
}

// Cargar datos persistentes al iniciar el servidor en modo demo
loadMocks();

// Limpiar todos los datos (excepto administrador) al iniciar
export function clearAllData() {
  console.log("[DB] Clearing all data, keeping only admin user...");

  // Limpiar arrays de datos
  MOCK_CUSTOMERS.length = 0;
  MOCK_PRODUCTS.length = 0;
  MOCK_INVENTORY.length = 0;
  MOCK_ORDERS.length = 0;
  MOCK_ORDER_ITEMS.length = 0;
  MOCK_PAYMENTS.length = 0;
  MOCK_MOVEMENTS.length = 0;
  MOCK_SUPPLIERS.length = 0;
  MOCK_PURCHASES.length = 0;
  MOCK_PURCHASE_ITEMS.length = 0;
  MOCK_ACCOUNTS_PAYABLE.length = 0;
  MOCK_DELIVERY_EXPENSES.length = 0;
  MOCK_OPERATIONAL_EXPENSES.length = 0;
  MOCK_FINANCIAL_TRANSACTIONS.length = 0;
  MOCK_CASH_CLOSURES.length = 0;
  MOCK_CASH_OPENINGS.length = 0;
  MOCK_SALES.length = 0;
  MOCK_SALE_ITEMS.length = 0;
  MOCK_QUOTATIONS.length = 0;
  MOCK_QUOTATION_ITEMS.length = 0;

  console.log("[DB] All data cleared successfully. Only admin user remains.");
}

// ------------------------------------------------------------------
// COTIZACIONES (Quotations)
// ------------------------------------------------------------------

export async function getNextQuotationNumber() {
  const db = await getDb();
  const today = new Date();
  const dateStr = `${today.getFullYear()}${pad2(today.getMonth() + 1)}${pad2(today.getDate())}`;

  if (!db) {
    const todayQuotes = MOCK_QUOTATIONS.filter(q => q.quotationNumber?.includes(dateStr));
    return `COT-${dateStr}-${pad2(todayQuotes.length + 1)}`;
  }

  const result = await db.select({ quotationNumber: quotations.quotationNumber })
    .from(quotations)
    .where(sql`${quotations.quotationNumber} LIKE ${`COT-${dateStr}-%`}`)
    .orderBy(desc(quotations.quotationNumber))
    .limit(1);

  let nextSequence = 1;
  if (result.length > 0 && result[0].quotationNumber) {
    const parts = result[0].quotationNumber.split('-');
    if (parts.length === 3) {
      nextSequence = parseInt(parts[2], 10) + 1;
    }
  }

  return `COT-${dateStr}-${pad2(nextSequence)}`;
}

export async function createQuotationWithItems(data: InsertQuotation & { items: InsertQuotationItem[] }) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_QUOTATIONS.length + 1;
    const { items, ...quotationData } = data;
    const newQuotation = {
      ...quotationData,
      id: newId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    MOCK_QUOTATIONS.push(newQuotation);

    items.forEach((item, index) => {
      MOCK_QUOTATION_ITEMS.push({
        ...item,
        id: MOCK_QUOTATION_ITEMS.length + 1,
        quotationId: newId,
        createdAt: new Date()
      });
    });

    syncMocksToDisk();
    return { insertId: newId, quotationNumber: newQuotation.quotationNumber };
  }

  let quotationId: number = 0;

  await db.transaction(async (tx: any) => {
    const { items, ...quotationData } = data;
    const result = await tx.insert(quotations).values(quotationData);
    quotationId = getInsertId(result);

    if (items && items.length > 0) {
      const itemsToInsert = items.map((item) => ({
        ...item,
        quotationId,
      }));
      await tx.insert(quotationItems).values(itemsToInsert);
    }
  });

  return { insertId: quotationId, quotationNumber: data.quotationNumber };
}

export async function getAllQuotations() {
  const db = await getDb();
  if (!db) {
    return MOCK_QUOTATIONS.map(q => {
      const customer = MOCK_CUSTOMERS.find(c => c.id === q.customerId);
      const creator = MOCK_USERS.find(u => u.id === q.createdBy);
      return {
        ...q,
        customerDisplayName: customer ? customer.name : q.customerName,
        creatorName: creator ? creator.name : "Desconocido"
      };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const result = await db.select({
    ...quotations,
    customerDisplayName: sql<string>`COALESCE(${customers.name}, ${quotations.customerName})`,
    creatorName: users.name,
  })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .leftJoin(users, eq(quotations.createdBy, users.id))
    .orderBy(desc(quotations.createdAt));

  return result;
}

export async function getQuotationById(quotationId: number) {
  const db = await getDb();
  if (!db) {
    const q = MOCK_QUOTATIONS.find(q => q.id === quotationId);
    if (!q) return undefined;
    const customer = MOCK_CUSTOMERS.find(c => c.id === q.customerId);
    const creator = MOCK_USERS.find(u => u.id === q.createdBy);
    return {
      ...q,
      customerDisplayName: customer ? customer.name : q.customerName,
      creatorName: creator ? creator.name : "Desconocido"
    };
  }

  const result = await db.select({
    ...quotations,
    customerDisplayName: sql<string>`COALESCE(${customers.name}, ${quotations.customerName})`,
    creatorName: users.name,
  })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .leftJoin(users, eq(quotations.createdBy, users.id))
    .where(eq(quotations.id, quotationId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getQuotationItemsByQuotationId(quotationId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_QUOTATION_ITEMS
      .filter(item => item.quotationId === quotationId)
      .map(item => {
        const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
        return {
          ...item,
          productName: product ? product.name : "Producto desconocido",
          productCode: product ? product.code : "N/A"
        };
      });
  }

  return await db.select({
    ...quotationItems,
    productName: products.name,
    productCode: products.code,
  })
    .from(quotationItems)
    .leftJoin(products, eq(quotationItems.productId, products.id))
    .where(eq(quotationItems.quotationId, quotationId));
}

export async function updateQuotationStatus(quotationId: number, status: "pending" | "accepted" | "rejected") {
  const db = await getDb();
  if (!db) {
    const index = MOCK_QUOTATIONS.findIndex(q => q.id === quotationId);
    if (index !== -1) {
      MOCK_QUOTATIONS[index].status = status;
      MOCK_QUOTATIONS[index].updatedAt = new Date();
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }

  await db.update(quotations).set({ status, updatedAt: new Date() }).where(eq(quotations.id, quotationId));
  return { success: true };
}

// =============================================
// Carga Extra de Repartidores
// =============================================
export async function assignDeliveryExtraLoad(data: InsertDeliveryExtraLoad) {
  const db = await getDb();
  
  // 1. Descontar del inventario central
  const { productId, quantity, deliveryPersonId, type } = data;
  
  if (!db) {
    const inventoryItem = MOCK_INVENTORY.find(i => i.productId === productId);
    if (!inventoryItem || inventoryItem.quantity < quantity) {
      throw new Error("Stock insuficiente en almacén central");
    }
    inventoryItem.quantity -= quantity;
    inventoryItem.lastUpdated = new Date();
    
    // Registrar movimiento
    await createInventoryMovement({
      productId,
      type: "exit",
      quantity,
      reason: `Carga Extra Repartidor (${type === 'sale' ? 'Venta' : 'Muestra'})`,
      userId: deliveryPersonId,
    });

    const newId = MOCK_DELIVERY_EXTRA_LOAD.length + 1;
    MOCK_DELIVERY_EXTRA_LOAD.push({
      ...data,
      id: newId,
      status: "loaded",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    syncMocksToDisk();
    return { insertId: newId };
  }

  return await db.transaction(async (tx) => {
    // Validar stock
    const inv = await tx.select().from(inventory).where(eq(inventory.productId, productId)).limit(1);
    if (!inv[0] || inv[0].quantity < quantity) {
      throw new Error("Stock insuficiente en almacén central");
    }

    // Descontar
    await (tx as any).update(inventory).set({ 
      quantity: inv[0].quantity - quantity,
      lastUpdated: new Date() 
    }).where(eq(inventory.productId, productId));

    // Registrar movimiento
    await tx.insert(inventoryMovements).values({
      productId,
      type: "exit",
      quantity,
      reason: `Carga Extra Repartidor (${type === 'sale' ? 'Venta' : 'Muestra'})`,
      userId: deliveryPersonId,
    });

    // Crear carga extra
    const result = await tx.insert(deliveryExtraLoad).values(data);
    return result;
  });
}

export async function getDeliveryExtraLoad(deliveryPersonId: number, date: string) {
  const db = await getDb();
  if (!db) {
    return MOCK_DELIVERY_EXTRA_LOAD
      .filter(item => item.deliveryPersonId === deliveryPersonId && item.date === date)
      .map(item => {
        const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
        return { ...item, productName: product?.name || "Desconocido" };
      });
  }

  return await db.select({
    ...deliveryExtraLoad,
    productName: products.name,
  })
    .from(deliveryExtraLoad)
    .leftJoin(products, eq(deliveryExtraLoad.productId, products.id))
    .where(and(
      eq(deliveryExtraLoad.deliveryPersonId, deliveryPersonId),
      eq(deliveryExtraLoad.date, date)
    ));
}

export async function updateDeliveryExtraLoadStatus(id: number, status: "loaded" | "sold" | "used" | "returned", userId: number) {
  const db = await getDb();
  
  if (!db) {
    const index = MOCK_DELIVERY_EXTRA_LOAD.findIndex(i => i.id === id);
    if (index === -1) throw new Error("Carga extra no encontrada");
    
    const item = MOCK_DELIVERY_EXTRA_LOAD[index];
    const oldStatus = item.status;
    
    // Si se devuelve, reingresar stock
    if (status === "returned" && oldStatus !== "returned") {
      const inv = MOCK_INVENTORY.find(i => i.productId === item.productId);
      if (inv) {
        inv.quantity += item.quantity;
        inv.lastUpdated = new Date();
      }
      await createInventoryMovement({
        productId: item.productId,
        type: "entry",
        quantity: item.quantity,
        reason: "Devolución Carga Extra Repartidor",
        userId,
      });
    }

    MOCK_DELIVERY_EXTRA_LOAD[index].status = status;
    MOCK_DELIVERY_EXTRA_LOAD[index].updatedAt = new Date();
    syncMocksToDisk();
    return { success: true };
  }

  return await db.transaction(async (tx) => {
    const items = await tx.select().from(deliveryExtraLoad).where(eq(deliveryExtraLoad.id, id)).limit(1);
    const item = items[0];
    if (!item) throw new Error("Carga extra no encontrada");

    if (status === "returned" && item.status !== "returned") {
      const inv = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
      if (inv[0]) {
        await (tx as any).update(inventory).set({ 
          quantity: inv[0].quantity + item.quantity,
          lastUpdated: new Date() 
        }).where(eq(inventory.productId, item.productId));
      }
      await tx.insert(inventoryMovements).values({
        productId: item.productId,
        type: "entry",
        quantity: item.quantity,
        reason: "Devolución Carga Extra Repartidor",
        userId,
      });
    }

    await tx.update(deliveryExtraLoad).set({ status, updatedAt: new Date() }).where(eq(deliveryExtraLoad.id, id));
    return { success: true };
  });
}

// =============================================
// Alertas Inteligentes de Inventario (Opción 5)
// =============================================
export async function getSmartInventoryAlerts() {
  const db = await getDb();
  const daysToLookBack = 30;
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - daysToLookBack);
  const startDateStr = getLocalDateKey(startDate);

  // 1. Obtener todos los productos activos
  const allProducts = await getAllProducts();
  const inventoryData = await getAllInventory();

  // 2. Obtener ventas de los últimos 30 días para calcular velocidad
  let salesVelocity: Record<number, number> = {};

  if (!db) {
    const recentSales = MOCK_SALE_ITEMS.filter(item => {
      const sale = MOCK_SALES.find(s => s.id === item.saleId);
      return sale && getLocalDateKey(sale.createdAt) >= startDateStr;
    });

    recentSales.forEach(item => {
      salesVelocity[item.productId] = (salesVelocity[item.productId] || 0) + item.quantity;
    });
  } else {
    const results = await db.select({
      productId: saleItems.productId,
      totalQuantity: sql<number>`sum(${saleItems.quantity})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(
      ne(sales.status, "cancelled"),
      sql`DATE(DATE_SUB(${sales.createdAt}, INTERVAL 4 HOUR)) >= ${startDateStr}`
    ))
    .groupBy(saleItems.productId);

    results.forEach((r: any) => {
      salesVelocity[r.productId] = r.totalQuantity;
    });
  }

  // 3. Cruzar datos para generar alertas
  const alerts = allProducts.map(product => {
    const productInventory = inventoryData.filter(i => i.productId === product.id);
    const totalStock = productInventory.reduce((sum, i) => sum + i.quantity, 0);
    const velocity30d = salesVelocity[product.id] || 0;
    const dailyVelocity = velocity30d / daysToLookBack;

    let daysRemaining = dailyVelocity > 0 ? Math.floor(totalStock / dailyVelocity) : 999;
    
    // Un lote próximo a vencer (en menos de 7 días)
    const urgentExpiry = productInventory.find(i => {
      if (!i.expiryDate) return false;
      const daysToExpiry = (new Date(i.expiryDate).getTime() - today.getTime()) / (1000 * 3600 * 24);
      return daysToExpiry >= 0 && daysToExpiry <= 7;
    });

    return {
      productId: product.id,
      productName: product.name,
      totalStock,
      dailyVelocity: dailyVelocity.toFixed(2),
      daysRemaining,
      urgentExpiry: urgentExpiry ? urgentExpiry.expiryDate : null,
      status: daysRemaining < 7 ? "critical" : daysRemaining < 15 ? "warning" : "ok"
    };
  }).filter(a => a.status !== "ok" || a.urgentExpiry);

  return alerts;
}

// Branches
export async function getAllBranches() {
  const db = await getDb();
  if (!db) {
    return MOCK_BRANCHES;
  }
  return await db.select().from(branches);
}

export async function createBranch(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_BRANCHES.length + 1;
    const newBranch = { ...data, id: newId, createdAt: new Date(), updatedAt: new Date() };
    MOCK_BRANCHES.push(newBranch);
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(branches).values(data);
}

export async function updateBranch(id: number, data: any) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_BRANCHES.findIndex((b) => b.id === id);
    if (index !== -1) {
      MOCK_BRANCHES[index] = { ...MOCK_BRANCHES[index], ...data, updatedAt: new Date() };
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }
  return await db.update(branches).set(data).where(eq(branches.id, id));
}

export async function getBranchById(id: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_BRANCHES.find((b) => b.id === id);
  }
  const result = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function deleteBranch(id: number) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_BRANCHES.findIndex((b) => b.id === id);
    if (index !== -1) {
      MOCK_BRANCHES.splice(index, 1);
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }
  return await db.delete(branches).where(eq(branches.id, id));
}

// ----------------------------------------------------
// CUENTAS POR COBRAR (CXC) & CUENTAS POR PAGAR (CXP)
// ----------------------------------------------------

export async function getCustomerCreditStatus(customerId: number) {
  const customer = MOCK_CUSTOMERS.find((c: any) => c.id === customerId);
  if (!customer) return null;

  const customerARs = MOCK_ACCOUNTS_RECEIVABLE.filter((ar: any) => ar.customerId === customerId && ar.status !== "paid");
  const currentDebt = customerARs.reduce((sum: number, ar: any) => sum + (ar.balance || 0), 0);
  
  const todayStr = getLocalDateKey(new Date()) || new Date().toISOString().split("T")[0];
  const overdueARs = customerARs.filter((ar: any) => ar.dueDate && ar.dueDate < todayStr);
  const overdueAmount = overdueARs.reduce((sum: number, ar: any) => sum + (ar.balance || 0), 0);

  const creditLimit = customer.creditLimit || 0;
  const availableCredit = Math.max(0, creditLimit - currentDebt);
  const hasOverdue = overdueAmount > 0;
  const allowCredit = customer.allowCredit !== 0;

  return {
    customer,
    creditLimit,
    creditDays: customer.creditDays || 30,
    currentDebt,
    availableCredit,
    overdueAmount,
    hasOverdue,
    allowCredit,
  };
}

export async function getAllAccountsReceivable() {
  const todayStr = getLocalDateKey(new Date()) || new Date().toISOString().split("T")[0];
  
  return MOCK_ACCOUNTS_RECEIVABLE.map((ar: any) => {
    const customer = MOCK_CUSTOMERS.find((c: any) => c.id === ar.customerId);
    const sale = MOCK_SALES.find((s: any) => s.id === ar.saleId);
    
    let status = ar.status;
    if (status !== "paid" && ar.dueDate && ar.dueDate < todayStr) {
      status = "overdue";
    }

    return {
      ...ar,
      status,
      customerName: customer?.name || sale?.customerName || "Anónimo",
      customerPhone: customer?.phone || null,
      customerTaxId: customer?.taxId || null,
      saleNumber: sale?.saleNumber || `VTA-${ar.saleId}`,
    };
  });
}

export async function getAllAccountsPayable() {
  const todayStr = getLocalDateKey(new Date()) || new Date().toISOString().split("T")[0];

  return MOCK_ACCOUNTS_PAYABLE.map((ap: any) => {
    const supplier = MOCK_SUPPLIERS.find((s: any) => s.id === ap.supplierId);
    const purchase = MOCK_PURCHASES.find((p: any) => p.id === ap.purchaseId);

    const totalAmount = ap.totalAmount !== undefined ? ap.totalAmount : (ap.amount || 0);
    const paidAmount = ap.paidAmount !== undefined ? ap.paidAmount : 0;
    const balance = ap.balance !== undefined ? ap.balance : (totalAmount - paidAmount);

    let status = ap.status;
    if (status !== "paid" && ap.dueDate && ap.dueDate < todayStr) {
      status = "overdue";
    }

    return {
      ...ap,
      totalAmount,
      paidAmount,
      balance,
      status,
      supplierName: supplier?.name || "Proveedor Sistema",
      supplierPhone: supplier?.phone || null,
      purchaseNumber: purchase?.purchaseNumber || ap.purchaseNumber || `CMP-${ap.purchaseId}`,
    };
  });
}

export async function createCreditPayment(data: {
  type: "receivable" | "payable";
  accountsReceivableId?: number;
  accountsPayableId?: number;
  amount: number;
  paymentMethod: "cash" | "qr" | "transfer";
  notes?: string;
  userId: number;
}) {
  const receiptNumber = `REC-${String(MOCK_CREDIT_PAYMENTS.length + 1).padStart(4, "0")}`;
  
  if (data.type === "receivable") {
    const ar = MOCK_ACCOUNTS_RECEIVABLE.find((item: any) => item.id === data.accountsReceivableId);
    if (!ar) throw new Error("Cuenta por cobrar no encontrada");
    if (ar.balance <= 0) throw new Error("Esta cuenta por cobrar ya se encuentra totalmente saldada");

    const paymentAmount = Math.min(data.amount, ar.balance);
    ar.paidAmount += paymentAmount;
    ar.balance -= paymentAmount;
    ar.status = ar.balance <= 0 ? "paid" : "partially_paid";
    ar.updatedAt = new Date();

    const paymentId = MOCK_CREDIT_PAYMENTS.length + 1;
    const payment = {
      id: paymentId,
      type: "receivable",
      accountsReceivableId: ar.id,
      customerId: ar.customerId,
      amount: paymentAmount,
      paymentMethod: data.paymentMethod,
      notes: data.notes || null,
      userId: data.userId,
      receiptNumber,
      createdAt: new Date(),
    };
    MOCK_CREDIT_PAYMENTS.push(payment);

    await createFinancialTransaction({
      type: "income",
      category: "ar_payment",
      amount: paymentAmount,
      referenceId: ar.id,
      notes: `Cobro de CXC (${receiptNumber}) - Venta #${ar.saleId}`,
      paymentMethod: data.paymentMethod,
      userId: data.userId,
    });

    syncMocksToDisk();
    return payment;
  } else {
    const ap = MOCK_ACCOUNTS_PAYABLE.find((item: any) => item.id === data.accountsPayableId);
    if (!ap) throw new Error("Cuenta por pagar no encontrada");

    // Normalizar campos si el registro es antiguo
    if (ap.totalAmount === undefined) ap.totalAmount = ap.amount || 0;
    if (ap.paidAmount === undefined) ap.paidAmount = 0;
    if (ap.balance === undefined) ap.balance = ap.totalAmount - ap.paidAmount;

    if (ap.balance <= 0) throw new Error("Esta cuenta por pagar ya se encuentra totalmente saldada");

    const paymentAmount = Math.min(data.amount, ap.balance);
    ap.paidAmount += paymentAmount;
    ap.balance -= paymentAmount;
    ap.status = ap.balance <= 0 ? "paid" : "partially_paid";
    ap.updatedAt = new Date();

    const paymentId = MOCK_CREDIT_PAYMENTS.length + 1;
    const payment = {
      id: paymentId,
      type: "payable",
      accountsPayableId: ap.id,
      supplierId: ap.supplierId,
      amount: paymentAmount,
      paymentMethod: data.paymentMethod,
      notes: data.notes || null,
      userId: data.userId,
      receiptNumber,
      createdAt: new Date(),
    };
    MOCK_CREDIT_PAYMENTS.push(payment);

    await createFinancialTransaction({
      type: "expense",
      category: "ap_payment",
      amount: paymentAmount,
      referenceId: ap.id,
      notes: `Pago de CXP (${receiptNumber}) - Compra #${ap.purchaseId}`,
      paymentMethod: data.paymentMethod,
      userId: data.userId,
    });

    syncMocksToDisk();
    return payment;
  }
}

export async function getAllCreditPayments() {
  return MOCK_CREDIT_PAYMENTS.map((p: any) => {
    const user = MOCK_USERS.find((u: any) => u.id === p.userId);
    const customer = p.customerId ? MOCK_CUSTOMERS.find((c: any) => c.id === p.customerId) : null;
    const supplier = p.supplierId ? MOCK_SUPPLIERS.find((s: any) => s.id === p.supplierId) : null;
    return {
      ...p,
      userName: user?.name || "Desconocido",
      entityName: customer?.name || supplier?.name || "N/A",
    };
  });
}


