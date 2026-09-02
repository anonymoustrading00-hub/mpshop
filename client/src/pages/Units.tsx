import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Laptop, HardDrive, QrCode, Search, Wrench, Shield, ArrowRightLeft, Plus, Cpu, Battery,
  Activity, ShoppingBag, ShoppingCart, CheckCircle, Package, Printer, Pencil, Trash2, X, BookOpen, Video,
  ExternalLink, Play, FileText, Sparkles, Camera, ImagePlus,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Boxes, Layers, Table, Grid, List
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBranch } from "@/contexts/BranchContext";
import { UnitKardex } from "@/components/UnitKardex";
import { CommercialCatalogModal } from "@/components/CommercialCatalogModal";
import { CommercialSheetModal } from "@/components/CommercialSheetModal";
import { WorkOrderModal } from "@/components/WorkOrderModal";
import { DisplayCardsModal } from "@/components/DisplayCardsModal";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  in_diagnosis: { label: "En Diagnóstico", color: "text-amber-700", bg: "bg-amber-100 border-amber-300", icon: Activity },
  in_repair:    { label: "En Taller",       color: "text-red-700",   bg: "bg-red-100 border-red-300",    icon: Wrench },
  available:    { label: "Disponible / Venta", color: "text-green-700", bg: "bg-green-100 border-green-300", icon: ShoppingBag },
  sold:         { label: "Vendida",         color: "text-slate-500", bg: "bg-slate-100 border-slate-300", icon: CheckCircle },
  returned:     { label: "Devuelta (RMA)",  color: "text-purple-700",bg: "bg-purple-100 border-purple-300",icon: Package },
};

const CHECKLIST_BY_TYPE: Record<string, Record<string, string>> = {
  laptop: {
    keyboard: "Teclado dañado",
    screen: "Pantalla rayada/mancha",
    hinges: "Bisagras flojas",
    trackpad: "Trackpad defectuoso",
    cosmetic: "Rayones carcasa",
    other: "Otros detalles",
  },
  tablet: {
    screen: "Pantalla rota/raya",
    touch: "Touch no responde",
    speakers: "Audio defectuoso",
    chargingPort: "Puerto de carga dañado",
    buttons: "Botones físicos",
    cosmetic: "Rayones carcasa",
    other: "Otros detalles",
  },
  phone: {
    screen: "Pantalla rota/raya",
    camera: "Cámara defectuosa",
    speakers: "Audio/mic defectuoso",
    chargingPort: "Puerto de carga dañado",
    battery: "Batería inflada",
    cosmetic: "Rayones carcasa",
    other: "Otros detalles",
  },
  monitor: {
    screen: "Pantalla rota/mancha/pixel muerto",
    stand: "Base/pie dañado",
    ports: "Puertos HDMI/VGA/DP",
    power: "Fuente de poder",
    cables: "Cables incluidos",
    other: "Otros detalles",
  },
  charger: {
    cable: "Cable cortado/dañado",
    connector: "Conector dañado",
    wattage: "No carga (wataje)",
    other: "Otros detalles",
  },
  accessory: {
    cosmetic: "Detalles estéticos",
    functional: "No funciona correctamente",
    packaging: "Sin empaque original",
    other: "Otros detalles",
  },
  other: {
    cosmetic: "Detalles estéticos",
    functional: "No funciona correctamente",
    other: "Otros detalles",
  },
};

const BATTERY_HEALTH_LABELS: Record<string, string> = {
  "100": "100%",
  "90": "90%",
  "80": "80%",
  "70": "70%",
  "60": "60%",
  "50": "50%",
  "40": "40%",
  plugged_only: "Solo conectada",
  bad_plugged_only: "Solo conectada",
  good: "100%",
  fair: "70%",
  n_a: "N/A",
};

function formatBatteryHealth(val?: string | null): string {
  if (!val || val === "n_a") return "N/D";
  if (BATTERY_HEALTH_LABELS[val]) return BATTERY_HEALTH_LABELS[val];
  if (/^\d+$/.test(val)) return `${val}%`;
  return val;
}

/* ─── Interactive Status Selector ────────────────────────────────── */
function UnitStatusSelect({
  currentStatus,
  onStatusChange,
  disabled = false
}: {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  disabled?: boolean;
}) {
  const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.in_diagnosis;
  const Icon = cfg.icon;

  const handleSelect = (val: string) => {
    if (val === "sold") {
      toast.info("ℹ️ El estado 'Vendida' se asigna automáticamente al realizar una venta en el Módulo de Ventas.");
      return;
    }
    if (val === "returned") {
      toast.info("ℹ️ El estado 'Devuelta (RMA)' se asigna al procesar una devolución en el Módulo de Devoluciones.");
      return;
    }
    if (val !== currentStatus) {
      onStatusChange(val);
    }
  };

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <Select value={currentStatus} onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger className={`h-8 text-xs font-bold border ${cfg.bg} ${cfg.color} rounded-full px-3 py-1 shadow-sm gap-1.5 focus:ring-1`}>
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <SelectValue placeholder={cfg.label}>{cfg.label}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" className="w-60 font-sans z-50">
          <SelectItem value="in_diagnosis" className="cursor-pointer">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-amber-600" />
              <span>En Diagnóstico</span>
            </div>
          </SelectItem>

          <SelectItem value="in_repair" className="cursor-pointer">
            <div className="flex items-center gap-2 font-bold text-red-600">
              <Wrench className="h-3.5 w-3.5" />
              <span>En Taller (Traspaso)</span>
            </div>
          </SelectItem>

          <SelectItem value="available" className="cursor-pointer">
            <div className="flex items-center gap-2 text-green-700 font-bold">
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              <span>{currentStatus === "in_repair" ? "✅ Ya Reparada (Para Venta)" : "Disponible / Para Venta"}</span>
            </div>
          </SelectItem>

          <SelectItem value="sold" className="opacity-60 cursor-not-allowed bg-slate-50">
            <div className="flex flex-col text-slate-500 text-[11px]">
              <span className="font-semibold flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> Vendida</span>
              <span className="text-[9px] text-slate-400">Auto en Módulo Ventas</span>
            </div>
          </SelectItem>

          <SelectItem value="returned" className="opacity-60 cursor-not-allowed bg-slate-50">
            <div className="flex flex-col text-purple-700 text-[11px]">
              <span className="font-semibold flex items-center gap-1.5"><Package className="h-3 w-3" /> Devuelta (RMA)</span>
              <span className="text-[9px] text-slate-400">Auto en Devoluciones</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export default function Units() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scanInput, setScanInput] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  // ── Edit Unit Modal State ──
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<any>(null);

  // ── Kardex Modal State ──
  const [kardexUnitId, setKardexUnitId] = useState<number | null>(null);
  const [isKardexOpen, setIsKardexOpen] = useState(false);

  // ── Paginación, vista y modo ──────────────────────────────────────────────
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState<number>(24);
  const [viewMode, setViewMode]   = useState<"grid" | "table" | "grouped">("table");
  // Resetear página cuando cambian filtros
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleTypeChange   = (v: string) => { setTypeFilter(v); setPage(1); };
  const handleStatusChange = (v: string) => { setStatusFilter(v); setPage(1); };
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editCondition, setEditCondition] = useState("8");
  const [editBatteryHealth, setEditBatteryHealth] = useState<string>("n_a");
  const [editDamageNotes, setEditDamageNotes] = useState("");
  const [editDamageChecklist, setEditDamageChecklist] = useState<Record<string, boolean>>({
    keyboard: false, screen: false, hinges: false, trackpad: false, cosmetic: false, other: false,
  });
  const [editSpecs, setEditSpecs] = useState<Array<{ key: string; value: string }>>([]);
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editDiscountPrice, setEditDiscountPrice] = useState("");
  const [editWholesalePrice, setEditWholesalePrice] = useState("");
  const [editSupplierId, setEditSupplierId] = useState<number | undefined>();
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editTiktokUrl, setEditTiktokUrl] = useState("");

  // Fotos del equipo en edición (base64)
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const editPhotoFileInputRef = useRef<HTMLInputElement>(null);
  const editPhotoCameraInputRef = useRef<HTMLInputElement>(null);

