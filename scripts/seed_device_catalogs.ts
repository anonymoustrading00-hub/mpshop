import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";
import {
  DEFAULT_DEVICE_BRANDS,
  DEFAULT_DEVICE_MODELS,
  DEFAULT_PROCESSORS,
  DEFAULT_RAM_OPTIONS,
  DEFAULT_SCREEN_SIZES,
  DEFAULT_STORAGE_OPTIONS,
} from "../shared/deviceCatalogDefaults";

async function ensureCatalogTables(connection: mysql.Connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS device_brands (
      id int AUTO_INCREMENT NOT NULL,
      name varchar(100) NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT device_brands_id PRIMARY KEY(id),
      CONSTRAINT device_brands_name_unique UNIQUE(name)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS device_models (
      id int AUTO_INCREMENT NOT NULL,
      brandId int NOT NULL,
      name varchar(255) NOT NULL,
      defaultSpecs text,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT device_models_id PRIMARY KEY(id),
      INDEX device_models_brandId_idx (brandId),
      UNIQUE KEY device_models_brand_name_unique (brandId, name)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS processors (
      id int AUTO_INCREMENT NOT NULL,
      name varchar(255) NOT NULL,
      generation varchar(50),
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT processors_id PRIMARY KEY(id),
      CONSTRAINT processors_name_unique UNIQUE(name)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS ram_options (
      id int AUTO_INCREMENT NOT NULL,
      capacity varchar(50) NOT NULL,
      type varchar(50),
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ram_options_id PRIMARY KEY(id),
      CONSTRAINT ram_options_capacity_unique UNIQUE(capacity)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS storage_options (
      id int AUTO_INCREMENT NOT NULL,
      capacity varchar(50) NOT NULL,
      type varchar(50),
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT storage_options_id PRIMARY KEY(id),
      CONSTRAINT storage_options_capacity_unique UNIQUE(capacity)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS screen_sizes (
      id int AUTO_INCREMENT NOT NULL,
      size varchar(50) NOT NULL,
      resolution varchar(100),
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT screen_sizes_id PRIMARY KEY(id),
      CONSTRAINT screen_sizes_size_unique UNIQUE(size)
    )
  `);
}

async function ensureBrand(db: any, name: string) {
  const normalizedName = name.replace(/\s+/g, " ").trim();
  const [existing] = await db
    .select()
    .from(schema.deviceBrands)
    .where(sql`lower(${schema.deviceBrands.name}) = ${normalizedName.toLowerCase()}`)
    .limit(1);

  if (existing) return existing.id;

  await db
    .insert(schema.deviceBrands)
    .values({ name: normalizedName })
    .onDuplicateKeyUpdate({ set: { name: schema.deviceBrands.name } });

  const [created] = await db
    .select()
    .from(schema.deviceBrands)
    .where(sql`lower(${schema.deviceBrands.name}) = ${normalizedName.toLowerCase()}`)
    .limit(1);

  return created.id;
}

async function ensureModel(db: any, brandId: number, name: string, defaultSpecs: Record<string, string>) {
  const normalizedName = name.replace(/\s+/g, " ").trim();
  const specsJson = JSON.stringify(defaultSpecs);
  const [existing] = await db
    .select()
    .from(schema.deviceModels)
    .where(and(
      eq(schema.deviceModels.brandId, brandId),
      sql`lower(${schema.deviceModels.name}) = ${normalizedName.toLowerCase()}`
    ))
    .limit(1);

  if (existing) {
    await db
      .update(schema.deviceModels)
      .set({ defaultSpecs: specsJson })
      .where(eq(schema.deviceModels.id, existing.id));
    return;
  }

  await db.insert(schema.deviceModels).values({
    brandId,
    name: normalizedName,
    defaultSpecs: specsJson,
  });
}

async function main() {
  const connection = process.env.DATABASE_URL
    ? await mysql.createConnection(process.env.DATABASE_URL)
    : await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "3306"),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "control_pedidos",
      });

  const db = drizzle(connection, { schema, mode: "default" });

  console.log("[SeedDeviceCatalogs] Starting device catalog seed...");
  await ensureCatalogTables(connection);

  const brandMap: Record<string, number> = {};
  for (const brandName of DEFAULT_DEVICE_BRANDS) {
    brandMap[brandName] = await ensureBrand(db, brandName);
  }
  console.log(`[SeedDeviceCatalogs] Brands ensured: ${DEFAULT_DEVICE_BRANDS.length}`);

  for (const model of DEFAULT_DEVICE_MODELS) {
    const brandId = brandMap[model.brand];
    if (brandId) await ensureModel(db, brandId, model.name, model.defaultSpecs);
  }
  console.log(`[SeedDeviceCatalogs] Models ensured: ${DEFAULT_DEVICE_MODELS.length}`);

  await db
    .insert(schema.processors)
    .values(DEFAULT_PROCESSORS)
    .onDuplicateKeyUpdate({
      set: {
        name: schema.processors.name,
        generation: schema.processors.generation,
      },
    });
  console.log(`[SeedDeviceCatalogs] Processors ensured: ${DEFAULT_PROCESSORS.length}`);

  await db
    .insert(schema.ramOptions)
    .values(DEFAULT_RAM_OPTIONS)
    .onDuplicateKeyUpdate({
      set: {
        capacity: schema.ramOptions.capacity,
        type: schema.ramOptions.type,
      },
    });
  console.log(`[SeedDeviceCatalogs] RAM options ensured: ${DEFAULT_RAM_OPTIONS.length}`);

  await db
    .insert(schema.storageOptions)
    .values(DEFAULT_STORAGE_OPTIONS)
    .onDuplicateKeyUpdate({
      set: {
        capacity: schema.storageOptions.capacity,
        type: schema.storageOptions.type,
      },
    });
  console.log(`[SeedDeviceCatalogs] Storage options ensured: ${DEFAULT_STORAGE_OPTIONS.length}`);

  await db
    .insert(schema.screenSizes)
    .values(DEFAULT_SCREEN_SIZES)
    .onDuplicateKeyUpdate({
      set: {
        size: schema.screenSizes.size,
        resolution: schema.screenSizes.resolution,
      },
    });
  console.log(`[SeedDeviceCatalogs] Screen sizes ensured: ${DEFAULT_SCREEN_SIZES.length}`);

  console.log("[SeedDeviceCatalogs] Done.");
  await connection.end();
}

main().catch((err) => {
  console.error("[SeedDeviceCatalogs] Failed:", err);
  process.exit(1);
});
