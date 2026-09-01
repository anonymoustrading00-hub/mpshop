import React, { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Printer, X, Search, FileText, Loader2, Sparkles, Layers,
  QrCode, Laptop, Cpu, HardDrive, Battery, CheckCircle2, ShieldCheck, Download
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import QRCode from "qrcode";

export interface DisplayCardUnit {
  id: number;
  code: string;
  brand: string;
  model: string;
  type?: string;
  salePrice: number;
  specs?: any;
  damageNotes?: string;
  warrantyDays?: number;
  tiktokUrl?: string;
  status?: string;
  branchName?: string;
}

interface DisplayCardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units?: DisplayCardUnit[];
  preselectedUnitId?: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  all: "Todos los tipos",
  laptop: "Laptops",
  phone: "Celulares",
  tablet: "Tablets",
  monitor: "Monitores",
  accessory: "Accesorios",
};

export function DisplayCardsModal({
  open,
  onOpenChange,
  units: propUnits,
  preselectedUnitId,
}: DisplayCardsModalProps) {
  const [printFormat, setPrintFormat] = useState<"letter" | "thermal">("letter");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Consultar unidad individual si se pasa preselectedUnitId
  const { data: singleUnitData } = trpc.units.getById.useQuery(
    { id: preselectedUnitId! },
    { enabled: open && !!preselectedUnitId }
  );

  // Si no se pasan unidades por prop o faltan, consultar las unidades del sistema (sin restringir estado)
  const { data: unitsList, isLoading: isLoadingUnits } = trpc.units.list.useQuery(
    { limit: 500 },
    { enabled: open }
  );

  const { data: companyConfig } = trpc.settings.getCompanyConfig.useQuery(undefined, { enabled: open });

  const companyName = companyConfig?.name || "MP SHOP TIENDA ONLINE";
  const companyPhone = companyConfig?.phone || companyConfig?.whatsapp || "+591 70000000";

  // Lista consolidada de unidades
  const allUnits: DisplayCardUnit[] = useMemo(() => {
    const list: DisplayCardUnit[] = [];
    const seenIds = new Set<number>();

    const addUnit = (u: any) => {
      if (!u || !u.id || seenIds.has(u.id)) return;
      seenIds.add(u.id);
      list.push({
        id: u.id,
        code: u.code || `EQ-${u.id}`,
        brand: u.brand || "",
        model: u.model || "",
        type: u.type || "laptop",
        salePrice: u.salePrice || 0,
        specs: typeof u.specs === "object" ? u.specs : (() => {
          try { return JSON.parse(u.specs || "{}"); } catch { return {}; }
        })(),
        damageNotes: u.damageNotes,
        warrantyDays: u.warrantyDays || 90,
        tiktokUrl: u.tiktokUrl,
        status: u.status,
        branchName: u.branchName,
      });
    };

    if (singleUnitData) {
      addUnit(singleUnitData);
    }
    if (propUnits && propUnits.length > 0) {
      propUnits.forEach(addUnit);
    }
    if (unitsList?.items) {
      unitsList.items.forEach(addUnit);
    }

    return list;
  }, [propUnits, singleUnitData, unitsList]);

  // Si se pasa preselectedUnitId, seleccionarlo por defecto al abrir y reiniciar filtros
  React.useEffect(() => {
    if (open) {
      if (preselectedUnitId) {
        setSelectedUnitIds([preselectedUnitId]);
        setTypeFilter("all");
        setSearch("");
      } else if (allUnits.length > 0) {
        setSelectedUnitIds(allUnits.map((u) => u.id));
      }
    }
  }, [preselectedUnitId, open]);

  // Filtrar unidades
  const filteredUnits = useMemo(() => {
    return allUnits.filter((u) => {
      const matchType =
        typeFilter === "all" ||
        (u.type && u.type.toLowerCase() === typeFilter.toLowerCase());
      const q = search.trim().toLowerCase();
      const s = u.specs || {};
      const cpuVal = s.cpu || s.processor || s.procesador || "";
      const matchSearch =
        !q ||
        (u.code && u.code.toLowerCase().includes(q)) ||
        (u.brand && u.brand.toLowerCase().includes(q)) ||
        (u.model && u.model.toLowerCase().includes(q)) ||
        String(cpuVal).toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [allUnits, typeFilter, search]);


  const toggleSelectAll = () => {
    if (selectedUnitIds.length === filteredUnits.length) {
      setSelectedUnitIds([]);
    } else {
      setSelectedUnitIds(filteredUnits.map((u) => u.id));
    }
  };

  const toggleUnit = (id: number) => {
    setSelectedUnitIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Formatear texto de especificaciones completo para laptops y otros dispositivos
  const getSpecsList = (unit: DisplayCardUnit) => {
    const s = unit.specs || {};
    const items: { label: string; val: string; icon?: string; priority: number }[] = [];

    // Procesador
    const cpu = s.cpu || s.processor || s.procesador || s.Processor || s.CPU;
    if (cpu) items.push({ label: "PROCESADOR", val: String(cpu), icon: "⚡", priority: 1 });

    // RAM
    const ram = s.ram || s.RAM || s.memory || s.memoria;
    if (ram) items.push({ label: "RAM", val: String(ram), icon: "🧠", priority: 2 });

    // Almacenamiento / Disco
    const storage = s.storage || s.disk || s.disco || s.almacenamiento || s.ssd || s.hdd;
    if (storage) items.push({ label: "DISCO", val: String(storage), icon: "💾", priority: 3 });

    // Pantalla
    const screen = s.screenSize || s.screen || s.pantalla || s.display;
    if (screen) items.push({ label: "PANTALLA", val: String(screen), icon: "🖥️", priority: 4 });

    // Tarjeta Gráfica / Video
    const gpu = s.gpu || s.graphics || s.video || s.tarjetaGrafica || s.tarjetaDeVideo;
    if (gpu) items.push({ label: "VIDEO", val: String(gpu), icon: "🎮", priority: 5 });

    // Resolución
    const res = s.resolution || s.resolucion;
    if (res) items.push({ label: "RESOLUCIÓN", val: String(res), icon: "📐", priority: 6 });

    // Sistema Operativo
    const os = s.os || s.sistemaOperativo || s.sistema_operativo || s.so;
    if (os) items.push({ label: "SISTEMA", val: String(os), icon: "💻", priority: 7 });

    // Batería
    if (s.batteryHealth) {
      const batVal = s.batteryHealth === "plugged_only" ? "Solo con cargador" : `${s.batteryHealth}%`;
      items.push({ label: "BATERÍA", val: batVal, icon: "🔋", priority: 8 });
    }

    // Estado / Condición
    if (s.conditionGrade || s.condition) {
      const cond = s.conditionGrade || s.condition;
      items.push({ label: "ESTADO", val: `Grado ${cond} (Seminuevo)`, icon: "✨", priority: 9 });
    }

    // Otras características dinámicas
    const knownKeys = new Set([
      "cpu", "processor", "procesador", "Processor", "CPU",
      "ram", "RAM", "memory", "memoria",
      "storage", "disk", "disco", "almacenamiento", "ssd", "hdd",
      "screenSize", "screen", "pantalla", "display",
      "gpu", "graphics", "video", "tarjetaGrafica", "tarjetaDeVideo",
      "resolution", "resolucion",
      "os", "sistemaOperativo", "sistema_operativo", "so",
      "batteryHealth", "conditionGrade", "condition"
    ]);

    Object.entries(s).forEach(([k, v]) => {
      if (!knownKeys.has(k) && v && String(v).trim()) {
        items.push({ label: k.toUpperCase(), val: String(v), icon: "🔹", priority: 10 });
      }
    });

    return items.sort((a, b) => a.priority - b.priority);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERADOR DE PDF
  // ─────────────────────────────────────────────────────────────────────────────
  const generatePDF = useCallback(async () => {
    const unitsToPrint = allUnits.filter((u) => selectedUnitIds.includes(u.id));
    if (unitsToPrint.length === 0) {
      toast.error("Selecciona al menos un equipo para imprimir");
      return;
    }

    setIsGenerating(true);
    toast.info("Generando archivo PDF de fichas de exhibición...");

    try {
      // Pre-generar QRs en data URLs
      const qrDataUrls: Record<number, string> = {};
      for (const u of unitsToPrint) {
        const qrContent = u.tiktokUrl || `https://wa.me/${companyPhone.replace(/\D/g, "")}?text=Consulta%20equipo%20${encodeURIComponent(u.code)}%20${encodeURIComponent(u.brand + " " + u.model)}`;
        try {
          qrDataUrls[u.id] = await QRCode.toDataURL(qrContent, {
            width: 120,
            margin: 1,
            color: { dark: "#0f172a", light: "#ffffff" },
          });
        } catch {
          qrDataUrls[u.id] = "";
        }
      }

      if (printFormat === "thermal") {
        // ── FORMATO TÉRMICO CONTINUO: 80 mm ancho × 70 mm alto por página ─────
        const doc = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: [70, 80], // 80 mm ancho x 70 mm alto
        });

        unitsToPrint.forEach((unit, idx) => {
          if (idx > 0) doc.addPage([70, 80], "landscape");

          const cardW = 80;
          const cardH = 70;

          // Fondo blanco
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, cardW, cardH, "F");

          // Marco exterior fino
          doc.setDrawColor(203, 213, 225); // Slate 300
          doc.setLineWidth(0.3);
          doc.roundedRect(1.5, 1.5, cardW - 3, cardH - 3, 2, 2, "S");

          // Cabecera: Nombre de empresa y Código
          doc.setFillColor(15, 23, 42); // Slate 900
          doc.roundedRect(2, 2, cardW - 4, 7, 1.5, 1.5, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(255, 255, 255);
          doc.text(companyName.toUpperCase().slice(0, 26), 4, 6.2);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(250, 204, 21); // Amber 400
          doc.text(unit.code, cardW - 4, 6.2, { align: "right" });

          // Nombre del Equipo (Marca + Modelo)
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42);
          const fullName = `${unit.brand} ${unit.model}`;
          doc.text(fullName.slice(0, 42), 4, 12.5);

          // Línea divisoria
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(4, 14.5, cardW - 4, 14.5);

          // Especificaciones Técnicas (renderiza hasta 7 características en 1 o 2 columnas)
          const specsList = getSpecsList(unit);
          let ySpec = 18;
          doc.setFontSize(6.2);

          specsList.slice(0, 7).forEach((spec) => {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(71, 85, 105); // Slate 600
            doc.text(`${spec.label}:`, 4, ySpec);

            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42); // Slate 900
            const maxValLen = 34;
            doc.text(spec.val.slice(0, maxValLen), 23, ySpec);

            ySpec += 3.8;
          });

          // Franja Inferior: Precio + Garantía + QR
          const botY = 49;
          doc.setFillColor(248, 250, 252); // Slate 50
          doc.roundedRect(2.5, botY, cardW - 5, 17.5, 1.5, 1.5, "F");
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(2.5, botY, cardW - 5, 17.5, 1.5, 1.5, "S");

          // Precio
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.5);
          doc.setTextColor(100, 116, 139);
          doc.text("PRECIO DE OFERTA:", 5, botY + 4.2);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11.5);
          doc.setTextColor(5, 150, 105); // Emerald 600
          doc.text(`Bs. ${(unit.salePrice / 100).toFixed(2)}`, 5, botY + 10.5);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.5);
          doc.setTextColor(71, 85, 105);
          doc.text(`Garantía Real: ${unit.warrantyDays || 90} Días`, 5, botY + 15);

          // QR Code a la derecha
          const qrImg = qrDataUrls[unit.id];
          if (qrImg) {
            doc.addImage(qrImg, "PNG", cardW - 18.5, botY + 1, 15, 15);
          }
        });

        doc.save(`Fichas_Exhibicion_Termica_80x70_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success(`PDF generado con éxito (${unitsToPrint.length} etiquetas térmicas de 80x70mm)`);
      } else {
        // ── FORMATO HOJA CARTA: 8 FICHAS POR PÁGINA (2 COLUMNAS × 4 FILAS) ───
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "letter",
        });

        const pageW = 215.9;
        const pageH = 279.4;
        const marginX = 8;
        const marginY = 8;
        const cols = 2;
        const rows = 4;
        const cardW = (pageW - marginX * 2 - 4) / cols; // ~98 mm
        const cardH = (pageH - marginY * 2 - 6) / rows; // ~63.5 mm

        const CARDS_PER_PAGE = cols * rows; // 8 fichas por página

        unitsToPrint.forEach((unit, idx) => {
          const pageIndex = Math.floor(idx / CARDS_PER_PAGE);
          const cardIndexOnPage = idx % CARDS_PER_PAGE;
          const col = cardIndexOnPage % cols;
          const row = Math.floor(cardIndexOnPage / cols);

          if (idx > 0 && cardIndexOnPage === 0) {
            doc.addPage("letter", "portrait");
          }

          const x = marginX + col * (cardW + 4);
          const y = marginY + row * (cardH + 2);

          // Fondo tarjeta
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");

          // Borde con líneas punteadas para corte
          doc.setDrawColor(148, 163, 184); // Slate 400
          doc.setLineWidth(0.25);
          // @ts-ignore
          if (doc.setLineDash) doc.setLineDash([1.5, 1.5], 0);
          doc.roundedRect(x, y, cardW, cardH, 2, 2, "S");
          // @ts-ignore
          if (doc.setLineDash) doc.setLineDash([], 0);

          // Cabecera
          doc.setFillColor(15, 23, 42); // Slate 900
          doc.roundedRect(x + 1.5, y + 1.5, cardW - 3, 7, 1.5, 1.5, "F");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(255, 255, 255);
          doc.text(companyName.toUpperCase().slice(0, 32), x + 3.5, y + 5.8);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(250, 204, 21); // Amber 400
          doc.text(unit.code, x + cardW - 3.5, y + 5.8, { align: "right" });

          // Nombre de la Laptop / Equipo
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          const fullName = `${unit.brand} ${unit.model}`;
          doc.text(fullName.slice(0, 46), x + 3.5, y + 12.5);

          // Línea separadora
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(x + 3.5, y + 14.5, x + cardW - 3.5, y + 14.5);

          // Especificaciones
          const specsList = getSpecsList(unit);
          let ySpec = y + 18;
          doc.setFontSize(6.5);

          specsList.slice(0, 6).forEach((spec) => {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(100, 116, 139);
            doc.text(`${spec.label}:`, x + 3.5, ySpec);

            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(spec.val.slice(0, 42), x + 26, ySpec);

            ySpec += 3.7;
          });

          // Franja inferior: Precio + Garantía + QR
          const botY = y + cardH - 17.5;
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(x + 2, botY, cardW - 4, 15.5, 1.5, 1.5, "F");
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(x + 2, botY, cardW - 4, 15.5, 1.5, 1.5, "S");

          // Precio
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.5);
          doc.setTextColor(100, 116, 139);
          doc.text("PRECIO DE OFERTA:", x + 4, botY + 4);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(5, 150, 105);
          doc.text(`Bs. ${(unit.salePrice / 100).toFixed(2)}`, x + 4, botY + 9.8);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.2);
          doc.setTextColor(71, 85, 105);
          doc.text(`Garantía Real: ${unit.warrantyDays || 90} Días`, x + 4, botY + 13.5);

          // QR Code
          const qrImg = qrDataUrls[unit.id];
          if (qrImg) {
            doc.addImage(qrImg, "PNG", x + cardW - 17.5, botY + 0.8, 14, 14);
          }
        });

        const totalPages = Math.ceil(unitsToPrint.length / CARDS_PER_PAGE);
        doc.save(`Fichas_Exhibicion_Carta_8porHoja_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success(`PDF generado con éxito (${totalPages} página${totalPages > 1 ? "s" : ""} · ${unitsToPrint.length} fichas)`);
      }
    } catch (err) {
      console.error("Error generando PDF:", err);
      toast.error("Ocurrió un error al generar las fichas en PDF");
    } finally {
      setIsGenerating(false);
    }
  }, [allUnits, selectedUnitIds, printFormat, companyName, companyPhone]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50">
        {/* Cabecera del Modal */}
        <DialogHeader className="p-5 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">
                  Fichas Adhesivas de Exhibición (Vitrina)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Genera etiquetas adhesivas para colocar en la esquina superior de la pantalla de tus laptops.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Panel de Configuración & Filtros */}
        <div className="p-4 bg-white border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Selector de Formato */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Formato de Impresión:
            </label>
            <Select value={printFormat} onValueChange={(val: any) => setPrintFormat(val)}>
              <SelectTrigger className="h-9 text-xs font-semibold bg-slate-50 border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="letter">
                  📄 Hoja Carta (8 Fichas por Página - Máxima Densidad)
                </SelectItem>
                <SelectItem value="thermal">
                  🏷️ Rollo Térmico Adhesivo (80 mm × 70 mm)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Tipo */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Tipo de Equipo:
            </label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Buscador */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Buscar Modelo o Código:
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por código, procesador, modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 text-xs bg-slate-50 border-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Resumen & Selección Rápida */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleSelectAll}
              className="h-7 text-xs font-bold border-slate-300 bg-white"
            >
              {selectedUnitIds.length === filteredUnits.length ? "Deseleccionar Todos" : "Seleccionar Todos"}
            </Button>
            <span className="text-slate-600 font-medium">
              Seleccionados: <strong className="text-slate-900 font-bold">{selectedUnitIds.length}</strong> de {filteredUnits.length} equipos
            </span>
          </div>

          <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
            {printFormat === "letter" ? (
              <span className="text-blue-700 font-bold">
                💡 Se generarán {Math.ceil(selectedUnitIds.length / 8)} página(s) carta (8 fichas recortables por hoja)
              </span>
            ) : (
              <span className="text-emerald-700 font-bold">
                💡 Se generará 1 tira continua de {selectedUnitIds.length} etiqueta(s) térmica(s) de 80×70mm
              </span>
            )}
          </div>
        </div>

        {/* Lista / Preview de Tarjetas Disponibles */}
        <div className="flex-1 p-4 overflow-y-auto max-h-[50vh]">
          {isLoadingUnits ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              <span className="text-xs">Cargando equipos disponibles...</span>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No se encontraron equipos disponibles con los filtros aplicados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredUnits.map((u) => {
                const isSelected = selectedUnitIds.includes(u.id);
                const specsList = getSpecsList(u);

                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUnit(u.id)}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer bg-white text-xs space-y-2 relative ${
                      isSelected
                        ? "border-emerald-500 shadow-sm bg-emerald-50/20"
                        : "border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-300"
                    }`}
                  >
                    {/* Header Mini */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px]">
                          {u.code}
                        </span>
                      </div>
                      <Badge className="bg-emerald-600 text-white font-black text-[11px]">
                        Bs. {(u.salePrice / 100).toFixed(2)}
                      </Badge>
                    </div>

                    {/* Modelo */}
                    <div className="font-bold text-slate-800 text-sm tracking-tight">
                      {u.brand} {u.model}
                    </div>

                    {/* Especificaciones Chips */}
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      {specsList.map((sp, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-700 font-medium border border-slate-200/60"
                        >
                          <strong>{sp.label}:</strong> {sp.val}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie del Modal con Acciones */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            {printFormat === "letter" ? (
              <span>
                Formato: <strong>Hoja Carta</strong> (Recortable con tijera o guillotina)
              </span>
            ) : (
              <span>
                Formato: <strong>Térmico 80×70 mm</strong> (Para impresoras de rollo adhesivo)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none text-xs"
            >
              Cerrar
            </Button>

            <Button
              onClick={generatePDF}
              disabled={isGenerating || selectedUnitIds.length === 0}
              className="flex-1 sm:flex-none gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Descargar Fichas PDF ({selectedUnitIds.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
