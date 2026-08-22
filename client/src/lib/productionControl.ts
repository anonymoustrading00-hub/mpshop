import { useEffect, useMemo, useState } from "react";

export type ProductionType = "kefir" | "kefir_agua" | "queso_directo" | "queso_indirecto" | "suero";
export type OrderStatus = "pendiente" | "en_proceso" | "completada" | "cancelada";
export type OrderPriority = "Baja" | "Media" | "Alta";
export type BatchStage =
  | "preparacion"
  | "fermentacion"
  | "filtrado"
  | "separacion"
  | "prensado"
  | "calidad"
  | "envasado"
  | "finalizado"
  | "rechazado";
export type QualityStatus = "pendiente" | "aprobado" | "rechazado";

export interface RawCatalogProduct {
  id: number;
  code?: string | null;
  name?: string | null;
  category?: string | null;
  unit?: string | null;
  presentationVolumeMl?: number | null;
  presentationWeightGr?: number | null;
  salePrice?: number | null;
  price?: number | null;
  productionRole?: string | null;
  status?: string | null;
}

export interface ProductionProduct {
  id: string;
  sourceId?: number;
  name: string;
  code: string;
  type: ProductionType | "suero";
  unit: "unid" | "ml" | "l" | "g" | "kg";
  volumeMl: number;
  weightGr: number;
  salePrice: number;
  costPrice: number;
  source: "catalog" | "default";
}

export interface ProductionOrderItem {
  id: string;
  productId: string;
  productName: string;
  type: ProductionType | "suero";
  quantity: number;
  unit: "unid";
  volumeMl: number;
  weightGr: number;
}

export interface ProductionOrder {
  id: string;
  date: string;
  dueDate: string;
  client: string;
  priority: OrderPriority;
  status: OrderStatus;
  items: ProductionOrderItem[];
  notes: string;
  batchIds: string[];
}

export interface InventoryLot {
  id: string;
  batchNumber: string;
  quantity: number;
  expirationDate: string;
  createdAt: string;
}

export interface ProductionInventoryItem {
  id: string;
  name: string;
  category: "materia" | "insumo" | "terminado" | "subproducto";
  unit: "L" | "kg" | "g" | "unid" | "ml";
  quantity: number;
  minStock: number;
  avgCost: number;
  updatedAt: string;
  lots?: InventoryLot[];
}

export interface ProductionMovement {
  id: string;
  date: string;
  productName: string;
  category: string;
  changeAmount: number;
  newQuantity: number;
  unit: string;
  reason: string;
  reference?: string;
}

export interface ProductionStrain {
  id: string;
  name: string;
  type: "leche" | "agua";
  currentWeightGr: number;
  health: "excelente" | "bueno" | "observacion" | "reposo";
  usageCount: number;
  lastUsed?: string;
  notes: string;
}

export interface ProductionFactors {
  kefirYieldPct: number;
  kefirWaterYieldPct: number;
  cheeseDirectGrPerLiter: number;
  cheeseDirectWheyMlPerLiter: number;
  cheeseIndirectGrPerLiter: number;
  cheeseIndirectWheyMlPerLiter: number;
}

export interface ProductionYieldRecord {
  id: string;
  batchId: string;
  batchNumber: string;
  type: ProductionType;
  inputLiters: number;
  outputUnits: number;
  outputVolumeLiters: number;
  outputCheeseGr: number;
  yieldPct: number;
  wastePct: number;
  date: string;
}

export interface BatchQuality {
  status: QualityStatus;
  ph?: number;
  temperature?: number;
  acidity?: number;
  aspectColor?: string;
  outputLiters?: number;
  rawMaterialStatus?: QualityStatus;
  rawMaterialNotes?: string;
  inputStatus?: QualityStatus;
  inputNotes?: string;
  approvedBy?: string;
  checkedAt?: string;
  notes?: string;
}

export type QualityScope = "stage" | "final";

export interface StageQualityRecord extends BatchQuality {
  id: string;
  stage: BatchStage | "final";
  scope: QualityScope;
  createdAt: string;
}

export interface ProductionBatch {
  id: string;
  batchNumber: string;
  type: ProductionType;
  status: "en_proceso" | "en_calidad" | "finalizado" | "cancelado" | "rechazado";
  stage: BatchStage;
  startDate: string;
  endDate?: string;
  operator: string;
  orderRef?: string;
  orderClient?: string;
  initialVolumeLiters: number;
  expectedVolumeLiters: number;
  expectedQuesoGr: number;
  expectedSueroMl: number;
  finalUnits: number;
  finalVolumeLiters: number;
  finalQuesoGr: number;
  finalSueroMl: number;
  grainsGr: number;
  strainId?: string;
  sugarBrownGr: number;
  sugarWhiteGr: number;
  milkType: string;
  notes: string;
  quality: BatchQuality;
  stageQuality: Partial<Record<BatchStage | "final", StageQualityRecord>>;
  finalQuality?: StageQualityRecord;
  inventoryDeductions: { name: string; quantity: number; unit: string }[];
  history: { date: string; event: string }[];
  leftoverVolumeMl?: number;
}

export interface KefirCatalogProduct {
  id: string;
  code: string;
  name: string;
  type: ProductionType | "suero";
  flavor: string;
  presentationMl: number;
  presentationGr: number;
  sellPrice: number;
  envase: string;
  notes: string;
}

export interface ProductionControlState {
  orders: ProductionOrder[];
  batches: ProductionBatch[];
  inventory: ProductionInventoryItem[];
  movements: ProductionMovement[];
  strains: ProductionStrain[];
  factors: ProductionFactors;
  yieldRecords: ProductionYieldRecord[];
  customProducts: KefirCatalogProduct[];
}

export interface CreateOrderInput {
  client: string;
  dueDate: string;
  priority: OrderPriority;
  notes: string;
  items: { productId: string; quantity: number }[];
}

export interface CreateBatchInput {
  type: ProductionType;
  orderId?: string;
  operator: string;
  initialVolumeLiters: number;
  expectedVolumeLiters: number;
  expectedQuesoGr: number;
  expectedSueroMl: number;
  grainsGr: number;
  strainId?: string;
  milkType: string;
  sugarBrownGr: number;
  sugarWhiteGr: number;
  notes: string;
  leftoverVolumeMl?: number;
  saveLeftoverToInventory?: boolean;
  milkUsedQuantity?: number;
}

export interface CompleteBatchInput {
  finalUnits: number;
  finalVolumeLiters: number;
  finalQuesoGr: number;
  finalSueroMl: number;
  notes: string;
  quality?: QualityInput;
}

export interface QualityInput {
  status: QualityStatus;
  ph?: number;
  temperature?: number;
  acidity?: number;
  aspectColor?: string;
  outputLiters?: number;
  rawMaterialStatus?: QualityStatus;
  rawMaterialNotes?: string;
  inputStatus?: QualityStatus;
  inputNotes?: string;
  approvedBy?: string;
  notes?: string;
  stage?: BatchStage | "final";
  scope?: QualityScope;
  expirationDate?: string;
}

