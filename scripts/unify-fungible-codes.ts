/**
 * Script de migración: Unificar códigos de productos fungibles
 * 
 * Este script actualiza todas las unidades fungibles (charger, accessory, battery, etc.)
 * que tienen el mismo brand+model para que compartan el MISMO código QR.
 * 
 * Ejemplo:
 * ANTES: 101010-01, 101010-02, 101010-03, 101010-04, 101010-05
 * DESPUÉS: 101010, 101010, 101010, 101010, 101010
 */

import { getDb } from "../server/db";
import { units } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

const FUNGIBLE_TYPES = ['charger', 'accessory', 'battery', 'cable', 'case', 'other'];

async function unifyFungibleCodes() {
  const db = await getDb();
  
  if (!db) {
    console.error("❌ No se pudo conectar a la base de datos");
    process.exit(1);
  }

  console.log("🔍 Buscando unidades fungibles con códigos individuales...\n");

  // Obtener todas las unidades fungibles
  const fungibleUnits = await db
    .select()
    .from(units)
    .where(sql`${units.type} IN (${sql.join(FUNGIBLE_TYPES.map(t => sql`${t}`), sql`, `)})`);

  console.log(`📦 Total de unidades fungibles encontradas: ${fungibleUnits.length}\n`);

  // Agrupar por brand + model
  const groupedByModel = new Map<string, typeof fungibleUnits>();
  
  for (const unit of fungibleUnits) {
    const key = `${unit.brand}|${unit.model}|${unit.type}`;
    if (!groupedByModel.has(key)) {
      groupedByModel.set(key, []);
    }
    groupedByModel.get(key)!.push(unit);
  }

  console.log(`🔢 Modelos únicos encontrados: ${groupedByModel.size}\n`);

  let totalUpdated = 0;
  let groupsProcessed = 0;

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

    // Verificar si realmente tienen sufijos
    const hasSuffixes = unitsInGroup.some(u => {
      const code = u.code || "";
      return code.includes("-") && /\d+$/.test(code.split("-")[1]);
    });

    if (!hasSuffixes) {
      // Ya están unificados
      continue;
    }

    groupsProcessed++;
    console.log(`\n📌 Grupo ${groupsProcessed}: ${brand} ${model} (${type})`);
    console.log(`   Unidades: ${unitsInGroup.length}`);
    console.log(`   Código base: ${baseCode}`);
    console.log(`   Códigos actuales: ${unitsInGroup.map(u => u.code).join(", ")}`);

    // Actualizar todas las unidades del grupo al código base
    for (const unit of unitsInGroup) {
      if (unit.code !== baseCode) {
        await db
          .update(units)
          .set({ code: baseCode })
          .where(eq(units.id, unit.id));
        
        totalUpdated++;
      }
    }

    console.log(`   ✅ ${unitsInGroup.length} unidades actualizadas al código: ${baseCode}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✨ Migración completada`);
  console.log(`   Grupos procesados: ${groupsProcessed}`);
  console.log(`   Unidades actualizadas: ${totalUpdated}`);
  console.log("=".repeat(60) + "\n");

  process.exit(0);
}

// Ejecutar
unifyFungibleCodes().catch((error) => {
  console.error("❌ Error durante la migración:", error);
  process.exit(1);
});
