/**
 * 🟡 MEDIO #2: Catálogo normalizado de categorías de gastos
 *
 * Fuente única de verdad para labels, grupos y metadatos de cada categoría.
 * Usada tanto en frontend (select/filtros) como en backend (validación/reportes).
 */

export type ExpenseCategoryKey =
  // ── Operativos fijos ──────────────────────────────────────────────────────
  | "rent"
  | "salaries"
  | "electricity"
  | "water"
  | "internet"
  | "telephone"
  | "insurance"
  | "taxes"
  // ── Ventas y marketing ────────────────────────────────────────────────────
  | "facebook_ads"
  | "google_ads"
  | "tiktok_ads"
  | "print_advertising"
  // ── Logística y reparto ───────────────────────────────────────────────────
  | "fuel"
  | "subsistence"
  | "logistics"
  | "packaging"
  // ── Mantenimiento y suministros ───────────────────────────────────────────
  | "maintenance"
  | "supplies"
  | "cleaning"
  | "equipment_depreciation"
  // ── Financieros y bancarios ───────────────────────────────────────────────
  | "bank_fees"
  | "loan_interest"
  | "commissions"
  // ── Costos directos (auto-generados por el sistema) ───────────────────────
  | "cogs"
  | "repair_cost"
  | "warranty_repair_cost"
  | "warranty_replacement_cost"
  // ── Otros ─────────────────────────────────────────────────────────────────
  | "other";

export type ExpenseCategoryGroup =
  | "fixed_costs"
  | "sales_marketing"
  | "logistics"
  | "maintenance"
  | "financial"
  | "direct_costs"
  | "other";

export interface ExpenseCategoryMeta {
  key: ExpenseCategoryKey;
  label: string;          // Etiqueta en español para UI
  group: ExpenseCategoryGroup;
  groupLabel: string;     // Etiqueta del grupo en español
  isAutomatic: boolean;   // true = generado por el sistema, no editable
  icon?: string;          // Emoji sugerido para UI
  description?: string;   // Tooltip o ayuda contextual
}