const STATE_KEY = "control_pedidos_production_state_v2";
const LEGACY_ORDERS_KEY = "kefir_orders_v3";
const LEGACY_BATCHES_KEY = "kefir_batches_v3";
const EVENT_NAME = "production-control-updated";

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const moneyToBs = (value?: number | null) => Math.round(Number(value || 0)) / 100;

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parsePresentation(name: string, unit?: string | null, volumeMl?: number | null, weightGr?: number | null) {
  if (volumeMl && volumeMl > 0) return { volumeMl, weightGr: 0 };
  if (weightGr && weightGr > 0) return { volumeMl: 0, weightGr };

  const normalizedUnit = normalize(unit);
  const volumeMatch = normalize(name).match(/(\d+(?:[.,]\d+)?)\s*(ml|l)\b/);
  const weightMatch = normalize(name).match(/(\d+(?:[.,]\d+)?)\s*(g|kg)\b/);

  if (volumeMatch && volumeMatch[1]) {
    const value = Number(String(volumeMatch[1]).replace(",", "."));
    return { volumeMl: volumeMatch[2] === "l" ? value * 1000 : value, weightGr: 0 };
  }

  if (weightMatch && weightMatch[1]) {
    const value = Number(String(weightMatch[1]).replace(",", "."));
    return { volumeMl: 0, weightGr: weightMatch[2] === "kg" ? value * 1000 : value };
  }

  if (normalizedUnit === "ml") return { volumeMl: 1000, weightGr: 0 };
  if (normalizedUnit === "l") return { volumeMl: 1000, weightGr: 0 };
  if (normalizedUnit === "g") return { volumeMl: 0, weightGr: 250 };
  if (normalizedUnit === "kg") return { volumeMl: 0, weightGr: 1000 };

  return { volumeMl: 1000, weightGr: 0 };
}

export function normalizeProductionType(product?: Partial<ProductionProduct> | RawCatalogProduct | null): ProductionType | "suero" {
  const text = normalize(
    `${(product as any)?.name || ""} ${(product as any)?.code || ""} ${(product as any)?.productionRole || ""} ${(product as any)?.type || ""}`
  );

  if (text.includes("suero")) return "suero";
  if (text.includes("queso") || text.includes("cheese")) return "queso_directo";
  if (text.includes("agua") || text.includes("water")) return "kefir_agua";
  return "kefir";
}

const DEFAULT_PRODUCTS: ProductionProduct[] = [
  {
    id: "default-kefir-1l",
    name: "Kefir de leche 1L",
    code: "KF-1L",
    type: "kefir",
    unit: "unid",
    volumeMl: 1000,
    weightGr: 0,
    salePrice: 20,
    costPrice: 8,
    source: "default",
  },
  {
    id: "default-kefir-500",
    name: "Kefir de leche 500ml",
    code: "KF-500",
    type: "kefir",
    unit: "unid",
    volumeMl: 500,
    weightGr: 0,
    salePrice: 12,
    costPrice: 5,
    source: "default",
  },
  {
    id: "default-agua-1l",
    name: "Kefir de agua 1L",
    code: "KA-1L",
    type: "kefir_agua",
    unit: "unid",
    volumeMl: 1000,
    weightGr: 0,
    salePrice: 18,
    costPrice: 6,
    source: "default",
  },
  {
    id: "default-queso-250",
    name: "Queso de kefir 250g",
    code: "QD-250",
    type: "queso_directo",
    unit: "unid",
    volumeMl: 0,
    weightGr: 250,
    salePrice: 25,
    costPrice: 9,
    source: "default",
  },
  {
    id: "default-suero-500",
    name: "Suero de kefir 500ml",
    code: "SU-500",
    type: "suero",
    unit: "unid",
    volumeMl: 500,
    weightGr: 0,
    salePrice: 10,
    costPrice: 3,
    source: "default",
  },
];

const DEFAULT_FACTORS: ProductionFactors = {
  kefirYieldPct: 90,
  kefirWaterYieldPct: 95,
  cheeseDirectGrPerLiter: 250,
  cheeseDirectWheyMlPerLiter: 750,
  cheeseIndirectGrPerLiter: 200,
  cheeseIndirectWheyMlPerLiter: 800,
};

const DEFAULT_INVENTORY: ProductionInventoryItem[] = [
  {
    id: "inv-leche-entera",
    name: "Leche entera",
    category: "materia",
    unit: "L",
    quantity: 60,
    minStock: 20,
    avgCost: 5.2,
    updatedAt: nowISO(),
  },
  {
    id: "inv-leche-sobrante",
    name: "Sobrante de leche",
    category: "materia",
    unit: "L",
    quantity: 0,
    minStock: 0,
    avgCost: 0,
    updatedAt: nowISO(),
  },
  {
    id: "inv-azucar-morena",
    name: "Azucar morena",
    category: "materia",
    unit: "kg",
    quantity: 12,
    minStock: 3,
    avgCost: 7,
    updatedAt: nowISO(),
  },
  {
    id: "inv-azucar-blanca",
    name: "Azucar blanca",
    category: "materia",
    unit: "kg",
    quantity: 18,
    minStock: 4,
    avgCost: 5.5,
    updatedAt: nowISO(),
  },
  {
    id: "inv-botellas",
    name: "Botellas",
    category: "insumo",
    unit: "unid",
    quantity: 300,
    minStock: 80,
    avgCost: 1.1,
    updatedAt: nowISO(),
  },
  {
    id: "inv-tapas",
    name: "Tapas",
    category: "insumo",
    unit: "unid",
    quantity: 300,
    minStock: 80,
    avgCost: 0.25,
    updatedAt: nowISO(),
  },
  {
    id: "inv-etiquetas",
    name: "Etiquetas",
    category: "insumo",
    unit: "unid",
    quantity: 300,
    minStock: 80,
    avgCost: 0.18,
    updatedAt: nowISO(),
  },
];

const DEFAULT_STRAINS: ProductionStrain[] = [
  {
    id: "strain-leche-principal",
    name: "Nodulo leche principal",
    type: "leche",
    currentWeightGr: 450,
    health: "bueno",
    usageCount: 0,
    notes: "Cepa base migrada para produccion diaria.",
  },
  {
    id: "strain-agua-principal",
    name: "Tibicos principal",
    type: "agua",
    currentWeightGr: 220,
    health: "bueno",
    usageCount: 0,
    notes: "Cepa base para kefir de agua.",
  },
];

