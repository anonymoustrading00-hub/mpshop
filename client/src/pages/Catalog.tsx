import React, { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SpecsCard } from "@/components/SpecsCard";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Laptop, Package, Search, Filter, Printer, Camera, CheckCircle,
  Tag, Grid, List, ChevronRight, Cpu, HardDrive, Battery, Activity,
  Star, TrendingUp, ShoppingBag, Wrench, Eye, ImageIcon, X, FileText, UserCheck, ShieldAlert,
  Play, ExternalLink, Video, Sparkles, Boxes, Layers, QrCode, ArrowRight
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBranch } from "@/contexts/BranchContext";
import { CommercialCatalogModal } from "@/components/CommercialCatalogModal";
import { CommercialSheetModal } from "@/components/CommercialSheetModal";
import { WorkOrderModal } from "@/components/WorkOrderModal";

/* ─── Constants ─────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  in_diagnosis: { label: "En Diagnóstico", color: "text-amber-700", bg: "bg-amber-100 border-amber-300", icon: Activity },
  in_repair:    { label: "En Taller",       color: "text-red-700",   bg: "bg-red-100 border-red-300",    icon: Wrench },
  available:    { label: "Disponible / Venta", color: "text-green-700", bg: "bg-green-100 border-green-300", icon: ShoppingBag },
  sold:         { label: "Vendida",         color: "text-slate-500", bg: "bg-slate-100 border-slate-300", icon: CheckCircle },
  returned:     { label: "Devuelta (RMA)",  color: "text-purple-700",bg: "bg-purple-100 border-purple-300",icon: Package },
};

const BATTERY_LABEL: Record<string, string> = {
  "100": "🔋 100%",
  "90": "🔋 90%",
  "80": "🔋 80%",
  "70": "🔋 70%",
  "60": "🔋 60%",
  "50": "🔋 50%",
  "40": "🔋 40%",
  plugged_only: "⚡ Solo conectada",
  bad_plugged_only: "⚡ Solo conectada",
  good: "🔋 100%",
  fair: "🔋 70%",
  n_a: "—",
};

/* ─── Photo Gallery Component ───────────────────────────────────── */
function PhotoGallery({ photos }: { photos: string[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  if (!photos || photos.length === 0) {
    return (
      <div className="w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400">
        <ImageIcon className="h-10 w-10" />
        <span className="text-xs font-medium">Sin fotografías</span>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="w-full h-52 rounded-xl overflow-hidden bg-black flex items-center justify-center">
        <img src={photos[activeIdx]} alt="Foto del equipo" className="w-full h-full object-contain" />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === activeIdx ? "border-blue-500 scale-105" : "border-transparent hover:border-blue-300"}`}
            >
              <img src={p} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Status Selector Dropdown Component ─────────────────────────── */
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
        <SelectContent align="end" className="w-56 font-sans">
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

/* ─── Unit Card ─────────────────────────────────────────────────── */
function UnitCard({
  unit,
  onSelect,
  onStatusChange,
  onOpenCommercialSheet,
}: {
  unit: any;
  onSelect: () => void;
  onStatusChange: (newStatus: string) => void;
  onOpenCommercialSheet: (unitId: number) => void;
}) {
  const photos: string[] = unit.photos ? (typeof unit.photos === "string" ? JSON.parse(unit.photos) : unit.photos) : [];
  const specs = unit.specs || {};
  const mainPhoto = photos[0];

  return (
    <div
      className="catalog-card group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between"
      onClick={onSelect}
    >
      <div>
        {/* Photo */}
        <div className="relative w-full h-44 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
          {mainPhoto ? (
            <img src={mainPhoto} alt={`${unit.brand} ${unit.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
              {unit.type === "laptop" ? <Laptop className="h-14 w-14" /> : <Package className="h-14 w-14" />}
              <span className="text-xs">Sin foto</span>
            </div>
          )}
          {/* Status Select Dropdown in Card Header */}
          <div className="absolute top-2 right-2 z-10">
            <UnitStatusSelect
              currentStatus={unit.status}
              onStatusChange={(newStatus) => onStatusChange(newStatus)}
            />
          </div>
          {/* Photo count */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full">
              <Camera className="h-2.5 w-2.5" />
              {photos.length}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-3">
          <div>
            <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{unit.code}</span>
            <h3 className="font-bold text-slate-900 mt-1 text-[15px] leading-tight">{unit.brand} {unit.model}</h3>
          </div>

          {unit.type === "laptop" && (
            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
              {specs.cpu && <div className="flex items-center gap-1"><Cpu className="h-3 w-3 text-blue-400" /><span className="truncate">{specs.cpu}</span></div>}
              {(specs.ram || specs.storage) && <div className="flex items-center gap-1"><HardDrive className="h-3 w-3 text-purple-400" /><span className="truncate">{specs.ram} | {specs.storage}</span></div>}
              {unit.condition && <div className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400" /><span>{unit.condition}/10</span></div>}
              {unit.batteryHealth && unit.batteryHealth !== "n_a" && (
                <div className="flex items-center gap-1"><Battery className="h-3 w-3 text-green-400" /><span>{BATTERY_LABEL[unit.batteryHealth] || unit.batteryHealth}</span></div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 pt-0 border-t border-slate-100 mt-2 space-y-2">
        <div className="flex items-center justify-between pt-2">
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Precio Venta Unit (Bs):</div>
            <div className="text-xl font-black text-blue-600">
              {unit.salePrice ? `Bs. ${(unit.salePrice / 100).toFixed(0)}` : <span className="text-slate-400 text-sm">Sin precio</span>}
            </div>
          </div>
          {unit.status === "in_diagnosis" && (
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange("available"); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Para Venta
            </button>
          )}
          {unit.status === "available" && (
            <div className="flex items-center gap-1 text-green-600 text-[11px] font-semibold">
              <TrendingUp className="h-3.5 w-3.5" />
              Disponible
            </div>
          )}
          {unit.status === "in_repair" && (
            <div className="flex items-center gap-1 text-red-600 text-[11px] font-semibold">
              <Wrench className="h-3.5 w-3.5" />
              En Taller
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCommercialSheet(unit.id);
          }}
          className="w-full text-xs font-bold text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 gap-1.5 h-8 transition-colors"
        >
          <FileText className="h-3.5 w-3.5 text-blue-600" />
          Generar Ficha Comercial
        </Button>
      </div>
    </div>
  );
}

/* ─── Grouped Product Card Component ───────────────────────────── */
interface GroupedProduct {
  key: string;
  brand: string;
  model: string;
  type: string;
  units: any[];
  availableCount: number;
  inRepairCount: number;
  inDiagnosisCount: number;
  soldCount: number;
  returnedCount: number;
  primaryUnit: any;
  photos: string[];
  salePrice: number;
  discountPrice?: number;
  wholesalePrice?: number;
  specs: any;
  tiktokUrl?: string;
}

function GroupedProductCard({
  group,
  onOpenGroupUnits,
  onOpenDetail,
  onOpenCommercialSheet,
}: {
  group: GroupedProduct;
  onOpenGroupUnits: () => void;
  onOpenDetail: () => void;
  onOpenCommercialSheet: (unitId: number) => void;
}) {
  const mainPhoto = group.photos[0];
  const specs = group.specs || {};

  return (
    <div
      className="catalog-card group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between"
      onClick={onOpenDetail}
    >
      <div>
        {/* Photo & Stock Badge */}
        <div className="relative w-full h-44 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
          {mainPhoto ? (
            <img
              src={mainPhoto}
              alt={`${group.brand} ${group.model}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
              {group.type === "laptop" ? <Laptop className="h-14 w-14" /> : <Package className="h-14 w-14 text-slate-400" />}
              <span className="text-xs font-medium">Sin foto</span>
            </div>
          )}

          {/* Badge de Stock en la esquina superior derecha */}
          <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
            {group.availableCount > 0 ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-2.5 py-1 shadow-md gap-1">
                <ShoppingBag className="h-3.5 w-3.5" />
                {group.availableCount} {group.availableCount === 1 ? "disponible" : "disponibles"}
              </Badge>
            ) : group.units.length > 0 ? (
              <Badge className="bg-amber-600 text-white font-bold text-xs px-2.5 py-1 shadow-md">
                {group.inRepairCount > 0 ? `${group.inRepairCount} en taller` : "Sin disponibles"}
              </Badge>
            ) : (
              <Badge className="bg-slate-500 text-white font-bold text-xs">Agotado</Badge>
            )}

            {group.inRepairCount > 0 && group.availableCount > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] py-0.5 px-1.5 font-bold">
                <Wrench className="h-2.5 w-2.5 mr-1 inline" />
                {group.inRepairCount} en taller
              </Badge>
            )}
          </div>

          {/* Badge de Tipo de Producto en la esquina superior izquierda */}
          <div className="absolute top-2 left-2 z-10">
            <Badge variant="outline" className="bg-white/90 backdrop-blur-sm text-slate-700 font-bold text-[10px] border-slate-200 uppercase tracking-wider">
              {group.type}
            </Badge>
          </div>

          {/* Photo count */}
          {group.photos.length > 1 && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full">
              <Camera className="h-2.5 w-2.5" />
              {group.photos.length}
            </div>
          )}

          {/* TikTok badge */}
          {group.tiktokUrl && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-pink-600 text-white text-[10px] font-bold rounded-full shadow">
              <Video className="h-2.5 w-2.5" />
              TikTok
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-2">
          <div>
            <h3 className="font-black text-slate-900 text-base leading-tight">
              {group.brand} {group.model}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {group.units.length} {group.units.length === 1 ? "unidad registrada" : "unidades registradas en total"}
            </p>
          </div>

          {group.type === "laptop" && (
            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500 pt-1">
              {specs.cpu && (
                <div className="flex items-center gap-1">
                  <Cpu className="h-3 w-3 text-blue-500" />
                  <span className="truncate">{specs.cpu}</span>
                </div>
              )}
              {(specs.ram || specs.storage) && (
                <div className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3 text-purple-500" />
                  <span className="truncate">{specs.ram} | {specs.storage}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer con Precios y Botones */}
      <div className="p-4 pt-0 border-t border-slate-100 mt-2 space-y-2.5">
        <div className="flex items-center justify-between pt-2">
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Precio Venta (Bs):</div>
            <div className="text-xl font-black text-blue-600">
              {group.salePrice ? `Bs. ${(group.salePrice / 100).toFixed(0)}` : <span className="text-slate-400 text-sm">Sin precio</span>}
            </div>
          </div>
          {group.wholesalePrice ? (
            <div className="text-right">
              <div className="text-[10px] text-green-700 font-bold uppercase tracking-wider">Por Mayor:</div>
              <div className="text-sm font-bold text-green-700">
                Bs. {(group.wholesalePrice / 100).toFixed(0)}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onOpenGroupUnits();
            }}
            className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 gap-1 h-8"
          >
            <Boxes className="h-3.5 w-3.5" />
            Ver ({group.units.length} uds.)
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              if (group.primaryUnit?.id) {
                onOpenCommercialSheet(group.primaryUnit.id);
              }
            }}
            className="text-xs font-bold text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 gap-1 h-8"
          >
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            Ficha PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Printable Catalog Card ─────────────────────────────────────── */
function PrintableCard({ unit }: { unit: any }) {
  const photos: string[] = unit.photos ? (typeof unit.photos === "string" ? JSON.parse(unit.photos) : unit.photos) : [];
  const specs = unit.specs || {};
  const cfg = STATUS_CONFIG[unit.status];

  return (
    <div className="print-card">
      <div className="print-photo">
        {photos[0]
          ? <img src={photos[0]} alt={`${unit.brand} ${unit.model}`} />
          : <div className="print-no-photo">📷</div>
        }
      </div>
      <div className="print-info">
        <div className="print-code">{unit.code}</div>
        <div className="print-name">{unit.brand} {unit.model}</div>
        {unit.type === "laptop" && (
          <div className="print-specs">
            {specs.cpu && <span>CPU: {specs.cpu}</span>}
            {specs.ram && <span>RAM: {specs.ram}</span>}
            {specs.storage && <span>Almacenamiento: {specs.storage}</span>}
            {unit.condition && <span>Estado: {unit.condition}/10</span>}
          </div>
        )}
        <div className="print-price">
          Precio Venta Unit (Bs): {unit.salePrice ? `Bs. ${(unit.salePrice / 100).toFixed(0)}` : "Consultar precio"}
        </div>
        <div className="print-status">{cfg?.label || unit.status}</div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */
export default function Catalog() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Estados para Catálogo Comercial (3 productos x pág) y Ficha Comercial
  const [isCommercialCatalogOpen, setIsCommercialCatalogOpen] = useState(false);
  const [commercialSheetUnitId, setCommercialSheetUnitId] = useState<number | null>(null);
  const [isCommercialSheetOpen, setIsCommercialSheetOpen] = useState(false);

  // Estados para Formulario e Impresión de Traspaso a Taller
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

  // Estado para Orden de Trabajo (OT) generada al aprobar traspaso a taller
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderRepairId, setWorkOrderRepairId] = useState<number | null>(null);
  const [workOrderUnitId, setWorkOrderUnitId] = useState<number | null>(null);

  // Estados para Modal "Marcar como Ya Reparada"
  const [isCompleteRepairOpen, setIsCompleteRepairOpen] = useState(false);
  const [completingUnit, setCompletingUnit] = useState<any>(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeLaborCost, setCompleteLaborCost] = useState("");
  const [completePartsCost, setCompletePartsCost] = useState("");

  // Modo de visualización del Catálogo: Agrupado por Producto (por defecto) o Individual por serie
  const [catalogMode, setCatalogMode] = useState<"grouped" | "individual">("grouped");
  const [selectedGroupForUnits, setSelectedGroupForUnits] = useState<GroupedProduct | null>(null);
  const [isGroupUnitsModalOpen, setIsGroupUnitsModalOpen] = useState(false);

  const { data: unitsData, isLoading, refetch } = trpc.units.list.useQuery({
    search: search || undefined,
    type: typeFilter !== "all" ? (typeFilter as any) : undefined,
    status: statusTab !== "all" ? (statusTab as any) : undefined,
    branchId: activeBranchId || undefined,
    limit: 500,
  });

  const items: any[] = unitsData?.items || [];

  // Agrupación automática de unidades por Tipo + Marca + Modelo
  const groupedProducts = useMemo<GroupedProduct[]>(() => {
    const groupsMap = new Map<string, GroupedProduct>();

    for (const unit of items) {
      const brandClean = (unit.brand || "").trim();
      const modelClean = (unit.model || "").trim();
      const typeClean = unit.type || "other";
      const key = `${typeClean}___${brandClean.toLowerCase()}___${modelClean.toLowerCase()}`;

      if (!groupsMap.has(key)) {
        const photos: string[] = unit.photos
          ? typeof unit.photos === "string"
            ? JSON.parse(unit.photos)
            : unit.photos
          : [];
        groupsMap.set(key, {
          key,
          brand: brandClean,
          model: modelClean,
          type: typeClean,
          units: [unit],
          availableCount: unit.status === "available" ? 1 : 0,
          inRepairCount: unit.status === "in_repair" ? 1 : 0,
          inDiagnosisCount: unit.status === "in_diagnosis" ? 1 : 0,
          soldCount: unit.status === "sold" ? 1 : 0,
          returnedCount: unit.status === "returned" ? 1 : 0,
          primaryUnit: unit,
          photos: photos,
          salePrice: unit.salePrice || 0,
          discountPrice: unit.discountPrice || undefined,
          wholesalePrice: unit.wholesalePrice || undefined,
          specs: unit.specs || {},
          tiktokUrl: unit.tiktokUrl || undefined,
        });
      } else {
        const group = groupsMap.get(key)!;
        group.units.push(unit);
        if (unit.status === "available") group.availableCount++;
        else if (unit.status === "in_repair") group.inRepairCount++;
        else if (unit.status === "in_diagnosis") group.inDiagnosisCount++;
        else if (unit.status === "sold") group.soldCount++;
        else if (unit.status === "returned") group.returnedCount++;

        // Si la unidad actual tiene fotos y el grupo no tenía, asignarlas
        if (group.photos.length === 0 && unit.photos) {
          const unitPhotos = typeof unit.photos === "string" ? JSON.parse(unit.photos) : unit.photos;
          if (unitPhotos.length > 0) {
            group.photos = unitPhotos;
            group.primaryUnit = unit;
          }
        }
        if (!group.tiktokUrl && unit.tiktokUrl) {
          group.tiktokUrl = unit.tiktokUrl;
        }
        if (!group.salePrice && unit.salePrice) {
          group.salePrice = unit.salePrice;
        }
      }
    }

    return Array.from(groupsMap.values());
  }, [items]);

  const changeStatusMutation = trpc.units.changeStatus.useMutation({
    onSuccess: () => {
      toast.success("✅ Estado de unidad actualizado");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createRepairMutation = trpc.repairs.create.useMutation({
    onSuccess: (res: any) => {
      refetch();
      // Abrir la Orden de Trabajo con jsPDF (sin window.print)
      if (res?.repairId) {
        setWorkOrderRepairId(res.repairId);
      }
      setWorkOrderModalOpen(true);
    },
  });

  const handleOpenCompleteRepair = (unit: any) => {
    setCompletingUnit(unit);
    setCompleteNotes("");
    setCompleteLaborCost("");
    setCompletePartsCost("");
    setIsCompleteRepairOpen(true);
  };

  const handleConfirmCompleteRepair = () => {
    if (!completingUnit) return;
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
      // Abre el modal de formulario e ingreso a taller
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

    // 2. Crear OT en el módulo de taller — el onSuccess abrirá el WorkOrderModal con PDF
    setWorkOrderUnitId(workshopUnit.id);
    setWorkOrderRepairId(null);
    createRepairMutation.mutate({
      unitId: workshopUnit.id,
      notes: repairNotesNotesData(workshopReason, accessoriesList, workshopNotes),
    });

    setIsWorkshopModalOpen(false);
    toast.success("✅ Traspaso a Taller Aprobado. Generando Orden de Trabajo...");
  };

  function repairNotesNotesData(reason: string, acc: string, notes: string) {
    return `Motivo: ${reason} | Accesorios: ${acc}${notes ? ` | Obs: ${notes}` : ""}`;
  }

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { key: "all",         label: "Todos",       icon: Grid },
    { key: "available",   label: "Para la Venta",icon: ShoppingBag },
    { key: "in_repair",   label: "En Taller",   icon: Wrench },
    { key: "in_diagnosis",label: "Diagnóstico", icon: Activity },
    { key: "sold",        label: "Vendidos",    icon: CheckCircle },
  ];

  return (
    <>
      {/* ═══════════ PRINT STYLES ═══════════ */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-catalog-root { display: block !important; }
          .print-workshop-root { display: block !important; }
          .no-print { display: none !important; }

          /* Impresion Hoja de Ingreso a Taller */
          .workshop-receipt {
            font-family: Arial, sans-serif;
            max-w: 800px;
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
            font-size: 11px; font-weight: bold; text-transform: uppercase; color: #2563eb; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; pb: 4px;
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
          .signature-line { border-top: 1px dashed #475569; pt: 6px; font-size: 11px; font-weight: bold; }

          /* Impresion de Catalogo General */
          .print-catalog-root { font-family: Arial, sans-serif; }
          .print-header { text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #333; }
          .print-header h1 { font-size: 22px; font-weight: bold; margin: 0; }
          .print-header p { font-size: 12px; color: #666; margin: 4px 0 0; }
          .print-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; page-break-inside: avoid; }
          .print-card { border: 1px solid #ccc; border-radius: 8px; overflow: hidden; page-break-inside: avoid; display: flex; flex-direction: column; }
          .print-photo { width: 100%; height: 140px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; overflow: hidden; }
          .print-photo img { width: 100%; height: 100%; object-fit: cover; }
          .print-no-photo { font-size: 40px; }
          .print-info { padding: 10px; }
          .print-code { font-family: monospace; font-size: 9px; color: #3b82f6; background: #eff6ff; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 4px; }
          .print-name { font-size: 14px; font-weight: bold; margin-bottom: 6px; color: #111; }
          .print-specs { font-size: 10px; color: #555; margin-bottom: 6px; }
          .print-specs span { display: block; }
          .print-price { font-size: 18px; font-weight: 900; color: #2563eb; }
          .print-status { font-size: 10px; color: #666; margin-top: 2px; }
        }
        @media screen {
          .print-catalog-root { display: none; }
          .print-workshop-root { display: none; }
        }
      `}</style>

      {/* ═══════════ PRINT-ONLY: CATÁLOGO GENERAL ═══════════ */}
      <div className="print-catalog-root">
        <div className="print-header">
          <h1>Catálogo de Inventario</h1>
          <p>Generado el {new Date().toLocaleDateString("es-BO")} · {items.length} artículo{items.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="print-grid">
          {items.map((unit) => <PrintableCard key={unit.id} unit={unit} />)}
        </div>
      </div>

      {/* ═══════════ SCREEN UI ═══════════════ */}
      <div className="no-print min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">

        {/* Hero Header */}
        <div className="bg-white border-b border-slate-200 shadow-sm">
          <div className="container mx-auto px-4 md:px-6 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inventario / Catálogo</h1>
                    <p className="text-sm text-slate-500">Gestión visual de laptops, equipos y artículos con cambio de estado interactivo</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a href="/register-unit">
                  <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200">
                    <Camera className="h-4 w-4" />
                    Registrar Equipo
                  </Button>
                </a>
                <Button
                  onClick={() => setIsCommercialCatalogOpen(true)}
                  className="gap-2 bg-slate-900 hover:bg-black text-white font-bold shadow-md shadow-slate-300"
                >
                  <FileText className="h-4 w-4 text-blue-400" />
                  Generar Catálogo Comercial
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mt-5 overflow-x-auto pb-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                      statusTab === tab.key
                        ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por marca, modelo, código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white border-slate-200 shadow-sm"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44 bg-white border-slate-200 shadow-sm">
                  <Filter className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="laptop">Laptops</SelectItem>
                  <SelectItem value="tablet">Tablets</SelectItem>
                  <SelectItem value="phone">Celulares</SelectItem>
                  <SelectItem value="monitor">Monitores</SelectItem>
                  <SelectItem value="charger">Cargadores</SelectItem>
                  <SelectItem value="accessory">Accesorios / Repuestos</SelectItem>
                  <SelectItem value="other">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Selector de Modo: Agrupado por Producto vs Unidades Individuales */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                <button
                  type="button"
                  onClick={() => setCatalogMode("grouped")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    catalogMode === "grouped"
                      ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                  title="Muestra 1 tarjeta por modelo de producto con su stock total"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  Por Producto ({groupedProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogMode("individual")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    catalogMode === "individual"
                      ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                  title="Muestra todas las unidades físicas y códigos de forma desglosada"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Por Unidad ({items.length})
                </button>
              </div>

              {/* Botones de Vista Grid / List */}
              <div className="flex items-center border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2.5 transition-colors ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-700"}`}
                  title="Vista en Cuadrícula"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2.5 transition-colors ${viewMode === "list" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-700"}`}
                  title="Vista en Lista"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-500">
            {catalogMode === "grouped" ? (
              <span className="font-bold text-slate-800">
                {groupedProducts.length} producto{groupedProducts.length !== 1 ? "s" : ""} · {items.length} unidades físicas en inventario
              </span>
            ) : (
              <span className="font-bold text-slate-800">
                {items.length} unidad{items.length !== 1 ? "es" : ""} física{items.length !== 1 ? "s" : ""}
              </span>
            )}

            {items.filter(u => u.status === "available").length > 0 && (
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                <ShoppingBag className="h-3.5 w-3.5" />
                {items.filter(u => u.status === "available").length} disponibles para la venta
              </span>
            )}
            {items.filter(u => u.status === "in_repair").length > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-semibold">
                <Wrench className="h-3.5 w-3.5" />
                {items.filter(u => u.status === "in_repair").length} en taller
              </span>
            )}
            {items.filter(u => u.status === "in_diagnosis").length > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                <Activity className="h-3.5 w-3.5" />
                {items.filter(u => u.status === "in_diagnosis").length} en diagnóstico
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 md:px-6 pb-12">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
                  <div className="h-44 bg-slate-100" />
                  <div className="p-4 space-y-3">
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                    <div className="h-4 bg-slate-100 rounded w-2/3" />
                    <div className="h-8 bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (catalogMode === "grouped" ? groupedProducts.length === 0 : items.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="p-5 bg-slate-100 rounded-full">
                <Package className="h-12 w-12 text-slate-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-700">Sin resultados</h3>
                <p className="text-slate-500 mt-1 max-w-xs">
                  No hay artículos que coincidan con los filtros seleccionados.
                </p>
              </div>
              <a href="/register-unit">
                <Button className="gap-2 mt-2">
                  <Camera className="h-4 w-4" />
                  Registrar primer equipo
                </Button>
              </a>
            </div>
          ) : catalogMode === "grouped" ? (
            // ═══════════ VISTA AGRUPADA POR PRODUCTO / MODELO ═══════════
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {groupedProducts.map((group) => (
                  <GroupedProductCard
                    key={group.key}
                    group={group}
                    onOpenGroupUnits={() => {
                      setSelectedGroupForUnits(group);
                      setIsGroupUnitsModalOpen(true);
                    }}
                    onOpenDetail={() => {
                      if (group.primaryUnit) {
                        setSelectedUnit(group.primaryUnit);
                        setIsDetailOpen(true);
                      }
                    }}
                    onOpenCommercialSheet={(uId) => {
                      setCommercialSheetUnitId(uId);
                      setIsCommercialSheetOpen(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              // Vista Agrupada en Lista
              <div className="space-y-3">
                {groupedProducts.map((group) => {
                  const mainPhoto = group.photos[0];
                  const specs = group.specs || {};
                  return (
                    <div
                      key={group.key}
                      onClick={() => {
                        if (group.primaryUnit) {
                          setSelectedUnit(group.primaryUnit);
                          setIsDetailOpen(true);
                        }
                      }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer overflow-hidden"
                    >
                      <div className="flex items-center gap-4 p-4 flex-wrap sm:flex-nowrap">
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-50 shrink-0 flex items-center justify-center">
                          {mainPhoto ? (
                            <img src={mainPhoto} alt="" className="w-full h-full object-cover" />
                          ) : group.type === "laptop" ? (
                            <Laptop className="h-8 w-8 text-slate-300" />
                          ) : (
                            <Package className="h-8 w-8 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-600 bg-slate-50">
                              {group.type}
                            </Badge>
                            {group.availableCount > 0 ? (
                              <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1">
                                <ShoppingBag className="h-3 w-3" />
                                {group.availableCount} {group.availableCount === 1 ? "disponible" : "disponibles"}
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-600 text-white font-bold text-xs">
                                {group.inRepairCount > 0 ? `${group.inRepairCount} en taller` : "Sin stock"}
                              </Badge>
                            )}
                            <span className="text-xs text-slate-400">({group.units.length} uds. en total)</span>
                          </div>
                          <div className="font-bold text-slate-900 text-base">{group.brand} {group.model}</div>
                          {group.type === "laptop" && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {specs.cpu} {specs.ram ? `· ${specs.ram}` : ""} {specs.storage ? `· ${specs.storage}` : ""}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-xl font-black text-blue-600">
                              {group.salePrice ? `Bs. ${(group.salePrice / 100).toFixed(0)}` : <span className="text-slate-400 text-sm">Sin precio</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroupForUnits(group);
                              setIsGroupUnitsModalOpen(true);
                            }}
                            className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 gap-1.5 h-8 shrink-0"
                          >
                            <Boxes className="h-3.5 w-3.5" />
                            Ver ({group.units.length})
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (group.primaryUnit?.id) {
                                setCommercialSheetUnitId(group.primaryUnit.id);
                                setIsCommercialSheetOpen(true);
                              }
                            }}
                            className="text-xs font-bold text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 gap-1.5 h-8 shrink-0"
                          >
                            <FileText className="h-3.5 w-3.5 text-blue-600" />
                            Ficha Comercial
                          </Button>
                          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // ═══════════ VISTA INDIVIDUAL POR SERIE / CÓDIGO ═══════════
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {items.map((unit) => (
                  <UnitCard
                    key={unit.id}
                    unit={unit}
                    onSelect={() => { setSelectedUnit(unit); setIsDetailOpen(true); }}
                    onStatusChange={(newStatus) => handleStatusChangeRequest(unit, newStatus)}
                    onOpenCommercialSheet={(uId) => {
                      setCommercialSheetUnitId(uId);
                      setIsCommercialSheetOpen(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              // List view
              <div className="space-y-3">
                {items.map((unit) => {
                  const photos: string[] = unit.photos ? (typeof unit.photos === "string" ? JSON.parse(unit.photos) : unit.photos) : [];
                  const specs = unit.specs || {};
                  return (
                    <div
                      key={unit.id}
                      onClick={() => { setSelectedUnit(unit); setIsDetailOpen(true); }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer overflow-hidden"
                    >
                      <div className="flex items-center gap-4 p-4 flex-wrap sm:flex-nowrap">
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-50 shrink-0 flex items-center justify-center">
                          {photos[0]
                            ? <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                            : <Laptop className="h-8 w-8 text-slate-300" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{unit.code}</span>
                            <UnitStatusSelect
                              currentStatus={unit.status}
                              onStatusChange={(newStatus) => handleStatusChangeRequest(unit, newStatus)}
                            />
                          </div>
                          <div className="font-bold text-slate-900">{unit.brand} {unit.model}</div>
                          {unit.type === "laptop" && (
                            <div className="text-xs text-slate-500 mt-0.5">{specs.cpu} · {specs.ram} · {specs.storage}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-xl font-black text-blue-600">
                              {unit.salePrice ? `Bs. ${(unit.salePrice / 100).toFixed(0)}` : <span className="text-slate-400 text-sm">Sin precio</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCommercialSheetUnitId(unit.id);
                              setIsCommercialSheetOpen(true);
                            }}
                            className="text-xs font-bold text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 gap-1.5 h-8 shrink-0"
                          >
                            <FileText className="h-3.5 w-3.5 text-blue-600" />
                            Ficha Comercial
                          </Button>
                          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* ═══════════ MODAL: LISTADO DE UNIDADES DEL PRODUCTO / LOTE ═══════════ */}
      <Dialog open={isGroupUnitsModalOpen} onOpenChange={setIsGroupUnitsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-lg font-black">
              <Boxes className="h-5 w-5 text-blue-600" />
              Unidades en Inventario: {selectedGroupForUnits?.brand} {selectedGroupForUnits?.model}
            </DialogTitle>
            <DialogDescription>
              Desglose de cada unidad física con su número de código/serie individual y estado actual.
            </DialogDescription>
          </DialogHeader>

          {selectedGroupForUnits && (
            <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
              {/* Badges de Resumen del Grupo */}
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Total registradas:</span>
                  <Badge className="bg-slate-800 text-white font-bold">{selectedGroupForUnits.units.length} unidades</Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-emerald-600 text-white font-bold">
                    {selectedGroupForUnits.availableCount} Disponibles
                  </Badge>
                  {selectedGroupForUnits.inRepairCount > 0 && (
                    <Badge className="bg-red-600 text-white font-bold">
                      {selectedGroupForUnits.inRepairCount} En Taller
                    </Badge>
                  )}
                  {selectedGroupForUnits.inDiagnosisCount > 0 && (
                    <Badge className="bg-amber-600 text-white font-bold">
                      {selectedGroupForUnits.inDiagnosisCount} En Diagnóstico
                    </Badge>
                  )}
                  {selectedGroupForUnits.soldCount > 0 && (
                    <Badge className="bg-slate-500 text-white font-bold">
                      {selectedGroupForUnits.soldCount} Vendidas
                    </Badge>
                  )}
                </div>
              </div>

              {/* Lista de Unidades Individuales */}
              <div className="space-y-2">
                {selectedGroupForUnits.units.map((u: any, idx: number) => {
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-slate-400 w-6">#{idx + 1}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {u.code}
                            </span>
                            {u.serialNumber && (
                              <span className="text-[11px] text-slate-500 font-mono">
                                SN: {u.serialNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {u.condition ? `Condición: ${u.condition}/10` : ""} {u.batteryHealth && u.batteryHealth !== "n_a" ? `· ${BATTERY_LABEL[u.batteryHealth]}` : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <UnitStatusSelect
                          currentStatus={u.status}
                          onStatusChange={(newStatus) => {
                            handleStatusChangeRequest(u, newStatus);
                            u.status = newStatus;
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedUnit(u);
                            setIsDetailOpen(true);
                          }}
                          className="h-8 text-xs font-bold text-blue-600 hover:bg-blue-50"
                        >
                          Ver Detalle
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGroupUnitsModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ MODAL: FORMULARIO DE TRASPASO A TALLER ═══════════ */}
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
              {/* Card Resumen de Equipo */}
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

              {/* Motivo de ingreso */}
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

              {/* Tecnico Asignado */}
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

              {/* Accesorios Dejados */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Accesorios Recibidos junto al equipo:
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="acc-charger"
                      checked={workshopAccessories.charger}
                      onCheckedChange={(c) => setWorkshopAccessories({ ...workshopAccessories, charger: !!c })}
                    />
                    <label htmlFor="acc-charger" className="text-xs cursor-pointer">Cargador original</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="acc-bag"
                      checked={workshopAccessories.bag}
                      onCheckedChange={(c) => setWorkshopAccessories({ ...workshopAccessories, bag: !!c })}
                    />
                    <label htmlFor="acc-bag" className="text-xs cursor-pointer">Funda / Bolso</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="acc-mouse"
                      checked={workshopAccessories.mouse}
                      onCheckedChange={(c) => setWorkshopAccessories({ ...workshopAccessories, mouse: !!c })}
                    />
                    <label htmlFor="acc-mouse" className="text-xs cursor-pointer">Mouse / Periférico</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="acc-box"
                      checked={workshopAccessories.box}
                      onCheckedChange={(c) => setWorkshopAccessories({ ...workshopAccessories, box: !!c })}
                    />
                    <label htmlFor="acc-box" className="text-xs cursor-pointer">Caja original</label>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
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

      {/* ═══════════ MODAL: DETALLE DE UNIDAD ════════════ */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedUnit && (() => {
            const photos: string[] = selectedUnit.photos
              ? (typeof selectedUnit.photos === "string" ? JSON.parse(selectedUnit.photos) : selectedUnit.photos)
              : [];
            const specs = selectedUnit.specs || {};

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">
                        {selectedUnit.code}
                      </span>
                      <span className="text-slate-900">{selectedUnit.brand} {selectedUnit.model}</span>
                    </div>
                    {/* Status Select in Detail Header */}
                    <UnitStatusSelect
                      currentStatus={selectedUnit.status}
                      onStatusChange={(newStatus) => {
                        handleStatusChangeRequest(selectedUnit, newStatus);
                        setIsDetailOpen(false);
                      }}
                    />
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                  {/* Photo Gallery */}
                  <PhotoGallery photos={photos} />

                  {/* Price */}
                  <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Precio de venta</div>
                      <div className="text-2xl font-black text-blue-600">
                        {selectedUnit.salePrice
                          ? `Bs. ${(selectedUnit.salePrice / 100).toFixed(2)}`
                          : <span className="text-slate-400 text-base font-normal">Por definir</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* TikTok Video */}
                  {selectedUnit.tiktokUrl && (
                    <a
                      href={selectedUnit.tiktokUrl.startsWith("http") ? selectedUnit.tiktokUrl : `https://${selectedUnit.tiktokUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-black hover:from-black hover:to-slate-900 text-white transition-all shadow-sm border border-slate-700/60 group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-pink-500/20 text-pink-400 rounded-lg border border-pink-500/30 flex items-center justify-center font-bold text-xs">
                          🎵
                        </div>
                        <div>
                          <p className="font-black text-xs text-white group-hover:text-pink-300 transition-colors flex items-center gap-1.5">
                            Video Demostrativo en TikTok
                            <span className="text-[9px] bg-pink-500 text-white px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                              Ver Video
                            </span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs sm:max-w-md">{selectedUnit.tiktokUrl}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-pink-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                        <span>Reproducir</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </div>
                    </a>
                  )}

                  {/* Specs */}
                  <SpecsCard
                    specs={specs}
                    unitType={selectedUnit.type as any}
                    serialNumber={selectedUnit.serialNumber}
                  />

                  {/* Condition */}
                  {selectedUnit.type === "laptop" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-amber-50 rounded-xl p-3">
                        <div className="text-xs text-amber-700 font-semibold mb-1">Estado Estético</div>
                        <div className="flex items-center gap-2">
                          <div className="text-2xl font-black text-amber-700">{selectedUnit.condition || "N/D"}</div>
                          <div className="text-sm text-amber-600">/ 10</div>
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3">
                        <div className="text-xs text-green-700 font-semibold mb-1">Batería</div>
                        <div className="text-sm font-bold text-green-700">{BATTERY_LABEL[selectedUnit.batteryHealth] || "N/D"}</div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-2 border-t">
                    <Button
                      onClick={() => {
                        const uid = selectedUnit.id;
                        setIsDetailOpen(false);
                        setCommercialSheetUnitId(uid);
                        setIsCommercialSheetOpen(true);
                      }}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      <FileText className="h-4 w-4" />
                      Generar Ficha Comercial
                    </Button>
                    <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                      Cerrar
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

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
                  El equipo cambiará su estado a <strong>Disponible para Venta</strong> y quedará listo en el catálogo comercial.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  Notas de Cierre / Trabajo Realizado (opcional):
                </label>
                <Textarea
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  placeholder="Ej. Reparación de pantalla finalizada, mantenimiento térmico realizado..."
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

      {/* Modal: Orden de Trabajo PDF — generado al aprobar traspaso a taller */}
      <WorkOrderModal
        repairId={workOrderRepairId}
        unitId={workOrderUnitId}
        open={workOrderModalOpen}
        onOpenChange={setWorkOrderModalOpen}
      />
    </>
  );
}
