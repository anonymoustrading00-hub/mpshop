import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { 
  getDb, 
  MOCK_DEVICE_BRANDS, 
  MOCK_DEVICE_MODELS, 
  MOCK_PROCESSORS, 
  MOCK_RAM_OPTIONS, 
  MOCK_STORAGE_OPTIONS, 
  MOCK_SCREEN_SIZES,
  syncMocksToDisk,
} from "../db";
import {
  DEFAULT_DEVICE_BRANDS,
  DEFAULT_DEVICE_MODELS,
  DEFAULT_PROCESSORS,
  DEFAULT_RAM_OPTIONS,
  DEFAULT_STORAGE_OPTIONS,
  DEFAULT_SCREEN_SIZES,
} from "../../shared/deviceCatalogDefaults";


function normalizeCatalogText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sameCatalogText(left: unknown, right: unknown) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

function nextMockId(items: any[]) {
  const ids = items.map((item) => Number(item.id)).filter(Number.isFinite);
  return (ids.length ? Math.max(...ids) : 0) + 1;
}

function inferRamType(capacity: string) {
  const upper = capacity.toUpperCase();
  if (upper.includes("LPDDR5")) return "LPDDR5";
  if (upper.includes("LPDDR4")) return "LPDDR4x";
  if (upper.includes("DDR5")) return "DDR5";
  if (upper.includes("DDR4")) return "DDR4";
  if (upper.includes("APPLE") || upper.includes("UNIFIED")) return "Unified";
  return "Generic";
}

function inferStorageType(capacity: string) {
  const upper = capacity.toUpperCase();
  if (upper.includes("NVME")) return "NVMe";
  if (upper.includes("SSD")) return "SSD";
  if (upper.includes("HDD")) return "HDD";
  return "Flash";
}

async function ensureBrandRecord(db: any, name: string) {
  const normalizedName = normalizeCatalogText(name);
  if (!normalizedName) return null;

  if (!db) {
    const existing = MOCK_DEVICE_BRANDS.find((brand) => sameCatalogText(brand.name, normalizedName));
    if (existing) return existing;

    const created = { id: nextMockId(MOCK_DEVICE_BRANDS), name: normalizedName, createdAt: new Date() };
    MOCK_DEVICE_BRANDS.push(created);
    syncMocksToDisk();
    return created;
  }

  const [existing] = await db
    .select()
    .from(schema.deviceBrands)
    .where(sql`lower(${schema.deviceBrands.name}) = ${normalizedName.toLowerCase()}`)
    .limit(1);

  if (existing) return existing;

  await db
    .insert(schema.deviceBrands)
    .values({ name: normalizedName })
    .onDuplicateKeyUpdate({ set: { name: schema.deviceBrands.name } });

  const [created] = await db
    .select()
    .from(schema.deviceBrands)
    .where(sql`lower(${schema.deviceBrands.name}) = ${normalizedName.toLowerCase()}`)
    .limit(1);

  return created || null;
}