const DEFAULT_CATALOG_PRODUCTS: KefirCatalogProduct[] = [
  { id: "PROD-001", code: "PROD-001", name: "Kéfir de Leche Natural 500ml", type: "kefir", flavor: "Natural", presentationMl: 500, presentationGr: 0, sellPrice: 3.50, envase: "", notes: "" },
  { id: "PROD-002", code: "PROD-002", name: "Kéfir de Leche Frutilla 500ml", type: "kefir", flavor: "Frutilla", presentationMl: 500, presentationGr: 0, sellPrice: 3.80, envase: "", notes: "" },
  { id: "PROD-003", code: "PROD-003", name: "Kéfir de Leche Coco 500ml", type: "kefir", flavor: "Coco", presentationMl: 500, presentationGr: 0, sellPrice: 3.80, envase: "", notes: "" },
  { id: "PROD-004", code: "PROD-004", name: "Kéfir de Leche Natural 1L", type: "kefir", flavor: "Natural", presentationMl: 1000, presentationGr: 0, sellPrice: 6.00, envase: "", notes: "" },
  { id: "PROD-005", code: "PROD-005", name: "Kéfir de Leche Frutilla 750ml", type: "kefir", flavor: "Frutilla", presentationMl: 750, presentationGr: 0, sellPrice: 5.00, envase: "", notes: "" },
  { id: "PROD-006", code: "PROD-006", name: "Kéfir de Agua Natural 500ml", type: "kefir_agua", flavor: "Natural", presentationMl: 500, presentationGr: 0, sellPrice: 3.00, envase: "", notes: "" },
  { id: "PROD-007", code: "PROD-007", name: "Kéfir de Agua Limón 500ml", type: "kefir_agua", flavor: "Limón", presentationMl: 500, presentationGr: 0, sellPrice: 3.20, envase: "", notes: "" },
  { id: "PROD-008", code: "PROD-008", name: "Kéfir de Agua Jengibre 500ml", type: "kefir_agua", flavor: "Jengibre", presentationMl: 500, presentationGr: 0, sellPrice: 3.20, envase: "", notes: "" },
  { id: "PROD-009", code: "PROD-009", name: "Queso Kéfir Natural 250g", type: "queso_directo", flavor: "Natural", presentationMl: 0, presentationGr: 250, sellPrice: 8.00, envase: "", notes: "" },
  { id: "PROD-010", code: "PROD-010", name: "Suero Kéfir 500ml", type: "suero", flavor: "Natural", presentationMl: 500, presentationGr: 0, sellPrice: 1.50, envase: "", notes: "" },
];

function defaultState(): ProductionControlState {
  return {
    orders: [],
    batches: [],
    inventory: DEFAULT_INVENTORY,
    movements: [],
    strains: DEFAULT_STRAINS,
    factors: DEFAULT_FACTORS,
    yieldRecords: [],
    customProducts: DEFAULT_CATALOG_PRODUCTS,
  };
}

function safeParse<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

const QUALITY_STAGES: Array<BatchStage | "final"> = [
  "preparacion",
  "fermentacion",
  "filtrado",
  "separacion",
  "prensado",
  "calidad",
  "envasado",
  "finalizado",
  "rechazado",
  "final",
];

function normalizeQualityStatus(value: unknown): QualityStatus {
  if (value === "aprobado" || value === "rechazado" || value === "pendiente") return value;
  return "pendiente";
}

function isQualityStage(value: unknown): value is BatchStage | "final" {
  return QUALITY_STAGES.includes(value as BatchStage | "final");
}

function normalizeBatchQuality(value?: Partial<BatchQuality> | null): BatchQuality {
  return {
    status: normalizeQualityStatus(value?.status),
    ph: value?.ph === undefined ? undefined : Number(value.ph),
    temperature: value?.temperature === undefined ? undefined : Number(value.temperature),
    acidity: value?.acidity === undefined ? undefined : Number(value.acidity),
    aspectColor: value?.aspectColor ? String(value.aspectColor) : undefined,
    outputLiters: value?.outputLiters === undefined ? undefined : Number(value.outputLiters),
    rawMaterialStatus: value?.rawMaterialStatus ? normalizeQualityStatus(value.rawMaterialStatus) : undefined,
    rawMaterialNotes: value?.rawMaterialNotes ? String(value.rawMaterialNotes) : undefined,
    inputStatus: value?.inputStatus ? normalizeQualityStatus(value.inputStatus) : undefined,
    inputNotes: value?.inputNotes ? String(value.inputNotes) : undefined,
    approvedBy: value?.approvedBy ? String(value.approvedBy) : undefined,
    checkedAt: value?.checkedAt ? String(value.checkedAt) : undefined,
    notes: value?.notes ? String(value.notes) : undefined,
  };
}

function normalizeQualityRecord(
  value: Partial<StageQualityRecord> | undefined,
  fallbackStage: BatchStage | "final",
  fallbackScope: QualityScope
): StageQualityRecord {
  const quality = normalizeBatchQuality(value);
  const createdAt = value?.createdAt || quality.checkedAt || nowISO();
  return {
    ...quality,
    id: value?.id ? String(value.id) : uid(),
    stage: isQualityStage(value?.stage) ? value.stage : fallbackStage,
    scope: value?.scope === "final" ? "final" : fallbackScope,
    checkedAt: quality.checkedAt || String(createdAt),
    createdAt: String(createdAt),
  };
}

function normalizeProductionBatch(batch: ProductionBatch): ProductionBatch {
  const quality = normalizeBatchQuality(batch.quality);
  const rawStageQuality = batch.stageQuality && typeof batch.stageQuality === "object" ? batch.stageQuality : {};
  const stageQuality: Partial<Record<BatchStage | "final", StageQualityRecord>> = {};

  Object.entries(rawStageQuality).forEach(([key, value]) => {
    if (!isQualityStage(key)) return;
    stageQuality[key] = normalizeQualityRecord(
      value as Partial<StageQualityRecord>,
      key,
      key === "final" ? "final" : "stage"
    );
  });

  if (!stageQuality[batch.stage] && quality.status !== "pendiente" && isQualityStage(batch.stage)) {
    stageQuality[batch.stage] = normalizeQualityRecord(
      { ...quality, stage: batch.stage, scope: "stage" },
      batch.stage,
      "stage"
    );
  }

  const finalQuality = batch.finalQuality
    ? normalizeQualityRecord(batch.finalQuality, "final", "final")
    : stageQuality.final?.scope === "final"
      ? stageQuality.final
      : undefined;

  return {
    ...batch,
    quality,
    stageQuality,
    finalQuality,
  };
}

function mergeState(value?: Partial<ProductionControlState>): ProductionControlState {
  const base = defaultState();
  return {
    orders: Array.isArray(value?.orders) ? value!.orders : base.orders,
    batches: Array.isArray(value?.batches) ? value!.batches.map(normalizeProductionBatch) : base.batches,
    inventory: Array.isArray(value?.inventory)
      ? (() => {
          const stored = value!.inventory!;
          return [
            ...stored,
            ...base.inventory.filter(
              (baseItem) => !stored.some((storedItem) => storedItem.id === baseItem.id || storedItem.name === baseItem.name)
            ),
          ];
        })()
      : base.inventory,
    movements: Array.isArray(value?.movements) ? value!.movements : base.movements,
    strains: Array.isArray(value?.strains) ? value!.strains : base.strains,
    factors: { ...base.factors, ...(value?.factors || {}) },
    yieldRecords: Array.isArray(value?.yieldRecords) ? value!.yieldRecords : base.yieldRecords,
    customProducts: Array.isArray(value?.customProducts) ? value!.customProducts : base.customProducts,
  };
}

