import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Ensuring new tables...");
  const db = await getDb();
  if (!db) return;
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inventory_transfers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transferNumber VARCHAR(50) NOT NULL UNIQUE,
      direction VARCHAR(50) NOT NULL DEFAULT 'branch_transfer',
      sourceBranchId INT NOT NULL DEFAULT 1,
      destinationBranchId INT NOT NULL DEFAULT 1,
      status ENUM('pending', 'in_transit', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
      userId INT NOT NULL,
      notes TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inventory_transfer_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transferId INT NOT NULL,
      unitId INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unitCode VARCHAR(50),
      notes TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  
  console.log("Done.");
  process.exit(0);
}

main().catch(console.error);