export const deviceCatalogsRouter = router({
  // Obtener todas las marcas
  getBrands: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return MOCK_DEVICE_BRANDS;
    return db.select().from(schema.deviceBrands).orderBy(schema.deviceBrands.name);
  }),

  // Obtener todos los modelos (con nombre de marca y defaultSpecs)
  getAllModels: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return MOCK_DEVICE_MODELS.map(m => {
        const brand = MOCK_DEVICE_BRANDS.find(b => b.id === m.brandId);
        return {
          ...m,
          brandName: brand?.name || "Generic"
        };
      });
    }
    const rows = await db
      .select({
        id: schema.deviceModels.id,
        brandId: schema.deviceModels.brandId,
        name: schema.deviceModels.name,
        defaultSpecs: schema.deviceModels.defaultSpecs,
        brandName: schema.deviceBrands.name,
      })
      .from(schema.deviceModels)
      .leftJoin(schema.deviceBrands, eq(schema.deviceModels.brandId, schema.deviceBrands.id))
      .orderBy(schema.deviceModels.name);
    return rows;
  }),

  // Obtener modelos por marca
  getModelsByBrand: protectedProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return MOCK_DEVICE_MODELS.filter(m => m.brandId === input.brandId);
      return db
        .select()
        .from(schema.deviceModels)
        .where(eq(schema.deviceModels.brandId, input.brandId))
        .orderBy(schema.deviceModels.name);
    }),


  // Obtener un modelo específico (para autocompletar specs)
  getModel: protectedProcedure
    .input(z.object({ modelId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return MOCK_DEVICE_MODELS.find(m => m.id === input.modelId) || null;
      const models = await db
        .select()
        .from(schema.deviceModels)
        .where(eq(schema.deviceModels.id, input.modelId));
      return models[0];
    }),

  // Obtener todos los procesadores
  getProcessors: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return MOCK_PROCESSORS;
    return db.select().from(schema.processors).orderBy(schema.processors.name);
  }),

  // Obtener opciones de RAM
  getRamOptions: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return MOCK_RAM_OPTIONS;
    return db.select().from(schema.ramOptions).orderBy(schema.ramOptions.capacity);
  }),

  // Obtener opciones de almacenamiento
  getStorageOptions: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return MOCK_STORAGE_OPTIONS;
    return db.select().from(schema.storageOptions).orderBy(schema.storageOptions.capacity);
  }),

  // Obtener tamaños de pantalla
  getScreenSizes: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return MOCK_SCREEN_SIZES;
    return db.select().from(schema.screenSizes).orderBy(schema.screenSizes.size);
  }),

  ensureBrand: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const record = await ensureBrandRecord(db, input.name);
      if (!record) throw new Error("No se pudo guardar la marca");
      return record;
    }),

  ensureModel: protectedProcedure
    .input(z.object({
      brandId: z.number().optional(),
      brandName: z.string().max(100).optional(),
      name: z.string().min(1).max(255),
      defaultSpecs: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const normalizedName = normalizeCatalogText(input.name);
      const defaultSpecs = input.defaultSpecs && Object.keys(input.defaultSpecs).length > 0
        ? JSON.stringify(input.defaultSpecs)
        : null;

      let resolvedBrandId = input.brandId;

      if (!resolvedBrandId && input.brandName) {
        const brand = await ensureBrandRecord(db, input.brandName);
        resolvedBrandId = brand?.id;
      }

      if (!resolvedBrandId) throw new Error("Selecciona o escribe una marca antes de guardar el modelo");

      if (!db) {
        const existing = MOCK_DEVICE_MODELS.find(
          (model) => Number(model.brandId) === Number(resolvedBrandId) && sameCatalogText(model.name, normalizedName)
        );
        if (existing) {
          if (!existing.defaultSpecs && defaultSpecs) {
            existing.defaultSpecs = defaultSpecs;
            syncMocksToDisk();
          }
          return existing;
        }

        const created = {
          id: nextMockId(MOCK_DEVICE_MODELS),
          brandId: resolvedBrandId,
          name: normalizedName,
          defaultSpecs,
          createdAt: new Date(),
        };
        MOCK_DEVICE_MODELS.push(created);
        syncMocksToDisk();
        return created;
      }

      const [existing] = await db
        .select()
        .from(schema.deviceModels)
        .where(and(
          eq(schema.deviceModels.brandId, resolvedBrandId),
          sql`lower(${schema.deviceModels.name}) = ${normalizedName.toLowerCase()}`
        ))
        .limit(1);

      if (existing) {
        if (!existing.defaultSpecs && defaultSpecs) {
          await db
            .update(schema.deviceModels)
            .set({ defaultSpecs })
            .where(eq(schema.deviceModels.id, existing.id));
          return { ...existing, defaultSpecs };
        }
        return existing;
      }

      await db.insert(schema.deviceModels).values({
        brandId: resolvedBrandId,
        name: normalizedName,
        defaultSpecs,
      });

      const [created] = await db
        .select()
        .from(schema.deviceModels)
        .where(and(
          eq(schema.deviceModels.brandId, resolvedBrandId),
          sql`lower(${schema.deviceModels.name}) = ${normalizedName.toLowerCase()}`
        ))
        .limit(1);

      return created;
    }),

  ensureProcessor: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const name = normalizeCatalogText(input.name);

      if (!db) {
        const existing = MOCK_PROCESSORS.find((processor) => sameCatalogText(processor.name, name));
        if (existing) return existing;

        const created = { id: nextMockId(MOCK_PROCESSORS), name, generation: null, createdAt: new Date() };
        MOCK_PROCESSORS.push(created);
        syncMocksToDisk();
        return created;
      }

      const [existing] = await db
        .select()
        .from(schema.processors)
        .where(sql`lower(${schema.processors.name}) = ${name.toLowerCase()}`)
        .limit(1);

      if (existing) return existing;

      await db
        .insert(schema.processors)
        .values({ name })
        .onDuplicateKeyUpdate({ set: { name: schema.processors.name } });

      const [created] = await db
        .select()
        .from(schema.processors)
        .where(sql`lower(${schema.processors.name}) = ${name.toLowerCase()}`)
        .limit(1);

      return created;
    }),

  ensureRamOption: protectedProcedure
    .input(z.object({ capacity: z.string().min(1).max(50) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const capacity = normalizeCatalogText(input.capacity);
      const type = inferRamType(capacity);

      if (!db) {
        const existing = MOCK_RAM_OPTIONS.find((option) => sameCatalogText(option.capacity, capacity));
        if (existing) return existing;

        const created = { id: nextMockId(MOCK_RAM_OPTIONS), capacity, type, createdAt: new Date() };
        MOCK_RAM_OPTIONS.push(created);
        syncMocksToDisk();
        return created;
      }

      const [existing] = await db
        .select()
        .from(schema.ramOptions)
        .where(sql`lower(${schema.ramOptions.capacity}) = ${capacity.toLowerCase()}`)
        .limit(1);

      if (existing) return existing;

      await db
        .insert(schema.ramOptions)
        .values({ capacity, type })
        .onDuplicateKeyUpdate({ set: { capacity: schema.ramOptions.capacity } });

      const [created] = await db
        .select()
        .from(schema.ramOptions)
        .where(sql`lower(${schema.ramOptions.capacity}) = ${capacity.toLowerCase()}`)
        .limit(1);

      return created;
    }),

  ensureStorageOption: protectedProcedure
    .input(z.object({ capacity: z.string().min(1).max(50) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const capacity = normalizeCatalogText(input.capacity);
      const type = inferStorageType(capacity);

      if (!db) {
        const existing = MOCK_STORAGE_OPTIONS.find((option) => sameCatalogText(option.capacity, capacity));
        if (existing) return existing;

        const created = { id: nextMockId(MOCK_STORAGE_OPTIONS), capacity, type, createdAt: new Date() };
        MOCK_STORAGE_OPTIONS.push(created);
        syncMocksToDisk();
        return created;
      }

      const [existing] = await db
        .select()
        .from(schema.storageOptions)
        .where(sql`lower(${schema.storageOptions.capacity}) = ${capacity.toLowerCase()}`)
        .limit(1);

      if (existing) return existing;

      await db
        .insert(schema.storageOptions)
        .values({ capacity, type })
        .onDuplicateKeyUpdate({ set: { capacity: schema.storageOptions.capacity } });

      const [created] = await db
        .select()
        .from(schema.storageOptions)
        .where(sql`lower(${schema.storageOptions.capacity}) = ${capacity.toLowerCase()}`)
        .limit(1);

      return created;
    }),

  ensureScreenSize: protectedProcedure
    .input(z.object({
      size: z.string().min(1).max(50),
      resolution: z.string().max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const size = normalizeCatalogText(input.size);
      const resolution = input.resolution ? normalizeCatalogText(input.resolution) : null;

      if (!db) {
        const existing = MOCK_SCREEN_SIZES.find((option) => sameCatalogText(option.size, size));
        if (existing) return existing;

        const created = { id: nextMockId(MOCK_SCREEN_SIZES), size, resolution, createdAt: new Date() };
        MOCK_SCREEN_SIZES.push(created);
        syncMocksToDisk();
        return created;
      }

      const [existing] = await db
        .select()
        .from(schema.screenSizes)
        .where(sql`lower(${schema.screenSizes.size}) = ${size.toLowerCase()}`)
        .limit(1);

      if (existing) return existing;

      await db
        .insert(schema.screenSizes)
        .values({ size, resolution })
        .onDuplicateKeyUpdate({ set: { size: schema.screenSizes.size } });

      const [created] = await db
        .select()
        .from(schema.screenSizes)
        .where(sql`lower(${schema.screenSizes.size}) = ${size.toLowerCase()}`)
        .limit(1);

      return created;
    }),
});

// ──────────────────────────────────────────────────────────────────────────────
// Seed: Poblar catálogos con datos por defecto al arrancar el servidor
// ──────────────────────────────────────────────────────────────────────────────
export async function seedDeviceCatalogs() {

  const db = await getDb();
  if (!db) {
    console.log("[SeedCatalogs] No DB available, skipping.");
    return;
  }

  console.log("[SeedCatalogs] Starting catalog seeding...");

  // 1. Marcas
  for (const brandName of DEFAULT_DEVICE_BRANDS) {
    try {
      await db
        .insert(schema.deviceBrands)
        .values({ name: brandName })
        .onDuplicateKeyUpdate({ set: { name: brandName } });
    } catch (_) {}
  }
  console.log(`[SeedCatalogs] Brands done (${DEFAULT_DEVICE_BRANDS.length})`);

  // Mapa nombre → id
  const dbBrands = await db.select().from(schema.deviceBrands);
  const brandIdByName: Record<string, number> = {};
  for (const b of dbBrands) {
    brandIdByName[b.name.toLowerCase()] = b.id;
  }

  // 2. Modelos
  let modelsSeeded = 0;
  for (const model of DEFAULT_DEVICE_MODELS) {
    const brandId = brandIdByName[model.brand.toLowerCase()];
    if (!brandId) continue;
    try {
      await db
        .insert(schema.deviceModels)
        .values({ brandId, name: model.name, defaultSpecs: JSON.stringify(model.defaultSpecs) })
        .onDuplicateKeyUpdate({ set: { defaultSpecs: JSON.stringify(model.defaultSpecs) } });
      modelsSeeded++;
    } catch (_) {}
  }
  console.log(`[SeedCatalogs] Models done (${modelsSeeded})`);

  // 3. Procesadores
  for (const p of DEFAULT_PROCESSORS) {
    try {
      await db
        .insert(schema.processors)
        .values({ name: p.name, generation: (p as any).generation ?? null })
        .onDuplicateKeyUpdate({ set: { name: p.name } });
    } catch (_) {}
  }
  console.log(`[SeedCatalogs] Processors done (${DEFAULT_PROCESSORS.length})`);

  // 4. RAM
  for (const r of DEFAULT_RAM_OPTIONS) {
    try {
      await db
        .insert(schema.ramOptions)
        .values({ capacity: r.capacity, type: "Generic" })
        .onDuplicateKeyUpdate({ set: { capacity: r.capacity } });
    } catch (_) {}
  }
  console.log(`[SeedCatalogs] RAM options done (${DEFAULT_RAM_OPTIONS.length})`);

  // 5. Almacenamiento
  for (const s of DEFAULT_STORAGE_OPTIONS) {
    const upper = s.capacity.toUpperCase();
    const type = upper.includes("SSD") ? "SSD" : upper.includes("HDD") ? "HDD" : "Flash";
    try {
      await db
        .insert(schema.storageOptions)
        .values({ capacity: s.capacity, type })
        .onDuplicateKeyUpdate({ set: { capacity: s.capacity } });
    } catch (_) {}
  }
  console.log(`[SeedCatalogs] Storage options done (${DEFAULT_STORAGE_OPTIONS.length})`);

  // 6. Pantallas
  for (const sc of DEFAULT_SCREEN_SIZES) {
    try {
      await db
        .insert(schema.screenSizes)
        .values({ size: sc.size, resolution: (sc as any).resolution ?? null })
        .onDuplicateKeyUpdate({ set: { size: sc.size } });
    } catch (_) {}
  }
  console.log(`[SeedCatalogs] Screen sizes done (${DEFAULT_SCREEN_SIZES.length})`);
  console.log("[SeedCatalogs] All catalog seeding complete ✓");
}

