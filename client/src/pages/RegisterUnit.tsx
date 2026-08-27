import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QrCode, Search, CheckCircle, AlertTriangle, Plus, Minus, Laptop, Trash2, Camera, ImagePlus, X, Smartphone, Tablet, Monitor, Plug, Package, MoreHorizontal, Wallet, Landmark, Video, ExternalLink, Play, Boxes, Layers, Calculator, Printer } from "lucide-react";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/currency";
import { useBranch } from "@/contexts/BranchContext";
import { BatchLabelsModal } from "@/components/BatchLabelsModal";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import type { DeviceBrand, DeviceModel, Processor, RamOption, StorageOption, ScreenSize } from "../../../drizzle/schema";

type UnitType = "laptop" | "tablet" | "phone" | "monitor" | "charger" | "accessory" | "other";

const TYPE_PREFIX: Record<UnitType, string> = {
  laptop: "LT",
  tablet: "TB",
  phone: "CEL",
  monitor: "MON",
  charger: "CHG",
  accessory: "ACC",
  other: "OTH",
};

const TYPE_LABEL: Record<UnitType, string> = {
  laptop: "Laptop",
  tablet: "Tablet",
  phone: "Celular",
  monitor: "Monitor",
  charger: "Cargador",
  accessory: "Accesorio / Repuesto",
  other: "Otro",
};

const TYPE_ICON: Record<UnitType, React.ReactNode> = {
  laptop: <Laptop className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
  phone: <Smartphone className="h-4 w-4" />,
  monitor: <Monitor className="h-4 w-4" />,
  charger: <Plug className="h-4 w-4" />,
  accessory: <Package className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
};

// Tipos que tienen batería (mostrar condición estética + batería)
const TYPES_WITH_BATTERY = new Set<UnitType>(["laptop", "tablet", "phone"]);

// Tipos que son simples (no requieren diagnóstico; van directo a 'available')
const SIMPLE_TYPES = new Set<UnitType>(["charger", "accessory", "other"]);

// Damage checklist por tipo (campos relevantes)
const CHECKLIST_BY_TYPE: Record<UnitType, Record<string, string>> = {
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
    functional: "No funciona",
    other: "Otros detalles",
  },
};

function validateImeiFormat(imei: string): { valid: boolean; reason?: string } {
  const trimmed = imei.trim();
  if (!trimmed) return { valid: true }; // IMEI es opcional
  if (!/^\d{15}$/.test(trimmed)) {
    return { valid: false, reason: "El IMEI debe tener exactamente 15 dígitos numéricos." };
  }
  return { valid: true };
}

