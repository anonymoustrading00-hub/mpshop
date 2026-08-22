import { useState, useMemo, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { useProductionControl, type KefirCatalogProduct } from "@/lib/productionControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Beaker,
  Edit2,
  FlaskConical,
  Link2,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductionType = "kefir" | "kefir_agua" | "queso_directo" | "queso_indirecto" | "suero";
type UnitKey = "ml" | "g" | "l" | "kg" | "unidad";

interface FormState {
  name: string;
  type: ProductionType;
  flavor: string;
  sellPrice: string;
  presentationValue: string;
  unit: UnitKey;
  envase: string;
  tapa: string;
  etiqueta: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "kefir",
  flavor: "Natural",
  sellPrice: "",
  presentationValue: "",
  unit: "ml",
  envase: "",
  tapa: "",
  etiqueta: "",
  notes: "",
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: ProductionType; label: string; badge: string; color: string }[] = [
  { value: "kefir", label: "Kéfir de Leche", badge: "Kéfir de Leche", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "kefir_agua", label: "Kéfir de Agua", badge: "Kéfir de Agua", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { value: "queso_directo", label: "Queso (desde leche)", badge: "Queso", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "queso_indirecto", label: "Queso (desde kéfir)", badge: "Queso Ind.", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "suero", label: "Suero", badge: "Suero", color: "bg-green-100 text-green-700 border-green-200" },
];

const UNIT_OPTIONS: { value: UnitKey; label: string }[] = [
  { value: "ml", label: "ml (Mililitros)" },
  { value: "l", label: "L (Litros)" },
  { value: "g", label: "g (Gramos)" },
  { value: "kg", label: "kg (Kilogramos)" },
  { value: "unidad", label: "Unidad" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function typeInfo(type: ProductionType | "suero") {
  return TYPE_OPTIONS.find((o) => o.value === type) ?? TYPE_OPTIONS[0];
}

function nextCode(products: KefirCatalogProduct[]): string {
  const nums = products
    .map((p) => parseInt(String(p.code || "").replace("PROD-", ""), 10))
    .filter(Number.isFinite);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `PROD-${String(max + 1).padStart(3, "0")}`;
}

function presentationLabel(p: KefirCatalogProduct) {
  if (p.presentationMl > 0) return `${p.presentationMl} ml`;
  if (p.presentationGr > 0) return `${p.presentationGr} g`;
  return "—";
}

// ─── Modal de registro ────────────────────────────────────────────────────────

function ProductModal({
  editing,
  products,
  packagingItems,
  onSave,
  onClose,
}: {
  editing: KefirCatalogProduct | null;
  products: KefirCatalogProduct[];
  packagingItems: { id: number; name: string; role: string }[];
  onSave: (form: FormState, editId?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          name: editing.name,
          type: editing.type as ProductionType,
          flavor: editing.flavor,
          sellPrice: String(editing.sellPrice),
          presentationValue: String(editing.presentationMl || editing.presentationGr || ""),
          unit: editing.presentationMl > 0 ? "ml" : editing.presentationGr > 0 ? "g" : "unidad",
          envase: editing.envase,
          tapa: "",
          etiqueta: "",
          notes: editing.notes,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  const envases = packagingItems.filter((i) => i.role === "bottle" || i.role === "packaging");
  const tapas = packagingItems.filter((i) => i.role === "cap");
  const etiquetas = packagingItems.filter((i) => i.role === "label");

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Ingresa el nombre del producto");
      return;
    }
    setSaving(true);
    try {
      await onSave(form, editing?.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold text-foreground">
            {editing ? "Editar Producto Elaborado" : "Registrar Nuevo Producto Elaborado"}
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Info banner */}
        <div className="mx-6 mb-5 flex items-center gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
          <FlaskConical className="h-4 w-4 shrink-0" />
          <span>Define la presentación y asocia los materiales de empaque</span>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
          {/* Nombre + Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Nombre del Producto
              </Label>
              <Input
                placeholder="Ej. Kéfir Frutilla 500ml"
                value={form.name}
                onChange={set("name")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Tipo de Producto
              </Label>
              <select
                value={form.type}
                onChange={set("type")}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sabor + Precio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Sabor / Variedad
              </Label>
              <Input
                placeholder="Natural"
                value={form.flavor}
                onChange={set("flavor")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Precio de Venta (Bs.)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-600">Bs.</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-10"
                  value={form.sellPrice}
                  onChange={set("sellPrice")}
                />
              </div>
            </div>
          </div>

          {/* Volumen + Unidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Volumen / Peso
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej. 500"
                value={form.presentationValue}
                onChange={set("presentationValue")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Unidad de Medida
              </Label>
              <select
                value={form.unit}
                onChange={set("unit")}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {UNIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vinculación de materiales */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="h-4 w-4 text-blue-600" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-blue-600">
                Vinculación de Materiales de Envasado
              </span>
            </div>

            {/* Envase principal */}
            <div className="space-y-1.5 mb-4">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Suministro Principal / Contenedor *
              </Label>
              <select
                value={form.envase}
                onChange={set("envase")}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Selecciona el Envase —</option>
                {envases.map((e) => (
                  <option key={e.id} value={String(e.id)}>{e.name}</option>
                ))}
              </select>
            </div>

            {/* Tapa + Etiqueta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Tapa Vinculada (Opcional)
                </Label>
                <select
                  value={form.tapa}
                  onChange={set("tapa")}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Sin Tapa —</option>
                  {tapas.map((e) => (
                    <option key={e.id} value={String(e.id)}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Etiqueta Vinculada (Opcional)
                </Label>
                <select
                  value={form.etiqueta}
                  onChange={set("etiqueta")}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Sin Etiqueta —</option>
                  {etiquetas.map((e) => (
                    <option key={e.id} value={String(e.id)}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Registrando…" : editing ? "Guardar Cambios" : "Registrar en Catálogo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tarjeta de producto ───────────────────────────────────────────────────────

function ProductCard({
  product,
  packagingItems,
  onEdit,
  onDelete,
}: {
  product: KefirCatalogProduct;
  packagingItems: { id: number; name: string; role: string }[];
  onEdit: (p: KefirCatalogProduct) => void;
  onDelete: (id: string) => void;
}) {
  const info = typeInfo(product.type as ProductionType);
  const envaseName = product.envase
    ? packagingItems.find((i) => String(i.id) === product.envase)?.name ?? "No asignado"
    : "No asignado";
  const isAssigned = !!product.envase;

  return (
    <div className="rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      {/* Header strip */}
      <div className={`h-1 w-full ${info.color.includes("blue") ? "bg-blue-500" : info.color.includes("cyan") ? "bg-cyan-500" : info.color.includes("yellow") ? "bg-yellow-500" : info.color.includes("orange") ? "bg-orange-500" : "bg-green-500"}`} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Code + badge */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-mono font-bold text-muted-foreground">{product.code}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${info.color}`}>
            {info.badge}
          </span>
        </div>

        {/* Icon + Name */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Beaker className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-snug">{product.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Sabor: <span className="font-medium">{product.flavor || "—"}</span>
              {" | "}
              Presentación: <span className="font-medium">{presentationLabel(product)}</span>
            </p>
          </div>
        </div>

        {/* Envase */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <PackagePlus className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Envase:</span>
          <span className={`font-semibold ${isAssigned ? "text-foreground" : "text-red-500"}`}>
            {envaseName}
          </span>
        </div>

        {/* Price + actions */}
        <div className="flex items-center justify-between pt-1 border-t mt-auto">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Precio de venta</p>
            <p className="text-lg font-bold text-foreground">
              Bs. {Number(product.sellPrice || 0).toFixed(2)}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => onEdit(product)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-background hover:bg-muted transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Editar
            </button>
            <button
              onClick={() => onDelete(product.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Módulo principal ──────────────────────────────────────────────────────────

export default function ProductionProducts() {
  const control = useProductionControl();
  const products = control.customProducts ?? [];

  // tRPC para inventario general
  const { data: rawProducts, refetch: refetchProducts } = (trpc.inventory as any).listProducts.useQuery();
  const createProductMutation = (trpc.inventory as any).createProduct.useMutation();

  // Packaging items (envases, tapas, etiquetas) from general inventory
  const packagingItems = useMemo(() => {
    if (!rawProducts) return [];
    return (rawProducts as any[])
      .filter((p: any) =>
        p.productionRole === "bottle" ||
        p.productionRole === "cap" ||
        p.productionRole === "label" ||
        p.productionRole === "packaging" ||
        p.category === "supplies"
      )
      .map((p: any) => ({ id: p.id, name: p.name, role: p.productionRole || "packaging" }));
  }, [rawProducts]);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<KefirCatalogProduct | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // KPIs
  const types = useMemo(() => new Set(products.map((p) => p.type)), [products]);
  const prices = products.map((p) => p.sellPrice).filter((v) => v > 0);
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const minPrice = prices.length ? Math.min(...prices) : 0;

  // Filtered
  const filtered = useMemo(() => {
    let list = products;
    if (filterType !== "all") list = list.filter((p) => p.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.flavor.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, filterType, search]);

  const openCreate = () => { setEditingProduct(null); setShowModal(true); };
  const openEdit = (p: KefirCatalogProduct) => { setEditingProduct(p); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingProduct(null); };

  const handleDelete = (id: string) => {
    if (!window.confirm("¿Eliminar este producto del catálogo?")) return;
    control.deleteProduct(id);
    toast.success("Producto eliminado");
  };

  const handleSave = async (form: FormState, editId?: string) => {
    const presentationNum = parseFloat(form.presentationValue) || 0;
    const presentationMl = form.unit === "ml" ? presentationNum : form.unit === "l" ? presentationNum * 1000 : 0;
    const presentationGr = form.unit === "g" ? presentationNum : form.unit === "kg" ? presentationNum * 1000 : 0;
    const sellPrice = parseFloat(form.sellPrice) || 0;

    if (editId) {
      // Solo actualizar localmente
      control.updateProduct(editId, {
        name: form.name,
        type: form.type,
        flavor: form.flavor,
        sellPrice,
        presentationMl,
        presentationGr,
        envase: form.envase,
        notes: form.notes,
      });
      toast.success(`"${form.name}" actualizado en el catálogo`);
      closeModal();
      return;
    }

    // Crear: guardar local + registrar en inventario general
    const newCode = nextCode(products);
    const presentationUnit = form.unit === "ml" || form.unit === "l" ? "ml" : form.unit === "g" || form.unit === "kg" ? "g" : "unidad";

    // 1. Registrar en el inventario general del programa
    try {
      await createProductMutation.mutateAsync({
        code: newCode,
        name: form.name,
        category: "finished_product",
        price: 0,
        salePrice: sellPrice,
        wholesalePrice: sellPrice,
        discountPrice: sellPrice,
        status: "active",
        unit: "unidad",
        presentationQuantity: 1,
        presentationUnit,
        presentationVolumeMl: presentationMl,
        presentationWeightGr: presentationGr,
        productionRole: "finished_good",
        storageLocation: "Producción",
        supplierName: "Producción KéfirControl",
        productionNotes: `Tipo: ${form.type} | Sabor: ${form.flavor}${form.notes ? ` | ${form.notes}` : ""}`,
      });
      await refetchProducts();
      toast.success(`"${form.name}" registrado en el Inventario General ✓`);
    } catch (err: any) {
      // Si falla la sincronización (sin DB), igual guardamos localmente
      console.warn("No se pudo sincronizar con inventario general:", err?.message);
      toast.warning("Guardado en catálogo local (sin conexión a DB)");
    }

    // 2. Guardar en catálogo local de producción
    control.addProduct({
      name: form.name,
      type: form.type,
      flavor: form.flavor,
      sellPrice,
      presentationMl,
      presentationGr,
      envase: form.envase,
      notes: form.notes,
    });

    closeModal();
  };

  return (
    <div className="p-4 space-y-5 md:p-6 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Catálogo Maestro de Productos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define presentaciones, sabores, precios y envases de toda tu línea de producción
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shrink-0">
          <Plus className="h-4 w-4" />
          Registrar Producto
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total SKUs", value: products.length, className: "text-foreground" },
          { label: "Tipos", value: types.size, className: "text-foreground" },
          { label: "Precio Máx", value: `Bs. ${maxPrice.toFixed(2)}`, className: "text-yellow-600" },
          { label: "Precio Mín", value: `Bs. ${minPrice.toFixed(2)}`, className: "text-blue-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.className}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, sabor o ID..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[160px]"
        >
          <option value="all">Todos los Tipos</option>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              packagingItems={packagingItems}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <FlaskConical className="h-12 w-12 opacity-20" />
          <p className="text-sm">
            {search || filterType !== "all"
              ? "No se encontraron productos con ese filtro"
              : "No hay productos registrados. Haz clic en + Registrar Producto"}
          </p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ProductModal
          editing={editingProduct}
          products={products}
          packagingItems={packagingItems}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
