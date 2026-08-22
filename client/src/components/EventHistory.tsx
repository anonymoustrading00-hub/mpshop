import React from "react";
import {
  Wrench, Package, ShoppingBag, RotateCcw, Plus, AlertTriangle,
  Hammer, Cog, Truck, FileText, History, Clock, Activity,
} from "lucide-react";

interface UnitEvent {
  id: number | string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  notes?: string | null;
  createdAt: string | Date;
  userName?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  in_diagnosis: "En diagnóstico",
  in_repair: "En taller",
  available: "Disponible",
  sold: "Vendido",
  returned: "Devuelto",
};

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  created: {
    label: "Registro inicial",
    icon: <Plus className="h-3.5 w-3.5" />,
    color: "text-slate-700",
    bg: "bg-slate-100 border-slate-300",
  },
  status_change: {
    label: "Cambio de estado",
    icon: <Activity className="h-3.5 w-3.5" />,
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-300",
  },
  repair_start: {
    label: "Ingreso a taller",
    icon: <Wrench className="h-3.5 w-3.5" />,
    color: "text-orange-700",
    bg: "bg-orange-50 border-orange-300",
  },
  repair_cancelled: {
    label: "Reparación cancelada",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: "text-red-700",
    bg: "bg-red-50 border-red-300",
  },
  sold: {
    label: "Venta",
    icon: <ShoppingBag className="h-3.5 w-3.5" />,
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-300",
  },
  return_rma: {
    label: "Devolución (RMA)",
    icon: <RotateCcw className="h-3.5 w-3.5" />,
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-300",
  },
};

// repair_completed / repair_completed_return_to_customer / repair_completed_return_to_inventory
function classifyRepairCompletion(eventType: string): { label: string; color: string; bg: string; icon: React.ReactNode } {
  if (eventType.endsWith("return_to_customer")) {
    return {
      label: "Reparación finalizada → Devuelto al cliente",
      icon: <Package className="h-3.5 w-3.5" />,
      color: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-300",
    };
  }
  if (eventType.endsWith("return_to_inventory")) {
    return {
      label: "Reparación finalizada → Retornado a inventario",
      icon: <Package className="h-3.5 w-3.5" />,
      color: "text-blue-700",
      bg: "bg-blue-50 border-blue-300",
    };
  }
  return {
    label: "Reparación finalizada",
    icon: <Hammer className="h-3.5 w-3.5" />,
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-300",
  };
}

function eventMeta(eventType: string) {
  if (eventType.startsWith("repair_completed")) return classifyRepairCompletion(eventType);
  if (EVENT_META[eventType]) return EVENT_META[eventType];
  return {
    label: eventType,
    icon: <Cog className="h-3.5 w-3.5" />,
    color: "text-slate-700",
    bg: "bg-slate-50 border-slate-300",
  };
}

function formatDateLong(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

interface EventHistoryProps {
  events: UnitEvent[] | null | undefined;
  emptyMessage?: string;
  maxHeightClass?: string;
}

export function EventHistory({ events, emptyMessage = "Sin eventos registrados.", maxHeightClass = "max-h-72" }: EventHistoryProps) {
  if (!events || events.length === 0) {
    return (
      <div className="text-xs text-muted-foreground border rounded p-3 bg-slate-50 text-center">
        <History className="h-4 w-4 mx-auto mb-1 opacity-40" />
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${maxHeightClass} overflow-y-auto pr-1`}>
      {events.map((ev) => {
        const meta = eventMeta(ev.eventType);
        const fromLabel = ev.fromStatus ? (STATUS_LABEL[ev.fromStatus] || ev.fromStatus) : null;
        const toLabel = ev.toStatus ? (STATUS_LABEL[ev.toStatus] || ev.toStatus) : null;
        const dateStr = formatDateLong(ev.createdAt);

        return (
          <div key={ev.id} className={`text-xs border rounded-lg p-2.5 ${meta.bg}`}>
            <div className="flex items-start justify-between gap-2">
              <div className={`flex items-center gap-1.5 font-semibold ${meta.color}`}>
                {meta.icon}
                <span>{meta.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <Clock className="h-3 w-3" /> {dateStr}
              </span>
            </div>

            {(fromLabel || toLabel) && (
              <div className="mt-1 text-[11px] text-slate-600">
                {fromLabel && toLabel ? (
                  <span>
                    {fromLabel} <span className="text-muted-foreground">→</span> {toLabel}
                  </span>
                ) : toLabel ? (
                  <span>→ {toLabel}</span>
                ) : null}
              </div>
            )}

            {ev.notes && (
              <p className="mt-1 text-slate-700 whitespace-pre-wrap break-words">
                {ev.notes}
              </p>
            )}

            {ev.userName && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Por: {ev.userName}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
