import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "server", "demo_data.json");

let existingData = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    existingData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (e) {
    console.error("Error reading demo_data.json", e);
  }
}

const BRANDS_MODELS = [
  { brand: "Dell", models: ["Latitude 5420", "XPS 13 9310", "Inspiron 15 3511", "Vostro 3510", "Latitude 7490", "G15 5511 Gaming", "Precision 3560", "Latitude 3420"] },
  { brand: "HP", models: ["EliteBook 840 G7", "Pavilion 15-eg", "ProBook 450 G8", "Victus 15-fa", "Envy x360 15", "Omen 16", "ProBook 440 G7", "EliteBook 830 G6"] },
  { brand: "Lenovo", models: ["ThinkPad T14 Gen 2", "ThinkPad X1 Carbon Gen 9", "IdeaPad 3 15ITL6", "Legion 5 15ACH6", "ThinkBook 15 G2", "ThinkPad L14", "IdeaPad Gaming 3", "Yoga Slim 7"] },
  { brand: "Asus", models: ["ZenBook 14 UX425", "TUF Gaming F15", "VivoBook 15 X513", "ROG Strix G15", "ExpertBook B1", "VivoBook Pro 15"] },
  { brand: "Acer", models: ["Nitro 5 AN515", "Aspire 5 A515", "Swift 3 SF314", "Predator Helios 300", "Aspire 3 A315", "Extensa 15"] },
  { brand: "Apple", models: ["MacBook Air M1 (2020)", "MacBook Pro 14 M1 Pro", "MacBook Air M2 (2022)", "MacBook Pro 13 M2", "MacBook Air 13 Retina"] },
  { brand: "MSI", models: ["GF63 Thin 11UC", "Modern 14 B11M", "Katana GF66", "Prestige 14 Evo", "Bravo 15"] },
];

const CPUS = [
  "Intel Core i5-1135G7 (4.2 GHz)", "Intel Core i7-1165G7 (4.7 GHz)",
  "Intel Core i5-12450H (4.4 GHz)", "Intel Core i7-12700H (4.7 GHz)",
  "AMD Ryzen 5 5500U (4.0 GHz)", "AMD Ryzen 7 5700U (4.3 GHz)",
  "AMD Ryzen 5 5600H (4.2 GHz)", "AMD Ryzen 7 5800H (4.4 GHz)",
  "Apple M1 Chip 8-Core", "Apple M2 Chip 8-Core",
];

const RAMS = ["8 GB DDR4", "16 GB DDR4", "16 GB DDR5", "32 GB DDR4", "8 GB Unificada", "16 GB Unificada"];
const STORAGES = ["256 GB NVMe SSD", "512 GB NVMe SSD", "1 TB NVMe M.2 SSD", "512 GB PCIe 4.0 SSD"];
const SCREENS = ['13.3" FHD IPS', '14.0" FHD IPS', '15.6" FHD 144Hz', '15.6" FHD IPS', '16.0" 2K 165Hz', '13.6" Liquid Retina'];

const CUSTOMERS = [
  { name: "Carlos Mendoza Quispe", phone: "71234501", zone: "Miraflores, La Paz" },
  { name: "Mariana Flores Choque", phone: "71234502", zone: "Calacoto, La Paz" },
  { name: "Roberto Gomez Fernandez", phone: "71234503", zone: "Sopocachi, La Paz" },
  { name: "Andrea Vargas Mamani", phone: "71234504", zone: "Villa Fatima, La Paz" },
  { name: "Lucia Torrico Rios", phone: "71234505", zone: "San Pedro, La Paz" },
  { name: "David Morales Paredes", phone: "71234506", zone: "Equipetrol, Santa Cruz" },
  { name: "Gabriela Silva Castro", phone: "71234507", zone: "Centro, Cochabamba" },
  { name: "Fernando Rocha Lima", phone: "71234508", zone: "Achumani, La Paz" },
  { name: "Nadia Huanca Ortiz", phone: "71234509", zone: "Ceja, El Alto" },
  { name: "Alejandro Condori Perez", phone: "71234510", zone: "Ciudad Satélite, El Alto" },
  { name: "Valeria Gutierrez Paz", phone: "71234511", zone: "Cala Cala, Cochabamba" },
  { name: "Jorge Arequipa Rojas", phone: "71234512", zone: "Quillacollo, Cochabamba" },
  { name: "Sofia Beltran Ramos", phone: "71234513", zone: "Plan 3000, Santa Cruz" },
  { name: "Mauricio Camacho Alarcon", phone: "71234514", zone: "Obrajes, La Paz" },
  { name: "Patricia Villarroel Luna", phone: "71234515", zone: "Urubó, Santa Cruz" },
  { name: "Esteban Ticona Miranda", phone: "71234516", zone: "Villa Adela, El Alto" },
  { name: "Veronica Salazar Ponce", phone: "71234517", zone: "Irpavi, La Paz" },
  { name: "Daniel Callejas Blanco", phone: "71234518", zone: "Sarco, Cochabamba" },
  { name: "Paola Alvarez Chavez", phone: "71234519", zone: "Norte, Santa Cruz" },
  { name: "Gonzalo Montesinos Soto", phone: "71234520", zone: "San Miguel, La Paz" },
];

