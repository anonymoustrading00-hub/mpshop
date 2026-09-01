import express from "express";
import bcrypt from "bcrypt";
import fs from "fs/promises";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import mysql from "mysql2/promise";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import * as schema from "../../drizzle/schema";
import { ensureTables } from "../../scripts/ensure_tables";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function saveUploadedFileLocally(fileName: string, buffer: Buffer) {
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const fullPath = path.join(uploadsDir, fileName);
  await fs.writeFile(fullPath, buffer);
  return `/uploads/${fileName}`;
}

async function runDatabaseMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log("[Database] DATABASE_URL not configured; skipping migrations");
    return;
  }

  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  const pool = mysql.createPool(process.env.DATABASE_URL);
  const db = drizzle(pool, { schema, mode: "default" });

  try {
    console.log("[Database] Running migrations...");
    await migrate(db, { migrationsFolder });
    console.log("[Database] Migrations completed");
  } catch (err: any) {
    console.warn(
      "[Database] Drizzle migrate failed (often due to existing columns). ensureTables will run next to verify schema.",
      err.message
    );
  } finally {
    await pool.end();
  }
}

async function seedDefaultAdmin() {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Administrador";
  const email = process.env.ADMIN_EMAIL || "admin@mpshop.local";
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await connection.query(
      `INSERT INTO users
        (openId, username, passwordHash, name, email, loginMethod, role, status, createdAt, updatedAt, lastSignedIn)
       VALUES (?, ?, ?, ?, ?, 'traditional', 'admin', 'active', NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
        status = 'active',
        role = 'admin'`,
      [`local_${username}`, username, passwordHash, name, email]
    );
    console.log(`[Seed] Admin user verified/ready: ${username}`);
  } catch (err: any) {
    console.error("[Seed] Error creating admin user:", err.message);
  } finally {
    await connection.end();
  }
}