export const EXPENSE_CATEGORIES: ExpenseCategoryMeta[] = [
  // ── Operativos fijos ──────────────────────────────────────────────────────
  { key: "rent",                  label: "Alquiler",                group: "fixed_costs", groupLabel: "Costos Fijos Operativos", isAutomatic: false, icon: "🏢", description: "Alquiler de local o almacén" },
  { key: "salaries",              label: "Sueldos y Salarios",      group: "fixed_costs", groupLabel: "Costos Fijos Operativos", isAutomatic: false, icon: "👥", description: "Nómina de empleados" },
  { key: "electricity",           label: "Energía Eléctrica",       group: "fixed_costs", groupLabel: "Costos Fijos Operativos", isAutomatic: false, icon: "⚡", description: "Factura de luz" },
  { key: "water",                 label: "Agua",                    group: "fixed_costs", groupLabel: "Costos Fijos Operativos", isAutomatic: false, icon: "💧", description: "Factura de agua potable" },
  { key: "internet",              label: "Internet",                group: "fixed_costs", groupLabel: "Costos Fijos Operativos", isAutomatic: false, icon: "🌐", description: "Servicio de internet" },
  { key: "telephone",             label: "Telefonía",               group: "fixed_costs", groupLabel: "Costos Fijos Operativos", isAutomatic: false, icon: "📞", description: "Líneas telefónicas fijas y móviles" },
  { key: "insurance",             label: "Seguros",                 group: "fixed_costs", groupLabel: "Costos Fijos Operativos", isAutomatic: false, icon: "🛡️", description: "Pólizas de seguro del negocio" },
  { key: "taxes",                 label: "Impuestos y Tributos",    group: "fixed_costs", groupLabel: "Costos Fijos Operativos", isAutomatic: false, icon: "🧾", description: "IVA, impuesto a las transacciones, tasas municipales" },

  // ── Ventas y marketing ────────────────────────────────────────────────────
  { key: "facebook_ads",          label: "Publicidad Facebook/Meta",group: "sales_marketing", groupLabel: "Ventas y Marketing", isAutomatic: false, icon: "📱", description: "Anuncios en Facebook e Instagram" },
  { key: "google_ads",            label: "Publicidad Google",       group: "sales_marketing", groupLabel: "Ventas y Marketing", isAutomatic: false, icon: "🔍", description: "Google Ads / SEM" },
  { key: "tiktok_ads",            label: "Publicidad TikTok",       group: "sales_marketing", groupLabel: "Ventas y Marketing", isAutomatic: false, icon: "🎵", description: "TikTok Ads" },
  { key: "print_advertising",     label: "Material Impreso",        group: "sales_marketing", groupLabel: "Ventas y Marketing", isAutomatic: false, icon: "🖨️", description: "Flyers, banners, tarjetas de presentación" },

  // ── Logística y reparto ───────────────────────────────────────────────────
  { key: "fuel",                  label: "Combustible",             group: "logistics", groupLabel: "Logística y Reparto", isAutomatic: false, icon: "⛽", description: "Gasolina, gas vehicular" },
  { key: "subsistence",           label: "Viáticos",                group: "logistics", groupLabel: "Logística y Reparto", isAutomatic: false, icon: "🍱", description: "Alimentación y hospedaje en ruta" },
  { key: "logistics",             label: "Logística / Fletes",      group: "logistics", groupLabel: "Logística y Reparto", isAutomatic: false, icon: "🚚", description: "Transporte de mercancía, envíos" },
  { key: "packaging",             label: "Embalaje",                group: "logistics", groupLabel: "Logística y Reparto", isAutomatic: false, icon: "📦", description: "Cajas, bolsas, cinta, materiales de empaque" },

  // ── Mantenimiento y suministros ───────────────────────────────────────────
  { key: "maintenance",           label: "Mantenimiento",           group: "maintenance", groupLabel: "Mantenimiento y Suministros", isAutomatic: false, icon: "🔧", description: "Reparaciones de local, equipos propios" },
  { key: "supplies",              label: "Insumos de Oficina",      group: "maintenance", groupLabel: "Mantenimiento y Suministros", isAutomatic: false, icon: "✏️", description: "Papel, tóner, artículos de escritorio" },
  { key: "cleaning",              label: "Limpieza",                group: "maintenance", groupLabel: "Mantenimiento y Suministros", isAutomatic: false, icon: "🧹", description: "Productos de limpieza, servicio de limpieza" },
  { key: "equipment_depreciation",label: "Depreciación de Equipo",  group: "maintenance", groupLabel: "Mantenimiento y Suministros", isAutomatic: false, icon: "📉", description: "Depreciación de equipos propios de la empresa" },

  // ── Financieros y bancarios ───────────────────────────────────────────────
  { key: "bank_fees",             label: "Comisiones Bancarias",    group: "financial", groupLabel: "Gastos Financieros", isAutomatic: false, icon: "🏦", description: "Mantenimiento de cuentas, transferencias, cobros QR" },
  { key: "loan_interest",         label: "Intereses de Préstamos",  group: "financial", groupLabel: "Gastos Financieros", isAutomatic: false, icon: "📊", description: "Intereses de créditos bancarios o prestamistas" },
  { key: "commissions",           label: "Comisiones de Venta",     group: "financial", groupLabel: "Gastos Financieros", isAutomatic: false, icon: "💰", description: "Comisiones a vendedores o intermediarios" },

  // ── Costos directos (auto-generados) ─────────────────────────────────────
  { key: "cogs",                  label: "Costo de Ventas (COGS)",  group: "direct_costs", groupLabel: "Costos Directos", isAutomatic: true,  icon: "📦", description: "Costo de adquisición de productos vendidos — generado automáticamente" },
  { key: "repair_cost",           label: "Costo de Reparación",     group: "direct_costs", groupLabel: "Costos Directos", isAutomatic: true,  icon: "🔩", description: "Costo de reparaciones — generado automáticamente" },
  { key: "warranty_repair_cost",  label: "Garantía — Reparación",   group: "direct_costs", groupLabel: "Costos Directos", isAutomatic: true,  icon: "🛠️", description: "Costo de reparación por garantía — generado automáticamente" },
  { key: "warranty_replacement_cost", label: "Garantía — Reposición", group: "direct_costs", groupLabel: "Costos Directos", isAutomatic: true, icon: "🔄", description: "Costo de reposición por garantía — generado automáticamente" },

  // ── Otros ─────────────────────────────────────────────────────────────────
  { key: "other",                 label: "Otros Gastos",            group: "other", groupLabel: "Otros", isAutomatic: false, icon: "📎", description: "Gastos no clasificados" },
];

/** Mapa rápido key → meta */
export const EXPENSE_CATEGORY_MAP = new Map<ExpenseCategoryKey, ExpenseCategoryMeta>(
  EXPENSE_CATEGORIES.map((c) => [c.key, c])
);

/** Solo las categorías editables manualmente (excluye las automáticas) */
export const MANUAL_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => !c.isAutomatic);

/** Todas las claves como array (para validación Zod) */
export const ALL_CATEGORY_KEYS = EXPENSE_CATEGORIES.map((c) => c.key) as [ExpenseCategoryKey, ...ExpenseCategoryKey[]];
export const MANUAL_CATEGORY_KEYS = MANUAL_EXPENSE_CATEGORIES.map((c) => c.key) as [ExpenseCategoryKey, ...ExpenseCategoryKey[]];

/** Etiqueta legible para una categoría */
export function getCategoryLabel(key: string): string {
  return EXPENSE_CATEGORY_MAP.get(key as ExpenseCategoryKey)?.label ?? key;
}

/** Grupo de una categoría */
export function getCategoryGroup(key: string): string {
  return EXPENSE_CATEGORY_MAP.get(key as ExpenseCategoryKey)?.groupLabel ?? "Otros";
}

/** Categorías agrupadas para UI (select con optgroups) */
export function getCategoriesByGroup(): Record<string, ExpenseCategoryMeta[]> {
  const groups: Record<string, ExpenseCategoryMeta[]> = {};
  for (const cat of EXPENSE_CATEGORIES) {
    if (!groups[cat.groupLabel]) groups[cat.groupLabel] = [];
    groups[cat.groupLabel].push(cat);
  }
  return groups;
}