const REPAIR_DIAGNOSES = [
  { problem: "Falla de encendido tras descarga eléctrica", diag: "Cambio de mosfet de entrada y reballing de circuito de carga", cost: 180, parts: 110, labor: 70 },
  { problem: "Pantalla con líneas verticales y parpadeo", diag: "Sustitución de flex de video y panel display 144Hz", cost: 350, parts: 220, labor: 130 },
  { problem: "Teclado no responde varias teclas (derramó líquido)", diag: "Reemplazo de teclado retroiluminado y limpieza ultrasónica", cost: 140, parts: 90, labor: 50 },
  { problem: "Sobrecalentamiento y apagado súbito en juegos", diag: "Mantenimiento preventivo, cambio de pasta térmica Arctic MX-4 y pads", cost: 90, parts: 30, labor: 60 },
  { problem: "No reconoce cargador ni puerto USB-C", diag: "Reparación de puerto Type-C Power Delivery y fusible SMD", cost: 120, parts: 70, labor: 50 },
  { problem: "Bisagra rota del lado izquierdo que presiona el display", diag: "Reconstrucción de anclajes de chasis y ajuste de tensión de bisagras", cost: 110, parts: 40, labor: 70 },
  { problem: "Batería hinchada, duración menor a 15 minutos", diag: "Instalación de batería original nueva de 4 celdas 56Wh", cost: 280, parts: 190, labor: 90 },
  { problem: "Trackpad bloqueado y clic derecho no funciona", diag: "Ajuste de sensor táctil y reemplazo de cable flex de datos", cost: 75, parts: 30, labor: 45 },
  { problem: "Equipo reinicia constantemente en bucle BIOS", diag: "Reprogramación de memoria EEPROM BIOS con dump original", cost: 130, parts: 40, labor: 90 },
  { problem: "Sonido distorsionado y altavoz izquierdo mudo", diag: "Cambio de módulo de parlantes estéreo internos", cost: 85, parts: 45, labor: 40 },
];

const now = new Date();

// Distribución de fechas de ventas:
// - 12 ventas este mes actual (agosto 2026): días 1, 3, 5, 8, 10, 12, 14, 15, 16, 17
// - 6 ventas el mes anterior (julio 2026)
// - 2 ventas hace 2 meses (junio 2026)

const units = [];
const repairs = [];
const sales = [];
const saleItems = [];
const warranties = [];
const unitEvents = [];
const financialTransactions = [];
const cashOpenings = [];
const operationalExpenses = [];
const accountsReceivable = [];
const returns = [];

let unitIdCounter = 1;
let repairIdCounter = 1;
let saleIdCounter = 1;
let txIdCounter = 1;

// 1. Aperturas de caja para el mes
cashOpenings.push(
  { id: 1, branchId: 1, paymentMethod: "cash", openingAmount: 2500, openedBy: 999, createdAt: new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0).toISOString() },
  { id: 2, branchId: 1, paymentMethod: "qr", openingAmount: 0, openedBy: 999, createdAt: new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0).toISOString() },
  { id: 3, branchId: 1, paymentMethod: "transfer", openingAmount: 15000, openedBy: 999, createdAt: new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0).toISOString() },
);

