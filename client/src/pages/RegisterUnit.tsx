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
import { Autocomplete, AutocompleteOption } from "@/components/ui/autocomplete";
import type { DeviceBrand, DeviceModel, Processor, RamOption, StorageOption, ScreenSize } from "../../../drizzle/schema";
import {
  DEFAULT_DEVICE_BRANDS,
  DEFAULT_DEVICE_MODELS,
  DEFAULT_PROCESSORS,
  DEFAULT_RAM_OPTIONS,
  DEFAULT_STORAGE_OPTIONS,
  DEFAULT_SCREEN_SIZES,
} from "../../../shared/deviceCatalogDefaults";


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

function normalizeCatalogText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sameCatalogText(left: unknown, right: unknown) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
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
    specs?: any;
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

  const { data: suppliersData } = trpc.suppliers.list.useQuery();
  const { data: globalBalances } = (trpc.finance as any).getGlobalBalances.useQuery();

  // Queries para catálogos de autocompletado
  const { data: brandsData } = trpc.deviceCatalogs.getBrands.useQuery();
  const { data: allModelsData } = trpc.deviceCatalogs.getAllModels.useQuery();
  const { data: modelsData } = trpc.deviceCatalogs.getModelsByBrand.useQuery(
    { brandId: brandId! },
    { enabled: !!brandId }
  );
  const { data: processorsData } = trpc.deviceCatalogs.getProcessors.useQuery();
  const { data: ramOptionsData } = trpc.deviceCatalogs.getRamOptions.useQuery();
  const { data: storageOptionsData } = trpc.deviceCatalogs.getStorageOptions.useQuery();
  const { data: screenSizesData } = trpc.deviceCatalogs.getScreenSizes.useQuery();
  const utils = trpc.useUtils();

  // Función central para autocompletar especificaciones y marca dado un modelo
  const applyModelSpecs = useCallback((modelQuery: string, explicitMetadata?: any) => {
    if (!modelQuery || !modelQuery.trim()) return;

    // Buscar modelo en metadata explícita, catálogo por defecto o base de datos
    let target = explicitMetadata;
    if (!target) {
      target = DEFAULT_DEVICE_MODELS.find(
        (m) =>
          sameCatalogText(m.name, modelQuery) ||
          sameCatalogText(m.fullName, modelQuery) ||
          sameCatalogText(`${m.brand} ${m.name}`, modelQuery)
      );
    }
    if (!target && (allModelsData || modelsData)) {
      target = (allModelsData || modelsData)?.find(
        (m: any) =>
          sameCatalogText(m.name, modelQuery) ||
          sameCatalogText(`${m.brandName || ""} ${m.name}`, modelQuery)
      );
    }

    if (target) {
      if (target.id) setModelId(target.id);

      // 1. Autocompletar Marca si está disponible
      const targetBrand = target.brand || target.brandName;
      if (targetBrand) {
        setBrand(targetBrand);
        const matchingBrand = brandsData?.find((b: any) => sameCatalogText(b.name, targetBrand));
        if (matchingBrand) setBrandId(matchingBrand.id);
        else if (target.brandId) setBrandId(target.brandId);
      }

      // 2. Autocompletar Especificaciones técnicas
      let specs = target.defaultSpecs;
      if (typeof specs === "string") {
        try {
          specs = JSON.parse(specs);
        } catch (_) {
          specs = {};
        }
      }

      if (specs && typeof specs === "object" && Object.keys(specs).length > 0) {
        setCustomSpecs((prev) => {
          const specMap: Record<string, string> = {};
          // Mantener valores existentes
          prev.forEach((item) => {
            specMap[item.key] = item.value;
          });
          // Sobrescribir con las especificaciones del modelo encontrado
          Object.entries(specs).forEach(([k, v]) => {
            if (v !== undefined && v !== null && String(v).trim() !== "") {
              specMap[k] = String(v);
            }
          });

          const standardOrder = ["cpu", "ram", "storage", "screenSize", "gpu", "resolution", "os"];
          const result: Array<{ key: string; value: string }> = [];
          const usedKeys = new Set<string>();

          standardOrder.forEach((k) => {
            if (specMap[k] !== undefined) {
              result.push({ key: k, value: specMap[k] });
              usedKeys.add(k);
            }
          });

          Object.entries(specMap).forEach(([k, v]) => {
            if (!usedKeys.has(k)) {
              result.push({ key: k, value: v });
            }
          });

          return result;
        });

        toast.success(`✨ Modelo "${target.name || modelQuery}" autocompletado con éxito.`);
      }
    }
  }, [allModelsData, modelsData, brandsData]);

  // Handler para cambio de marca (texto libre con autocompletado)
  const handleBrandChange = (value: string) => {
    setBrand(value);
    const matchingBrand = brandsData?.find((b: any) => 
      sameCatalogText(b.name, value)
    );
    if (matchingBrand) {
      setBrandId(matchingBrand.id);
    } else {
      setBrandId(undefined);
    }
  };

  // Handler para selección inteligente de modelo desde el dropdown
  const handleModelSelect = (option: AutocompleteOption) => {
    setModel(option.label);
    applyModelSpecs(option.label, option.metadata);
  };

  // Handler para cambio de modelo manual por teclado
  const handleModelChange = (value: string) => {
    setModel(value);
    // Si el texto coincide con algún modelo conocido, aplicar specs inmediatamente
    applyModelSpecs(value);
  };


  const ensureBrandMutation = trpc.deviceCatalogs.ensureBrand.useMutation({
    onSuccess: (savedBrand) => {
      utils.deviceCatalogs.getBrands.invalidate();
      if (savedBrand?.name && sameCatalogText(savedBrand.name, brand)) {
        setBrandId(savedBrand.id);
      }
    },
    onError: (error) => console.error("Error saving brand to catalog:", error),
  });
  const ensureModelMutation = trpc.deviceCatalogs.ensureModel.useMutation({
    onSuccess: (savedModel) => {
      utils.deviceCatalogs.getAllModels.invalidate();
      if (savedModel?.brandId) {
        utils.deviceCatalogs.getModelsByBrand.invalidate({ brandId: savedModel.brandId });
      }
      if (savedModel?.name && sameCatalogText(savedModel.name, model)) {
        setModelId(savedModel.id);
      }
    },
    onError: (error) => console.error("Error saving model to catalog:", error),
  });
  const ensureProcessorMutation = trpc.deviceCatalogs.ensureProcessor.useMutation({
    onSuccess: () => utils.deviceCatalogs.getProcessors.invalidate(),
    onError: (error) => console.error("Error saving processor to catalog:", error),
  });
  const ensureRamOptionMutation = trpc.deviceCatalogs.ensureRamOption.useMutation({
    onSuccess: () => utils.deviceCatalogs.getRamOptions.invalidate(),
    onError: (error) => console.error("Error saving RAM option to catalog:", error),
  });
  const ensureStorageOptionMutation = trpc.deviceCatalogs.ensureStorageOption.useMutation({
    onSuccess: () => utils.deviceCatalogs.getStorageOptions.invalidate(),
    onError: (error) => console.error("Error saving storage option to catalog:", error),
  });
  const ensureScreenSizeMutation = trpc.deviceCatalogs.ensureScreenSize.useMutation({
    onSuccess: () => utils.deviceCatalogs.getScreenSizes.invalidate(),
    onError: (error) => console.error("Error saving screen size to catalog:", error),
  });

  // Opciones combinadas garantizadas de Marcas (Base de datos + Catálogo por defecto)
  const brandOptions: AutocompleteOption[] = useMemo(() => {
    const fromDb = brandsData?.map((b: any) => ({ value: b.id || b.name, label: b.name })) || [];
    const fromDefaults = DEFAULT_DEVICE_BRANDS.map((name) => ({ value: name, label: name }));
    const map = new Map<string, AutocompleteOption>();
    [...fromDefaults, ...fromDb].forEach((opt) => {
      if (opt.label) map.set(opt.label.toLowerCase(), opt);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [brandsData]);

  // Opciones combinadas garantizadas de Modelos
  const modelOptions: AutocompleteOption[] = useMemo(() => {
    const fromDb = (allModelsData || modelsData || []).map((m: any) => ({
      value: m.id || m.name,
      label: m.name,
      secondaryLabel: m.brandName || m.brand || "",
      metadata: m,
    }));
    const fromDefaults = DEFAULT_DEVICE_MODELS.map((m) => ({
      value: m.name,
      label: m.name,
      secondaryLabel: m.brand,
      metadata: m,
    }));

    const map = new Map<string, AutocompleteOption>();
    [...fromDefaults, ...fromDb].forEach((opt) => {
      const key = `${(opt.secondaryLabel || "").toLowerCase()}___${opt.label.toLowerCase()}`;
      map.set(key, opt);
    });

    const allList = Array.from(map.values());

    if (brand && brand.trim()) {
      const bLower = brand.trim().toLowerCase();
      const matchingBrand = allList.filter((m) =>
        (m.secondaryLabel || "").toLowerCase().includes(bLower)
      );
      const otherBrands = allList.filter(
        (m) => !(m.secondaryLabel || "").toLowerCase().includes(bLower)
      );
      return [...matchingBrand, ...otherBrands];
    }

    return allList;
  }, [allModelsData, modelsData, brand]);

  // Opciones combinadas de Procesadores
  const processorOptions: AutocompleteOption[] = useMemo(() => {
    const fromDb = processorsData?.map((p: any) => ({ value: p.name, label: p.name })) || [];
    const fromDefaults = DEFAULT_PROCESSORS.map((p) => ({ value: p.name, label: p.name }));
    const map = new Map<string, AutocompleteOption>();
    [...fromDefaults, ...fromDb].forEach((opt) => {
      if (opt.label) map.set(opt.label.toLowerCase(), opt);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [processorsData]);

  // Opciones combinadas de Memoria RAM
  const ramOptions: AutocompleteOption[] = useMemo(() => {
    const fromDb = ramOptionsData?.map((r: any) => ({ value: r.capacity, label: r.capacity })) || [];
    const fromDefaults = DEFAULT_RAM_OPTIONS.map((r) => ({ value: r.capacity, label: r.capacity }));
    const map = new Map<string, AutocompleteOption>();
    [...fromDefaults, ...fromDb].forEach((opt) => {
      if (opt.label) map.set(opt.label.toLowerCase(), opt);
    });
    return Array.from(map.values());
  }, [ramOptionsData]);

  // Opciones combinadas de Almacenamiento
  const storageOptions: AutocompleteOption[] = useMemo(() => {
    const fromDb = storageOptionsData?.map((s: any) => ({ value: s.capacity, label: s.capacity })) || [];
    const fromDefaults = DEFAULT_STORAGE_OPTIONS.map((s) => ({ value: s.capacity, label: s.capacity }));
    const map = new Map<string, AutocompleteOption>();
    [...fromDefaults, ...fromDb].forEach((opt) => {
      if (opt.label) map.set(opt.label.toLowerCase(), opt);
    });
    return Array.from(map.values());
  }, [storageOptionsData]);

  // Opciones combinadas de Pantallas
  const screenOptions: AutocompleteOption[] = useMemo(() => {
    const fromDb = screenSizesData?.map((s: any) => ({ 
      value: s.size, 
      label: s.resolution ? `${s.size} (${s.resolution})` : s.size 
    })) || [];
    const fromDefaults = DEFAULT_SCREEN_SIZES.map((s) => ({ 
      value: s.size, 
      label: s.resolution ? `${s.size} (${s.resolution})` : s.size 
    }));
    const map = new Map<string, AutocompleteOption>();
    [...fromDefaults, ...fromDb].forEach((opt) => {
      if (opt.label) map.set(opt.label.toLowerCase(), opt);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [screenSizesData]);



  const buildSpecsObject = useCallback((items = customSpecs) => {
    const specsObj: Record<string, string> = {};
    items.forEach((item) => {
      const key = normalizeCatalogText(item.key);
      if (key) {
        specsObj[key] = normalizeCatalogText(item.value);
      }
    });
    return specsObj;
  }, [customSpecs]);

  const persistBrandToCatalog = useCallback(async (rawName = brand) => {
    const name = normalizeCatalogText(rawName);
    if (!name) return undefined;

    const existing = brandsData?.find((item: DeviceBrand) => sameCatalogText(item.name, name));
    if (existing) {
      setBrandId(existing.id);
      return existing;
    }

    try {
      const savedBrand = await ensureBrandMutation.mutateAsync({ name });
      setBrandId(savedBrand.id);
      return savedBrand;
    } catch (error) {
      console.error("Error saving brand to catalog:", error);
      return undefined;
    }
  }, [brand, brandsData, ensureBrandMutation]);

  const persistModelToCatalog = useCallback(async (
    rawName = model,
    specsOverride?: Record<string, string>
  ) => {
    const name = normalizeCatalogText(rawName);
    if (!name) return undefined;

    let resolvedBrandId = brandId;
    if (!resolvedBrandId) {
      const savedBrand = await persistBrandToCatalog();
      resolvedBrandId = savedBrand?.id;
    }
    if (!resolvedBrandId) return undefined;

    const existing = modelsData?.find((item: DeviceModel) => sameCatalogText(item.name, name));
    if (existing) {
      setModelId(existing.id);
      return existing;
    }

    try {
      const savedModel = await ensureModelMutation.mutateAsync({
        brandId: resolvedBrandId,
        brandName: normalizeCatalogText(brand) || undefined,
        name,
        defaultSpecs: specsOverride,
      });
      setModelId(savedModel.id);
      return savedModel;
    } catch (error) {
      console.error("Error saving model to catalog:", error);
      return undefined;
    }
  }, [brand, brandId, model, modelsData, persistBrandToCatalog, ensureModelMutation]);

  const persistSpecValueToCatalog = useCallback(async (key: string, rawValue: string) => {
    const value = normalizeCatalogText(rawValue);
    if (!value) return;

    try {
      if (key === "cpu" && !processorOptions.some((option) => sameCatalogText(option.label, value))) {
        await ensureProcessorMutation.mutateAsync({ name: value });
      } else if (key === "ram" && !ramOptions.some((option) => sameCatalogText(option.label, value))) {
        await ensureRamOptionMutation.mutateAsync({ capacity: value });
      } else if (key === "storage" && !storageOptions.some((option) => sameCatalogText(option.label, value))) {
        await ensureStorageOptionMutation.mutateAsync({ capacity: value });
      } else if (key === "screenSize" && !screenOptions.some((option) => sameCatalogText(option.label, value))) {
        await ensureScreenSizeMutation.mutateAsync({ size: value });
      }
    } catch (error) {
      console.error("Error saving spec value to catalog:", error);
    }
  }, [
    ensureProcessorMutation,
    ensureRamOptionMutation,
    ensureScreenSizeMutation,
    ensureStorageOptionMutation,
    processorOptions,
    ramOptions,
    screenOptions,
    storageOptions,
  ]);

  const persistCatalogSelections = useCallback(async (specsOverride?: Record<string, string>) => {
    const specsObj = specsOverride || buildSpecsObject();
    await Promise.all([
      persistBrandToCatalog(),
      persistModelToCatalog(model, specsObj),
      ...Object.entries(specsObj).map(([key, value]) => persistSpecValueToCatalog(key, value)),
    ]);
  }, [buildSpecsObject, model, persistBrandToCatalog, persistModelToCatalog, persistSpecValueToCatalog]);

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
        specs: buildSpecsObject(),
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

    const specsObj = buildSpecsObject();
    void persistCatalogSelections(specsObj);

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
                <Autocomplete
                  options={brandOptions}
                  value={brand}
                  onChange={handleBrandChange}
                  onCommit={(value) => void persistBrandToCatalog(value)}
                  placeholder="Buscar o escribir marca (ej: HP, Dell, Lenovo, Asus...)"
                  showSearchIcon
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Modelo *:</label>
                <Autocomplete
                  options={modelOptions}
                  value={model}
                  onChange={handleModelChange}
                  onSelect={handleModelSelect}
                  onCommit={(value) => void persistModelToCatalog(value, buildSpecsObject())}
                  placeholder="Buscar o escribir modelo (ej: Victus 15, IdeaPad Slim 3, EliteBook...)"
                  showSearchIcon
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
                  
                  // Determinar si este campo debe usar Autocomplete
                  const useAutocomplete = ["cpu", "ram", "storage", "screenSize"].includes(spec.key);
                  let autocompleteOptions: AutocompleteOption[] = [];
                  
                  if (useAutocomplete) {
                    if (spec.key === "cpu") autocompleteOptions = processorOptions;
                    else if (spec.key === "ram") autocompleteOptions = ramOptions;
                    else if (spec.key === "storage") autocompleteOptions = storageOptions;
                    else if (spec.key === "screenSize") autocompleteOptions = screenOptions;
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
                    {useAutocomplete ? (
                      <div className="flex-1">
                        <Autocomplete
                          options={autocompleteOptions}
                          value={spec.value}
                          onChange={(value) => {
                            const updated = [...customSpecs];
                            updated[idx].value = value;
                            setCustomSpecs(updated);
                          }}
                          onCommit={(value) => void persistSpecValueToCatalog(spec.key, value)}
                          placeholder={`Buscar o escribir ${displayKey.toLowerCase()}...`}
                          showSearchIcon
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
              <div className="pt-2">
                <label className="text-xs font-semibold block mb-1">
                  Detalle adicional del equipo:
                </label>
                <Textarea
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Ej: bateria dura 2 horas, cargador generico, pantalla con mancha leve, detalle estetico adicional..."
                  rows={3}
                />
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
                      inputMode="numeric"
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
                    inputMode="decimal"
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
                    inputMode="decimal"
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
                    inputMode="decimal"
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
                    inputMode="decimal"
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
                        className="absolute top-1 right-1 w-6 h-6 bg-red-600 rounded-full text-white flex items-center justify-center opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md"
                        title="Eliminar foto"
                      >
                        <X className="h-3.5 w-3.5" />
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
            <div className="space-y-3 bg-gradient-to-br from-[#0b0f19] via-[#111827] to-[#0b0f19] text-white p-4 sm:p-5 rounded-2xl shadow-md border border-pink-500/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-pink-500/25 to-rose-600/20 text-pink-400 rounded-xl border border-pink-500/40 flex items-center justify-center shadow-inner">
                    <Video className="h-5 w-5 text-pink-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-white tracking-wide">Video de TikTok del Equipo</h3>
                      <Badge className="bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-[10px] px-2 py-0.5 border-none shadow-sm">
                        🎵 TikTok
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
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
                    className="bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border-pink-500/40 font-bold text-xs h-8 gap-1.5 self-start sm:self-auto shrink-0 shadow-sm"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" /> Probar Enlace
                    <ExternalLink className="h-3 w-3 ml-0.5" />
                  </Button>
                )}
              </div>

              <div className="relative flex items-center">
                <Input
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@mpshop/video/73829183921... o https://vm.tiktok.com/..."
                  className="dark-input !bg-[#050811] !text-white placeholder:!text-slate-500 !border-slate-700 focus:!border-pink-500 focus:!ring-2 focus:!ring-pink-500/30 text-xs font-mono h-11 pr-9 rounded-xl transition-all"
                />
                {tiktokUrl && (
                  <button
                    type="button"
                    onClick={() => setTiktokUrl("")}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    title="Limpiar enlace"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <span>💡</span> Este enlace creará un botón interactivo en el catálogo y Kardex para que cualquier vendedor o cliente pueda ver el video de TikTok al instante.
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
          specs={batchCreatedData.specs}
        />
      )}


    </div>
  );
}
