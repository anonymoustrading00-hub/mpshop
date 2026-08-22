import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "server", "demo_data.json");

// Cargar data existente
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
  "Intel Core i5-1135G7 (4.2 GHz)",
  "Intel Core i7-1165G7 (4.7 GHz)",
  "Intel Core i5-12450H (4.4 GHz)",
  "Intel Core i7-12700H (4.7 GHz)",
  "AMD Ryzen 5 5500U (4.0 GHz)",
  "AMD Ryzen 7 5700U (4.3 GHz)",
  "AMD Ryzen 5 5600H (4.2 GHz)",
  "AMD Ryzen 7 5800H (4.4 GHz)",
  "Apple M1 Chip 8-Core",
  "Apple M2 Chip 8-Core",
];

const RAMS = ["8 GB DDR4", "16 GB DDR4", "16 GB DDR5", "32 GB DDR4", "8 GB Unificada", "16 GB Unificada"];
const STORAGES = ["256 GB NVMe SSD", "512 GB NVMe SSD", "1 TB NVMe M.2 SSD", "512 GB PCIe 4.0 SSD"];
const SCREENS = ['13.3" FHD IPS', '14.0" FHD IPS', '15.6" FHD 144Hz', '15.6" FHD IPS', '16.0" 2K 165Hz', '13.6" Liquid Retina'];

const CUSTOMER_NAMES = [
  "Carlos Mendoza Quispe", "Mariana Flores Choque", "Roberto Gomez Fernandez", 
  "Andrea Vargas Mamani", "Lucia Torrico Rios", "David Morales Paredes",
  "Gabriela Silva Castro", "Fernando Rocha Lima", "Nadia Huanca Ortiz",
  "Alejandro Condori Perez", "Valeria Gutierrez Paz", "Jorge Arequipa Rojas",
  "Sofia Beltran Ramos", "Mauricio Camacho Alarcon", "Patricia Villarroel Luna",
  "Esteban Ticona Miranda", "Veronica Salazar Ponce", "Daniel Callejas Blanco",
  "Paola Alvarez Chavez", "Gonzalo Montesinos Soto"
];

const TECHNICIANS = ["Juan Perez (Técnico Central)", "Carlos Vega (Soporte)", "Raul Choque (Laboratorio)"];

const REPAIR_DIAGNOSES = [
  { problem: "Falla de encendido tras descarga eléctrica", diag: "Cambio de mosfet de entrada y reballing de circuito de carga", cost: 180 },
  { problem: "Pantalla con líneas verticales y parpadeo", diag: "Sustitución de flex de video y panel display 144Hz", cost: 350 },
  { problem: "Teclado no responde varias teclas (derramó líquido)", diag: "Reemplazo de teclado retroiluminado y limpieza ultrasónica", cost: 140 },
  { problem: "Sobrecalentamiento y apagado súbito en juegos", diag: "Mantenimiento preventivo, cambio de pasta térmica Arctic MX-4 y pads", cost: 90 },
  { problem: "No reconoce cargador ni puerto USB-C", diag: "Reparación de puerto Type-C Power Delivery y fusible SMD", cost: 120 },
  { problem: "Bisagra rota del lado izquierdo que presiona el display", diag: "Reconstrucción de anclajes de chasis y ajuste de tensión de bisagras", cost: 110 },
  { problem: "Batería hinchada, duración menor a 15 minutos", diag: "Instalación de batería original nueva de 4 celdas 56Wh", cost: 280 },
  { problem: "Trackpad bloqueado y clic derecho no funciona", diag: "Ajuste de sensor táctil y reemplazo de cable flex de datos", cost: 75 },
  { problem: "Equipo reinicia constantemente en bucle BIOS", diag: "Reprogramación de memoria EEPROM BIOS con dump original", cost: 130 },
  { problem: "Sonido distorsionado y altavoz izquierdo mudo", diag: "Cambio de módulo de parlantes estéreo internos", cost: 85 },
];

console.log("Generando 80 equipos con distribución realista...");

const units = [];
const repairs = [];
const sales = [];
const saleItems = [];
const warranties = [];
const unitEvents = [];

let unitIdCounter = 1;
let repairIdCounter = 1;
let saleIdCounter = 1;

