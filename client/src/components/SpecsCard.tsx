import React from "react";
import { Cpu, MemoryStick, HardDrive, MonitorSmartphone, Battery, Wifi, Camera, Aperture, Box, Layers, CircuitBoard, Tag } from "lucide-react";

type UnitType = "laptop" | "tablet" | "phone" | "monitor" | "charger" | "accessory" | "other";

// Diccionario: clave canónica -> etiqueta legible + ícono + tipo preferido
const SPEC_META: Record<string, { label: string; icon: React.ReactNode; types: UnitType[] }> = {
  // Laptop / Tablet / Monitor
  cpu: { label: "Procesador", icon: <Cpu className="h-3.5 w-3.5" />, types: ["laptop", "tablet"] },
  processor: { label: "Procesador", icon: <Cpu className="h-3.5 w-3.5" />, types: ["laptop", "tablet"] },
  gpu: { label: "Tarjeta de video", icon: <CircuitBoard className="h-3.5 w-3.5" />, types: ["laptop"] },
  ram: { label: "Memoria RAM", icon: <MemoryStick className="h-3.5 w-3.5" />, types: ["laptop", "tablet", "phone"] },
  memory: { label: "Memoria RAM", icon: <MemoryStick className="h-3.5 w-3.5" />, types: ["laptop", "tablet", "phone"] },
  storage: { label: "Almacenamiento", icon: <HardDrive className="h-3.5 w-3.5" />, types: ["laptop", "tablet", "phone"] },
  ssd: { label: "Almacenamiento", icon: <HardDrive className="h-3.5 w-3.5" />, types: ["laptop", "tablet"] },
  screenSize: { label: "Tamaño de pantalla", icon: <MonitorSmartphone className="h-3.5 w-3.5" />, types: ["laptop", "tablet", "phone", "monitor"] },
  resolution: { label: "Resolución", icon: <MonitorSmartphone className="h-3.5 w-3.5" />, types: ["laptop", "tablet", "phone", "monitor"] },
  panelType: { label: "Tipo de panel", icon: <MonitorSmartphone className="h-3.5 w-3.5" />, types: ["monitor"] },
  refreshRate: { label: "Tasa de refresco", icon: <MonitorSmartphone className="h-3.5 w-3.5" />, types: ["monitor"] },
  // Phone / Tablet
  os: { label: "Sistema operativo", icon: <Box className="h-3.5 w-3.5" />, types: ["phone", "tablet"] },
  androidVersion: { label: "Versión Android", icon: <Box className="h-3.5 w-3.5" />, types: ["phone", "tablet"] },
  iosVersion: { label: "Versión iOS", icon: <Box className="h-3.5 w-3.5" />, types: ["phone", "tablet"] },
  camera: { label: "Cámara", icon: <Camera className="h-3.5 w-3.5" />, types: ["phone", "tablet"] },
  // Charger
  wattage: { label: "Potencia (W)", icon: <Battery className="h-3.5 w-3.5" />, types: ["charger"] },
  connector: { label: "Conector", icon: <Tag className="h-3.5 w-3.5" />, types: ["charger"] },
  voltage: { label: "Voltaje", icon: <Battery className="h-3.5 w-3.5" />, types: ["charger"] },
  amperage: { label: "Amperaje", icon: <Battery className="h-3.5 w-3.5" />, types: ["charger"] },
  // Genéricos
  color: { label: "Color", icon: <Aperture className="h-3.5 w-3.5" />, types: ["laptop", "tablet", "phone", "monitor", "charger", "accessory", "other"] },
  weight: { label: "Peso", icon: <Layers className="h-3.5 w-3.5" />, types: ["laptop", "tablet", "phone", "monitor"] },
  connectivity: { label: "Conectividad", icon: <Wifi className="h-3.5 w-3.5" />, types: ["laptop", "tablet", "phone"] },
  description: { label: "Descripción", icon: <Tag className="h-3.5 w-3.5" />, types: ["accessory", "other"] },
};

const TYPE_LABEL: Record<UnitType, string> = {
  laptop: "Laptop",
  tablet: "Tablet",
  phone: "Celular",
  monitor: "Monitor",
  charger: "Cargador",
  accessory: "Accesorio",
  other: "Otro",
};

interface SpecsCardProps {
  specs: Record<string, any> | string | null | undefined;
  unitType?: UnitType;
  serialNumber?: string | null | undefined;
  title?: string;
  compact?: boolean;
  className?: string;
}

function parseSpecs(raw: SpecsCardProps["specs"]): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

// Heurística para formatear valores según el tipo de spec
function formatValue(key: string, value: any): string {
  const v = String(value).trim();
  const k = key.toLowerCase();
  // Memoria RAM: "8GB DDR4" / "8 GB"
  if (k === "ram" || k === "memory") {
    return v; // ya viene formateado
  }
  // Storage: si viene en bytes sin unidad, agregar GB
  if (k === "storage" || k === "ssd") {
    if (/^\d+$/.test(v)) {
      const gb = parseInt(v, 10);
      if (gb >= 1024) return `${(gb / 1024).toFixed(0)} TB`;
      return `${gb} GB`;
    }
    return v;
  }
  // Screen size: si viene "14.0" sin unidad, agregar "
  if (k === "screensize") {
    if (/^\d+(\.\d+)?$/.test(v)) return `${v}"`;
    return v;
  }
  return v;
}

export function SpecsCard({ specs: rawSpecs, unitType, serialNumber, title = "Especificaciones técnicas", compact = false, className = "" }: SpecsCardProps) {
  const specs = parseSpecs(rawSpecs);

  // Filtrar vacíos
  const entries = Object.entries(specs).filter(([_, v]) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    return true;
  });

  // Ordenar: primero los que tienen meta conocido con prioridad, luego alfabético
  entries.sort(([a], [b]) => {
    const aKnown = !!SPEC_META[a.toLowerCase()];
    const bKnown = !!SPEC_META[b.toLowerCase()];
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    return a.localeCompare(b);
  });

  const hasSerial = !!serialNumber && String(serialNumber).trim().length > 0;

  if (entries.length === 0 && !hasSerial) return null;

  return (
    <div className={className}>
      <h4 className={`font-bold text-slate-700 flex items-center gap-2 ${compact ? "text-xs mb-2" : "text-sm mb-3"}`}>
        <Cpu className="h-4 w-4 text-blue-500" /> {title}
        {unitType && (
          <span className="text-xs font-normal text-muted-foreground">({TYPE_LABEL[unitType]})</span>
        )}
      </h4>

      <div className={`grid grid-cols-2 ${compact ? "gap-1.5" : "gap-2"}`}>
        {entries.map(([key, value]) => {
          const meta = SPEC_META[key.toLowerCase()];
          const label = meta?.label || key;
          const icon = meta?.icon;
          return (
            <div key={key} className={`bg-slate-50 rounded-lg ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                {icon}
                {label}
              </div>
              <div className={`${compact ? "text-xs" : "text-sm"} font-semibold text-slate-800 break-words`}>
                {formatValue(key, value)}
              </div>
            </div>
          );
        })}

        {hasSerial && (
          <div className={`bg-slate-50 rounded-lg ${compact ? "px-2 py-1.5" : "px-3 py-2"} col-span-2`}>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              IMEI / Serial Number
            </div>
            <div className={`${compact ? "text-xs" : "text-sm"} font-semibold text-slate-800 font-mono break-all`}>
              {serialNumber}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
