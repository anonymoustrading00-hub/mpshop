import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;

async function seedDashboardDemoData() {
  if (!databaseUrl) {
    console.log("[Seed] DATABASE_URL not configured; skipping dashboard demo data seed (MOCK mode)");
    return;
  }

  const connection = await mysql.createConnection(databaseUrl);

  try {
    console.log("[Seed] Seeding dashboard demo data...");

    // 1. Agregar unidades (equipos)
    await connection.query(
      `INSERT INTO units 
        (code, type, brand, model, condition, status, purchasePrice, salePrice, createdAt, updatedAt, branchId)
       VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1),
        (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1),
        (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1),
        (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1),
        (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1),
        (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1),
        (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1),
        (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1)`,
      [
        "UNI-00001", "laptop", "Dell", "Inspiron 15", 7, "sold", 120000, 150000,
        "UNI-00002", "laptop", "HP", "Pavilion 14", 8, "sold", 150000, 200000,
        "UNI-00003", "celular", "Samsung", "A12", 6, "sold", 130000, 180000,
        "UNI-00004", "tablet", "iPad", "Air", 10, "sold", 180000, 220000,
        "UNI-00005", "laptop", "Lenovo", "ThinkPad", 7, "sold", 140000, 170000,
        "UNI-00006", "charger", "Generic", "USB-C", 10, "sold", 40000, 190000,
        "UNI-00007", "laptop", "ASUS", "VivoBook", 5, "available", 100000, 0,
        "UNI-00008", "celular", "Xiaomi", "Redmi Note", 6, "in_repair", 80000, 0,
      ],
    );

    // 2. Agregar ventas (sales)
    await connection.query(
      `INSERT INTO sales 
        (saleNumber, total, status, branchId, createdAt, updatedAt)
       VALUES 
        (?, ?, ?, 1, DATE_SUB(NOW(), INTERVAL 15 DAY), NOW()),
        (?, ?, ?, 1, DATE_SUB(NOW(), INTERVAL 14 DAY), NOW()),
        (?, ?, ?, 1, DATE_SUB(NOW(), INTERVAL 10 DAY), NOW()),
        (?, ?, ?, 1, DATE_SUB(NOW(), INTERVAL 8 DAY), NOW()),
        (?, ?, ?, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), NOW()),
        (?, ?, ?, 1, DATE_SUB(NOW(), INTERVAL 3 DAY), NOW())`,
      [
        "V-001", 150000, "completed",
        "V-002", 200000, "completed",
        "V-003", 180000, "completed",
        "V-004", 220000, "completed",
        "V-005", 170000, "completed",
        "V-006", 190000, "completed",
      ],
    );

    // 3. Obtener IDs de sales y agregar sale items
    const [sales]: any = await connection.query(
      `SELECT id, saleNumber FROM sales WHERE saleNumber IN ('V-001', 'V-002', 'V-003', 'V-004', 'V-005', 'V-006') ORDER BY saleNumber`,
    );

    const saleMap: Record<string, number> = {};
    sales.forEach((s: any) => {
      saleMap[s.saleNumber] = s.id;
    });

    await connection.query(
      `INSERT INTO saleItems 
        (saleId, unitId, quantity, finalUnitPrice, discountAmount)
       VALUES 
        (?, ?, 1, ?, 0),
        (?, ?, 1, ?, 0),
        (?, ?, 1, ?, 0),
        (?, ?, 1, ?, 0),
        (?, ?, 1, ?, 0),
        (?, ?, 1, ?, 0)`,
      [
        saleMap["V-001"], 1, 150000,
        saleMap["V-002"], 2, 200000,
        saleMap["V-003"], 3, 180000,
        saleMap["V-004"], 4, 220000,
        saleMap["V-005"], 5, 170000,
        saleMap["V-006"], 6, 190000,
      ],
    );

    // 4. Agregar reparaciones
    await connection.query(
      `INSERT INTO repairs 
        (unitId, startDate, endDate, status, laborCost, partsCost, createdAt, updatedAt)
       VALUES 
        (?, DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_SUB(NOW(), INTERVAL 13 DAY), 'completed', ?, ?, NOW(), NOW()),
        (?, DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 11 DAY), 'completed', ?, ?, NOW(), NOW()),
        (?, DATE_SUB(NOW(), INTERVAL 5 DAY), NULL, 'in_progress', ?, ?, NOW(), NOW())`,
      [
        2, 20000, 30000,
        3, 15000, 35000,
        8, 0, 25000,
      ],
    );

    // 5. Agregar gastos operativos
    const expenses = [
      { category: "rent", amount: 50000, offset: 5 },
      { category: "labor", amount: 30000, offset: 4 },
      { category: "transport", amount: 15000, offset: 3 },
      { category: "repairs", amount: 8000, offset: 2 },
      { category: "marketing", amount: 12000, offset: 1 },
      { category: "services", amount: 5000, offset: 0 },
    ];

    for (const exp of expenses) {
      await connection.query(
        `INSERT INTO financialTransactions 
          (type, category, description, amount, paymentMethod, branchId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'cash', 1, DATE_SUB(NOW(), INTERVAL ? DAY), NOW())`,
        ["expense", exp.category, `Gasto: ${exp.category}`, exp.amount, exp.offset],
      );
    }

    console.log("[Seed] Dashboard demo data inserted successfully");
  } catch (error) {
    console.error("[Seed] Error seeding dashboard demo data:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

seedDashboardDemoData().catch((error) => {
  console.error("[Seed] Failed:", error);
  process.exit(1);
});