function compressImage(base64: string, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxWidth || h > maxWidth) {
        if (w > h) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        } else {
          w = Math.round((w * maxWidth) / h);
          h = maxWidth;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

  const handleEditPhotoFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const remaining = 8 - editPhotos.length;
    const toProcess = Math.min(files.length, remaining);
    if (toProcess === 0) {
      toast.warning("Máximo 8 fotos por equipo");
      return;
    }
    let processed = 0;
    for (let i = 0; i < toProcess; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const rawResult = ev.target?.result as string;
        if (rawResult) {
          const compressed = await compressImage(rawResult);
          setEditPhotos((prev) => {
            if (prev.length >= 8) return prev;
            return [...prev, compressed];
          });
        }
      };
      reader.readAsDataURL(file);
      processed++;
    }
    if (processed > 0) toast.success(`${processed} foto${processed > 1 ? "s" : ""} agregada${processed > 1 ? "s" : ""}`);
  }, [editPhotos.length]);

  const removeEditPhoto = (idx: number) => {
    setEditPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Estados para Catálogo Comercial (3 productos x pág) y Ficha Comercial
  const [isCommercialCatalogOpen, setIsCommercialCatalogOpen] = useState(false);
  const [commercialSheetUnitId, setCommercialSheetUnitId] = useState<number | null>(null);
  const [isCommercialSheetOpen, setIsCommercialSheetOpen] = useState(false);

  // Estados para Fichas de Exhibición (80x70mm y Carta 8 por hoja)
  const [isDisplayCardsOpen, setIsDisplayCardsOpen] = useState(false);
  const [displayCardsUnitId, setDisplayCardsUnitId] = useState<number | null>(null);
  const [displayCardsUnit, setDisplayCardsUnit] = useState<any | null>(null);


  // Estados para Modal e Ingreso a Taller
  const [workshopUnit, setWorkshopUnit] = useState<any>(null);
  const [isWorkshopModalOpen, setIsWorkshopModalOpen] = useState(false);
  const [workshopReason, setWorkshopReason] = useState("");
  const [workshopTechnician, setWorkshopTechnician] = useState("");
  const [workshopAccessories, setWorkshopAccessories] = useState<Record<string, boolean>>({
    charger: true,
    bag: false,
    mouse: false,
    box: false,
  });
  const [workshopNotes, setWorkshopNotes] = useState("");

  // Estados para Orden de Trabajo (OT) generada al ingresar a taller
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderRepairId, setWorkOrderRepairId] = useState<number | null>(null);
  const [workOrderUnitId, setWorkOrderUnitId] = useState<number | null>(null);

  // Estados para Modal "Marcar como Ya Reparada"
  const [isCompleteRepairOpen, setIsCompleteRepairOpen] = useState(false);
  const [completingUnit, setCompletingUnit] = useState<any>(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeLaborCost, setCompleteLaborCost] = useState("");
  const [completePartsCost, setCompletePartsCost] = useState("");

  const { data: unitsData, isLoading, refetch } = trpc.units.list.useQuery({
    search: search || undefined,
    type: typeFilter !== "all" ? (typeFilter as any) : undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    branchId: activeBranchId || undefined,
    limit: 500,
    offset: 0,
  });

  const [expandedArticleKey, setExpandedArticleKey] = useState<string | null>(null);

  // ── Agrupación de artículos por Producto / Barcode + Sucursal (formato exacto de inventario) ──
  const tableArticles = useMemo(() => {
    if (!unitsData?.items) return [];

    const map = new Map<string, {
      key: string;
      description: string;
      displayCode: string;
      barcode: string;
      model: string;
      supplierCode: string;
      brand: string;
      unitMeasure: string;
      quantity: number;
      wholesalePrice: number;
      salePrice: number;
      purchasePrice: number;
      locationName: string;
      supplierName: string;
      units: any[];
      firstUnit: any;
    }>();

    for (const u of (unitsData.items as any[])) {
      const specs = u.specs || {};
      const rawBarcode = specs.barcode || u.code || "";
      const barcodeClean = rawBarcode.includes("-") && rawBarcode.length > 8 && !rawBarcode.startsWith("LT-")
        ? rawBarcode.split("-")[0]
        : rawBarcode;

      const brandClean = (u.brand || "").trim() || "SIN MARCA";
      const modelClean = (u.model || "").trim() || "-";
      const branchId = u.branchId || 1;
      const key = `${barcodeClean}___${brandClean.toLowerCase()}___${modelClean.toLowerCase()}___${branchId}`;

      if (!map.has(key)) {
        const desc = specs.description || `${brandClean} ${modelClean}`.trim();
        const cod = String(u.id).padStart(5, "0");
        const codProv = specs.supplierCode || specs.codProv || (u.serialNumber ? u.serialNumber.split("-")[0] : "-");
        const unitMeasure = specs.unit || (u.type === "laptop" || u.type === "phone" ? "UNIDAD" : "PZA");
        const loc = u.branchName || "Sucursal Principal";
        const sup = u.supplierName || "SIN NOMBRE";

        map.set(key, {
          key,
          description: desc,
          displayCode: cod,
          barcode: barcodeClean || "-",
          model: modelClean,
          supplierCode: codProv,
          brand: brandClean,
          unitMeasure,
          quantity: 0,
          wholesalePrice: u.wholesalePrice || 0,
          salePrice: u.salePrice || 0,
          purchasePrice: u.purchasePrice || 0,
          locationName: loc,
          supplierName: sup,
          units: [],
          firstUnit: u,
        });
      }

      const row = map.get(key)!;
      row.units.push(u);
      if (u.status !== "sold") {
        row.quantity += 1;
      }
    }

    return Array.from(map.values());
  }, [unitsData?.items]);

  const { data: suppliersData } = trpc.suppliers.list.useQuery();

  const changeStatusMutation = trpc.units.changeStatus.useMutation({
    onSuccess: () => {
      toast.success("✅ Estado de unidad actualizado");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateUnitMutation = trpc.units.update.useMutation({
    onSuccess: () => {
      toast.success("✅ Unidad actualizada correctamente");
      setIsEditOpen(false);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Estado para modal de eliminación en lote / selección de unidades
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [targetArticleForDelete, setTargetArticleForDelete] = useState<any>(null);
  const [selectedUnitIdsToDelete, setSelectedUnitIdsToDelete] = useState<number[]>([]);
  const [deleteMode, setDeleteMode] = useState<"all" | "quantity" | "custom">("all");
  const [customQtyToDelete, setCustomQtyToDelete] = useState<number>(1);
  const [expandedSelectedIds, setExpandedSelectedIds] = useState<Record<string, number[]>>({});

  const deleteUnitMutation = (trpc.units as any).delete?.useMutation({
    onSuccess: () => {
      toast.success("✅ Unidad eliminada correctamente");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteBatchMutation = (trpc.units as any).deleteBatch?.useMutation({
    onSuccess: (res: any) => {
      toast.success(`✅ ${res?.count || "Las"} unidades fueron eliminadas correctamente`);
      setIsBatchDeleteOpen(false);
      setTargetArticleForDelete(null);
      setSelectedUnitIdsToDelete([]);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleOpenDeleteArticle = (item: any) => {
    setTargetArticleForDelete(item);
    setSelectedUnitIdsToDelete(item.units.map((u: any) => u.id));
    setDeleteMode("all");
    setCustomQtyToDelete(item.units.length > 1 ? Math.min(10, item.units.length) : 1);
    setIsBatchDeleteOpen(true);
  };

  const handleToggleUnitSelection = (unitId: number) => {
    setSelectedUnitIdsToDelete((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  const handleSelectAllInModal = () => {
    if (!targetArticleForDelete) return;
    setSelectedUnitIdsToDelete(targetArticleForDelete.units.map((u: any) => u.id));
  };

  const handleDeselectAllInModal = () => {
    setSelectedUnitIdsToDelete([]);
  };

  const handleConfirmBatchDelete = () => {
    if (!targetArticleForDelete) return;

    let idsToDelete: number[] = [];
    if (deleteMode === "all") {
      idsToDelete = targetArticleForDelete.units.map((u: any) => u.id);
    } else if (deleteMode === "quantity") {
      const qty = Math.max(1, Math.min(customQtyToDelete, targetArticleForDelete.units.length));
      idsToDelete = targetArticleForDelete.units.slice(0, qty).map((u: any) => u.id);
    } else if (deleteMode === "custom") {
      idsToDelete = selectedUnitIdsToDelete;
    }

    if (idsToDelete.length === 0) {
      toast.error("Selecciona al menos una unidad para eliminar");
      return;
    }

    deleteBatchMutation.mutate({ ids: idsToDelete });
  };

  const toggleExpandedUnit = (articleKey: string, unitId: number) => {
    setExpandedSelectedIds((prev) => {
      const current = prev[articleKey] || [];
      const updated = current.includes(unitId)
        ? current.filter((id) => id !== unitId)
        : [...current, unitId];
      return { ...prev, [articleKey]: updated };
    });
  };

  const selectAllExpanded = (articleKey: string, allUnits: any[]) => {
    setExpandedSelectedIds((prev) => ({
      ...prev,
      [articleKey]: allUnits.map((u) => u.id),
    }));
  };

  const deselectAllExpanded = (articleKey: string) => {
    setExpandedSelectedIds((prev) => ({
      ...prev,
      [articleKey]: [],
    }));
  };

  const handleDeleteSelectedFromExpanded = (articleKey: string) => {
    const selected = expandedSelectedIds[articleKey] || [];
    if (selected.length === 0) {
      toast.error("No has seleccionado ninguna serie para eliminar.");
      return;
    }
    if (window.confirm(`¿Eliminar las ${selected.length} series seleccionadas? Esta acción no se puede deshacer.`)) {
      deleteBatchMutation.mutate({ ids: selected });
      deselectAllExpanded(articleKey);
    }
  };

  const createRepairMutation = trpc.repairs.create.useMutation({
    onSuccess: (res: any) => {
      refetch();
      if (res?.repairId) {
        setWorkOrderRepairId(res.repairId);
      }
      setWorkOrderModalOpen(true);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateRepairMutation = trpc.repairs.update.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    // Al escanear un código → buscar la unidad y abrir su Kardex directamente
    const code = scanInput.trim();
    setScanInput("");

    // Buscar en la lista ya cargada
    const items = (unitsData?.items as any[]) || [];
    const found = items.find((u: any) =>
      u.code?.toLowerCase() === code.toLowerCase() ||
      String(u.rmaNumber || "").toLowerCase() === code.toLowerCase()
    );
    if (found) {
      setKardexUnitId(found.id);
      setIsKardexOpen(true);
    } else {
      // Si no está en la lista, hacer búsqueda por texto como fallback
      handleSearchChange(code);
      toast.info(`Buscando: ${code}`);
    }
  };

  const handleOpenEdit = (unit: any) => {
    setEditUnit(unit);
    setEditBrand(unit.brand || "");
    setEditModel(unit.model || "");
    setEditCondition(String(unit.condition || 8));
    setEditBatteryHealth(unit.batteryHealth || "n_a");
    setEditDamageNotes(unit.damageNotes || "");
    const checklist = typeof unit.damageChecklist === "string"
      ? JSON.parse(unit.damageChecklist)
      : (unit.damageChecklist || {});
    
    const type = unit.type || "laptop";
    const typeChecklistDefs = CHECKLIST_BY_TYPE[type] || CHECKLIST_BY_TYPE.laptop;
    const initialChecklist: Record<string, boolean> = {};
    Object.keys(typeChecklistDefs).forEach((k) => {
      initialChecklist[k] = !!checklist[k];
    });
    Object.keys(checklist).forEach((k) => {
      if (checklist[k]) initialChecklist[k] = true;
    });
    setEditDamageChecklist(initialChecklist);

    const specs = typeof unit.specs === "string" ? JSON.parse(unit.specs) : (unit.specs || {});
    setEditSpecs(Object.entries(specs).map(([key, value]) => ({ key, value: String(value) })));
    setEditSalePrice(unit.salePrice ? String(unit.salePrice / 100) : "");
    setEditDiscountPrice(unit.discountPrice ? String(unit.discountPrice / 100) : "");
    setEditWholesalePrice(unit.wholesalePrice ? String(unit.wholesalePrice / 100) : "");
    setEditSupplierId(unit.supplierId || undefined);
    setEditPurchaseDate(unit.purchaseDate || "");
    setEditTiktokUrl(unit.tiktokUrl || "");

    // Cargar fotos existentes del equipo
    let existingPhotos: string[] = [];
    if (unit.photos) {
      try {
        existingPhotos = typeof unit.photos === "string" ? JSON.parse(unit.photos) : unit.photos;
        if (!Array.isArray(existingPhotos)) existingPhotos = [unit.photos];
      } catch {
        existingPhotos = [unit.photos];
      }
    }
    setEditPhotos(existingPhotos.filter(Boolean));
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editUnit) return;
    const specsObj: Record<string, string> = {};
    editSpecs.forEach(({ key, value }) => {
      if (key.trim()) specsObj[key.trim()] = value.trim();
    });
    updateUnitMutation.mutate({
      id: editUnit.id,
      brand: editBrand,
      model: editModel,
      condition: parseInt(editCondition) || 8,
      batteryHealth: editBatteryHealth as any,
      damageNotes: editDamageNotes,
      damageChecklist: editDamageChecklist,
      specs: specsObj,
      salePrice: editSalePrice ? Math.round(parseFloat(editSalePrice) * 100) : undefined,
      discountPrice: editDiscountPrice ? Math.round(parseFloat(editDiscountPrice) * 100) : undefined,
      wholesalePrice: editWholesalePrice ? Math.round(parseFloat(editWholesalePrice) * 100) : undefined,
      supplierId: editSupplierId || undefined,
      purchaseDate: editPurchaseDate || undefined,
      tiktokUrl: editTiktokUrl.trim() || undefined,
      photos: JSON.stringify(editPhotos),
    });
  };

  const handleOpenCompleteRepair = (unit: any) => {
    setCompletingUnit(unit);
    setCompleteNotes("");
    setCompleteLaborCost("");
    setCompletePartsCost("");
    setIsCompleteRepairOpen(true);
  };

  const handleConfirmCompleteRepair = () => {
    if (!completingUnit) return;
    const laborCents = completeLaborCost ? Math.round(parseFloat(completeLaborCost) * 100) : 0;
    const partsCents = completePartsCost ? Math.round(parseFloat(completePartsCost) * 100) : 0;
    const notesData = `Reparación finalizada — Equipo Listo y Disponible para Venta. ${completeNotes.trim() ? `Notas: ${completeNotes.trim()}` : ""}`;

    changeStatusMutation.mutate({
      unitId: completingUnit.id,
      toStatus: "available",
      notes: notesData,
    });

    setIsCompleteRepairOpen(false);
    toast.success("✅ Equipo marcado como YA REPARADO y retornado a inventario disponible.");
  };

  const handleStatusChangeRequest = (unit: any, newStatus: string) => {
    if (newStatus === "in_repair") {
      setWorkshopUnit(unit);
      setWorkshopReason("");
      setWorkshopNotes("");
      setWorkshopTechnician(user?.name || "");
      setIsWorkshopModalOpen(true);
    } else if (unit.status === "in_repair" && newStatus === "available") {
      handleOpenCompleteRepair(unit);
    } else {
      changeStatusMutation.mutate({ unitId: unit.id, toStatus: newStatus as any });
    }
  };

  const handleApproveWorkshopTransfer = () => {
    if (!workshopReason.trim()) {
      toast.error("Por favor ingresa el motivo o falla reportada para el ingreso a taller");
      return;
    }

    const accessoriesList = Object.entries(workshopAccessories)
      .filter(([_, v]) => v)
      .map(([k]) => k === "charger" ? "Cargador original" : k === "bag" ? "Funda/Bolso" : k === "mouse" ? "Mouse" : "Caja original")
      .join(", ") || "Ninguno";

    const repairNotesData = `Ingreso a Taller - Motivo: ${workshopReason.trim()} | Accesorios: ${accessoriesList} | Notas: ${workshopNotes.trim()}`;

    // 1. Cambiar estado de unidad a in_repair
    changeStatusMutation.mutate({
      unitId: workshopUnit.id,
      toStatus: "in_repair",
      notes: repairNotesData,
    });

    // 2. Crear OT en taller -> abrir WorkOrderModal
    setWorkOrderUnitId(workshopUnit.id);
    setWorkOrderRepairId(null);
    createRepairMutation.mutate({
      unitId: workshopUnit.id,
      notes: `Motivo: ${workshopReason.trim()} | Accesorios: ${accessoriesList}${workshopNotes ? ` | Obs: ${workshopNotes.trim()}` : ""}`,
    });

    setIsWorkshopModalOpen(false);
    toast.success("✅ Traspaso a Taller Aprobado. Generando Orden de Trabajo...");
  };

  return (
    <>
      {/* ═══════════ SCREEN UI ═══════════ */}
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Encabezado y Barra de Escaneo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Laptop className="h-7 w-7 text-primary" />
              Gestión de Unidades y Registro
            </h1>
            <p className="text-sm text-muted-foreground">
              Consulta correlativa y control de estados de Laptops y Accesorios.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => { setDisplayCardsUnitId(null); setIsDisplayCardsOpen(true); }}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-sm"
            >
              <Sparkles className="h-4 w-4" /> Fichas de Exhibición (Vitrina)
            </Button>
            <a href="/purchases">
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">
                <ShoppingCart className="h-4 w-4" /> Compras
              </Button>
            </a>
            <a href="/register-unit">
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700 font-bold shadow-sm">
                <Plus className="h-4 w-4" /> Registrar Unidad
              </Button>
            </a>
            <a href="/generate-codes">
              <Button variant="outline" className="gap-2">
                <QrCode className="h-4 w-4" /> Códigos QR
              </Button>
            </a>
          </div>

        </div>

        {/* Input de Escáner USB omnipresente */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <form onSubmit={handleScanSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={scanInputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Escanear Código QR / Código de Barras físico o escribir 'LT-0001' + Enter..."
                  className="pl-9 bg-background"
                  autoFocus
                />
              </div>
              <Button type="submit">Buscar Escáner</Button>
            </form>
          </CardContent>
        </Card>

        {/* Filtros + Controles de Vista */}
        <div className="space-y-3">
          {/* Fila 1: Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="🔍 Buscar por código, serie, RMA, marca, modelo..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <Select value={typeFilter} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Producto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Tipos</SelectItem>
                <SelectItem value="laptop">Laptop</SelectItem>
                <SelectItem value="tablet">Tablet</SelectItem>
                <SelectItem value="phone">Celular</SelectItem>
                <SelectItem value="monitor">Monitor</SelectItem>
                <SelectItem value="charger">Cargador</SelectItem>
                <SelectItem value="accessory">Accesorio</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Estado de Unidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="in_diagnosis">En Diagnóstico</SelectItem>
                <SelectItem value="in_repair">En Taller</SelectItem>
                <SelectItem value="available">Disponible</SelectItem>
                <SelectItem value="sold">Vendida</SelectItem>
                <SelectItem value="returned">Devuelta (RMA)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fila 2: Modo vista + por página + total */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Selector de modo vista */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
              <button
                onClick={() => { setViewMode("grid"); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "grid" ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title="Tarjetas visuales"
              >
                <Grid className="h-3.5 w-3.5" /> Tarjetas
              </button>
              <button
                onClick={() => { setViewMode("table"); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "table" ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title="Tabla compacta"
              >
                <List className="h-3.5 w-3.5" /> Tabla
              </button>
              <button
                onClick={() => { setViewMode("grouped"); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "grouped" ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title="Agrupado por modelo"
              >
                <Boxes className="h-3.5 w-3.5" /> Agrupado
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Por página (solo en grid y tabla) */}
              {viewMode !== "grouped" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Por página:</span>
                  <div className="flex gap-1">
                    {[24, 48, 96].map(n => (
                      <button
                        key={n}
                        onClick={() => { setPageSize(n); setPage(1); }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${pageSize === n ? "bg-primary text-white border-primary" : "border-muted text-muted-foreground hover:border-primary/50"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Total */}
              {!isLoading && (
                <span className="text-xs font-semibold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
                  {unitsData?.total ?? 0} unidades
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contenido según modo de vista */}
        {isLoading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Cargando inventario...</p>
          </div>
        ) : !unitsData?.items || unitsData.items.length === 0 ? (
          <Card className="text-center p-12">
            <CardContent className="space-y-4">
              <HardDrive className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">No se encontraron unidades</h3>
              <p className="text-sm text-muted-foreground">
                Intenta cambiar los filtros o registra una nueva unidad.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── MODO TABLA (Formato Oficial de Inventario y Stock) ── */}
            {viewMode === "table" && (
              <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-sm bg-white">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-300">
                    <tr className="text-[11px] font-bold text-slate-800 uppercase tracking-wider select-none">
                      <th className="text-left px-3 py-3 border-r border-slate-200">DESCRIPCION</th>
                      <th className="text-center px-2 py-3 border-r border-slate-200">COD.</th>
                      <th className="text-left px-2 py-3 border-r border-slate-200">BARCODE</th>
                      <th className="text-left px-2 py-3 border-r border-slate-200">MODELO</th>
                      <th className="text-left px-2 py-3 border-r border-slate-200">COD. PROV.</th>
                      <th className="text-left px-2 py-3 border-r border-slate-200">MARCA</th>
                      <th className="text-center px-2 py-3 border-r border-slate-200">UNIDAD</th>
                      <th className="text-center px-3 py-3 bg-red-100/90 text-red-900 border-r border-slate-300">CANT.</th>
                      <th className="text-right px-2 py-3 border-r border-slate-200">POR MAYOR</th>
                      <th className="text-right px-2 py-3 border-r border-slate-200">PUBLICO</th>
                      <th className="text-right px-2 py-3 border-r border-slate-200 bg-amber-50 text-amber-900">P. COMPRA</th>
                      <th className="text-left px-2 py-3 border-r border-slate-200">Ubi.</th>
                      <th className="text-left px-3 py-3 border-r border-slate-200">PROVEEDOR HABITUAL</th>
                      <th className="text-right px-2 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-amber-50/10">
                    {tableArticles.map((item: any) => {
                      const isExpanded = expandedArticleKey === item.key;
                      return (
                        <React.Fragment key={item.key}>
                          <tr
                            className="hover:bg-amber-50/70 transition-colors cursor-pointer group"
                            onClick={() => setExpandedArticleKey(isExpanded ? null : item.key)}
                          >
                            <td className="px-3 py-2.5 font-bold text-slate-900 border-r border-slate-200">
                              <div className="flex items-center gap-1.5">
                                <span className="uppercase">{item.description}</span>
                                {item.units.length > 1 && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                                    {item.units.length} series
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-700 border-r border-slate-200">
                              {item.displayCode}
                            </td>
                            <td className="px-2 py-2.5 font-mono text-slate-800 font-bold border-r border-slate-200">
                              {item.barcode !== "-" ? item.barcode : ""}
                            </td>
                            <td className="px-2 py-2.5 text-slate-700 uppercase border-r border-slate-200">
                              {item.model !== "-" ? item.model : ""}
                            </td>
                            <td className="px-2 py-2.5 text-slate-600 font-mono border-r border-slate-200">
                              {item.supplierCode !== "-" ? item.supplierCode : ""}
                            </td>
                            <td className="px-2 py-2.5 text-slate-700 uppercase font-medium border-r border-slate-200">
                              {item.brand !== "SIN MARCA" ? item.brand : ""}
                            </td>
                            <td className="px-2 py-2.5 text-center text-slate-600 uppercase font-bold border-r border-slate-200">
                              {item.unitMeasure}
                            </td>
                            <td className="px-3 py-2.5 text-center font-black bg-red-100/80 text-red-900 border-r border-slate-300 text-sm">
                              {item.quantity}
                            </td>
                            <td className="px-2 py-2.5 text-right font-medium text-slate-700 border-r border-slate-200">
                              {item.wholesalePrice ? (item.wholesalePrice / 100).toFixed(0) : "0"}
                            </td>
                            <td className="px-2 py-2.5 text-right font-bold text-slate-900 border-r border-slate-200">
                              {item.salePrice ? (item.salePrice / 100).toFixed(item.salePrice % 100 === 0 ? 0 : 2) : "0"}
                            </td>
                            <td className="px-2 py-2.5 text-right font-medium text-amber-800 bg-amber-50/50 border-r border-slate-200">
                              {item.purchasePrice ? (item.purchasePrice / 100).toFixed(item.purchasePrice % 100 === 0 ? 0 : 2) : "0"}
                            </td>
                            <td className="px-2 py-2.5 text-slate-700 font-medium border-r border-slate-200">
                              {item.locationName}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 uppercase font-medium border-r border-slate-200">
                              {item.supplierName !== "SIN NOMBRE" ? item.supplierName : "SIN NOMBRE"}
                            </td>
                            <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-purple-700 hover:bg-purple-50"
                                  title="Imprimir Ficha de Exhibición (Vitrina)"
                                  onClick={() => {
                                    setDisplayCardsUnitId(item.firstUnit.id);
                                    setDisplayCardsUnit(item.firstUnit);
                                    setIsDisplayCardsOpen(true);
                                  }}
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                </Button>

                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-100" title="Ver Kardex / Historial" onClick={() => { setKardexUnitId(item.firstUnit.id); setIsKardexOpen(true); }}>
                                  <BookOpen className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-700 hover:bg-blue-50" title="Editar" onClick={() => handleOpenEdit(item.firstUnit)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                                  title="Eliminar unidades"
                                  onClick={() => handleOpenDeleteArticle(item)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* Fila expandible con las unidades / series individuales si tiene varias */}
                          {isExpanded && item.units.length > 0 && (
                            <tr className="bg-slate-50 border-b border-slate-200" onClick={(e) => e.stopPropagation()}>
                              <td colSpan={14} className="p-3">
                                <div className="bg-white rounded-lg border p-3 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                      <Layers className="h-4 w-4 text-blue-600" />
                                      Detalle de Unidades / Series Registradas ({item.units.length}):
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs px-2"
                                        onClick={() => selectAllExpanded(item.key, item.units)}
                                      >
                                        Marcar todos ({item.units.length})
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs px-2"
                                        onClick={() => deselectAllExpanded(item.key)}
                                      >
                                        Desmarcar
                                      </Button>
                                      {(expandedSelectedIds[item.key] || []).length > 0 && (
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="h-7 text-xs px-2.5 gap-1 font-bold"
                                          onClick={() => handleDeleteSelectedFromExpanded(item.key)}
                                          disabled={deleteBatchMutation.isPending}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Eliminar seleccionadas ({(expandedSelectedIds[item.key] || []).length})
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {item.units.map((u: any) => {
                                      const isChecked = (expandedSelectedIds[item.key] || []).includes(u.id);
                                      return (
                                        <div
                                          key={u.id}
                                          className={`flex items-center justify-between p-2 rounded border transition-colors text-xs ${
                                            isChecked ? "bg-red-50/60 border-red-300" : "bg-slate-50/50 border-slate-200"
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <Checkbox
                                              checked={isChecked}
                                              onCheckedChange={() => toggleExpandedUnit(item.key, u.id)}
                                            />
                                            <div>
                                              <span className="font-mono font-bold text-blue-700 mr-1.5">{u.code}</span>
                                              {u.serialNumber && <span className="text-slate-500 font-mono text-[10px]">S/N: {u.serialNumber}</span>}
                                              {u.rmaNumber && <span className="text-emerald-600 font-mono text-[10px] ml-1 font-bold">RMA: {u.rmaNumber}</span>}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <UnitStatusSelect currentStatus={u.status} onStatusChange={(s) => handleStatusChangeRequest(u, s)} />
                                            <button className="text-slate-400 hover:text-slate-700 p-1" onClick={() => { setKardexUnitId(u.id); setIsKardexOpen(true); }} title="Kardex">
                                              <BookOpen className="h-3 w-3" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── MODO AGRUPADO ──────────────────────────────────────────── */}
            {viewMode === "grouped" && (() => {
              // Agrupar por tipo + marca + modelo
              const groups = new Map<string, { brand: string; model: string; type: string; units: any[]; available: number; inRepair: number; inDiagnosis: number; sold: number }>();
              for (const unit of (unitsData.items as any[])) {
                const key = `${unit.type}___${(unit.brand||"").toLowerCase()}___${(unit.model||"").toLowerCase()}`;
                if (!groups.has(key)) groups.set(key, { brand: unit.brand, model: unit.model, type: unit.type, units: [], available: 0, inRepair: 0, inDiagnosis: 0, sold: 0 });
                const g = groups.get(key)!;
                g.units.push(unit);
                if (unit.status === "available") g.available++;
                else if (unit.status === "in_repair") g.inRepair++;
                else if (unit.status === "in_diagnosis") g.inDiagnosis++;
                else if (unit.status === "sold") g.sold++;
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from(groups.values()).map((g, i) => {
                    const photo = g.units.find((u: any) => u.photos)?.photos;
                    const photoUrl = photo ? (() => { try { const p = typeof photo === "string" ? JSON.parse(photo) : photo; return Array.isArray(p) ? p[0] : null; } catch { return null; } })() : null;
                    const firstUnit = g.units[0];
                    return (
                      <Card key={i} className="hover:shadow-md transition-shadow overflow-hidden">
                        <div className="flex">
                          {photoUrl && <img src={photoUrl} alt={`${g.brand} ${g.model}`} className="w-20 h-20 object-cover shrink-0 rounded-l-lg" />}
                          <div className="p-3 flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <p className="font-black text-sm text-slate-800 truncate">{g.brand} {g.model}</p>
                                <p className="text-[10px] text-slate-400 capitalize">{g.type} · {g.units.length} unidades</p>
                              </div>
                              {g.available > 0 && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-black text-xs shrink-0">{g.available} disp.</Badge>}
                            </div>
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {g.available > 0 && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">{g.available} disponibles</span>}
                              {g.inRepair > 0 && <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-bold">{g.inRepair} en taller</span>}
                              {g.inDiagnosis > 0 && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">{g.inDiagnosis} diagnóstico</span>}
                              {g.sold > 0 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">{g.sold} vendidas</span>}
                            </div>
                            {firstUnit?.salePrice > 0 && (
                              <p className="text-sm font-black text-primary mt-1">Bs. {(firstUnit.salePrice/100).toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                        {/* Lista de unidades individuales del grupo */}
                        <div className="border-t border-slate-50 px-3 pb-2">
                          <div className="max-h-28 overflow-y-auto space-y-1 mt-2">
                            {g.units.map((unit: any) => {
                              const cfg = STATUS_CONFIG[unit.status] || STATUS_CONFIG.in_diagnosis;
                              return (
                                <div key={unit.id} className="flex items-center justify-between text-xs py-0.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono text-slate-600 shrink-0">{unit.code}</span>
                                    {unit.rmaNumber && <span className="font-mono text-[9px] text-emerald-600 font-black shrink-0">{unit.rmaNumber}</span>}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Badge variant="outline" className={`text-[9px] ${cfg.bg} ${cfg.color} px-1 py-0`}>{cfg.label}</Badge>
                                    <button className="text-slate-400 hover:text-slate-700 p-0.5" onClick={() => { setKardexUnitId(unit.id); setIsKardexOpen(true); }}>
                                      <BookOpen className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── MODO TARJETAS (GRID) ───────────────────────────────────── */}
            {viewMode === "grid" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unitsData.items.map((unit: any) => {
                  const specs = unit.specs || {};

              return (
                <Card key={unit.id} className="hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div className="min-w-0 flex-1">
                        {/* Código de barras físico */}
                        <Badge variant="outline" className="mb-1 font-mono text-xs">
                          {unit.code}
                        </Badge>
                        {/* RMA permanente del equipo */}
                        {unit.rmaNumber && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">RMA:</span>
                            <span className="text-[10px] font-mono font-black text-emerald-600">{unit.rmaNumber}</span>
                          </div>
                        )}
                        <CardTitle className="text-base font-bold truncate">
                          {unit.brand} {unit.model}
                        </CardTitle>
                      </div>
                      {/* Interactive Status Selector */}
                      <UnitStatusSelect
                        currentStatus={unit.status}
                        onStatusChange={(newStatus) => handleStatusChangeRequest(unit, newStatus)}
                      />
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {unit.type === "laptop" ? (
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded">
                          {specs.cpu && (
                            <div className="flex items-center gap-1">
                              <Cpu className="h-3 w-3" /> {specs.cpu}
                            </div>
                          )}
                          {(specs.ram || specs.storage) && (
                            <div className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3" />
                              {specs.ram ? `RAM ${specs.ram}` : ""}
                              {specs.ram && specs.storage ? " | " : ""}
                              {specs.storage ? `${specs.storage}` : ""}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3" /> Estado: {unit.condition ? `${unit.condition}/10` : "N/D"}
                          </div>
                          <div className="flex items-center gap-1">
                            <Battery className="h-3 w-3" /> Bat: {formatBatteryHealth(unit.batteryHealth)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded">
                          Prueba funcional: {unit.functionalTestPassed ? "PASADA" : "PENDIENTE"}
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-1 border-t">
                        <span className="text-xs text-muted-foreground">Precio Venta:</span>
                        <span className="text-lg font-bold text-primary">
                          {unit.salePrice ? `Bs. ${(unit.salePrice / 100).toFixed(2)}` : "Sin precio"}
                        </span>
                      </div>

                      {unit.tiktokUrl && (
                        <div className="pt-1">
                          <a
                            href={unit.tiktokUrl.startsWith("http") ? unit.tiktokUrl : `https://${unit.tiktokUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 w-full py-1 px-2.5 rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] font-bold transition-all shadow-sm group"
                            title="Abrir video demostrativo en TikTok"
                          >
                            <span className="text-pink-400">🎵</span> Ver en TikTok
                            <ExternalLink className="h-3 w-3 text-pink-400 group-hover:translate-x-0.5 transition-transform" />
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </div>

                  <div className="p-4 pt-0 space-y-2">
                    <div className="flex gap-2 pt-2 flex-wrap">
                      {/* Kardex — historia completa del equipo */}
                      <Button
                        size="sm"
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
                        onClick={() => { setKardexUnitId(unit.id); setIsKardexOpen(true); }}
                      >
                        <BookOpen className="h-3.5 w-3.5" /> Kardex
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50 gap-1"
                        onClick={() => handleOpenEdit(unit)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                    </div>

                    {unit.status === "in_repair" && (
                      <Button
                        size="sm"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 h-8 shadow-sm"
                        onClick={() => handleOpenCompleteRepair(unit)}
                      >
                        <CheckCircle className="h-4 w-4" /> ✅ Marcar como Ya Reparada (Para Venta)
                      </Button>
                    )}

                    {/* Ficha Comercial de Venta */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs font-bold text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/60 gap-1.5 h-8"
                      onClick={() => {
                        setCommercialSheetUnitId(unit.id);
                        setIsCommercialSheetOpen(true);
                      }}
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                      Ficha Comercial
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
            )}

            {/* ── BARRA DE PAGINACIÓN (grid y tabla) ───────────────────────── */}
            {viewMode !== "grouped" && (() => {
              const total = unitsData?.total ?? 0;
              const totalPages = Math.max(1, Math.ceil(total / pageSize));
              if (totalPages <= 1) return null;
              return (
                <div className="flex items-center justify-center gap-2 py-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Primera página"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {/* Páginas numéricas */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let p: number;
                      if (totalPages <= 5) {
                        p = i + 1;
                      } else if (page <= 3) {
                        p = i + 1;
                      } else if (page >= totalPages - 2) {
                        p = totalPages - 4 + i;
                      } else {
                        p = page - 2 + i;
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`min-w-[36px] h-9 rounded-lg text-sm font-bold transition-all border ${
                            p === page
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Última página"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>

                  <span className="text-xs font-semibold text-muted-foreground ml-2">
                    Página <strong>{page}</strong> de <strong>{totalPages}</strong>
                    <span className="text-slate-400 ml-1">({total} total)</span>
                  </span>
                </div>
              );
            })()}
          </>
        )}

        {/* Modal: Kardex completo de la unidad */}
        <UnitKardex
          unitId={kardexUnitId}
          open={isKardexOpen}
          onOpenChange={(open) => { setIsKardexOpen(open); if (!open) setKardexUnitId(null); }}
        />

        {/* Modal: Fichas de Exhibición / Vitrina (80x70mm y Carta 8 por hoja) */}
        <DisplayCardsModal
          open={isDisplayCardsOpen}
          onOpenChange={(open) => {
            setIsDisplayCardsOpen(open);
            if (!open) {
              setDisplayCardsUnitId(null);
              setDisplayCardsUnit(null);
            }
          }}
          units={displayCardsUnit ? [displayCardsUnit] : undefined}
          preselectedUnitId={displayCardsUnitId}
        />



        {/* Modal: Catálogo Comercial General (3 productos por hoja A4) */}
        <CommercialCatalogModal
          open={isCommercialCatalogOpen}
          onOpenChange={setIsCommercialCatalogOpen}
          initialTypeFilter={typeFilter}
        />

        {/* Modal: Ficha Comercial Individual de Producto */}
        <CommercialSheetModal
          unitId={commercialSheetUnitId}
          open={isCommercialSheetOpen}
          onOpenChange={setIsCommercialSheetOpen}
        />

        {/* Modal: Orden de Trabajo PDF / WhatsApp — generado al ingresar a taller */}
        <WorkOrderModal
          open={workOrderModalOpen}
          onOpenChange={setWorkOrderModalOpen}
          repairId={workOrderRepairId || undefined}
          unitId={workOrderUnitId || undefined}
        />

        {/* Modal: Marcar como YA REPARADA y Disponible */}
        <Dialog open={isCompleteRepairOpen} onOpenChange={setIsCompleteRepairOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700 font-bold">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
                Marcar Equipo como YA REPARADO
              </DialogTitle>
            </DialogHeader>

            {completingUnit && (
              <div className="space-y-4 py-2 text-sm">
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  <div className="font-mono text-xs font-bold text-emerald-800">
                    {completingUnit.code}
                  </div>
                  <div className="font-bold text-slate-900 text-base mt-0.5">
                    {completingUnit.brand} {completingUnit.model}
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">
                    El equipo cambiará su estado a <strong>Disponible para Venta</strong> y quedará listo en el catálogo.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Mano de Obra (Bs):</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={completeLaborCost}
                      onChange={(e) => setCompleteLaborCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Repuestos (Bs):</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={completePartsCost}
                      onChange={(e) => setCompletePartsCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Notas de Cierre / Trabajo Realizado (opcional):
                  </label>
                  <Textarea
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    placeholder="Ej. Cambio de teclado completado, limpieza interna y pasta térmica nueva..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsCompleteRepairOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmCompleteRepair}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Confirmar: Ya Reparado (Disponible)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Formulario de Traspaso a Taller */}
        <Dialog open={isWorkshopModalOpen} onOpenChange={setIsWorkshopModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600 text-lg font-bold">
                <Wrench className="h-5 w-5 text-red-600" />
                Formulario de Ingreso y Traspaso a Taller Técnico
              </DialogTitle>
            </DialogHeader>

            {workshopUnit && (
              <div className="space-y-4 py-2 text-sm">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {workshopUnit.code}
                    </span>
                    <div className="font-bold text-slate-900 text-base mt-1">
                      {workshopUnit.brand} {workshopUnit.model}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    Ingreso a Reparación
                  </Badge>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Motivo de Ingreso / Falla Reportada *:
                  </label>
                  <Textarea
                    value={workshopReason}
                    onChange={(e) => setWorkshopReason(e.target.value)}
                    placeholder="Ej. La pantalla parpadea, teclado no responde tecla ENTER, requiere cambio de pasta térmica..."
                    rows={3}
                    className="bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Técnico Receptor / Asignado:
                  </label>
                  <Input
                    value={workshopTechnician}
                    onChange={(e) => setWorkshopTechnician(e.target.value)}
                    placeholder="Nombre del técnico responsable..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Accesorios Recibidos junto al equipo:
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="u-acc-charger"
                        checked={workshopAccessories.charger}
                        onCheckedChange={(c) => setWorkshopAccessories({ ...workshopAccessories, charger: !!c })}
                      />
                      <label htmlFor="u-acc-charger" className="text-xs cursor-pointer">Cargador original</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="u-acc-bag"
                        checked={workshopAccessories.bag}
                        onCheckedChange={(c) => setWorkshopAccessories({ ...workshopAccessories, bag: !!c })}
                      />
                      <label htmlFor="u-acc-bag" className="text-xs cursor-pointer">Funda / Bolso</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="u-acc-mouse"
                        checked={workshopAccessories.mouse}
                        onCheckedChange={(c) => setWorkshopAccessories({ ...workshopAccessories, mouse: !!c })}
                      />
                      <label htmlFor="u-acc-mouse" className="text-xs cursor-pointer">Mouse / Periférico</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="u-acc-box"
                        checked={workshopAccessories.box}
                        onCheckedChange={(c) => setWorkshopAccessories({ ...workshopAccessories, box: !!c })}
                      />
                      <label htmlFor="u-acc-box" className="text-xs cursor-pointer">Caja original</label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Observaciones Adicionales / Detalles estéticos:
                  </label>
                  <Input
                    value={workshopNotes}
                    onChange={(e) => setWorkshopNotes(e.target.value)}
                    placeholder="Ej. Tapa con rayones leves, faltan 2 tornillos carcasa..."
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsWorkshopModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleApproveWorkshopTransfer} className="bg-red-600 hover:bg-red-700 text-white gap-2 font-bold">
                <Printer className="h-4 w-4" />
                Aprobar Traspaso e Imprimir Hoja de Ingreso
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════ MODAL: EDITAR UNIDAD ══════════ */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-700">
                <Pencil className="h-5 w-5" />
                Editar Unidad — <span className="font-mono text-primary">{editUnit?.code}</span>
              </DialogTitle>
            </DialogHeader>

            {editUnit && (
              <div className="space-y-5 py-2 text-sm">

                {/* Marca y Modelo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Marca *</label>
                    <Input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} placeholder="Lenovo, Dell, HP..." />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Modelo *</label>
                    <Input value={editModel} onChange={(e) => setEditModel(e.target.value)} placeholder="ThinkPad T490..." />
                  </div>
                </div>

                {/* Specs clave-valor */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold">Especificaciones Técnicas:</label>
                    <Button type="button" variant="outline" size="sm" className="gap-1 text-xs"
                      onClick={() => setEditSpecs([...editSpecs, { key: "", value: "" }])}>
                      <Plus className="h-3 w-3" /> Agregar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editSpecs.map((spec, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          placeholder="Atributo (cpu, ram...)"
                          value={spec.key}
                          onChange={(e) => {
                            const updated = [...editSpecs];
                            updated[idx].key = e.target.value;
                            setEditSpecs(updated);
                          }}
                          className="w-1/3"
                        />
                        <Input
                          placeholder="Valor (Core i5, 8GB...)"
                          value={spec.value}
                          onChange={(e) => {
                            const updated = [...editSpecs];
                            updated[idx].value = e.target.value;
                            setEditSpecs(updated);
                          }}
                          className="flex-1"
                        />
                        <Button type="button" variant="ghost" size="icon"
                          onClick={() => setEditSpecs(editSpecs.filter((_, i) => i !== idx))}>
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Condición y Batería (solo laptops) */}
                {editUnit.type === "laptop" && (
                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div>
                      <label className="text-xs font-semibold block mb-1">Estado Estético (1-10):</label>
                      <Select value={editCondition} onValueChange={setEditCondition}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[10,9,8,7,6,5,4,3,2,1].map(n => (
                            <SelectItem key={n} value={String(n)}>
                              {n}/10 {n >= 8 ? "(Excelente)" : n >= 6 ? "(Aceptable)" : "(Detalles)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Estado de Batería:</label>
                      <Select value={editBatteryHealth} onValueChange={(v) => setEditBatteryHealth(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">100%</SelectItem>
                          <SelectItem value="90">90%</SelectItem>
                          <SelectItem value="80">80%</SelectItem>
                          <SelectItem value="70">70%</SelectItem>
                          <SelectItem value="60">60%</SelectItem>
                          <SelectItem value="50">50%</SelectItem>
                          <SelectItem value="40">40%</SelectItem>
                          <SelectItem value="plugged_only">Solo conectada</SelectItem>
                          <SelectItem value="n_a">N/A</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Damage Checklist */}
                {editUnit && (
                  <div className="space-y-2 border-t pt-4">
                    <label className="text-xs font-semibold block">Checklist de Daños / Observaciones:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(CHECKLIST_BY_TYPE[editUnit.type] || CHECKLIST_BY_TYPE.other).map(([key, label]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-check-${key}`}
                            checked={!!editDamageChecklist[key]}
                            onCheckedChange={(c) => setEditDamageChecklist({ ...editDamageChecklist, [key]: !!c })}
                          />
                          <label htmlFor={`edit-check-${key}`} className="text-xs capitalize cursor-pointer">
                            {label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <Textarea
                      placeholder="Notas adicionales sobre el estado del equipo..."
                      value={editDamageNotes}
                      onChange={(e) => setEditDamageNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}

                {/* Precios */}
                <div className="border-t pt-4 space-y-3">
                  <label className="text-xs font-semibold block">Precios (Bs):</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold block mb-1 text-blue-700">💰 Precio Unit:</label>
                      <Input
                        type="number" step="0.01"
                        value={editSalePrice}
                        onChange={(e) => setEditSalePrice(e.target.value)}
                        placeholder="ej. 2200.00"
                        className="border-blue-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1 text-amber-700">🏷️ Precio Descuento:</label>
                      <Input
                        type="number" step="0.01"
                        value={editDiscountPrice}
                        onChange={(e) => setEditDiscountPrice(e.target.value)}
                        placeholder="ej. 2000.00"
                        className="border-amber-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1 text-green-700">📦 Precio Mayor:</label>
                      <Input
                        type="number" step="0.01"
                        value={editWholesalePrice}
                        onChange={(e) => setEditWholesalePrice(e.target.value)}
                        placeholder="ej. 1900.00"
                        className="border-green-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Proveedor y Fecha de Compra */}
                <div className="border-t pt-4 space-y-3">
                  <label className="text-xs font-semibold block">Información de Compra:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold block mb-1">Proveedor:</label>
                      <Select
                        value={editSupplierId ? String(editSupplierId) : ""}
                        onValueChange={(v) => setEditSupplierId(v ? parseInt(v) : undefined)}
                      >
                        <SelectTrigger><SelectValue placeholder="Seleccionar proveedor..." /></SelectTrigger>
                        <SelectContent>
                          {(suppliersData as any[])?.map((s: any) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Fecha de Compra:</label>
                      <Input
                        type="date"
                        value={editPurchaseDate}
                        onChange={(e) => setEditPurchaseDate(e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                  </div>
                </div>

                {/* ─── Fotografías del Equipo ─── */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5 text-slate-800">
                      <Camera className="h-4 w-4 text-blue-600" />
                      Fotografías del Equipo:
                      <span className="text-muted-foreground font-normal">({editPhotos.length}/8)</span>
                    </label>
                  </div>

                  {/* Photo buttons */}
                  <div className="flex flex-wrap gap-2">
                    {/* Camera capture — celular */}
                    <button
                      type="button"
                      onClick={() => editPhotoCameraInputRef.current?.click()}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Tomar Foto
                    </button>

                    {/* File upload — galería / pc */}
                    <button
                      type="button"
                      onClick={() => editPhotoFileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold transition-colors"
                    >
                      <ImagePlus className="h-3.5 w-3.5 text-blue-600" />
                      Subir desde Galería / PC
                    </button>

                    {/* Hidden inputs */}
                    <input
                      ref={editPhotoCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={(e) => handleEditPhotoFiles(e.target.files)}
                    />
                    <input
                      ref={editPhotoFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleEditPhotoFiles(e.target.files)}
                    />
                  </div>

                  {/* Photo previews */}
                  {editPhotos.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
                      {editPhotos.map((photo, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                          <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeEditPhoto(idx)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                            title="Eliminar foto"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {idx === 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-[9px] text-center py-0.5 font-bold">
                              PRINCIPAL
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {editPhotos.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      📸 Sin fotografías registradas. Sube imágenes para que aparezcan en el Catálogo Comercial y Ficha de Producto.
                    </p>
                  )}
                </div>

                {/* Video de TikTok */}
                <div className="border-t pt-4 space-y-2.5 bg-gradient-to-br from-[#0b0f19] via-[#111827] to-[#0b0f19] text-white p-3.5 sm:p-4 rounded-2xl border border-pink-500/30">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold flex items-center gap-1.5 text-white">
                      <span className="p-1 bg-pink-500/20 text-pink-400 rounded-md">🎵</span> Video de TikTok del Equipo:
                    </label>
                    {editTiktokUrl.trim() && (
                      <a
                        href={editTiktokUrl.startsWith("http") ? editTiktokUrl : `https://${editTiktokUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-pink-300 hover:text-pink-200 flex items-center gap-1 bg-pink-500/20 px-2.5 py-1 rounded-lg border border-pink-500/30"
                      >
                        <Play className="h-3 w-3 fill-current" /> Probar Video
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <Input
                    value={editTiktokUrl}
                    onChange={(e) => setEditTiktokUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/@mpshop/video/... o https://vm.tiktok.com/..."
                    className="dark-input !bg-[#050811] !text-white placeholder:!text-slate-500 !border-slate-700 focus:!border-pink-500 focus:!ring-2 focus:!ring-pink-500/30 text-xs font-mono h-10 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-400">
                    💡 Enlace de TikTok con la prueba de funcionamiento, batería o unboxing del equipo.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateUnitMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {updateUnitMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── MODAL ELIMINAR UNIDADES / LOTES CON CHECKS Y CANTIDADES ───────── */}
        <Dialog open={isBatchDeleteOpen} onOpenChange={setIsBatchDeleteOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Eliminar Unidades de Inventario
              </DialogTitle>
            </DialogHeader>

            {targetArticleForDelete && (
              <div className="space-y-4 py-2">
                {/* Resumen del Artículo */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-sm">
                      {targetArticleForDelete.description}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Marca: <span className="font-medium text-slate-700">{targetArticleForDelete.brand}</span> | Modelo: <span className="font-medium text-slate-700">{targetArticleForDelete.model}</span> | Código: <span className="font-mono font-medium text-slate-700">{targetArticleForDelete.displayCode}</span>
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold">
                    {targetArticleForDelete.units.length} {targetArticleForDelete.units.length === 1 ? "unidad" : "unidades"}
                  </Badge>
                </div>

                {targetArticleForDelete.units.length > 1 ? (
                  <>
                    {/* Selector de Modo de Eliminación */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">¿Cómo deseas eliminar?</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setDeleteMode("all")}
                          className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                            deleteMode === "all"
                              ? "border-red-500 bg-red-50/80 text-red-900 font-bold shadow-sm"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="h-2 w-2 rounded-full bg-red-500"></span>
                            Todo el lote
                          </div>
                          <span className="text-[11px] font-normal text-slate-500">
                            Eliminar las {targetArticleForDelete.units.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteMode("quantity")}
                          className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                            deleteMode === "quantity"
                              ? "border-red-500 bg-red-50/80 text-red-900 font-bold shadow-sm"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                            Por cantidad
                          </div>
                          <span className="text-[11px] font-normal text-slate-500">
                            Indicar número (ej. 10)
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteMode("custom")}
                          className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                            deleteMode === "custom"
                              ? "border-red-500 bg-red-50/80 text-red-900 font-bold shadow-sm"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                            Con casillas (Checks)
                          </div>
                          <span className="text-[11px] font-normal text-slate-500">
                            Elegir series específicas
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Modo 1: Todo el lote */}
                    {deleteMode === "all" && (
                      <div className="p-3 bg-red-50/60 rounded-lg border border-red-200 text-xs text-red-800 space-y-1">
                        <p className="font-bold">⚠️ Se eliminarán todas las {targetArticleForDelete.units.length} unidades registradas.</p>
                        <p className="text-red-700 text-[11px]">Esta acción borrará el artículo completo y todas sus series de la sucursal activa.</p>
                      </div>
                    )}

                    {/* Modo 2: Por cantidad */}
                    {deleteMode === "quantity" && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <label className="text-xs font-semibold text-slate-700">
                          Cantidad de unidades a eliminar (máx: {targetArticleForDelete.units.length}):
                        </label>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            min={1}
                            max={targetArticleForDelete.units.length}
                            value={customQtyToDelete}
                            onChange={(e) => setCustomQtyToDelete(Math.max(1, Math.min(Number(e.target.value) || 1, targetArticleForDelete.units.length)))}
                            className="h-10 w-28 font-bold text-center text-sm"
                          />
                          <span className="text-xs text-slate-600">
                            de <strong>{targetArticleForDelete.units.length}</strong> unidades disponibles.
                          </span>
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          {[5, 10, 20, 50].filter(n => n <= targetArticleForDelete.units.length).map(n => (
                            <Button
                              key={n}
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs px-2"
                              onClick={() => setCustomQtyToDelete(n)}
                            >
                              {n} unidades
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2 font-bold"
                            onClick={() => setCustomQtyToDelete(targetArticleForDelete.units.length)}
                          >
                            Todas ({targetArticleForDelete.units.length})
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Modo 3: Con casillas (Checks) */}
                    {deleteMode === "custom" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">
                            Seleccionadas: <strong className="text-red-600">{selectedUnitIdsToDelete.length}</strong> de {targetArticleForDelete.units.length}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSelectAllInModal}
                              className="text-blue-600 hover:underline font-medium text-xs"
                            >
                              Marcar todos
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={handleDeselectAllInModal}
                              className="text-slate-500 hover:underline text-xs"
                            >
                              Desmarcar todos
                            </button>
                          </div>
                        </div>

                        <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
                          {targetArticleForDelete.units.map((u: any) => {
                            const isChecked = selectedUnitIdsToDelete.includes(u.id);
                            return (
                              <label
                                key={u.id}
                                className={`flex items-center gap-2.5 p-2 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                                  isChecked ? "bg-red-50/50" : ""
                                }`}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => handleToggleUnitSelection(u.id)}
                                />
                                <span className="font-mono font-bold text-blue-700">{u.code}</span>
                                {u.serialNumber && (
                                  <span className="text-slate-500 font-mono text-[10px]">S/N: {u.serialNumber}</span>
                                )}
                                <span className="ml-auto text-[10px] uppercase font-bold text-slate-500">
                                  {STATUS_CONFIG[u.status]?.label || u.status}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-800">
                    <p className="font-bold">¿Estás seguro de eliminar esta unidad ({targetArticleForDelete.displayCode})?</p>
                    <p className="text-[11px] text-red-700 mt-1">Esta acción no se puede deshacer.</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsBatchDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmBatchDelete}
                disabled={
                  deleteBatchMutation.isPending ||
                  (deleteMode === "custom" && selectedUnitIdsToDelete.length === 0) ||
                  (deleteMode === "quantity" && customQtyToDelete < 1)
                }
                className="gap-1.5 font-bold"
              >
                <Trash2 className="h-4 w-4" />
                {deleteBatchMutation.isPending
                  ? "Eliminando..."
                  : deleteMode === "all"
                  ? `Eliminar todo (${targetArticleForDelete?.units.length})`
                  : deleteMode === "quantity"
                  ? `Eliminar ${customQtyToDelete} unidades`
                  : `Eliminar seleccionadas (${selectedUnitIdsToDelete.length})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </>
  );
}