// 2. Gastos Operativos del mes
const EXPENSES_LIST = [
  { desc: "Alquiler Sede Central", cat: "rent", amount: 3200, method: "transfer", daysAgo: 15 },
  { desc: "Pago de Servicios Básicos (Luz e Internet)", cat: "utilities", amount: 480, method: "qr", daysAgo: 10 },
  { desc: "Compra de Insumos y Pastas Térmicas Arctic MX-4", cat: "workshop_supplies", amount: 350, method: "cash", daysAgo: 8 },
  { desc: "Publicidad en Facebook Ads y TikTok", cat: "marketing", amount: 650, method: "transfer", daysAgo: 5 },
  { desc: "Combustible y Viáticos Reparto", cat: "logistics", amount: 220, method: "cash", daysAgo: 2 },
];

for (const exp of EXPENSES_LIST) {
  const expDate = new Date(Date.now() - exp.daysAgo * 24 * 60 * 60 * 1000).toISOString();
  operationalExpenses.push({
    id: operationalExpenses.length + 1,
    description: exp.desc,
    category: exp.cat,
    amount: exp.amount,
    paymentMethod: exp.method,
    branchId: 1,
    registeredBy: 999,
    createdAt: expDate,
  });

  financialTransactions.push({
    id: txIdCounter++,
    type: "expense",
    category: exp.cat,
    concept: exp.desc,
    amount: exp.amount,
    paymentMethod: exp.method,
    branchId: 1,
    registeredBy: 999,
    createdAt: expDate,
  });
}

