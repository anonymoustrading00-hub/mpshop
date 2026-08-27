import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { 
  getDb, 
  MOCK_DEVICE_BRANDS, 
  MOCK_DEVICE_MODELS, 
  MOCK_PROCESSORS, 
  MOCK_RAM_OPTIONS, 
  MOCK_STORAGE_OPTIONS, 
  MOCK_SCREEN_SIZES 
} from "../db";

export const deviceCatalogsRouter = router({
  // Obtener todas las marcas
  getBrands: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return MOCK_DEVICE_BRANDS;
    return db.select().from(schema.deviceBrands).orderBy(schema.deviceBrands.name);
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
});
