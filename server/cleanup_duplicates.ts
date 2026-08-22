import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { financialTransactions } from "../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

async function cleanupDuplicates() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);

  // Buscar todas las transacciones de tipo closure_report
  const allClosureReports = await db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.category, "closure_report" as any))
    .orderBy(desc(financialTransactions.createdAt));

  console.log(`Encontradas ${allClosureReports.length} transacciones de cierre.`);

  // Agrupar por notas (misma nota = mismo cierre)
  const seenNotes = new Map<string, number>();
  const toDelete: number[] = [];

  // Los registros están ordenados por fecha DESC, así conservamos el más reciente
  for (const tx of allClosureReports) {
    const key = tx.notes || "";
    if (seenNotes.has(key)) {
      // Este es un duplicado, marcarlo para eliminar
      toDelete.push(tx.id!);
      console.log(`Duplicado encontrado: ID=${tx.id}, Notas="${tx.notes}"`);
    } else {
      seenNotes.set(key, tx.id!);
    }
  }

  if (toDelete.length === 0) {
    console.log("No se encontraron duplicados.");
  } else {
    console.log(`Eliminando ${toDelete.length} duplicados...`);
    for (const id of toDelete) {
      await db.delete(financialTransactions).where(eq(financialTransactions.id, id));
      console.log(`Eliminado ID=${id}`);
    }
    console.log("Limpieza completada.");
  }

  await connection.end();
}

cleanupDuplicates().catch(console.error);