// 3. Generar las 80 unidades
for (let i = 0; i < 80; i++) {
  const brandObj = BRANDS_MODELS[i % BRANDS_MODELS.length];
  const model = brandObj.models[i % brandObj.models.length];
  const brand = brandObj.brand;

  const isApple = brand === "Apple";
  const cpu = isApple ? (model.includes("M2") ? "Apple M2 Chip" : "Apple M1 Chip") : CPUS[i % CPUS.length];
  const ram = isApple ? (model.includes("Pro") ? "16 GB Unificada" : "8 GB Unificada") : RAMS[i % RAMS.length];
  const storage = STORAGES[i % STORAGES.length];
  const screenSize = isApple ? (model.includes("Pro") ? '14.2" Liquid Retina XDR' : '13.6" Liquid Retina') : SCREENS[i % SCREENS.length];
  const specs = JSON.stringify({ cpu, ram, storage, screenSize });

  const basePurchase = 1800 + ((i * 149) % 2400); // 1800 a 4200 BOB
  const purchasePrice = Math.round(basePurchase / 10) * 10;
  const salePrice = Math.round((purchasePrice * 1.32) / 10) * 10;
  const discountPrice = Math.round((salePrice * 0.94) / 10) * 10;
  const wholesalePrice = Math.round((salePrice * 0.88) / 10) * 10;

  let status = "available";
  if (i < 20) {
    status = "sold";
  } else if (i < 30) {
    status = "in_repair";
  }

  // Fechas de ingreso escalonadas:
  // Algunas unidades entraron hace 5 días, otras hace 25 días, otras hace 45 días (para el KPI de Aging +30 días)
  let unitDaysOld = 10;
  if (i >= 40 && i < 65) {
    unitDaysOld = 38 + (i % 25); // Unidades de más de 30 días para KPI de Aging
  } else if (i >= 65) {
    unitDaysOld = 65 + (i % 30); // Unidades de más de 60 días
  } else {
    unitDaysOld = 5 + (i % 20); // Unidades recientes
  }

  const unitCreatedAt = new Date(Date.now() - unitDaysOld * 24 * 60 * 60 * 1000).toISOString();
  const branchId = (i % 3) + 1;
  const code = `LAP-${brand.substring(0, 3).toUpperCase()}-${String(100 + i).padStart(3, "0")}`;
  const serialNumber = `SN-${brand.substring(0, 2).toUpperCase()}${20260000 + i * 47}`;

  const unit = {
    id: unitIdCounter,
    code,
    codeId: null,
    type: "laptop",
    brand,
    model,
    serialNumber,
    specs,
    condition: 8 + (i % 3),
    batteryHealth: i % 5 === 0 ? "fair" : (i % 2 === 0 ? "excellent" : "good"),
    damageChecklist: JSON.stringify({ keyboard: false, screen: false, hinges: false, trackpad: false, cosmetic: i % 4 === 0, other: false }),
    damageNotes: i % 4 === 0 ? "Leve desgaste estético superficial en tapa" : null,
    functionalTestPassed: 1,
    status,
    purchasePrice,
    salePrice,
    discountPrice,
    wholesalePrice,
    purchaseDate: unitCreatedAt.split("T")[0],
    supplierId: (i % 4) + 1,
    branchId,
    photos: null,
    createdAt: unitCreatedAt,
    updatedAt: new Date().toISOString(),
  };

  units.push(unit);

  unitEvents.push({
    id: unitEvents.length + 1,
    unitId: unit.id,
    type: "created",
    eventType: "created",
    notes: `Ingreso de equipo ${brand} ${model} a inventario`,
    userId: 999,
    branchId,
    createdAt: unitCreatedAt,
  });

  // 10 En Taller Técnico
  if (status === "in_repair") {
    const rIdx = i - 20;
    const diag = REPAIR_DIAGNOSES[rIdx];
    const repairEntryDays = 2 + (rIdx * 2);
    const entryDate = new Date(Date.now() - repairEntryDays * 24 * 60 * 60 * 1000).toISOString();

    repairs.push({
      id: repairIdCounter,
      unitId: unit.id,
      branchId,
      ticketNumber: `REP-${String(202600 + repairIdCounter).padStart(6, "0")}`,
      customerName: CUSTOMERS[rIdx % CUSTOMERS.length].name,
      customerPhone: CUSTOMERS[rIdx % CUSTOMERS.length].phone,
      problemDescription: diag.problem,
      diagnosis: diag.diag,
      status: rIdx % 3 === 0 ? "diagnosing" : (rIdx % 2 === 0 ? "in_progress" : "pending_parts"),
      priority: rIdx % 4 === 0 ? "high" : "normal",
      estimatedCost: diag.cost,
      partsCost: diag.parts,
      laborCost: diag.labor,
      technicianName: rIdx % 2 === 0 ? "Juan Perez (Técnico Central)" : "Carlos Vega (Soporte)",
      technicianId: rIdx % 2 === 0 ? 1 : 2,
      entryDate,
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: entryDate,
      updatedAt: new Date().toISOString(),
    });

    unitEvents.push({
      id: unitEvents.length + 1,
      unitId: unit.id,
      type: "repair_in",
      eventType: "repair_in",
      notes: `Ingreso a taller: ${diag.problem}`,
      userId: 999,
      branchId,
      createdAt: entryDate,
    });

    repairIdCounter++;
  }

  // 20 Vendidos con fechas distribuidas
  if (status === "sold") {
    let saleDaysAgo = 1;
    if (i < 12) {
      // 12 ventas este mes (días 1 a 17)
      saleDaysAgo = [1, 2, 3, 5, 7, 9, 11, 12, 13, 15, 16, 17][i];
    } else if (i < 18) {
      // 6 ventas el mes pasado (hace 25 a 45 días)
      saleDaysAgo = 25 + (i - 12) * 4;
    } else {
      // 2 ventas hace 2 meses (hace 60 a 70 días)
      saleDaysAgo = 60 + (i - 18) * 8;
    }

    const saleDate = new Date(Date.now() - saleDaysAgo * 24 * 60 * 60 * 1000).toISOString();
    const customer = CUSTOMERS[i % CUSTOMERS.length];
    const warrantyDays = i % 3 === 0 ? 180 : (i % 2 === 0 ? 90 : 30);
    const warrantyExpiresAt = new Date(new Date(saleDate).getTime() + warrantyDays * 24 * 60 * 60 * 1000).toISOString();
    
    // Tipo de precio aplicado
    const priceType = i % 4 === 0 ? "wholesalePrice" : (i % 3 === 0 ? "discountPrice" : "salePrice");
    const finalPrice = priceType === "wholesalePrice" ? wholesalePrice : (priceType === "discountPrice" ? discountPrice : salePrice);
    const paymentMethod = i % 3 === 0 ? "qr" : (i % 2 === 0 ? "transfer" : "cash");

    sales.push({
      id: saleIdCounter,
      code: `VTA-${String(202600 + saleIdCounter).padStart(6, "0")}`,
      customerName: customer.name,
      customerPhone: customer.phone,
      total: finalPrice,
      paymentMethod,
      status: "completed",
      branchId,
      sellerId: 999,
      soldBy: 999,
      warrantyDays,
      createdAt: saleDate,
      updatedAt: saleDate,
    });

    saleItems.push({
      id: saleIdCounter,
      saleId: saleIdCounter,
      unitId: unit.id,
      productName: `${brand} ${model} (${cpu} / ${ram} / ${storage})`,
      priceType,
      unitPrice: finalPrice,
      finalUnitPrice: finalPrice,
      purchasePrice,
      quantity: 1,
      warrantyDays,
      warrantyExpiresAt,
      createdAt: saleDate,
    });

    warranties.push({
      id: saleIdCounter,
      unitId: unit.id,
      saleId: saleIdCounter,
      customerName: customer.name,
      customerPhone: customer.phone,
      startDate: saleDate,
      durationDays: warrantyDays,
      endDate: warrantyExpiresAt,
      status: new Date(warrantyExpiresAt) > new Date() ? "active" : "expired",
      terms: "Garantía de placa madre, procesador, memoria RAM y pantalla.",
      createdAt: saleDate,
      updatedAt: saleDate,
    });

    unitEvents.push({
      id: unitEvents.length + 1,
      unitId: unit.id,
      type: "sold",
      eventType: "sold",
      notes: `Venta a ${customer.name} - BOB ${finalPrice} (${priceType})`,
      userId: 999,
      branchId,
      createdAt: saleDate,
    });

    // Registrar ingreso financiero en caja
    financialTransactions.push({
      id: txIdCounter++,
      type: "income",
      category: "sale",
      concept: `Venta equipo ${code} (${brand} ${model})`,
      amount: finalPrice,
      paymentMethod,
      referenceId: saleIdCounter,
      branchId,
      registeredBy: 999,
      createdAt: saleDate,
    });

    // Generar 2 Cuentas por Cobrar pendientes (créditos comerciales a clientes frecuentes)
    if (i === 1 || i === 4) {
      const creditTotal = finalPrice;
      const initialPaid = Math.round(creditTotal * 0.4);
      const remainingBalance = creditTotal - initialPaid;

      accountsReceivable.push({
        id: accountsReceivable.length + 1,
        saleId: saleIdCounter,
        customerName: customer.name,
        customerPhone: customer.phone,
        totalAmount: creditTotal,
        paidAmount: initialPaid,
        balance: remainingBalance,
        status: "partial",
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        notes: `Crédito comercial acordado a 30 días para ${customer.name}`,
        createdAt: saleDate,
        updatedAt: new Date().toISOString(),
      });
    }

    saleIdCounter++;
  }

  unitIdCounter++;
}

