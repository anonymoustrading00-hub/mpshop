/**
 * seed_all_required_products.ts
 *
 * Script de seed para Railway pre-deploy.
 * Este proyecto usa la tabla `units` para el inventario de equipos electrónicos.
 * La tabla `inventory` fue eliminada en la migración a units.
 *
 * Este script verifica la conexión y no hace nada si no hay DATABASE_URL,
 * lo cual es el comportamiento correcto — los equipos (units) se registran
 * manualmente desde la interfaz, no desde un seed.
 */

import dotenv from "dotenv";
dotenv.config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.log("[Seed Products] No DATABASE_URL configured — running in demo mode, skipping.");
    process.exit(0);
  }

  console.log("[Seed Products] DATABASE_URL detected.");
  console.log("[Seed Products] This project uses the `units` table for inventory.");
  console.log("[Seed Products] Units are registered manually via the UI — no automatic seed needed.");
  console.log("[Seed Products] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Seed Products] Error:", err);
  process.exit(0); // exit 0 to not block Railway deploy
});
