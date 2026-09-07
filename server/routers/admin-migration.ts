import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { units } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";

const FUNGIBLE_TYPES = ['charger', 'accessory', 'battery', 'cable', 'case', 'other'];

export const adminMigrationRouter = router({
  /**
   * Unificar códigos de productos fungibles
   * Agrupa unidades con el mismo brand+model para que compartan el mismo código QR
   */
  unifyFungibleCodes: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Solo admin puede ejecutar migraciones
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Solo administradores pueden ejecutar migraciones" 
        });
      }

      const db = await getDb();
      
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo conectar a la base de datos"
        });
      }

      const results = {
        totalFungibleUnits: 0,
        uniqueModels: 0,
        groupsProcessed: 0,
        unitsUpdated: 0,
        details: [] as Array<{
          brand: string;
          model: string;
          type: string;
          count: number;
          baseCode: string;
          oldCodes: string[];
        }>
      };

      // Obtener todas las unidades fungibles
      const fungibleUnits = await db
        .select()
        .from(units)
        .where(sql`${units.type} IN (${sql.join(FUNGIBLE_TYPES.map(t => sql`${t}`), sql`, `)})`);

      results.totalFungibleUnits = fungibleUnits.length;

      // Agrupar por brand + model + type
      const groupedByModel = new Map<string, typeof fungibleUnits>();
      
      for (const unit of fungibleUnits) {
        const key = `${unit.brand}|${unit.model}|${unit.type}`;
        if (!groupedByModel.has(key)) {
          groupedByModel.set(key, []);
        }
        groupedByModel.get(key)!.push(unit);
      }

      results.uniqueModels = groupedByModel.size;

      // Procesar cada grupo
      for (const [key, unitsInGroup] of groupedByModel.entries()) {
        const [brand, model, type] = key.split("|");
        
        // Si solo hay 1 unidad, no necesita unificación
        if (unitsInGroup.length <= 1) {
          continue;
        }

        // Obtener el código base (sin sufijo -01, -02, etc.)
        const firstCode = unitsInGroup[0].code || "";
        const baseCode = firstCode.split("-")[0];

        // Verificar si realmente tienen sufijos numéricos
        const hasSuffixes = unitsInGroup.some(u => {
          const code = u.code || "";
          const parts = code.split("-");
          return parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]);
        });

        if (!hasSuffixes) {
          // Ya están unificados
          continue;
        }

        results.groupsProcessed++;
        
        const oldCodes = unitsInGroup.map(u => u.code || "");

        // Actualizar todas las unidades del grupo al código base
        for (const unit of unitsInGroup) {
          if (unit.code !== baseCode) {
            await db
              .update(units)
              .set({ code: baseCode })
              .where(eq(units.id, unit.id));
            
            results.unitsUpdated++;
          }
        }

        results.details.push({
          brand: brand || "",
          model: model || "",
          type: type || "",
          count: unitsInGroup.length,
          baseCode,
          oldCodes,
        });
      }

      return {
        success: true,
        message: `Migración completada: ${results.unitsUpdated} unidades actualizadas en ${results.groupsProcessed} grupos`,
        results,
      };
    }),

  /**
   * Obtener estadísticas de códigos duplicados
   */
  getFungibleStats: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Solo administradores pueden ver estadísticas" 
        });
      }

      const db = await getDb();
      
      if (!db) {
        return {
          totalFungible: 0,
          needsUnification: 0,
          groups: []
        };
      }

      // Obtener todas las unidades fungibles
      const fungibleUnits = await db
        .select()
        .from(units)
        .where(sql`${units.type} IN (${sql.join(FUNGIBLE_TYPES.map(t => sql`${t}`), sql`, `)})`);

      // Agrupar por brand + model + type
      const groupedByModel = new Map<string, typeof fungibleUnits>();
      
      for (const unit of fungibleUnits) {
        const key = `${unit.brand}|${unit.model}|${unit.type}`;
        if (!groupedByModel.has(key)) {
          groupedByModel.set(key, []);
        }
        groupedByModel.get(key)!.push(unit);
      }

      const groups = [];
      let needsUnification = 0;

      for (const [key, unitsInGroup] of groupedByModel.entries()) {
        const [brand, model, type] = key.split("|");
        
        if (unitsInGroup.length <= 1) continue;

        const codes = unitsInGroup.map(u => u.code || "");
        const uniqueCodes = new Set(codes);
        const hasSuffixes = codes.some(code => {
          const parts = code.split("-");
          return parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]);
        });

        if (hasSuffixes && uniqueCodes.size > 1) {
          needsUnification++;
          groups.push({
            brand,
            model,
            type,
            count: unitsInGroup.length,
            codes: Array.from(uniqueCodes),
          });
        }
      }

      return {
        totalFungible: fungibleUnits.length,
        needsUnification,
        groups: groups.slice(0, 20), // Primeros 20 grupos
      };
    }),
});
