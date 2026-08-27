import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { getDb } from "../db";

export const deviceCatalogsRouter = router({
  // Obtener todas las marcas
  getBrands: protectedProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(schema.deviceBrands).orderBy(schema.deviceBrands.name);
  }),

  // Obtener modelos por marca
  getModelsByBrand: protectedProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
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
      const models = await db
        .select()
        .from(schema.deviceModels)
        .where(eq(schema.deviceModels.id, input.modelId));
      return models[0];
    }),

  // Obtener todos los procesadores
  getProcessors: protectedProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(schema.processors).orderBy(schema.processors.name);
  }),

  // Obtener opciones de RAM
  getRamOptions: protectedProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(schema.ramOptions).orderBy(schema.ramOptions.capacity);
  }),

  // Obtener opciones de almacenamiento
  getStorageOptions: protectedProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(schema.storageOptions).orderBy(schema.storageOptions.capacity);
  }),

  // Obtener tamaños de pantalla
  getScreenSizes: protectedProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(schema.screenSizes).orderBy(schema.screenSizes.size);
  }),
});