function migrateLegacyState(): Partial<ProductionControlState> | undefined {
  if (!canUseStorage()) return undefined;
  const legacyOrders = safeParse<any[]>(window.localStorage.getItem(LEGACY_ORDERS_KEY));
  const legacyBatches = safeParse<any[]>(window.localStorage.getItem(LEGACY_BATCHES_KEY));
  if (!legacyOrders?.length && !legacyBatches?.length) return undefined;

  return {
    orders: (legacyOrders || []).map((order) => ({
      id: String(order.id || uid()),
      date: String(order.date || todayISO()),
      dueDate: String(order.dueDate || todayISO()),
      client: String(order.client || "Cliente"),
      priority: (order.priority || "Media") as OrderPriority,
      status: (order.status || "pendiente") as OrderStatus,
      notes: String(order.notes || ""),
      batchIds: Array.isArray(order.batchIds) ? order.batchIds.map(String) : [],
      items: Array.isArray(order.items)
        ? order.items.map((item: any) => ({
            id: String(item.id || uid()),
            productId: String(item.productId || item.productName || uid()),
            productName: String(item.productName || item.name || "Producto"),
            type: normalizeProductionType(item),
            quantity: Number(item.quantity || 0),
            unit: "unid" as const,
            volumeMl: Number(item.volumeMl || item.volume || 1000),
            weightGr: Number(item.weightGr || 0),
          }))
        : [],
    })),
    batches: (legacyBatches || []).map((batch) => ({
      id: String(batch.id || batch.batchNumber || uid()),
      batchNumber: String(batch.batchNumber || batch.id || "LOTE"),
      type: normalizeBatchType(batch.type),
      status: batch.status === "finalizado" || batch.status === "completed" ? "finalizado" : "en_proceso",
      stage: batch.status === "finalizado" || batch.status === "completed" ? "finalizado" : "preparacion",
      startDate: String(batch.startDate || batch.date || todayISO()),
      endDate: batch.endDate,
      operator: String(batch.operator || "Sistema"),
      orderRef: batch.orderRef ? String(batch.orderRef) : undefined,
      orderClient: batch.orderClient ? String(batch.orderClient) : undefined,
      initialVolumeLiters: Number(batch.initialVolume || batch.initialVolumeLiters || 0),
      expectedVolumeLiters: Number(batch.expectedVolume || batch.expectedVolumeLiters || 0),
      expectedQuesoGr: Number(batch.expectedQuesoGr || 0),
      expectedSueroMl: Number(batch.expectedSueroMl || 0),
      finalUnits: Number(batch.bottlesUsed || batch.finalUnits || 0),
      finalVolumeLiters: Number(batch.finalVolume || batch.finalVolumeLiters || 0),
      finalQuesoGr: Number(batch.finalQuesoGr || 0),
      finalSueroMl: Number(batch.finalSueroMl || 0),
      grainsGr: Number(batch.grains || batch.grainsGr || 0),
      strainId: batch.strainId ? String(batch.strainId) : undefined,
      sugarBrownGr: Number(batch.sugarBrownGr || 0),
      sugarWhiteGr: Number(batch.sugarWhiteGr || 0),
      milkType: String(batch.milkType || "Leche entera"),
      notes: String(batch.notes || ""),
      quality: batch.quality || { status: "pendiente" },
      inventoryDeductions: Array.isArray(batch.inventoryDeductions) ? batch.inventoryDeductions : [],
      history: Array.isArray(batch.history) ? batch.history : [],
    })) as ProductionBatch[],
  };
}

function normalizeBatchType(value: unknown): ProductionType {
  const text = normalize(value);
  if (text.includes("agua")) return "kefir_agua";
  if (text.includes("indirect")) return "queso_indirecto";
  if (text.includes("queso") || text.includes("nodule")) return "queso_directo";
  return "kefir";
}

function readState() {
  if (!canUseStorage()) return defaultState();
  const stored = safeParse<ProductionControlState>(window.localStorage.getItem(STATE_KEY));
  if (stored) return mergeState(stored);
  const migrated = migrateLegacyState();
  return mergeState(migrated);
}