export default function RegisterUnit() {
  const [, setLocation] = useLocation();
  const { activeBranchId, branches } = useBranch();
  const [scannedCode, setScannedCode] = useState("");

  const scanInputRef = useRef<HTMLInputElement>(null);

  // Estado del flujo
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [codeStatusState, setCodeStatusState] = useState<"unassigned" | "assigned" | "non_existent" | null>(null);
  const [existingUnitData, setExistingUnitData] = useState<any>(null);
  const [generatedCodeObj, setGeneratedCodeObj] = useState<any>(null);

  // Campos del formulario
  const [type, setType] = useState<UnitType>("laptop");
  const [brandId, setBrandId] = useState<number | undefined>();
  const [modelId, setModelId] = useState<number | undefined>();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [condition, setCondition] = useState("8");
  const [batteryHealth, setBatteryHealth] = useState<string>("100");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [purchaseDate, setPurchaseDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr" | "transfer">("cash");
  const [damageNotes, setDamageNotes] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");

  // Estado para modal de impresión de etiquetas de lote
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchCreatedData, setBatchCreatedData] = useState<{
    codes: string[];
    brand: string;
    model: string;
    type: string;
    salePrice?: number;
  } | null>(null);

  // Fotos del equipo (base64)
  const [photos, setPhotos] = useState<string[]>([]);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const photoCameraInputRef = useRef<HTMLInputElement>(null);

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

  const handlePhotoFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const remaining = 8 - photos.length;
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
          setPhotos((prev) => {
            if (prev.length >= 8) return prev;
            return [...prev, compressed];
          });
        }
      };
      reader.readAsDataURL(file);
      processed++;
    }
    if (processed > 0) toast.success(`${processed} foto${processed > 1 ? "s" : ""} agregada${processed > 1 ? "s" : ""}`);
  }, [photos.length]);

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Damage Checklist — se inicializa/reinicia cuando cambia el tipo
  const [damageChecklist, setDamageChecklist] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(CHECKLIST_BY_TYPE.laptop).map((k) => [k, false]))
  );

  // Sugerencia de código al cambiar el tipo (cuenta cuántos hay con ese prefijo)
  const { data: unitsByPrefix } = trpc.units.list.useQuery(
    { type, limit: 1, offset: 0 } as any,
    { enabled: false }
  );

  const suggestedCode = useMemo(() => {
    const prefix = TYPE_PREFIX[type];
    return `${prefix}-${String(Date.now()).slice(-6)}`;
  }, [type]);

  // Specs flexibles (pares clave-valor) — sugeridos según el tipo
  const initialSpecs = useMemo<Array<{ key: string; value: string }>>(() => {
    if (type === "laptop" || type === "tablet") {
      return [
        { key: "cpu", value: "" },
        { key: "ram", value: "" },
        { key: "storage", value: "" },
        { key: "screenSize", value: "" },
      ];
    }
    if (type === "phone") {
      return [
        { key: "ram", value: "" },
        { key: "storage", value: "" },
        { key: "screenSize", value: "" },
        { key: "os", value: "Android" },
      ];
    }
    if (type === "monitor") {
      return [
        { key: "screenSize", value: "" },
        { key: "resolution", value: "" },
        { key: "panelType", value: "IPS" },
      ];
    }
    if (type === "charger") {
      return [
        { key: "wattage", value: "" },
        { key: "connector", value: "" },
      ];
    }
    return [{ key: "description", value: "" }];
  }, [type]);

  const [customSpecs, setCustomSpecs] = useState<Array<{ key: string; value: string }>>(initialSpecs);

  // Resetear checklist y specs cuando cambia el tipo
  useEffect(() => {
    setDamageChecklist(Object.fromEntries(Object.keys(CHECKLIST_BY_TYPE[type]).map((k) => [k, false])));
    setCustomSpecs(initialSpecs);
    if (!TYPES_WITH_BATTERY.has(type)) {
      setBatteryHealth("n_a");
    } else {
      setBatteryHealth("100");
    }
  }, [type, initialSpecs]);

  // Handler para cambio de marca (ahora permite texto libre)
  const handleBrandChange = (value: string | number) => {
    if (typeof value === 'string') {
      // Texto libre
      setBrand(value);
      setBrandId(undefined);
      setModelId(undefined);
      setModel("");
    } else {
      // Selección de catálogo
      const selectedBrandId = value;
      setBrandId(selectedBrandId);
      const selectedBrand = brandsData?.find((b: DeviceBrand) => b.id === selectedBrandId);
      setBrand(selectedBrand?.name || "");
      setModelId(undefined);
      setModel("");
    }
  };

  // Handler para texto de marca personalizado
  const handleBrandTextChange = (text: string) => {
    setBrand(text);
    setBrandId(undefined); // Limpiar ID cuando es texto libre
    setModelId(undefined);
    setModel("");
  };

  // Handler para cambio de modelo (permite texto libre)
  const handleModelChange = async (value: string | number) => {
    if (typeof value === 'string') {
      // Texto libre
      setModel(value);
      setModelId(undefined);
    } else {
      // Selección de catálogo con autocompletado
      const selectedModelId = value;
      setModelId(selectedModelId);
      const selectedModel = modelsData?.find((m: DeviceModel) => m.id === selectedModelId);
      setModel(selectedModel?.name || "");
      
      // Autocompletar specs si el modelo tiene defaultSpecs
      if (selectedModel?.defaultSpecs) {
        try {
          const specs = JSON.parse(selectedModel.defaultSpecs);
          const specsArray: Array<{ key: string; value: string }> = [];
          
          Object.entries(specs).forEach(([key, value]) => {
            specsArray.push({ key, value: value as string });
          });
          
          setCustomSpecs(specsArray);
          toast.success("Especificaciones autocompletadas del modelo");
        } catch (error) {
          console.error("Error parsing defaultSpecs:", error);
        }
      }
    }
  };

  // Handler para texto de modelo personalizado
  const handleModelTextChange = (text: string) => {
    setModel(text);
    setModelId(undefined);
  };

  const { data: suppliersData } = trpc.suppliers.list.useQuery();
  const { data: globalBalances } = (trpc.finance as any).getGlobalBalances.useQuery();

  // Queries para catálogos de autocompletado
  const { data: brandsData } = trpc.deviceCatalogs.getBrands.useQuery();
  const { data: modelsData } = trpc.deviceCatalogs.getModelsByBrand.useQuery(
    { brandId: brandId! },
    { enabled: !!brandId }
  );
  const { data: processorsData } = trpc.deviceCatalogs.getProcessors.useQuery();
  const { data: ramOptionsData } = trpc.deviceCatalogs.getRamOptions.useQuery();
  const { data: storageOptionsData } = trpc.deviceCatalogs.getStorageOptions.useQuery();
  const { data: screenSizesData } = trpc.deviceCatalogs.getScreenSizes.useQuery();

  // Convertir datos de catálogos a formato ComboboxOption
  const brandOptions: ComboboxOption[] = useMemo(() => 
    brandsData?.map((b: DeviceBrand) => ({ value: b.id, label: b.name })) || [],
    [brandsData]
  );

  const modelOptions: ComboboxOption[] = useMemo(() => 
    modelsData?.map((m: DeviceModel) => ({ value: m.id, label: m.name })) || [],
    [modelsData]
  );

  const processorOptions: ComboboxOption[] = useMemo(() => 
    processorsData?.map((p: Processor) => ({ value: p.name, label: p.name })) || [],
    [processorsData]
  );

  const ramOptions: ComboboxOption[] = useMemo(() => 
    ramOptionsData?.map((r: RamOption) => ({ value: r.capacity, label: r.capacity })) || [],
    [ramOptionsData]
  );

  const storageOptions: ComboboxOption[] = useMemo(() => 
    storageOptionsData?.map((s: StorageOption) => ({ value: s.capacity, label: s.capacity })) || [],
    [storageOptionsData]
  );

  const screenOptions: ComboboxOption[] = useMemo(() => 
    screenSizesData?.map((s: ScreenSize) => ({ 
      value: s.size, 
      label: s.resolution ? `${s.size} (${s.resolution})` : s.size 
    })) || [],
    [screenSizesData]
  );

  const codeQuery = trpc.units.getByCode.useQuery(
    { code: scannedCode },
    { enabled: false }
  );

  const createUnitMutation = trpc.units.create.useMutation({
    onSuccess: (data: any) => {
      const count = data.count || 1;
      const codes = data.codes || (data.code ? [data.code] : []);
      toast.success(`✅ ${count} ${count > 1 ? "unidades registradas" : "unidad registrada"} exitosamente`);

      setBatchCreatedData({
        codes,
        brand,
        model,
        type,
        salePrice: salePrice ? Math.round(parseFloat(salePrice) * 100) : undefined,
      });
      setBatchModalOpen(true);
    },
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCode.trim()) return;

    const res = await codeQuery.refetch();
    const data = res.data;

    setActiveCode(scannedCode.trim());

    if (data?.found && data.unit) {
      // Ya está asignada a una unidad existente
      setCodeStatusState("assigned");
      setExistingUnitData(data.unit);
      toast.warning("Este código ya está vinculado a una unidad existente.");
    } else if (data?.isUnassignedCode) {
      // Código generado válido disponible
      setCodeStatusState("unassigned");
      setGeneratedCodeObj(data.generatedCode);
      setExistingUnitData(null);
      toast.success("Código físico verificado. Completa el alta del equipo.");
    } else {
      // Código no existente en la base de datos de lotes generados
      setCodeStatusState("non_existent");
      setExistingUnitData(null);
      toast.error("El código escaneado no fue generado por el sistema.");
    }
  };

  const addCustomSpecField = () => {
    setCustomSpecs([...customSpecs, { key: "", value: "" }]);
  };

  const removeCustomSpecField = (index: number) => {
    setCustomSpecs(customSpecs.filter((_, i) => i !== index));
  };

  const handleUseSuggestedCode = () => {
    setActiveCode(suggestedCode);
    setCodeStatusState("unassigned");
    setGeneratedCodeObj(null);
    setExistingUnitData(null);
    toast.success(`Código sugerido aplicado: ${suggestedCode}. El equipo irá a estado "${SIMPLE_TYPES.has(type) ? "available" : "in_diagnosis"}".`);
  };

  const handleSaveUnit = () => {
    if (!activeCode) {
      toast.error("Debes escanear o ingresar un código");
      return;
    }
    if (!brand.trim() || !model.trim()) {
      toast.error("Ingresa la marca y el modelo");
      return;
    }

    // Validación de IMEI/Serial para celulares/tablets
    if (type === "phone" || type === "tablet") {
      const imeiCheck = validateImeiFormat(serialNumber);
      if (!imeiCheck.valid) {
        toast.error(imeiCheck.reason || "IMEI/Serial inválido");
        return;
      }
    }

    const pPriceCents = purchasePrice ? Math.round(parseFloat(purchasePrice) * 100) : 0;
    const sPriceCents = salePrice ? Math.round(parseFloat(salePrice) * 100) : undefined;
    const dPriceCents = discountPrice ? Math.round(parseFloat(discountPrice) * 100) : undefined;
    const wPriceCents = wholesalePrice ? Math.round(parseFloat(wholesalePrice) * 100) : undefined;

    // Convertir specs array a JSON object
    const specsObj: Record<string, string> = {};
    customSpecs.forEach((item) => {
      if (item.key.trim()) {
        specsObj[item.key.trim()] = item.value.trim();
      }
    });

    const defaultStatus = SIMPLE_TYPES.has(type) ? "available" : "in_diagnosis";

    createUnitMutation.mutate({
      code: activeCode,
      codeId: generatedCodeObj?.id,
      type,
      brand,
      model,
      serialNumber: serialNumber.trim() || undefined,
      specs: specsObj,
      condition: TYPES_WITH_BATTERY.has(type) ? (parseInt(condition) || 8) : undefined,
      batteryHealth: batteryHealth as any,
      damageChecklist,
      damageNotes,
      purchasePrice: pPriceCents,
      salePrice: sPriceCents,
      discountPrice: dPriceCents,
      wholesalePrice: wPriceCents,
      quantity: Math.max(1, quantity),
      supplierId,
      purchaseDate: purchaseDate || undefined,
      paymentMethod,
      status: defaultStatus,
      photos: photos.length > 0 ? JSON.stringify(photos) : undefined,
      tiktokUrl: tiktokUrl.trim() || undefined,
      branchId: activeBranchId || 1,
    });
  };

  const checklistFields = CHECKLIST_BY_TYPE[type];

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <QrCode className="h-7 w-7 text-primary" />
          Registro de Unidad por Escaneo
        </h1>
        <p className="text-sm text-muted-foreground">
          Escanea la etiqueta ya pegada en el equipo para vincularla y dar de alta el producto.
        </p>
      </div>

      {/* Escáner USB omnipresente */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-4">
          <form onSubmit={handleScanSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={scanInputRef}
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                placeholder="Escanear etiqueta física (lector USB) o tipear código + Enter..."
                className="pl-9 bg-background text-lg font-mono font-bold"
                autoFocus
              />
            </div>
            <Button type="submit">Verificar Código</Button>
          </form>
        </CardContent>
      </Card>

      {/* Caso A: Código Asignado Previamente */}
      {codeStatusState === "assigned" && existingUnitData && (
        <Card className="border-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" /> Unidad Existente Encontrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              El código <span className="font-mono font-bold">{activeCode}</span> ya está asignado a:
            </p>
            <div className="p-3 bg-background rounded border font-medium">
              {existingUnitData.brand} {existingUnitData.model} ({existingUnitData.type}) - Estado:{" "}
              <Badge>{existingUnitData.status}</Badge>
            </div>
            <div className="pt-2">
              <a href="/units">
                <Button variant="outline">Ver en el Catálogo</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Caso B: Código No Generado por el Sistema */}
      {codeStatusState === "non_existent" && (
        <Card className="border-red-500 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" /> Código No Válido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              El código <span className="font-mono font-bold">{activeCode}</span> no existe en la base de datos de lotes generados por el sistema.
            </p>
            <p className="text-xs text-muted-foreground">
              Para registrar una unidad con este código, debes crearlo mediante el generador de lotes o habilitar registro directo.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setCodeStatusState("unassigned"); // Permite override manual
              }}
            >
              Forzar Registro Directo con este Código
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Caso C: Código Válido o Registro Directo -> Formulario de Alta */}
      {codeStatusState === "unassigned" && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Alta de Equipo - Vinculando Código: <span className="font-mono text-primary">{activeCode}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tipo, Marca, Modelo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Tipo de Producto:</label>
                <Select value={type} onValueChange={(v) => setType(v as UnitType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABEL) as UnitType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        <div className="flex items-center gap-2">
                          {TYPE_ICON[t]}
                          <span>{TYPE_LABEL[t]}</span>
                          <Badge variant="outline" className="ml-auto text-[10px] py-0 h-4 font-mono">{TYPE_PREFIX[t]}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Marca *:</label>
                <Combobox
                  options={brandOptions}
                  value={brandId || brand}
                  onChange={handleBrandChange}
                  onTextChange={handleBrandTextChange}
                  placeholder="Escribir o seleccionar marca..."
                  emptyMessage="No hay marcas en catálogo"
                  allowCustomValue={true}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Modelo *:</label>
                <Combobox
                  options={modelOptions}
                  value={modelId || model}
                  onChange={handleModelChange}
                  onTextChange={handleModelTextChange}
                  placeholder="Escribir o seleccionar modelo..."
                  emptyMessage={brandId ? "No hay modelos para esta marca" : "Primero selecciona una marca"}
                  allowCustomValue={true}
                />
              </div>
            </div>

            {/* Serial/IMEI + sugerencia de código */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="text-xs font-semibold block mb-1">
                  {(type === "phone" || type === "tablet") ? "IMEI / Serial Number (15 dígitos)" : "Serial Number (opcional)"}:
                </label>
                <Input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value.replace(/\s/g, ""))}
                  placeholder={type === "phone" || type === "tablet" ? "356123456789012" : "S/N del fabricante"}
                  maxLength={50}
                  className="font-mono"
                />
                {type === "phone" || type === "tablet" ? (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    💡 Marcar <kbd className="px-1 bg-slate-100 rounded">*#06#</kbd> en el celular para ver el IMEI.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Código sugerido (prefijo por tipo):</label>
                <div className="flex gap-2">
                  <Input
                    value={suggestedCode}
                    readOnly
                    className="font-mono bg-slate-50 text-slate-700"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseSuggestedCode}
                    title="Usar este código en lugar de escanear"
                  >
                    Usar
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Si no tenés etiqueta física, podés usar este código sugerido (prefijo {TYPE_PREFIX[type]}).
                </p>
              </div>
            </div>

            {/* Ficha técnica flexible (Specs JSON) */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold">Ficha Técnica / Especificaciones (Specs Flexible JSON):</label>
                <Button type="button" variant="outline" size="sm" onClick={addCustomSpecField} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Agregar Característica
                </Button>
              </div>

              <div className="space-y-2">
                {customSpecs.map((spec, idx) => {
                  // Traducir claves conocidas al español para mejor UX
                  const SPEC_LABELS: Record<string, string> = {
                    cpu: "Procesador", ram: "Memoria RAM", storage: "Almacenamiento",
                    screenSize: "Tamaño de Pantalla", gpu: "Tarjeta de Video",
                    resolution: "Resolución", os: "Sistema Operativo",
                    androidVersion: "Versión Android", iosVersion: "Versión iOS",
                    camera: "Cámara", wattage: "Potencia (W)", connector: "Conector",
                    voltage: "Voltaje", amperage: "Amperaje", color: "Color",
                    weight: "Peso", connectivity: "Conectividad",
                    panelType: "Tipo de Panel", refreshRate: "Tasa de Refresco",
                  };
                  const displayKey = SPEC_LABELS[spec.key] || spec.key;
                  
                  // Determinar si este campo debe usar Combobox
                  const useCombobox = ["cpu", "ram", "storage", "screenSize"].includes(spec.key);
                  let comboboxOptions: ComboboxOption[] = [];
                  
                  if (useCombobox) {
                    if (spec.key === "cpu") comboboxOptions = processorOptions;
                    else if (spec.key === "ram") comboboxOptions = ramOptions;
                    else if (spec.key === "storage") comboboxOptions = storageOptions;
                    else if (spec.key === "screenSize") comboboxOptions = screenOptions;
                  }
                  
                  return (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder="Atributo (ej. cpu, ram)"
                      value={displayKey}
                      onChange={(e) => {
                        const updated = [...customSpecs];
                        // Guardar la clave canónica (invertir traducción si existe)
                        const reverseMap: Record<string, string> = Object.fromEntries(
                          Object.entries(SPEC_LABELS).map(([k, v]) => [v, k])
                        );
                        updated[idx].key = reverseMap[e.target.value] || e.target.value;
                        setCustomSpecs(updated);
                      }}
                      className="w-1/3"
                    />
                    {useCombobox ? (
                      <div className="flex-1">
                        <Combobox
                          options={comboboxOptions}
                          value={spec.value}
                          onChange={(value) => {
                            const updated = [...customSpecs];
                            updated[idx].value = String(value);
                            setCustomSpecs(updated);
                          }}
                          onTextChange={(text) => {
                            const updated = [...customSpecs];
                            updated[idx].value = text;
                            setCustomSpecs(updated);
                          }}
                          placeholder={`Escribir o seleccionar ${displayKey.toLowerCase()}...`}
                          emptyMessage="Escribe para agregar"
                          allowCustomValue={true}
                        />
                      </div>
                    ) : (
                      <Input
                        placeholder="Valor (ej. Core i5, 8GB)"
                        value={spec.value}
                        onChange={(e) => {
                          const updated = [...customSpecs];
                          updated[idx].value = e.target.value;
                          setCustomSpecs(updated);
                        }}
                        className="flex-1"
                      />
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomSpecField(idx)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Estado Estético y Batería (laptop, tablet, phone) */}
            {TYPES_WITH_BATTERY.has(type) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Puntuación de Estado Estético (1 al 10):</label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((num) => (
                        <SelectItem key={num} value={String(num)}>
                          {num} / 10 {num >= 8 ? "(Excelente/Muy Bueno)" : num >= 6 ? "(Aceptable)" : "(Detalles)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Estado de Batería:</label>
                  <Select value={batteryHealth} onValueChange={(v) => setBatteryHealth(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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

            {/* Damage Checklist — campos relevantes según tipo */}
            <div className="space-y-2 border-t pt-4">
              <label className="text-xs font-semibold block">
                Checklist de Daños u Observaciones:
                <span className="text-muted-foreground font-normal ml-2">({TYPE_LABEL[type]})</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(checklistFields).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`check-${key}`}
                      checked={damageChecklist[key] || false}
                      onCheckedChange={(c) => setDamageChecklist({ ...damageChecklist, [key]: !!c })}
                    />
                    <label htmlFor={`check-${key}`} className="text-xs cursor-pointer">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Cantidad y Precios */}
            <div className="border-t pt-4 space-y-4">
              {/* Sección de Cantidad de Unidades */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800/80 dark:to-indigo-950/40 p-4 rounded-2xl border border-blue-200/80 dark:border-indigo-800/40 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-sm font-black text-blue-900 dark:text-blue-200 flex items-center gap-2">
                      <Boxes className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Cantidad de Unidades a Comprar / Registrar:
                    </label>
                    <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                      Ideal para cargadores, accesorios o compras por lote (10, 20, 50 piezas).
                    </p>
                  </div>
                  
                  {/* Selector numérico con botones + / - */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl border-blue-300 bg-white dark:bg-slate-800 shadow-sm font-bold text-blue-700 hover:bg-blue-100"
                      onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setQuantity(isNaN(val) ? 1 : Math.max(1, Math.min(500, val)));
                      }}
                      className="w-20 text-center font-black text-lg h-9 bg-white dark:bg-slate-900 border-blue-300 text-blue-950 dark:text-blue-100 rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl border-blue-300 bg-white dark:bg-slate-800 shadow-sm font-bold text-blue-700 hover:bg-blue-100"
                      onClick={() => setQuantity((prev) => Math.min(500, prev + 1))}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Botones de selección rápida */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 mr-1 uppercase tracking-wider">
                    Acceso Rápido:
                  </span>
                  {[1, 2, 5, 10, 20, 30, 50, 100].map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant={quantity === q ? "default" : "outline"}
                      className={`h-7 text-xs px-2.5 rounded-lg font-bold transition-all ${
                        quantity === q
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                          : "bg-white/80 dark:bg-slate-800/80 hover:bg-blue-100/80 text-blue-900 dark:text-blue-200 border-blue-200"
                      }`}
                      onClick={() => setQuantity(q)}
                    >
                      {q === 1 ? "1 unidad" : `${q} uds.`}
                    </Button>
                  ))}
                </div>

                {/* Explicación si quantity > 1 */}
                {quantity > 1 && (
                  <div className="bg-white/90 dark:bg-slate-900/90 rounded-xl p-2.5 border border-blue-200/60 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      Se darán de alta <strong>{quantity} unidades independientes</strong> en stock con códigos correlativos (ej. <code className="font-mono bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded text-[11px]">{activeCode || suggestedCode}-01</code> al <code className="font-mono bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded text-[11px]">{activeCode || suggestedCode}-{String(quantity).padStart(quantity > 99 ? 3 : 2, "0")}</code>) listas para imprimir etiquetas y vender por separado.
                    </span>
                  </div>
                )}
              </div>

              {/* Precios Unitarios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1 text-slate-800 dark:text-slate-200">
                    Costo Compra Unitario (Bs) *:
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="ej. 80.00"
                    className="font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1 text-blue-700 dark:text-blue-400">
                    💰 Precio Venta Unitario (Bs):
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="ej. 150.00"
                    className="border-blue-300 focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1 text-amber-700 dark:text-amber-400">
                    🏷️ Precio Descuento (Bs):
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={discountPrice}
                    onChange={(e) => setDiscountPrice(e.target.value)}
                    placeholder="ej. 130.00"
                    className="border-amber-300 focus:border-amber-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1 text-green-700 dark:text-green-400">
                    📦 Precio Mayorista (Bs):
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    placeholder="ej. 110.00"
                    className="border-green-300 focus:border-green-500 font-medium"
                  />
                </div>
              </div>

              {/* Resumen Financiero Total del Lote */}
              {parseFloat(purchasePrice) > 0 && (
                <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Resumen Financiero y Contable de la Operación:
                      </span>
                    </div>
                    <Badge className="bg-slate-800 text-slate-200 border-slate-700 text-xs">
                      {quantity} {quantity === 1 ? "unidad" : "unidades en total"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
                    <div className="bg-slate-800/80 p-2.5 rounded-xl">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Costo Unitario</div>
                      <div className="text-base font-bold text-slate-200">
                        {formatCurrency(Math.round((parseFloat(purchasePrice) || 0) * 100))}
                      </div>
                    </div>

                    <div className="bg-emerald-950/60 border border-emerald-800/50 p-2.5 rounded-xl">
                      <div className="text-[10px] text-emerald-400 uppercase font-bold">Total Egreso de Caja</div>
                      <div className="text-base font-black text-emerald-300">
                        {formatCurrency(Math.round(((parseFloat(purchasePrice) || 0) * quantity) * 100))}
                      </div>
                    </div>

                    <div className="bg-blue-950/60 border border-blue-800/50 p-2.5 rounded-xl">
                      <div className="text-[10px] text-blue-400 uppercase font-bold">Venta Total Proyectada</div>
                      <div className="text-base font-bold text-blue-300">
                        {parseFloat(salePrice) > 0
                          ? formatCurrency(Math.round(((parseFloat(salePrice) || 0) * quantity) * 100))
                          : "—"}
                      </div>
                    </div>

                    <div className="bg-purple-950/60 border border-purple-800/50 p-2.5 rounded-xl">
                      <div className="text-[10px] text-purple-400 uppercase font-bold">Margen Proyectado</div>
                      <div className="text-base font-black text-purple-300">
                        {parseFloat(salePrice) > 0
                          ? formatCurrency(
                              Math.round(
                                (((parseFloat(salePrice) || 0) - (parseFloat(purchasePrice) || 0)) * quantity) * 100
                              )
                            )
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 italic">
                    * Se registrará 1 sola orden de compra consolidada y 1 solo egreso de caja por {formatCurrency(Math.round(((parseFloat(purchasePrice) || 0) * quantity) * 100))}.
                  </p>
                </div>
              )}
            </div>

            {/* ─── Información de Compra ─── */}
            <div className="border-t pt-4 space-y-3">
              <label className="text-xs font-semibold block">Información de Compra:</label>

              {/* Saldos disponibles por caja */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Caja Efectivo */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all text-left ${
                    paymentMethod === "cash"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <Wallet className={`h-4 w-4 shrink-0 ${paymentMethod === "cash" ? "text-emerald-600" : "text-slate-400"}`} />
                    <span className={`text-[10px] font-black uppercase tracking-wider ${paymentMethod === "cash" ? "text-emerald-700" : "text-slate-500"}`}>
                      Efectivo
                    </span>
                    {paymentMethod === "cash" && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </div>
                  <div className="w-full">
                    <p className={`text-sm font-black tabular-nums leading-tight ${
                      (globalBalances?.cash ?? 0) >= (purchasePrice ? Math.round(parseFloat(purchasePrice) * 100) : 0) && (globalBalances?.cash ?? 0) > 0
                        ? "text-emerald-700"
                        : "text-slate-400"
                    }`}>
                      {formatCurrency(globalBalances?.cash ?? 0)}
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium">Saldo disp.</p>
                  </div>
                </button>

                {/* Caja QR */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("qr")}
                  className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all text-left ${
                    paymentMethod === "qr"
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <QrCode className={`h-4 w-4 shrink-0 ${paymentMethod === "qr" ? "text-blue-600" : "text-slate-400"}`} />
                    <span className={`text-[10px] font-black uppercase tracking-wider ${paymentMethod === "qr" ? "text-blue-700" : "text-slate-500"}`}>
                      QR
                    </span>
                    {paymentMethod === "qr" && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>
                  <div className="w-full">
                    <p className={`text-sm font-black tabular-nums leading-tight ${
                      (globalBalances?.qr ?? 0) >= (purchasePrice ? Math.round(parseFloat(purchasePrice) * 100) : 0) && (globalBalances?.qr ?? 0) > 0
                        ? "text-blue-700"
                        : "text-slate-400"
                    }`}>
                      {formatCurrency(globalBalances?.qr ?? 0)}
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium">Saldo disp.</p>
                  </div>
                </button>

                {/* Cuenta Bancaria */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("transfer")}
                  className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all text-left ${
                    paymentMethod === "transfer"
                      ? "border-purple-500 bg-purple-50"
                      : "border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <Landmark className={`h-4 w-4 shrink-0 ${paymentMethod === "transfer" ? "text-purple-600" : "text-slate-400"}`} />
                    <span className={`text-[10px] font-black uppercase tracking-wider ${paymentMethod === "transfer" ? "text-purple-700" : "text-slate-500"}`}>
                      Banco
                    </span>
                    {paymentMethod === "transfer" && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                    )}
                  </div>
                  <div className="w-full">
                    <p className={`text-sm font-black tabular-nums leading-tight ${
                      (globalBalances?.transfer ?? 0) >= (purchasePrice ? Math.round(parseFloat(purchasePrice) * 100) : 0) && (globalBalances?.transfer ?? 0) > 0
                        ? "text-purple-700"
                        : "text-slate-400"
                    }`}>
                      {formatCurrency(globalBalances?.transfer ?? 0)}
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium">Saldo disp.</p>
                  </div>
                </button>
              </div>

              {/* Aviso de saldo insuficiente */}
              {purchasePrice && (() => {
                const priceCents = Math.round(parseFloat(purchasePrice) * 100);
                const selectedBalance = paymentMethod === "cash"
                  ? (globalBalances?.cash ?? 0)
                  : paymentMethod === "qr"
                  ? (globalBalances?.qr ?? 0)
                  : (globalBalances?.transfer ?? 0);
                const methodLabel = paymentMethod === "cash" ? "Efectivo" : paymentMethod === "qr" ? "QR" : "Cuenta Bancaria";
                if (!isNaN(priceCents) && priceCents > 0 && selectedBalance < priceCents) {
                  return (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      Saldo insuficiente en {methodLabel} ({formatCurrency(selectedBalance)}). Considera usar otra caja.
                    </div>
                  );
                }
                return null;
              })()}

              {/* Proveedor y Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Proveedor:</label>
                  <Select
                    value={supplierId ? String(supplierId) : ""}
                    onValueChange={(v) => setSupplierId(v ? parseInt(v) : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(suppliersData as any[])?.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Fecha de Compra:</label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
            </div>

            {/* ─── Fotografías del Equipo ─── */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-blue-500" />
                  Fotografías del Equipo
                  <span className="text-muted-foreground font-normal">({photos.length}/8)</span>
                </label>
              </div>

              {/* Photo buttons */}
              <div className="flex flex-wrap gap-2">
                {/* Camera capture — usable desde celular */}
                <button
                  type="button"
                  onClick={() => photoCameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-md shadow-blue-200"
                >
                  <Camera className="h-4 w-4" />
                  Tomar Foto
                </button>

                {/* File upload — desde galería o computadora */}
                <button
                  type="button"
                  onClick={() => photoFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-sm font-semibold transition-colors"
                >
                  <ImagePlus className="h-4 w-4" />
                  Subir desde Galería / PC
                </button>

                {/* Hidden inputs */}
                <input
                  ref={photoCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => handlePhotoFiles(e.target.files)}
                />
                <input
                  ref={photoFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handlePhotoFiles(e.target.files)}
                />
              </div>

              {/* Photo previews */}
              {photos.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                      <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {idx === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5 font-bold">
                          PRINCIPAL
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {photos.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  💡 Tip: 3-5 fotos aumentan la confianza del comprador. Usa fondo blanco y buena iluminación.
                </p>
              )}
            </div>

            {/* ─── Video de TikTok del Equipo ─── */}
            <div className="space-y-3 border-t pt-4 bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-700/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-pink-500/20 text-pink-400 rounded-xl border border-pink-500/30 flex items-center justify-center">
                    <Video className="h-5 w-5 text-pink-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-white tracking-wide">Video de TikTok del Equipo</h3>
                      <Badge className="bg-pink-500 hover:bg-pink-600 text-white font-bold text-[10px] px-2 py-0.5 border-none">
                        🎵 TikTok
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Link al video mostrando el funcionamiento, unboxing o estado estético real.
                    </p>
                  </div>
                </div>

                {tiktokUrl.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = tiktokUrl.trim();
                      if (url.startsWith("http://") || url.startsWith("https://")) {
                        window.open(url, "_blank", "noopener,noreferrer");
                      } else {
                        window.open(`https://${url}`, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs h-8 gap-1.5 self-start sm:self-auto"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" /> Probar Enlace
                    <ExternalLink className="h-3 w-3 ml-0.5" />
                  </Button>
                )}
              </div>

              <div className="relative">
                <Input
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@vitalia/video/73829183921... o https://vm.tiktok.com/..."
                  className="bg-white/5 border-slate-600 text-white placeholder:text-slate-400 text-xs font-mono h-10 focus:border-pink-500 focus:ring-pink-500"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                💡 Este enlace creará un botón interactivo en el catálogo y Kardex para que cualquier vendedor o cliente pueda ver el video de TikTok al instante.
              </p>
            </div>

            <Button onClick={handleSaveUnit} className="w-full gap-2 text-base py-5 font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200" disabled={createUnitMutation.isPending}>
              <CheckCircle className="h-5 w-5" />
              {quantity > 1
                ? `Guardar y Dar de Alta Lote (${quantity} Unidades)`
                : "Guardar y Vincular Unidad"}
            </Button>
          </CardContent>
        </Card>

      )}

      {/* Modal para Confirmación del Lote Registrado */}
      {batchCreatedData && (
        <BatchLabelsModal
          open={batchModalOpen}
          onOpenChange={(open) => {
            setBatchModalOpen(open);
            if (!open) {
              setLocation("/units");
            }
          }}
          brand={batchCreatedData.brand}
          model={batchCreatedData.model}
          type={batchCreatedData.type}
          salePrice={batchCreatedData.salePrice}
          codes={batchCreatedData.codes}
          branchName={branches.find((b: any) => b.id === activeBranchId)?.name || "Sucursal Principal"}
        />
      )}

    </div>
  );
}
