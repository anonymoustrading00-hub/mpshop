/**
 * Script de diagnóstico: Ver qué especificaciones tienen los equipos
 */
import { getDb } from "../server/db";
import { units } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function checkSpecs() {
  const db = await getDb();
  if (!db) {
    console.error("❌ No hay conexión a la base de datos");
    return;
  }

  console.log("🔍 Revisando especificaciones de equipos...\n");

  // Obtener las primeras 10 unidades
  const allUnits = await db.select().from(units).limit(10);

  for (const unit of allUnits) {
    console.log(`\n📦 ${unit.brand} ${unit.model} (ID: ${unit.id}, Código: ${unit.code})`);
    console.log(`   Tipo: ${unit.type}`);
    
    if (unit.specs) {
      try {
        const parsedSpecs = typeof unit.specs === 'string' ? JSON.parse(unit.specs) : unit.specs;
        console.log(`   ✅ Especificaciones guardadas:`);
        
        const entries = Object.entries(parsedSpecs);
        if (entries.length === 0) {
          console.log(`      ⚠️  El campo specs existe pero está VACÍO`);
        } else {
          entries.forEach(([key, value]) => {
            console.log(`      • ${key}: ${value}`);
          });
        }
      } catch (err) {
        console.log(`   ❌ Error al parsear specs: ${err}`);
        console.log(`   Raw specs: ${unit.specs}`);
      }
    } else {
      console.log(`   ⚠️  NO tiene campo specs guardado (es NULL)`);
    }
  }

  console.log("\n✅ Diagnóstico completado");
  process.exit(0);
}

checkSpecs().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
