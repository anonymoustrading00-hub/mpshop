import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { Laptop, HardDrive, QrCode, Search, Wrench, Shield, ArrowRightLeft, Plus, Cpu, Battery, Activity, ShoppingBag, CheckCircle, Package, Printer, Pencil, Trash2, X, BookOpen, Video, ExternalLink, Play, FileText, Sparkles, Camera, ImagePlus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { UnitKardex } from "@/components/UnitKardex";
import { CommercialCatalogModal } from "@/components/CommercialCatalogModal";
import { CommercialSheetModal } from "@/components/CommercialSheetModal";

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
    if (currentStatus === "in_repair" && val === "available") {
      toast.error("⚠️ La unidad está en taller técnico. Debe completar o cancelar la reparación en el módulo de Taller para liberarla.");
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
        <SelectContent align="end" className="w-56 font-sans z-50">
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
            <div className="flex items-center gap-2 text-green-700">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Disponible / Para Venta</span>
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
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editCondition, setEditCondition] = useState("8");
  const [editBatteryHealth, setEditBatteryHealth] = useState<"good" | "fair" | "bad_plugged_only" | "n_a">("n_a");
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
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) {
          setEditPhotos((prev) => {
            if (prev.length >= 8) return prev;
            return [...prev, result];
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

  // Estados para Modal e Impresión de Traspaso a Taller
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
  const [printedRepairReceipt, setPrintedRepairReceipt] = useState<any>(null);

  const { data: unitsData, isLoading, refetch } = trpc.units.list.useQuery({
    search: search || undefined,
    type: typeFilter !== "all" ? (typeFilter as any) : undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

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

  const createRepairMutation = trpc.repairs.create.useMutation({
    onSuccess: () => {
      refetch();
    },
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
      setSearch(code);
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
      batteryHealth: editBatteryHealth,
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

  const handleStatusChangeRequest = (unit: any, newStatus: string) => {
    if (newStatus === "in_repair") {
      setWorkshopUnit(unit);
      setWorkshopReason("");
      setWorkshopNotes("");
      setWorkshopTechnician(user?.name || "");
      setIsWorkshopModalOpen(true);
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

    changeStatusMutation.mutate({
      unitId: workshopUnit.id,
      toStatus: "in_repair",
      notes: repairNotesData,
    });

    createRepairMutation.mutate({
      unitId: workshopUnit.id,
      notes: `Motivo: ${workshopReason.trim()} | Accesorios: ${accessoriesList}${workshopNotes ? ` | Obs: ${workshopNotes.trim()}` : ""}`,
    });

    const receiptData = {
      receiptNumber: `TRP-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleString("es-BO"),
      unitCode: workshopUnit.code,
      brand: workshopUnit.brand,
      model: workshopUnit.model,
      type: workshopUnit.type,
      specs: workshopUnit.specs,
      reason: workshopReason,
      technician: workshopTechnician || user?.name || "Técnico asignado",
      accessories: accessoriesList,
      notes: workshopNotes,
    };

    setPrintedRepairReceipt(receiptData);
    setIsWorkshopModalOpen(false);

    toast.success("✅ Traspaso a Taller Aprobado. Imprimiendo Hoja de Ingreso...");
    setTimeout(() => {
      window.print();
    }, 400);
  };

  return (
    <>
      {/* ═══════════ PRINT STYLES FOR REPAIR RECEIPT ═══════════ */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-workshop-root { display: block !important; }
          .no-print { display: none !important; }

          .workshop-receipt {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #111;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .receipt-header h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; color: #1e3a8a; margin: 0; }
          .receipt-header p { font-size: 11px; color: #555; margin-top: 4px; }
          .receipt-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
          }
          .receipt-box {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px;
            background: #f8fafc;
          }
          .receipt-box-title {
            font-size: 11px; font-weight: bold; text-transform: uppercase; color: #2563eb; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;
          }
          .receipt-row { font-size: 12px; margin-bottom: 4px; }
          .receipt-label { font-weight: bold; color: #475569; }
          .signatures-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 60px;
            text-align: center;
          }
          .signature-line { border-top: 1px dashed #475569; padding-top: 6px; font-size: 11px; font-weight: bold; }
        }
        @media screen {
          .print-workshop-root { display: none; }
        }
      `}</style>

      {/* ═══════════ PRINT-ONLY: HOJA DE INGRESO A TALLER ═══════════ */}
      {printedRepairReceipt && (
        <div className="print-workshop-root">
          <div className="workshop-receipt">
            <div className="receipt-header">
              <h1>Hoja de Ingreso y Traspaso a Taller Técnico</h1>
              <p>Comprobante de Recepción · Orden N° <strong>{printedRepairReceipt.receiptNumber}</strong> · Fecha: {printedRepairReceipt.date}</p>
            </div>

            <div className="receipt-grid">
              <div className="receipt-box">
                <div className="receipt-box-title">Datos del Equipo</div>
                <div className="receipt-row"><span className="receipt-label">Código Único:</span> {printedRepairReceipt.unitCode}</div>
                <div className="receipt-row"><span className="receipt-label">Equipo:</span> {printedRepairReceipt.brand} {printedRepairReceipt.model}</div>
                <div className="receipt-row"><span className="receipt-label">Tipo:</span> {printedRepairReceipt.type.toUpperCase()}</div>
              </div>

              <div className="receipt-box">
                <div className="receipt-box-title">Datos del Servicio</div>
                <div className="receipt-row"><span className="receipt-label">Técnico Receptor:</span> {printedRepairReceipt.technician}</div>
                <div className="receipt-row"><span className="receipt-label">Accesorios Dejados:</span> {printedRepairReceipt.accessories}</div>
                <div className="receipt-row"><span className="receipt-label">Estado Asignado:</span> EN TALLER</div>
              </div>
            </div>

            <div className="receipt-box" style={{ marginBottom: "16px" }}>
              <div className="receipt-box-title">Motivo de Ingreso / Falla Reportada</div>
              <p style={{ fontSize: "12px", margin: "4px 0 0" }}>{printedRepairReceipt.reason}</p>
            </div>

            {printedRepairReceipt.notes && (
              <div className="receipt-box" style={{ marginBottom: "16px" }}>
                <div className="receipt-box-title">Observaciones Adicionales</div>
                <p style={{ fontSize: "12px", margin: "4px 0 0" }}>{printedRepairReceipt.notes}</p>
              </div>
            )}

            <div className="signatures-grid">
              <div>
                <div className="signature-line">Firma y Sello del Técnico Receptor</div>
              </div>
              <div>
                <div className="signature-line">Firma del Responsable / Cliente</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ SCREEN UI ═══════════ */}
      <div className="no-print container mx-auto p-4 md:p-6 space-y-6">
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
              onClick={() => setIsCommercialCatalogOpen(true)}
              className="gap-2 bg-slate-900 hover:bg-black text-white font-bold shadow-md shadow-slate-300"
            >
              <FileText className="h-4 w-4 text-blue-400" /> Catálogo Comercial
            </Button>
            <a href="/catalog">
              <Button variant="outline" className="gap-2">
                <Package className="h-4 w-4" /> Catálogo Visual
              </Button>
            </a>
            <a href="/register-unit">
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
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

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            placeholder="Buscar por marca, modelo o specs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo de Producto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Tipos</SelectItem>
              <SelectItem value="laptop">Laptop</SelectItem>
              <SelectItem value="accessory">Accesorio / Repuesto</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
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

        {/* Grid de Unidades */}
        {isLoading ? (
          <div className="text-center py-10">Cargando inventario de unidades...</div>
        ) : !unitsData?.items || unitsData.items.length === 0 ? (
          <Card className="text-center p-12">
            <CardContent className="space-y-4">
              <HardDrive className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">No se encontraron unidades</h3>
              <p className="text-sm text-muted-foreground">
                Intenta cambiar los filtros o registra una nueva unidad usando el botón de la parte superior.
              </p>
            </CardContent>
          </Card>
        ) : (
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
                            <Battery className="h-3 w-3" /> Bat: {unit.batteryHealth || "N/D"}
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

        {/* Modal: Kardex completo de la unidad */}
        <UnitKardex
          unitId={kardexUnitId}
          open={isKardexOpen}
          onOpenChange={(open) => { setIsKardexOpen(open); if (!open) setKardexUnitId(null); }}
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
                      <Select value={editBatteryHealth} onValueChange={(v) => setEditBatteryHealth(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Buena</SelectItem>
                          <SelectItem value="fair">Regular</SelectItem>
                          <SelectItem value="bad_plugged_only">Solo con cargador</SelectItem>
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
                <div className="border-t pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5 text-slate-800">
                      <span className="text-pink-500 font-black">🎵</span> Video Demostrativo en TikTok:
                    </label>
                    {editTiktokUrl.trim() && (
                      <a
                        href={editTiktokUrl.startsWith("http") ? editTiktokUrl : `https://${editTiktokUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1"
                      >
                        <Play className="h-3 w-3 fill-current" /> Probar Video
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <Input
                    value={editTiktokUrl}
                    onChange={(e) => setEditTiktokUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/@vitalia/video/... o https://vm.tiktok.com/..."
                    className="text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Enlace de TikTok con la prueba de funcionamiento, batería o unboxing del equipo.
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

      </div>
    </>
  );
}