async function startServer() {
  await runDatabaseMigrations();
  if (process.env.DATABASE_URL) {
    await ensureTables().catch(err =>
      console.error("[StartServer] ensureTables failed:", err)
    );
    
    // Ejecutar migraciones automáticas
    const { getDb } = await import("../db");
    const { runAutoMigrations } = await import("../migrations/auto-migrate");
    const db = await getDb();
    await runAutoMigrations(db).catch(err =>
      console.error("[StartServer] Auto-migrations failed:", err)
    );
  } else {
    console.log("[StartServer] Skipping ensureTables (no DATABASE_URL, running in demo mode)");
  }
  await seedDefaultAdmin();
  if (process.env.DATABASE_URL) {
    const { seedDeviceCatalogs } = await import("../routers/deviceCatalogs");
    await seedDeviceCatalogs().catch(err =>
      console.error("[StartServer] seedDeviceCatalogs failed:", err)
    );
  }


  const app = express();
  const server = createServer(app);
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/uploads", express.static(uploadsDir));

  const kefirControlDir = path.resolve(
    process.cwd(),
    "client",
    "public",
    "kefir-control"
  );
  const kefirControlIndex = path.join(kefirControlDir, "index.html");
  const rootAppIndex =
    process.env.NODE_ENV === "development"
      ? path.resolve(process.cwd(), "client", "index.html")
      : path.resolve(process.cwd(), "dist", "public", "index.html");

  const setKefirControlCacheHeaders = (
    res: express.Response,
    filePath: string
  ) => {
    const normalizedFilePath = filePath.split(path.sep).join("/");

    if (normalizedFilePath.includes("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return;
    }

    if (normalizedFilePath.endsWith("/index.html")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  };

  const sendRootAppIndex = (
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (process.env.NODE_ENV === "development") {
      next();
      return;
    }

    res.sendFile(rootAppIndex);
  };

  const sendKefirControlIndex = async (
    _req: express.Request,
    res: express.Response
  ) => {
    res.setHeader("Cache-Control", "no-cache");
    try {
      let html = await fs.readFile(kefirControlIndex, 'utf-8');
      
      const { getDb } = await import("../db");
      const db = await getDb();
      let storageData: Record<string, string> = {};
      
      if (db) {
        const pool = (db as any).session?.client || (global as any)._pool;
        if (pool) {
          try {
            // 1. Sincronizar el Inventario de Producción REAL
            const [prodRows] = await pool.execute(`
              SELECT pi.productId as id, p.name, pi.quantity, p.unit, p.category, p.price as costPerUnit,
                     p.presentationQuantity, p.presentationUnit, p.presentationVolumeMl,
                     p.presentationWeightGr, p.productionRole
              FROM production_inventory pi
              INNER JOIN products p ON pi.productId = p.id
            `);

            let sanitizedProd = [];
            if (Array.isArray(prodRows) && prodRows.length > 0) {
              sanitizedProd = prodRows.map((row: any) => ({
                id: row.id,
                name: row.name,
                quantity: row.quantity,
                unit: row.unit || 'uds',
                minStock: 5,
                category: row.category,
                costPerUnit: row.costPerUnit,
                presentationQuantity: row.presentationQuantity || 1,
                presentationUnit: row.presentationUnit || row.unit || 'unidad',
                presentationVolumeMl: row.presentationVolumeMl || 0,
                presentationWeightGr: row.presentationWeightGr || 0,
                productionRole: row.productionRole || 'none',
              }));
            } else {
              // FALLBACK: Si no hay nada en la tabla de inventario, buscamos traspasos completados
              const [transferRows] = await pool.execute(`
                SELECT it.productId as id, p.name, it.quantity, p.unit, p.category, p.price as costPerUnit,
                       p.presentationQuantity, p.presentationUnit, p.presentationVolumeMl,
                       p.presentationWeightGr, p.productionRole
                FROM inventory_transfer_items it
                INNER JOIN inventory_transfers t ON it.transferId = t.id
                INNER JOIN products p ON it.productId = p.id
                WHERE t.direction = 'to_production' AND t.status = 'completed'
              `);

              if (Array.isArray(transferRows)) {
                const agg = new Map();
                for (const row of transferRows) {
                  const current = agg.get(row.id) || {
                    id: row.id, name: row.name, quantity: 0, unit: row.unit || 'uds',
                    minStock: 5, category: row.category, costPerUnit: row.costPerUnit,
                    presentationQuantity: row.presentationQuantity || 1,
                    presentationUnit: row.presentationUnit || row.unit || 'unidad',
                    presentationVolumeMl: row.presentationVolumeMl || 0,
                    presentationWeightGr: row.presentationWeightGr || 0,
                    productionRole: row.productionRole || 'none'
                  };
                  current.quantity += row.quantity;
                  agg.set(row.id, current);
                }
                sanitizedProd = Array.from(agg.values());
              }
            }
            storageData["kefir_inventory_v3"] = JSON.stringify(sanitizedProd);


            // 2. Recuperar el resto de configuraciones legacy de kefir_storage
            const [legacyRows] = await pool.execute('SELECT storage_key, storage_value FROM kefir_storage');
            if (Array.isArray(legacyRows)) {
              for (const row of legacyRows) {
                if (row.storage_key && row.storage_value && row.storage_key !== "kefir_inventory_v3") {
                  storageData[row.storage_key] = row.storage_value;
                }
              }
            }
          } catch (e) {
            console.error("Error reading kefir storage synthesis:", e);
          }
        }
      }
      
      const injection = `
      <script>
        try {
          window.__KEFIR_INITIAL_STATE__ = ${JSON.stringify(storageData)};
          
          // 1. Sincronizar DESDE la nube HACIA el navegador local
          for (const key in window.__KEFIR_INITIAL_STATE__) {
            if (window.__KEFIR_INITIAL_STATE__.hasOwnProperty(key)) {
              if (key.startsWith('kefir_')) {
                localStorage.setItem(key, window.__KEFIR_INITIAL_STATE__[key]);
              }
            }
          }
          
          // 2. Sincronizar DESDE el navegador HACIA la nube (para recuperar datos huérfanos del PC original)
          for (let i = 0; i < localStorage.length; i++) {
            const localKey = localStorage.key(i);
            if (localKey && localKey.startsWith('kefir_')) {
              // Si la nube no tiene esta llave, o es diferente, la subimos
              if (!window.__KEFIR_INITIAL_STATE__[localKey] || window.__KEFIR_INITIAL_STATE__[localKey] !== localStorage.getItem(localKey)) {
                try {
                  fetch("/api/trpc/production.setKefirStorage", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 0: { key: localKey, value: localStorage.getItem(localKey) } }),
                  });
                } catch(e) {}
              }
            }
          }
        } catch(e) {
          console.error("Failed to inject and sync kefir storage state", e);
        }
      </script>
      `;
      
      html = html.replace('<head>', '<head>\\n' + injection);
      res.send(html);
    } catch (err) {
      console.error("Error serving kefir control index:", err);
      res.sendFile(kefirControlIndex);
    }
  };
  app.use(
    "/kefir-control",
    express.static(kefirControlDir, {
      index: false,
      setHeaders: setKefirControlCacheHeaders,
    })
  );
  app.get("/kefir-control", sendKefirControlIndex);
  app.get("/kefir-control/index.html", sendKefirControlIndex);
  app.get("/preview/kefir-control", sendRootAppIndex);
  app.get("/preview/kefir-control/index.html", sendRootAppIndex);
  app.get("/preview/kefir-control/inventory", sendRootAppIndex);
  app.get("/preview/kefir-control/kardex", sendRootAppIndex);
  app.get("/preview/kefir-control/lotes", sendRootAppIndex);
  app.get(/^\/preview\/kefir-control(?:\/.*)?$/, (req, res, next) => {
    const relativePath = req.path.replace(/^\/preview\/kefir-control\/?/, "");
    if (
      !relativePath ||
      relativePath === "index.html" ||
      !path.extname(relativePath)
    ) {
      if (process.env.NODE_ENV === "development") {
        next();
        return;
      }

      res.sendFile(rootAppIndex);
      return;
    }
    next();
  });
  app.get(/^\/kefir-control(?:\/.*)?$/, (req, res, next) => {
    const relativePath = req.path.replace(/^\/kefir-control\/?/, "");
    if (
      !relativePath ||
      relativePath === "index.html" ||
      !path.extname(relativePath)
    ) {
      sendKefirControlIndex(req, res);
      return;
    }
    next();
  });

  // Configurar multer para upload de imágenes
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Solo se permiten archivos de imagen"));
      }
    },
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Image upload endpoint
  app.post("/api/upload-image", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const extension = req.file.mimetype.split("/")[1] || "jpg";
      const fileName = `product-${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

      let url: string;

      try {
        const { storagePut } = await import("../storage");
        const uploaded = await storagePut(
          fileName,
          req.file.buffer,
          req.file.mimetype
        );
        url = uploaded.url;
      } catch (error) {
        console.warn("Falling back to local upload storage:", error);
        url = await saveUploadedFileLocally(fileName, req.file.buffer);
      }

      res.json({ url, success: true });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Error al subir la imagen" });
    }
  });

  // Version endpoint for deployment verification
  const APP_VERSION = "1.5.0";
  app.get("/api/version", (_req, res) => {
    res.json({
      version: APP_VERSION,
      buildTime: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
    });
  });

  app.get("/api/debug-db-status", async (_req, res) => {
    const { getDb, getDbInitError } = await import("../db");
    const db = await getDb();
    res.json({
      dbConnected: !!db,
      envHasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlStart: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.substring(0, 15)
        : "missing",
      initError: getDbInitError(),
    });
  });

  // Debug endpoint for order items table structure
  app.get("/api/debug-order-tables", async (_req, res) => {
    try {
      const mysql = await import("mysql2/promise");
      const connection = await mysql.default.createConnection(process.env.DATABASE_URL!);

      // Check orderItems table structure
      const [orderItemsColumns] = await connection.query("DESCRIBE orderItems");
      const [ordersColumns] = await connection.query("DESCRIBE orders");

      // Check if there are any orders
      const [orders] = await connection.query("SELECT id, orderNumber FROM orders ORDER BY id DESC LIMIT 10");

      // Check if there are any orderItems
      const [orderItems] = await connection.query("SELECT id, orderId, productId FROM orderItems ORDER BY id DESC LIMIT 10");

      await connection.end();

      res.json({
        orderItemsColumns,
        ordersColumns,
        recentOrders: orders,
        recentOrderItems: orderItems,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint to check specific order
  app.get("/api/debug-order/:orderId", async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const mysql = await import("mysql2/promise");
      const connection = await mysql.default.createConnection(process.env.DATABASE_URL!);

      // Get order
      const [orders] = await connection.query("SELECT * FROM orders WHERE id = ?", [orderId]);

      // Get order items
      const [items] = await connection.query("SELECT * FROM orderItems WHERE orderId = ?", [orderId]);

      await connection.end();

      res.json({
        order: orders,
        items: items,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RESET DE BASE DE DATOS (solo en modo DATABASE_URL / producción)
  // Borra TODOS los datos operativos y conserva únicamente el usuario admin.
  // Uso: GET /api/admin/reset-db?secret=RESET_SECRET
  // La variable de entorno RESET_SECRET debe estar configurada en Railway.
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/admin/reset-db", async (req, res) => {
    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ error: "Este endpoint solo funciona con DATABASE_URL configurada." });
    }

    const secret = process.env.RESET_SECRET || "mpshop-reset-2024";
    if (req.query.secret !== secret) {
      return res.status(403).json({ error: "Clave incorrecta. Agrega ?secret=TU_CLAVE a la URL." });
    }

    let connection: any;
    try {
      const mysql = await import("mysql2/promise");
      connection = await mysql.default.createConnection(process.env.DATABASE_URL);

      // Lista de tablas operativas a vaciar (orden: primero las hijas, luego las padre)
      const tablesToTruncate = [
        "sale_items",
        "sales",
        "quotation_items",
        "quotations",
        "order_items",
        "orders",
        "purchase_items",
        "purchases",
        "accounts_payable",
        "accounts_receivable",
        "credit_payments",
        "financial_transactions",
        "cash_closures",
        "cash_openings",
        "operational_expenses",
        "delivery_expenses",
        "unit_events",
        "repairs",
        "warranties",
        "returns",
        "units",
        "generated_codes",
        "inventory",
        "movements",
        "payments",
        "inventory_transfer_items",
        "inventory_transfers",
        "customers",
        "suppliers",
      ];

      // Deshabilitar FK checks temporalmente para poder truncar sin orden estricto
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const table of tablesToTruncate) {
        try {
          await connection.query(`TRUNCATE TABLE \`${table}\``);
          console.log(`[Reset] Truncated: ${table}`);
        } catch (err: any) {
          // Si la tabla no existe la ignoramos
          if (!err.message?.includes("doesn't exist")) {
            console.warn(`[Reset] Could not truncate ${table}:`, err.message);
          }
        }
      }
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");

      // Asegurarse que el admin siga existiendo con contraseña "usuario"
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.default.hash("usuario", 10);
      const adminUsername = process.env.ADMIN_USERNAME || "admin";
      const adminEmail = process.env.ADMIN_EMAIL || "admin@mpshop.local";

      await connection.query(
        `INSERT INTO users
          (openId, username, passwordHash, name, email, loginMethod, role, status,
           allowedModules, specialPermissions, assignedBranchIds, createdAt, updatedAt, lastSignedIn)
         VALUES (?, ?, ?, 'Administrador', ?, 'traditional', 'admin', 'active',
           ?, ?, ?, NOW(), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           passwordHash = VALUES(passwordHash),
           role = 'admin',
           status = 'active',
           allowedModules = VALUES(allowedModules),
           specialPermissions = VALUES(specialPermissions)`,
        [
          `local_${adminUsername}`,
          adminUsername,
          passwordHash,
          adminEmail,
          JSON.stringify(["sales","catalog","units","repairs","warranties","returns","orders","generate-codes","customers","suppliers","purchases","dashboard-kpis","reports","dashboard","analytics","analysis","finance","accounts-receivable","accounts-payable","expenses","branches","users","delivery-persons"]),
          JSON.stringify({ canViewPurchaseCost: true, canApplyDiscounts: true, canViewFinancialReports: true, canManageInventory: true, canDeleteRecords: true }),
          JSON.stringify(["all"]),
        ]
      );

      await connection.end();

      return res.json({
        success: true,
        message: "✅ Base de datos reiniciada correctamente. Solo el usuario admin se conservó.",
        admin: { username: adminUsername, password: "usuario" },
      });
    } catch (error: any) {
      console.error("[Reset] Error:", error);
      try { await connection?.end(); } catch {}
      return res.status(500).json({ error: error.message });
    }
  });



  console.log(`[App] Version ${APP_VERSION} starting...`);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`[Server] [v1.5.0] Running on port ${port}`);
  });
}

startServer().catch(console.error);