// 80 equipos en total:
// - 20 Vendidos (indices 0..19)
// - 10 En Taller (indices 20..29)
// - 50 Disponibles (indices 30..79)

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
  
  // Precios en Bolivianos
  const basePurchase = 1800 + ((i * 137) % 2400); // 1800 a 4200 BOB
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

  const branchId = (i % 3) + 1; // Distribuidos en sucursales 1, 2, 3
  const code = `LAP-${brand.substring(0, 3).toUpperCase()}-${String(100 + i).padStart(3, "0")}`;
  const serialNumber = `SN-${brand.substring(0, 2).toUpperCase()}${20260000 + i * 47}`;

  const daysAgo = (i * 3) % 45 + 1;
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  const unit = {
    id: unitIdCounter,
    code,
    codeId: null,
    type: "laptop",
    brand,
    model,
    serialNumber,
    specs,
    condition: 8 + (i % 3), // 8, 9 o 10
    batteryHealth: i % 5 === 0 ? "fair" : (i % 2 === 0 ? "excellent" : "good"),
    damageChecklist: JSON.stringify({ keyboard: false, screen: false, hinges: false, trackpad: false, cosmetic: i % 4 === 0, other: false }),
    damageNotes: i % 4 === 0 ? "Leve desgaste estético superficial en tapa superior" : null,
    functionalTestPassed: 1,
    status,
    purchasePrice,
    salePrice,
    discountPrice,
    wholesalePrice,
    purchaseDate: createdAt.split("T")[0],
    supplierId: (i % 4) + 1,
    branchId,
    photos: null,
    createdAt,
    updatedAt: new Date().toISOString(),
  };

  units.push(unit);

  // Registro de evento de creación
  unitEvents.push({
    id: unitEvents.length + 1,
    unitId: unit.id,
    type: "created",
    notes: `Ingreso de equipo ${brand} ${model} a inventario`,
    userId: 999,
    branchId,
    createdAt,
  });

  // Si está en Taller (10 unidades)
  if (status === "in_repair") {
    const repairInfo = REPAIR_DIAGNOSES[i - 20];
    const repairDaysAgo = ((i - 20) * 2) % 12 + 1;
    const entryDate = new Date(Date.now() - repairDaysAgo * 24 * 60 * 60 * 1000).toISOString();
    
    repairs.push({
      id: repairIdCounter,
      unitId: unit.id,
      branchId,
      ticketNumber: `REP-${String(202600 + repairIdCounter).padStart(6, "0")}`,
      customerName: CUSTOMER_NAMES[(i - 20) % CUSTOMER_NAMES.length],
      customerPhone: `700${String(10000 + i * 33).substring(0, 5)}`,
      problemDescription: repairInfo.problem,
      diagnosis: repairInfo.diag,
      status: (i - 20) % 3 === 0 ? "diagnosing" : ((i - 20) % 2 === 0 ? "in_progress" : "pending_parts"),
      priority: (i - 20) % 4 === 0 ? "high" : "normal",
      estimatedCost: repairInfo.cost,
      partsCost: Math.round(repairInfo.cost * 0.6),
      laborCost: Math.round(repairInfo.cost * 0.4),
      technicianName: TECHNICIANS[(i - 20) % TECHNICIANS.length],
      entryDate,
      estimatedDeliveryDate: new Date(Date.now() + (3 + (i % 4)) * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: entryDate,
      updatedAt: new Date().toISOString(),
    });

    unitEvents.push({
      id: unitEvents.length + 1,
      unitId: unit.id,
      type: "repair_in",
      notes: `Ingreso a taller técnico: ${repairInfo.problem}`,
      userId: 999,
      branchId,
      createdAt: entryDate,
    });

    repairIdCounter++;
  }

  // Si está Vendido (20 unidades)
  if (status === "sold") {
    const saleDaysAgo = (i * 2) % 28 + 1;
    const saleDate = new Date(Date.now() - saleDaysAgo * 24 * 60 * 60 * 1000).toISOString();
    const customer = CUSTOMER_NAMES[i % CUSTOMER_NAMES.length];
    const warrantyDays = i % 3 === 0 ? 180 : (i % 2 === 0 ? 90 : 30);
    const warrantyExpiresAt = new Date(new Date(saleDate).getTime() + warrantyDays * 24 * 60 * 60 * 1000).toISOString();
    const priceType = i % 4 === 0 ? "wholesalePrice" : (i % 3 === 0 ? "discountPrice" : "salePrice");
    const finalPrice = priceType === "wholesalePrice" ? wholesalePrice : (priceType === "discountPrice" ? discountPrice : salePrice);

    sales.push({
      id: saleIdCounter,
      code: `VTA-${String(202600 + saleIdCounter).padStart(6, "0")}`,
      customerName: customer,
      customerPhone: `711${String(20000 + i * 41).substring(0, 5)}`,
      total: finalPrice,
      paymentMethod: i % 3 === 0 ? "qr" : (i % 2 === 0 ? "transfer" : "cash"),
      status: "completed",
      branchId,
      sellerId: 999,
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
      customerName: customer,
      customerPhone: `711${String(20000 + i * 41).substring(0, 5)}`,
      startDate: saleDate,
      durationDays: warrantyDays,
      endDate: warrantyExpiresAt,
      status: new Date(warrantyExpiresAt) > new Date() ? "active" : "expired",
      terms: "Garantía de funcionamiento en placa y componentes internos.",
      createdAt: saleDate,
      updatedAt: saleDate,
    });

    unitEvents.push({
      id: unitEvents.length + 1,
      unitId: unit.id,
      type: "sold",
      notes: `Venta completada a cliente ${customer} por BOB ${finalPrice} (${priceType})`,
      userId: 999,
      branchId,
      createdAt: saleDate,
    });

    saleIdCounter++;
  }

  unitIdCounter++;
}

// Guardar en demo_data.json
existingData.MOCK_UNITS = units;
existingData.MOCK_REPAIRS = repairs;
existingData.MOCK_SALES = sales;
existingData.MOCK_SALE_ITEMS = saleItems;
existingData.MOCK_WARRANTIES = warranties;
existingData.MOCK_UNIT_EVENTS = unitEvents;

fs.writeFileSync(DATA_FILE, JSON.stringify(existingData, null, 2), "utf-8");

console.log("¡Datos generados exitosamente!");
console.log(`- Total Equipos creados: ${units.length}`);
console.log(`- Disponibles para venta: ${units.filter(u => u.status === "available").length}`);
console.log(`- Vendidos: ${units.filter(u => u.status === "sold").length}`);
console.log(`- En Taller / Reparación: ${units.filter(u => u.status === "in_repair").length}`);
console.log(`- Órdenes de Servicio en Taller: ${repairs.length}`);
console.log(`- Ventas y Pólizas de Garantía: ${sales.length}`);