function writeState(state: ProductionControlState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function nextOrderId(orders: ProductionOrder[]) {
  const year = new Date().getFullYear();
  const max = orders.reduce((acc, order) => {
    const match = String(order.id).match(/OP-\d{4}-(\d+)/);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `OP-${year}-${String(max + 1).padStart(3, "0")}`;
}

function batchPrefix(type: ProductionType) {
  if (type === "kefir_agua") return "KA";
  if (type === "queso_directo") return "QD";
  if (type === "queso_indirecto") return "QI";
  if (type === "suero") return "SU";
  return "KF";
}

function nextBatchNumber(batches: ProductionBatch[], type: ProductionType) {
  const year = new Date().getFullYear();
  const prefix = batchPrefix(type);
  const max = batches.reduce((acc, batch) => {
    const match = String(batch.batchNumber).match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`;
}

function updateInventoryQuantity(
  state: ProductionControlState,
  name: string,
  changeAmount: number,
  reason: string,
  reference?: string,
  category: ProductionInventoryItem["category"] = "terminado",
  unit: ProductionInventoryItem["unit"] = "unid",
  avgCost = 0,
  expirationDate?: string
) {
  const key = normalize(name);
  let inventory = state.inventory.map((item) => ({ ...item, lots: item.lots ? [...item.lots] : [] }));
  let item = inventory.find((entry) => normalize(entry.name) === key);

  if (!item) {
    item = {
      id: `inv-${uid()}`,
      name,
      category,
      unit,
      quantity: 0,
      minStock: 0,
      avgCost,
      updatedAt: nowISO(),
      lots: [],
    };
    inventory = [...inventory, item];
  }

  // Lógica de Lotes (Kardex FEFO)
  if (!item.lots) item.lots = [];
  
  if (changeAmount > 0) {
    // INGRESO: Crear nuevo lote si hay referencia o es terminado/subproducto
    if ((category === "terminado" || category === "subproducto") && reference) {
      const expDate = expirationDate ? new Date(expirationDate) : new Date();
      if (!expirationDate) expDate.setDate(expDate.getDate() + 30); // 30 días default
      
      const existingLotIndex = item.lots.findIndex(l => l.batchNumber === reference);
      if (existingLotIndex >= 0) {
        item.lots[existingLotIndex].quantity += changeAmount;
      } else {
        item.lots.push({
          id: `lot-${uid()}`,
          batchNumber: reference,
          quantity: changeAmount,
          expirationDate: expDate.toISOString(),
          createdAt: nowISO(),
        });
      }
    }
  } else if (changeAmount < 0) {
    // SALIDA: Descontar FEFO (First Expire, First Out)
    let amountToConsume = Math.abs(changeAmount);
    // Ordenar lotes por fecha de vencimiento (los más antiguos primero)
    item.lots.sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
    
    for (let i = 0; i < item.lots.length && amountToConsume > 0; i++) {
      if (item.lots[i].quantity > 0) {
        const available = item.lots[i].quantity;
        const taken = Math.min(available, amountToConsume);
        item.lots[i].quantity = Number((available - taken).toFixed(3));
        amountToConsume -= taken;
      }
    }
    // Filtrar lotes en cero
    item.lots = item.lots.filter(l => l.quantity > 0);
  }

  item.quantity = Math.max(0, Number((item.quantity + changeAmount).toFixed(3)));
  item.updatedAt = nowISO();

  return {
    ...state,
    inventory,
    movements: [
      {
        id: uid(),
        date: nowISO(),
        productName: item.name,
        category: item.category,
        changeAmount: Number(changeAmount.toFixed(3)),
        newQuantity: item.quantity,
        unit: item.unit,
        reason,
        reference,
      },
      ...state.movements,
    ].slice(0, 300),
  };
}

function stageFlow(type: ProductionType): BatchStage[] {
  if (type === "queso_directo" || type === "queso_indirecto") {
    return ["preparacion", "separacion", "prensado", "envasado", "finalizado"];
  }
  if (type === "suero") {
    return ["preparacion", "separacion", "filtrado", "envasado", "finalizado"];
  }
  return ["preparacion", "fermentacion", "filtrado", "envasado", "finalizado"];
}

export function getBatchStageFlow(type: ProductionType): BatchStage[] {
  return stageFlow(type);
}

function typeMatchesBatch(itemType: ProductionType | "suero", batchType: ProductionType) {
  if (batchType === "kefir") return itemType === "kefir";
  if (batchType === "kefir_agua") return itemType === "kefir_agua";
  if (batchType === "queso_directo" || batchType === "queso_indirecto") {
    return itemType === "queso_directo" || itemType === "queso_indirecto" || itemType === "suero";
  }
  return false;
}

function orderTargetUnits(order: ProductionOrder) {
  return order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function producedUnitsForOrder(order: ProductionOrder, batches: ProductionBatch[]) {
  const linked = batches.filter((batch) => order.batchIds.includes(batch.id) || batch.orderRef === order.id);
  return linked.reduce((sum, batch) => sum + Number(batch.finalUnits || 0), 0);
}

function refreshOrderStatus(order: ProductionOrder, batches: ProductionBatch[]): ProductionOrder {
  if (order.status === "cancelada") return order;
  const progress = getOrderProgress(order, batches);
  if (progress >= 100 && orderTargetUnits(order) > 0) return { ...order, status: "completada" };
  if (order.batchIds.length > 0 || batches.some((batch) => batch.orderRef === order.id)) {
    return { ...order, status: "en_proceso" };
  }
  return { ...order, status: "pendiente" };
}

export function getOrderProgress(order: ProductionOrder, batches: ProductionBatch[]) {
  const target = orderTargetUnits(order);
  if (target <= 0) return 0;
  return Math.min(100, Math.round((producedUnitsForOrder(order, batches) / target) * 100));
}

export function buildProductionCatalog(rawProducts?: RawCatalogProduct[] | null): ProductionProduct[] {
  const mapped = (rawProducts || [])
    .filter((product) => product.status !== "inactive")
    .filter((product) => product.category === "finished_product" || product.productionRole === "finished_good")
    .map((product) => {
      const name = product.name || `Producto ${product.id}`;
      const presentation = parsePresentation(
        name,
        product.unit,
        Number(product.presentationVolumeMl || 0),
        Number(product.presentationWeightGr || 0)
      );

      return {
        id: `catalog-${product.id}`,
        sourceId: product.id,
        name,
        code: product.code || `P-${product.id}`,
        type: normalizeProductionType(product),
        unit: "unid" as const,
        volumeMl: presentation.volumeMl,
        weightGr: presentation.weightGr,
        salePrice: moneyToBs(product.salePrice),
        costPrice: moneyToBs(product.price),
        source: "catalog" as const,
      };
    });

  if (mapped.length === 0) return DEFAULT_PRODUCTS;

  const defaultsByType = DEFAULT_PRODUCTS.filter(
    (fallback) => !mapped.some((product) => product.type === fallback.type && normalize(product.name) === normalize(fallback.name))
  );

  return [...mapped, ...defaultsByType];
}

export function getTypeLabel(type: ProductionType | "suero") {
  switch (type) {
    case "kefir_agua":
      return "Kéfir de agua";
    case "queso_directo":
      return "Queso directo";
    case "queso_indirecto":
      return "Queso indirecto";
    case "suero":
      return "Suero de Kéfir";
    default:
      return "Kéfir de leche";
  }
}

export function getStageLabel(stage: BatchStage) {
  const labels: Record<BatchStage, string> = {
    preparacion: "Preparacion",
    fermentacion: "Fermentacion",
    filtrado: "Filtrado",
    separacion: "Separacion",
    prensado: "Prensado",
    calidad: "Calidad",
    envasado: "Envasado",
    finalizado: "Finalizado",
    rechazado: "Rechazado",
  };
  return labels[stage];
}

export function getOrderStatusLabel(status: OrderStatus) {
  if (status === "en_proceso") return "En proceso";
  if (status === "completada") return "Completada";
  if (status === "cancelada") return "Cancelada";
  return "Pendiente";
}

export function getQualityLabel(status: QualityStatus) {
  if (status === "aprobado") return "Aprobado";
  if (status === "rechazado") return "Rechazado";
  return "Pendiente";
}

export function calculateOrderSuggestion(
  state: ProductionControlState,
  orderId: string | undefined,
  type: ProductionType
) {
  const order = orderId ? state.orders.find((entry) => entry.id === orderId) : undefined;
  let expectedVolumeLiters = 0;
  let expectedQuesoGr = 0;
  let expectedSueroMl = 0;
  let targetUnits = 0;

  if (order) {
    order.items.filter((item) => typeMatchesBatch(item.type, type)).forEach((item) => {
      targetUnits += item.quantity;
      if (type === "queso_directo" || type === "queso_indirecto") {
        if (item.type === "suero") expectedSueroMl += item.quantity * (item.volumeMl || 500);
        else expectedQuesoGr += item.quantity * (item.weightGr || 250);
      } else {
        expectedVolumeLiters += item.quantity * ((item.volumeMl || 1000) / 1000);
      }
    });
  }

  const factors = state.factors;
  let initialVolumeLiters = expectedVolumeLiters;
  if (type === "kefir" && expectedVolumeLiters > 0) {
    initialVolumeLiters = expectedVolumeLiters / (factors.kefirYieldPct / 100);
  }
  if (type === "kefir_agua" && expectedVolumeLiters > 0) {
    initialVolumeLiters = expectedVolumeLiters / (factors.kefirWaterYieldPct / 100);
  }
  if (type === "queso_directo" && expectedQuesoGr > 0) {
    initialVolumeLiters = expectedQuesoGr / factors.cheeseDirectGrPerLiter;
    expectedSueroMl = expectedSueroMl || initialVolumeLiters * factors.cheeseDirectWheyMlPerLiter;
  }
  if (type === "queso_indirecto" && expectedQuesoGr > 0) {
    initialVolumeLiters = expectedQuesoGr / factors.cheeseIndirectGrPerLiter;
    expectedSueroMl = expectedSueroMl || initialVolumeLiters * factors.cheeseIndirectWheyMlPerLiter;
  }

  return {
    expectedVolumeLiters: Number(expectedVolumeLiters.toFixed(2)),
    expectedQuesoGr: Math.round(expectedQuesoGr),
    expectedSueroMl: Math.round(expectedSueroMl),
    initialVolumeLiters: Number(initialVolumeLiters.toFixed(2)),
    targetUnits,
  };
}

function calculateYield(batch: ProductionBatch, factors: ProductionFactors) {
  if (batch.initialVolumeLiters <= 0) return { yieldPct: 0, wastePct: 0, outputVolumeLiters: 0 };

  if (batch.type === "queso_directo" || batch.type === "queso_indirecto") {
    const factor =
      batch.type === "queso_directo" ? factors.cheeseDirectGrPerLiter : factors.cheeseIndirectGrPerLiter;
    const expected = batch.initialVolumeLiters * factor;
    const yieldPct = expected > 0 ? Math.round((batch.finalQuesoGr / expected) * 100) : 0;
    return { yieldPct, wastePct: Math.max(0, 100 - yieldPct), outputVolumeLiters: 0 };
  }

  const outputVolumeLiters = batch.finalVolumeLiters || batch.finalUnits;
  const yieldPct = Math.round((outputVolumeLiters / batch.initialVolumeLiters) * 100);
  return { yieldPct, wastePct: Math.max(0, 100 - yieldPct), outputVolumeLiters };
}

export function useProductionControl(rawProducts?: RawCatalogProduct[] | null) {
  const [state, setState] = useState<ProductionControlState>(() => readState());
  const products = useMemo(() => buildProductionCatalog(rawProducts), [rawProducts]);

  useEffect(() => {
    const onUpdated = () => setState(readState());
    window.addEventListener(EVENT_NAME, onUpdated);
    window.addEventListener("storage", onUpdated);
    return () => {
      window.removeEventListener(EVENT_NAME, onUpdated);
      window.removeEventListener("storage", onUpdated);
    };
  }, []);

  const commit = (updater: (current: ProductionControlState) => ProductionControlState) => {
    const next = updater(readState());
    setState(next);
    writeState(next);
    return next;
  };

  const createOrder = (input: CreateOrderInput) => {
    let created: ProductionOrder | undefined;
    commit((current) => {
      const items = input.items
        .filter((item) => item.quantity > 0)
        .map((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          if (!product) return undefined;
          return {
            id: uid(),
            productId: product.id,
            productName: product.name,
            type: product.type,
            quantity: Number(item.quantity),
            unit: "unid" as const,
            volumeMl: product.volumeMl,
            weightGr: product.weightGr,
          };
        })
        .filter(Boolean) as ProductionOrderItem[];

      const order: ProductionOrder = {
        id: nextOrderId(current.orders),
        date: todayISO(),
        dueDate: input.dueDate || todayISO(),
        client: input.client.trim() || "Cliente sin nombre",
        priority: input.priority || "Media",
        status: "pendiente",
        items,
        notes: input.notes || "",
        batchIds: [],
      };
      created = order;
      return { ...current, orders: [order, ...current.orders] };
    });
    return created!;
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    commit((current) => ({
      ...current,
      orders: current.orders.map((order) => (order.id === orderId ? { ...order, status } : order)),
    }));
  };

  const deleteOrder = (orderId: string) => {
    commit((current) => ({
      ...current,
      orders: current.orders.filter((order) => order.id !== orderId),
    }));
  };

  const createBatch = (input: CreateBatchInput) => {
    let created: ProductionBatch | undefined;
    commit((current) => {
      const order = input.orderId ? current.orders.find((entry) => entry.id === input.orderId) : undefined;
      const batchNumber = nextBatchNumber(current.batches, input.type);
      const batch: ProductionBatch = {
        id: uid(),
        batchNumber,
        type: input.type,
        status: "en_proceso",
        stage: "preparacion",
        startDate: todayISO(),
        operator: input.operator.trim() || "Produccion",
        orderRef: order?.id,
        orderClient: order?.client,
        initialVolumeLiters: Number(input.initialVolumeLiters || 0),
        expectedVolumeLiters: Number(input.expectedVolumeLiters || 0),
        expectedQuesoGr: Number(input.expectedQuesoGr || 0),
        expectedSueroMl: Number(input.expectedSueroMl || 0),
        finalUnits: 0,
        finalVolumeLiters: 0,
        finalQuesoGr: 0,
        finalSueroMl: 0,
        grainsGr: Number(input.grainsGr || 0),
        strainId: input.strainId || undefined,
        sugarBrownGr: Number(input.sugarBrownGr || 0),
        sugarWhiteGr: Number(input.sugarWhiteGr || 0),
        milkType: input.milkType || "Leche entera",
        notes: input.notes || "",
        quality: { status: "pendiente" },
        stageQuality: {},
        finalQuality: undefined,
        inventoryDeductions: [],
        history: [{ date: nowISO(), event: `Lote ${batchNumber} creado` }],
        leftoverVolumeMl: Number(input.leftoverVolumeMl || 0),
      };

      let nextState: ProductionControlState = { ...current, batches: [batch, ...current.batches] };

      if (input.type === "kefir_agua") {
        if (batch.sugarBrownGr > 0) {
          const kg = batch.sugarBrownGr / 1000;
          nextState = updateInventoryQuantity(nextState, "Azucar morena", -kg, "Consumo por lote", batchNumber, "materia", "kg");
          batch.inventoryDeductions.push({ name: "Azucar morena", quantity: kg, unit: "kg" });
        }
        if (batch.sugarWhiteGr > 0) {
          const kg = batch.sugarWhiteGr / 1000;
          nextState = updateInventoryQuantity(nextState, "Azucar blanca", -kg, "Consumo por lote", batchNumber, "materia", "kg");
          batch.inventoryDeductions.push({ name: "Azucar blanca", quantity: kg, unit: "kg" });
        }
      } else if (input.type !== "queso_indirecto" && batch.initialVolumeLiters > 0) {
        const leftoverLiters = Number(((batch.leftoverVolumeMl || 0) / 1000).toFixed(3));
        const totalDeducted = Number((batch.initialVolumeLiters + leftoverLiters).toFixed(3));

        // Descontar la cantidad total ingresada (incluyendo sobrantes) de la leche de base original
        const deductionQty = input.milkUsedQuantity && input.milkUsedQuantity > 0 ? input.milkUsedQuantity : totalDeducted;
        const deductionUnit = input.milkUsedQuantity && input.milkUsedQuantity > 0 ? "unid" : "L";

        nextState = updateInventoryQuantity(
          nextState,
          batch.milkType || "Leche entera",
          -deductionQty,
          "Consumo por lote",
          batchNumber,
          "materia",
          deductionUnit
        );
        batch.inventoryDeductions.push({
          name: batch.milkType || "Leche entera",
          quantity: deductionQty,
          unit: deductionUnit,
        });

        // Sumar el sobrante al ítem "Sobrante de leche" si el operario lo decidió
        if (leftoverLiters > 0 && input.saveLeftoverToInventory !== false) {
          nextState = updateInventoryQuantity(
            nextState,
            "Sobrante de leche",
            leftoverLiters,
            "Sobrante de lote",
            batchNumber,
            "materia",
            "L"
          );
          batch.inventoryDeductions.push({
            name: "Sobrante de leche",
            quantity: -leftoverLiters,
            unit: "L",
          });
        }
      }

      if (batch.strainId) {
        nextState = {
          ...nextState,
          strains: nextState.strains.map((strain) =>
            strain.id === batch.strainId
              ? {
                  ...strain,
                  usageCount: strain.usageCount + 1,
                  lastUsed: todayISO(),
                  currentWeightGr: Math.max(0, Number((strain.currentWeightGr - batch.grainsGr * 0.02).toFixed(1))),
                }
              : strain
          ),
        };
      }

      if (order) {
        nextState = {
          ...nextState,
          orders: nextState.orders.map((entry) =>
            entry.id === order.id
              ? {
                  ...entry,
                  status: entry.status === "pendiente" ? "en_proceso" : entry.status,
                  batchIds: Array.from(new Set([...entry.batchIds, batch.id])),
                }
              : entry
          ),
        };
      }

      created = batch;
      return nextState;
    });
    return created!;
  };

  const advanceBatch = (batchId: string) => {
    commit((current) => ({
      ...current,
      batches: current.batches.map((batch) => {
        if (batch.id !== batchId || batch.status !== "en_proceso") return batch;
        const flow = stageFlow(batch.type);
        const index = flow.indexOf(batch.stage);
        const nextStage = flow[Math.min(index + 1, flow.length - 1)] || "finalizado";
        return {
          ...batch,
          stage: nextStage,
          history: [{ date: nowISO(), event: `Avanza a ${getStageLabel(nextStage)}` }, ...batch.history],
        };
      }),
    }));
  };

  const recordQuality = (batchId: string, quality: QualityInput) => {
    commit((current) => ({
      ...current,
      batches: current.batches.map((batch) => {
        if (batch.id !== batchId) return batch;
        const checkedAt = nowISO();
        const stage = isQualityStage(quality.stage) ? quality.stage : batch.stage;
        const scope: QualityScope = quality.scope || (stage === "final" ? "final" : "stage");
        const record: StageQualityRecord = {
          id: uid(),
          stage,
          scope,
          status: quality.status,
          ph: quality.ph,
          temperature: quality.temperature,
          acidity: quality.acidity,
          aspectColor: quality.aspectColor,
          outputLiters: quality.outputLiters,
          rawMaterialStatus: quality.rawMaterialStatus,
          rawMaterialNotes: quality.rawMaterialNotes,
          inputStatus: quality.inputStatus,
          inputNotes: quality.inputNotes,
          approvedBy: quality.approvedBy,
          notes: quality.notes,
          checkedAt,
          createdAt: checkedAt,
        };
        const rejected = quality.status === "rechazado";
        const approvedCurrentQualityGate = quality.status === "aprobado" && scope === "stage" && stage === "calidad" && batch.stage === "calidad";
        const stageText = scope === "final" ? "final" : getStageLabel(stage as BatchStage).toLowerCase();
        return {
          ...batch,
          status: rejected ? "rechazado" : batch.status,
          stage: rejected ? "rechazado" : approvedCurrentQualityGate ? "envasado" : batch.stage,
          quality: record,
          stageQuality: {
            ...batch.stageQuality,
            [stage]: record,
          },
          finalQuality: scope === "final" ? record : batch.finalQuality,
          history: [
            { date: checkedAt, event: `Control de calidad ${stageText}: ${getQualityLabel(quality.status).toLowerCase()}` },
            ...batch.history,
          ],
        };
      }),
    }));
  };

  const completeBatch = (batchId: string, input: CompleteBatchInput) => {
    commit((current) => {
      let completedBatch: ProductionBatch | undefined;
      const batches = current.batches.map((batch) => {
        if (batch.id !== batchId) return batch;
        const checkedAt = nowISO();
        const finalQuality: StageQualityRecord = {
          id: uid(),
          stage: "final",
          scope: "final",
          status: input.quality?.status || "aprobado",
          ph: input.quality?.ph,
          temperature: input.quality?.temperature,
          acidity: input.quality?.acidity,
          aspectColor: input.quality?.aspectColor,
          outputLiters: input.quality?.outputLiters || Number(input.finalVolumeLiters || 0),
          rawMaterialStatus: input.quality?.rawMaterialStatus,
          rawMaterialNotes: input.quality?.rawMaterialNotes,
          inputStatus: input.quality?.inputStatus,
          inputNotes: input.quality?.inputNotes,
          approvedBy: input.quality?.approvedBy || "Calidad",
          notes: input.quality?.notes || "Control final registrado al cierre de produccion",
          checkedAt,
          createdAt: checkedAt,
        };
        const approvedFinal = finalQuality.status === "aprobado";
        const rejectedFinal = finalQuality.status === "rechazado";
        completedBatch = {
          ...batch,
          // Always go to en_calidad — never jump directly to finalizado
          status: rejectedFinal ? "rechazado" : "en_calidad",
          stage: rejectedFinal ? "rechazado" : "finalizado",
          endDate: todayISO(),
          finalUnits: Number(input.finalUnits || 0),
          finalVolumeLiters: Number(input.finalVolumeLiters || 0),
          finalQuesoGr: Number(input.finalQuesoGr || 0),
          finalSueroMl: Number(input.finalSueroMl || 0),
          notes: [batch.notes, input.notes].filter(Boolean).join("\n"),
          quality: finalQuality,
          stageQuality: {
            ...batch.stageQuality,
            final: finalQuality,
          },
          finalQuality,
          history: [
            { date: checkedAt, event: `Control final: ${getQualityLabel(finalQuality.status).toLowerCase()}` },
            {
              date: checkedAt,
              event: rejectedFinal
                ? "Lote rechazado en control final"
                : approvedFinal
                  ? "Lote finalizado y registrado en inventario"
                  : "Cierre final pendiente de aprobacion",
            },
            ...batch.history,
          ],
        };
        return completedBatch;
      });

      if (!completedBatch) return current;

      let nextState: ProductionControlState = { ...current, batches };
      // Do NOT move to inventory yet — wait for releaseToInventory from Quality module
      return nextState;
    });
  };

  // Called from Quality module to do final approval and push to inventory
  const releaseToInventory = (batchId: string, qualityInput?: QualityInput) => {
    commit((current) => {
      const batch = current.batches.find((b) => b.id === batchId);
      if (!batch || (batch.status !== "en_calidad" && batch.status !== "finalizado")) return current;

      const checkedAt = nowISO();
      const finalQuality: StageQualityRecord = {
        id: uid(),
        stage: "final",
        scope: "final",
        status: qualityInput?.status || batch.finalQuality?.status || "aprobado",
        ph: qualityInput?.ph ?? batch.finalQuality?.ph,
        temperature: qualityInput?.temperature ?? batch.finalQuality?.temperature,
        acidity: qualityInput?.acidity ?? batch.finalQuality?.acidity,
        aspectColor: qualityInput?.aspectColor ?? batch.finalQuality?.aspectColor,
        outputLiters: qualityInput?.outputLiters ?? batch.finalQuality?.outputLiters ?? batch.finalVolumeLiters,
        approvedBy: qualityInput?.approvedBy ?? batch.finalQuality?.approvedBy ?? "Calidad",
        notes: qualityInput?.notes ?? batch.finalQuality?.notes ?? "Aprobado desde módulo de calidad",
        checkedAt,
        createdAt: checkedAt,
      };

      const rejected = finalQuality.status === "rechazado";

      const updatedBatch: ProductionBatch = {
        ...batch,
        status: rejected ? "rechazado" : "finalizado",
        stage: rejected ? "rechazado" : "finalizado",
        finalQuality,
        stageQuality: { ...batch.stageQuality, final: finalQuality },
        history: [
          { date: checkedAt, event: rejected ? "Rechazado en calidad final" : "Liberado desde calidad → inventario" },
          ...batch.history,
        ],
      };

      const batches = current.batches.map((b) => (b.id === batchId ? updatedBatch : b));
      let nextState: ProductionControlState = { ...current, batches };

      if (rejected) return nextState;

      // ── Move to finished goods inventory ──────────────────────────
      if (updatedBatch.finalUnits > 0) {
        nextState = updateInventoryQuantity(nextState, "Botellas", -updatedBatch.finalUnits, "Envases usados", updatedBatch.batchNumber, "insumo", "unid");
        nextState = updateInventoryQuantity(nextState, "Tapas", -updatedBatch.finalUnits, "Tapas usadas", updatedBatch.batchNumber, "insumo", "unid");
        nextState = updateInventoryQuantity(nextState, "Etiquetas", -updatedBatch.finalUnits, "Etiquetas usadas", updatedBatch.batchNumber, "insumo", "unid");
      }

      const order = updatedBatch.orderRef ? nextState.orders.find((entry) => entry.id === updatedBatch.orderRef) : undefined;
      if (order) {
        order.items
          .filter((item) => typeMatchesBatch(item.type, updatedBatch.type))
          .forEach((item) => {
            const produced = Math.min(item.quantity, Math.max(0, updatedBatch.finalUnits));
            if (produced > 0) {
              nextState = updateInventoryQuantity(
                nextState,
                item.productName,
                produced,
                "Ingreso por producción — Liberado por Calidad",
                updatedBatch.batchNumber,
                item.type === "suero" ? "subproducto" : "terminado",
                "unid",
                0,
                qualityInput?.expirationDate
              );
            }
          });
      } else if (updatedBatch.finalUnits > 0) {
        nextState = updateInventoryQuantity(
          nextState,
          getTypeLabel(updatedBatch.type),
          updatedBatch.finalUnits,
          "Ingreso por producción — Liberado por Calidad",
          updatedBatch.batchNumber,
          "terminado",
          "unid",
          0,
          qualityInput?.expirationDate
        );
      }

      // If it was suero batch, also register suero volume
      if (updatedBatch.type === "suero" && updatedBatch.finalSueroMl > 0) {
        nextState = updateInventoryQuantity(
          nextState,
          "Suero de Kéfir",
          Math.round(updatedBatch.finalSueroMl / 1000 * 10) / 10,
          "Suero envasado — Liberado por Calidad",
          updatedBatch.batchNumber,
          "subproducto",
          "L",
          0,
          qualityInput?.expirationDate
        );
      }

      const yieldCalc = calculateYield(updatedBatch, nextState.factors);
      const yieldRecord: ProductionYieldRecord = {
        id: uid(),
        batchId: updatedBatch.id,
        batchNumber: updatedBatch.batchNumber,
        type: updatedBatch.type,
        inputLiters: updatedBatch.initialVolumeLiters,
        outputUnits: updatedBatch.finalUnits,
        outputVolumeLiters: yieldCalc.outputVolumeLiters,
        outputCheeseGr: updatedBatch.finalQuesoGr,
        yieldPct: yieldCalc.yieldPct,
        wastePct: yieldCalc.wastePct,
        date: todayISO(),
      };

      const refreshedOrders = nextState.orders.map((entry) => refreshOrderStatus(entry, nextState.batches));
      return {
        ...nextState,
        orders: refreshedOrders,
        yieldRecords: [yieldRecord, ...nextState.yieldRecords],
      };
    });
  };

  const adjustInventory = (itemId: string, quantity: number, reason: string) => {
    commit((current) => {
      const item = current.inventory.find((entry) => entry.id === itemId);
      if (!item) return current;
      return updateInventoryQuantity(current, item.name, quantity - item.quantity, reason || "Ajuste manual", undefined, item.category, item.unit);
    });
  };

  const updateFactors = (factors: Partial<ProductionFactors>) => {
    commit((current) => ({ ...current, factors: { ...current.factors, ...factors } }));
  };

  const addProduct = (product: Omit<KefirCatalogProduct, "id" | "code">) => {
    commit((current) => {
      const nextNum = current.customProducts.length + 1;
      const code = `PROD-${String(nextNum).padStart(3, "0")}`;
      const newProduct: KefirCatalogProduct = { ...product, id: code, code };
      return { ...current, customProducts: [newProduct, ...current.customProducts] };
    });
  };

  const updateProduct = (productId: string, patch: Partial<KefirCatalogProduct>) => {
    commit((current) => ({
      ...current,
      customProducts: current.customProducts.map((p) => (p.id === productId ? { ...p, ...patch } : p)),
    }));
  };

  const deleteProduct = (productId: string) => {
    commit((current) => ({
      ...current,
      customProducts: current.customProducts.filter((p) => p.id !== productId),
    }));
  };

  const addStrain = (input: Omit<ProductionStrain, "id" | "usageCount">) => {
    commit((current) => ({
      ...current,
      strains: [{ ...input, id: uid(), usageCount: 0 }, ...current.strains],
    }));
  };

  const updateStrain = (strainId: string, patch: Partial<ProductionStrain>) => {
    commit((current) => ({
      ...current,
      strains: current.strains.map((strain) => (strain.id === strainId ? { ...strain, ...patch } : strain)),
    }));
  };

  const resetDemo = () => {
    const next = defaultState();
    setState(next);
    writeState(next);
  };

  const enrichedOrders = useMemo(
    () =>
      state.orders.map((order) => ({
        ...order,
        progress: getOrderProgress(order, state.batches),
        producedUnits: producedUnitsForOrder(order, state.batches),
        targetUnits: orderTargetUnits(order),
      })),
    [state.orders, state.batches]
  );

  const activeBatches = useMemo(
    () => state.batches.filter((batch) => batch.status === "en_proceso" || batch.status === "en_calidad"),
    [state.batches]
  );

  const inventoryAlerts = useMemo(
    () => state.inventory.filter((item) => item.quantity <= item.minStock),
    [state.inventory]
  );

  const pendingQuality = useMemo(
    () =>
      state.batches.filter((batch) => {
        if (batch.status === "en_calidad") return true; // awaiting final quality release
        if (batch.status === "en_proceso") {
          return (batch.stageQuality?.[batch.stage]?.status || "pendiente") === "pendiente";
        }
        if (batch.status === "finalizado") {
          return (batch.finalQuality?.status || "pendiente") === "pendiente";
        }
        return false;
      }),
    [state.batches]
  );

  return {
    state,
    products,
    customProducts: state.customProducts,
    orders: enrichedOrders,
    batches: state.batches,
    inventory: state.inventory,
    movements: state.movements,
    strains: state.strains,
    factors: state.factors,
    yieldRecords: state.yieldRecords,
    activeBatches,
    inventoryAlerts,
    pendingQuality,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    createBatch,
    advanceBatch,
    recordQuality,
    completeBatch,
    releaseToInventory,
    adjustInventory,
    updateFactors,
    addStrain,
    updateStrain,
    addProduct,
    updateProduct,
    deleteProduct,
    resetDemo,
    calculateSuggestion: (orderId: string | undefined, type: ProductionType) =>
      calculateOrderSuggestion(state, orderId, type),
  };
}
