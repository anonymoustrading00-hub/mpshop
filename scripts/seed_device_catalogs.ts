import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";

// Seed data para catálogos de equipos

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "control_pedidos",
  });

  const db = drizzle(connection, { schema, mode: "default" });

  console.log("🌱 Iniciando seed de catálogos de equipos...");

  // 1. Marcas de laptops más comunes
  const brands = [
    { name: "HP" },
    { name: "Dell" },
    { name: "Lenovo" },
    { name: "Asus" },
    { name: "Acer" },
    { name: "Toshiba" },
    { name: "Apple" },
    { name: "MSI" },
  ];

  console.log("📦 Insertando marcas...");
  const insertedBrands = await db.insert(schema.deviceBrands).values(brands).onDuplicateKeyUpdate({ set: { name: schema.deviceBrands.name } });
  
  // Obtener IDs de marcas
  const brandRecords = await db.select().from(schema.deviceBrands);
  const brandMap = Object.fromEntries(brandRecords.map(b => [b.name, b.id]));

  // 2. Modelos populares con specs predeterminadas
  const models = [
    // HP
    { brandId: brandMap["HP"], name: "EliteBook 840 G7", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-10210U", ram: "8GB DDR4", storage: "256GB SSD", screenSize: "14\" FHD", gpu: "Intel UHD Graphics" }) },
    { brandId: brandMap["HP"], name: "EliteBook 850 G8", defaultSpecs: JSON.stringify({ cpu: "Intel Core i7-1165G7", ram: "16GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["HP"], name: "ProBook 450 G8", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-1135G7", ram: "8GB DDR4", storage: "256GB SSD", screenSize: "15.6\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["HP"], name: "Pavilion 15", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-1135G7", ram: "8GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["HP"], name: "Pavilion Gaming 15", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-10300H", ram: "8GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD", gpu: "GTX 1650" }) },
    { brandId: brandMap["HP"], name: "OMEN 15", defaultSpecs: JSON.stringify({ cpu: "Intel Core i7-10750H", ram: "16GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD 144Hz", gpu: "RTX 2060" }) },
    
    // Dell
    { brandId: brandMap["Dell"], name: "Latitude 5420", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-1135G7", ram: "8GB DDR4", storage: "256GB SSD", screenSize: "14\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Dell"], name: "Latitude 7420", defaultSpecs: JSON.stringify({ cpu: "Intel Core i7-1185G7", ram: "16GB DDR4", storage: "512GB SSD", screenSize: "14\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Dell"], name: "Inspiron 15 3000", defaultSpecs: JSON.stringify({ cpu: "Intel Core i3-1115G4", ram: "4GB DDR4", storage: "128GB SSD", screenSize: "15.6\" HD", gpu: "Intel UHD Graphics" }) },
    { brandId: brandMap["Dell"], name: "Inspiron 15 5000", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-1135G7", ram: "8GB DDR4", storage: "256GB SSD", screenSize: "15.6\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Dell"], name: "XPS 13 9310", defaultSpecs: JSON.stringify({ cpu: "Intel Core i7-1165G7", ram: "16GB LPDDR4x", storage: "512GB SSD", screenSize: "13.4\" FHD+", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Dell"], name: "G5 15", defaultSpecs: JSON.stringify({ cpu: "Intel Core i7-10750H", ram: "16GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD", gpu: "RTX 2060" }) },
    
    // Lenovo
    { brandId: brandMap["Lenovo"], name: "ThinkPad X1 Carbon Gen 9", defaultSpecs: JSON.stringify({ cpu: "Intel Core i7-1165G7", ram: "16GB LPDDR4x", storage: "512GB SSD", screenSize: "14\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Lenovo"], name: "ThinkPad T14 Gen 2", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-1135G7", ram: "8GB DDR4", storage: "256GB SSD", screenSize: "14\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Lenovo"], name: "ThinkPad E15 Gen 3", defaultSpecs: JSON.stringify({ cpu: "AMD Ryzen 5 5500U", ram: "8GB DDR4", storage: "256GB SSD", screenSize: "15.6\" FHD", gpu: "AMD Radeon Graphics" }) },
    { brandId: brandMap["Lenovo"], name: "IdeaPad 3 15", defaultSpecs: JSON.stringify({ cpu: "Intel Core i3-1115G4", ram: "4GB DDR4", storage: "128GB SSD", screenSize: "15.6\" HD", gpu: "Intel UHD Graphics" }) },
    { brandId: brandMap["Lenovo"], name: "IdeaPad 5 Pro", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-11300H", ram: "16GB DDR4", storage: "512GB SSD", screenSize: "14\" 2.2K", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Lenovo"], name: "Legion 5", defaultSpecs: JSON.stringify({ cpu: "AMD Ryzen 7 5800H", ram: "16GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD 165Hz", gpu: "RTX 3060" }) },
    
    // Asus
    { brandId: brandMap["Asus"], name: "VivoBook 15", defaultSpecs: JSON.stringify({ cpu: "Intel Core i3-1115G4", ram: "4GB DDR4", storage: "128GB SSD", screenSize: "15.6\" FHD", gpu: "Intel UHD Graphics" }) },
    { brandId: brandMap["Asus"], name: "VivoBook S15", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-1135G7", ram: "8GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Asus"], name: "ZenBook 14", defaultSpecs: JSON.stringify({ cpu: "Intel Core i7-1165G7", ram: "16GB LPDDR4x", storage: "512GB SSD", screenSize: "14\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Asus"], name: "TUF Gaming A15", defaultSpecs: JSON.stringify({ cpu: "AMD Ryzen 7 5800H", ram: "16GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD 144Hz", gpu: "RTX 3060" }) },
    { brandId: brandMap["Asus"], name: "ROG Strix G15", defaultSpecs: JSON.stringify({ cpu: "AMD Ryzen 9 5900HX", ram: "16GB DDR4", storage: "1TB SSD", screenSize: "15.6\" FHD 300Hz", gpu: "RTX 3070" }) },
    
    // Acer
    { brandId: brandMap["Acer"], name: "Aspire 5", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-1135G7", ram: "8GB DDR4", storage: "256GB SSD", screenSize: "15.6\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Acer"], name: "Aspire 3", defaultSpecs: JSON.stringify({ cpu: "Intel Core i3-1115G4", ram: "4GB DDR4", storage: "128GB SSD", screenSize: "15.6\" HD", gpu: "Intel UHD Graphics" }) },
    { brandId: brandMap["Acer"], name: "Swift 3", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-1135G7", ram: "8GB LPDDR4x", storage: "512GB SSD", screenSize: "14\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["Acer"], name: "Nitro 5", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-11400H", ram: "8GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD 144Hz", gpu: "RTX 3050" }) },
    { brandId: brandMap["Acer"], name: "Predator Helios 300", defaultSpecs: JSON.stringify({ cpu: "Intel Core i7-11800H", ram: "16GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD 144Hz", gpu: "RTX 3060" }) },
    
    // Toshiba
    { brandId: brandMap["Toshiba"], name: "Satellite C55", defaultSpecs: JSON.stringify({ cpu: "Intel Core i3-1005G1", ram: "4GB DDR4", storage: "128GB SSD", screenSize: "15.6\" HD", gpu: "Intel UHD Graphics" }) },
    { brandId: brandMap["Toshiba"], name: "Satellite Pro L50", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-8250U", ram: "8GB DDR4", storage: "256GB SSD", screenSize: "15.6\" FHD", gpu: "Intel UHD Graphics 620" }) },
    { brandId: brandMap["Toshiba"], name: "Tecra A50", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-10210U", ram: "8GB DDR4", storage: "256GB SSD", screenSize: "15.6\" FHD", gpu: "Intel UHD Graphics" }) },
    
    // Apple
    { brandId: brandMap["Apple"], name: "MacBook Air M1", defaultSpecs: JSON.stringify({ cpu: "Apple M1", ram: "8GB", storage: "256GB SSD", screenSize: "13.3\" Retina", gpu: "Apple M1 GPU" }) },
    { brandId: brandMap["Apple"], name: "MacBook Air M2", defaultSpecs: JSON.stringify({ cpu: "Apple M2", ram: "8GB", storage: "256GB SSD", screenSize: "13.6\" Liquid Retina", gpu: "Apple M2 GPU" }) },
    { brandId: brandMap["Apple"], name: "MacBook Pro 13\" M1", defaultSpecs: JSON.stringify({ cpu: "Apple M1", ram: "8GB", storage: "256GB SSD", screenSize: "13.3\" Retina", gpu: "Apple M1 GPU" }) },
    { brandId: brandMap["Apple"], name: "MacBook Pro 14\" M1 Pro", defaultSpecs: JSON.stringify({ cpu: "Apple M1 Pro", ram: "16GB", storage: "512GB SSD", screenSize: "14.2\" Liquid Retina XDR", gpu: "Apple M1 Pro GPU" }) },
    { brandId: brandMap["Apple"], name: "MacBook Pro 16\" M1 Max", defaultSpecs: JSON.stringify({ cpu: "Apple M1 Max", ram: "32GB", storage: "1TB SSD", screenSize: "16.2\" Liquid Retina XDR", gpu: "Apple M1 Max GPU" }) },
    
    // MSI
    { brandId: brandMap["MSI"], name: "Modern 14", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-1135G7", ram: "8GB DDR4", storage: "512GB SSD", screenSize: "14\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["MSI"], name: "Prestige 14", defaultSpecs: JSON.stringify({ cpu: "Intel Core i7-1185G7", ram: "16GB LPDDR4x", storage: "512GB SSD", screenSize: "14\" FHD", gpu: "Intel Iris Xe" }) },
    { brandId: brandMap["MSI"], name: "GF63 Thin", defaultSpecs: JSON.stringify({ cpu: "Intel Core i5-11400H", ram: "8GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD", gpu: "GTX 1650" }) },
    { brandId: brandMap["MSI"], name: "Katana GF66", defaultSpecs: JSON.stringify({ cpu: "Intel Core i7-11800H", ram: "16GB DDR4", storage: "512GB SSD", screenSize: "15.6\" FHD 144Hz", gpu: "RTX 3060" }) },
    { brandId: brandMap["MSI"], name: "GE76 Raider", defaultSpecs: JSON.stringify({ cpu: "Intel Core i9-11980HK", ram: "32GB DDR4", storage: "1TB SSD", screenSize: "17.3\" FHD 360Hz", gpu: "RTX 3080" }) },
  ];

  console.log("💻 Insertando modelos de laptops...");
  await db.insert(schema.deviceModels).values(models);

  // 3. Procesadores Intel y AMD más comunes
  const processorList = [
    // Intel Core i3
    { name: "Intel Core i3-1115G4", generation: "11th Gen" },
    { name: "Intel Core i3-1005G1", generation: "10th Gen" },
    { name: "Intel Core i3-8130U", generation: "8th Gen" },
    
    // Intel Core i5
    { name: "Intel Core i5-1135G7", generation: "11th Gen" },
    { name: "Intel Core i5-11400H", generation: "11th Gen" },
    { name: "Intel Core i5-1155G7", generation: "11th Gen" },
    { name: "Intel Core i5-10210U", generation: "10th Gen" },
    { name: "Intel Core i5-10300H", generation: "10th Gen" },
    { name: "Intel Core i5-8250U", generation: "8th Gen" },
    
    // Intel Core i7
    { name: "Intel Core i7-1165G7", generation: "11th Gen" },
    { name: "Intel Core i7-1185G7", generation: "11th Gen" },
    { name: "Intel Core i7-11800H", generation: "11th Gen" },
    { name: "Intel Core i7-10750H", generation: "10th Gen" },
    { name: "Intel Core i7-10510U", generation: "10th Gen" },
    { name: "Intel Core i7-8550U", generation: "8th Gen" },
    
    // Intel Core i9
    { name: "Intel Core i9-11980HK", generation: "11th Gen" },
    { name: "Intel Core i9-10980HK", generation: "10th Gen" },
    
    // AMD Ryzen 3
    { name: "AMD Ryzen 3 5300U", generation: "Ryzen 5000" },
    { name: "AMD Ryzen 3 3250U", generation: "Ryzen 3000" },
    
    // AMD Ryzen 5
    { name: "AMD Ryzen 5 5500U", generation: "Ryzen 5000" },
    { name: "AMD Ryzen 5 5600H", generation: "Ryzen 5000" },
    { name: "AMD Ryzen 5 4500U", generation: "Ryzen 4000" },
    { name: "AMD Ryzen 5 3500U", generation: "Ryzen 3000" },
    
    // AMD Ryzen 7
    { name: "AMD Ryzen 7 5800H", generation: "Ryzen 5000" },
    { name: "AMD Ryzen 7 5700U", generation: "Ryzen 5000" },
    { name: "AMD Ryzen 7 4800H", generation: "Ryzen 4000" },
    
    // AMD Ryzen 9
    { name: "AMD Ryzen 9 5900HX", generation: "Ryzen 5000" },
    { name: "AMD Ryzen 9 5900HS", generation: "Ryzen 5000" },
    
    // Apple Silicon
    { name: "Apple M1", generation: "M1" },
    { name: "Apple M1 Pro", generation: "M1" },
    { name: "Apple M1 Max", generation: "M1" },
    { name: "Apple M2", generation: "M2" },
  ];

  console.log("🔧 Insertando procesadores...");
  await db.insert(schema.processors).values(processorList).onDuplicateKeyUpdate({ set: { name: schema.processors.name } });

  // 4. Opciones de RAM
  const ramList = [
    { capacity: "4GB DDR4", type: "DDR4" },
    { capacity: "8GB DDR4", type: "DDR4" },
    { capacity: "16GB DDR4", type: "DDR4" },
    { capacity: "32GB DDR4", type: "DDR4" },
    { capacity: "64GB DDR4", type: "DDR4" },
    { capacity: "8GB DDR5", type: "DDR5" },
    { capacity: "16GB DDR5", type: "DDR5" },
    { capacity: "32GB DDR5", type: "DDR5" },
    { capacity: "8GB LPDDR4x", type: "LPDDR4x" },
    { capacity: "16GB LPDDR4x", type: "LPDDR4x" },
    { capacity: "8GB (Apple)", type: "Unified" },
    { capacity: "16GB (Apple)", type: "Unified" },
    { capacity: "32GB (Apple)", type: "Unified" },
  ];

  console.log("💾 Insertando opciones de RAM...");
  await db.insert(schema.ramOptions).values(ramList).onDuplicateKeyUpdate({ set: { capacity: schema.ramOptions.capacity } });

  // 5. Opciones de almacenamiento
  const storageList = [
    { capacity: "128GB SSD", type: "SSD" },
    { capacity: "256GB SSD", type: "SSD" },
    { capacity: "512GB SSD", type: "SSD" },
    { capacity: "1TB SSD", type: "SSD" },
    { capacity: "2TB SSD", type: "SSD" },
    { capacity: "128GB NVMe", type: "NVMe" },
    { capacity: "256GB NVMe", type: "NVMe" },
    { capacity: "512GB NVMe", type: "NVMe" },
    { capacity: "1TB NVMe", type: "NVMe" },
    { capacity: "500GB HDD", type: "HDD" },
    { capacity: "1TB HDD", type: "HDD" },
    { capacity: "2TB HDD", type: "HDD" },
  ];

  console.log("💿 Insertando opciones de almacenamiento...");
  await db.insert(schema.storageOptions).values(storageList).onDuplicateKeyUpdate({ set: { capacity: schema.storageOptions.capacity } });

  // 6. Tamaños de pantalla
  const screenList = [
    { size: "13.3\"", resolution: "1920x1080 (FHD)" },
    { size: "13.4\"", resolution: "1920x1200 (FHD+)" },
    { size: "13.6\"", resolution: "2560x1664 (Liquid Retina)" },
    { size: "14\"", resolution: "1920x1080 (FHD)" },
    { size: "14\"", resolution: "2240x1400 (2.2K)" },
    { size: "14.2\"", resolution: "3024x1964 (Liquid Retina XDR)" },
    { size: "15.6\"", resolution: "1366x768 (HD)" },
    { size: "15.6\"", resolution: "1920x1080 (FHD)" },
    { size: "15.6\"", resolution: "2560x1440 (QHD)" },
    { size: "15.6\"", resolution: "1920x1080 144Hz" },
    { size: "15.6\"", resolution: "1920x1080 165Hz" },
    { size: "16.2\"", resolution: "3456x2234 (Liquid Retina XDR)" },
    { size: "17.3\"", resolution: "1920x1080 (FHD)" },
    { size: "17.3\"", resolution: "1920x1080 360Hz" },
  ];

  console.log("🖥️  Insertando tamaños de pantalla...");
  await db.insert(schema.screenSizes).values(screenList).onDuplicateKeyUpdate({ set: { size: schema.screenSizes.size } });

  console.log("✅ Seed completado exitosamente!");
  await connection.end();
}

main().catch((err) => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});