// 4. Devoluciones de garantía (2 registradas para calcular tasa de devolución realista en KPIs)
returns.push({
  id: 1,
  saleId: 2,
  unitId: 2,
  reason: "Defecto en teclado tras 10 días de uso",
  status: "approved",
  resolution: "repair",
  returnDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
});

// Guardar todo en demo_data.json
existingData.MOCK_UNITS = units;
existingData.MOCK_REPAIRS = repairs;
existingData.MOCK_SALES = sales;
existingData.MOCK_SALE_ITEMS = saleItems;
existingData.MOCK_WARRANTIES = warranties;
existingData.MOCK_UNIT_EVENTS = unitEvents;
existingData.MOCK_FINANCIAL_TRANSACTIONS = financialTransactions;
existingData.MOCK_CASH_OPENINGS = cashOpenings;
existingData.MOCK_OPERATIONAL_EXPENSES = operationalExpenses;
existingData.MOCK_ACCOUNTS_RECEIVABLE = accountsReceivable;
existingData.MOCK_RETURNS = returns;

fs.writeFileSync(DATA_FILE, JSON.stringify(existingData, null, 2), "utf-8");

console.log("=========================================");
console.log("¡DATOS DE ANALÍTICA Y KPIS GENERADOS!");
console.log("=========================================");
console.log(`- Total Unidades: ${units.length}`);
console.log(`- Unidades Vendidas: ${sales.length} (12 este mes, 6 mes pasado, 2 hace 2 meses)`);
console.log(`- Unidades en Taller: ${repairs.length}`);
console.log(`- Unidades Disponibles: ${units.filter(u => u.status === "available").length}`);
console.log(`- Transacciones Financieras: ${financialTransactions.length}`);
console.log(`- Gastos Operativos: ${operationalExpenses.length}`);
console.log(`- Cuentas por Cobrar Pendientes: ${accountsReceivable.length}`);
console.log(`- Devoluciones por Garantía: ${returns.length}`);
