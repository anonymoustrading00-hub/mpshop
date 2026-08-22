import { type FormEvent, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  getBatchStageFlow,
  getQualityLabel,
  getTypeLabel,
  type BatchStage,
  type ProductionBatch,
  type ProductionType,
  type QualityStatus,
  useProductionControl,
} from "@/lib/productionControl";
import {
  Beaker,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Droplet,
  FlaskConical,
  Milk,
  Plus,
  Recycle,
  Send,
  ShieldCheck,
  SkipForward,
  Trash2,
  Waves,
  Wine,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

// ─── Configuración por tipo de producto ────────────────────────────────────────

interface TypeConfig {
  type: ProductionType;
  label: string;
  icon: React.ElementType;
  accent: string;
  bg: string;
  prefix: string;
  // Map internal BatchStage → display label for this type
  stageLabels: Partial<Record<BatchStage, string>>;
  // Ordered display stages (internal stage keys)
  displayFlow: BatchStage[];
}

const TYPE_CONFIG: TypeConfig[] = [
  {
    type: "kefir",
    label: "Kéfir de Leche",
    icon: Droplet,
    accent: "#00a878",
    bg: "#f0fdf9",
    prefix: "KF",
    displayFlow: ["preparacion", "fermentacion", "filtrado", "envasado"],
    stageLabels: {
      preparacion: "Preparación",
      fermentacion: "Fermentando",
      filtrado: "Aditivos",
      calidad: "Calidad",
      envasado: "Envasando",
      finalizado: "Finalizado",
    },
  },
  {
    type: "queso_directo",
    label: "Queso Directo",
    icon: Milk,
    accent: "#f59e0b",
    bg: "#fffbeb",
    prefix: "QD",
    displayFlow: ["preparacion", "separacion", "prensado", "envasado"],
    stageLabels: {
      preparacion: "Preparación",
      separacion: "Colando",
      prensado: "Prensando",
      calidad: "Calidad",
      envasado: "Envasando",
      finalizado: "Finalizado",
    },
  },
  {
    type: "queso_indirecto",
    label: "Queso Indirecto",
    icon: Recycle,
    accent: "#8b5cf6",
    bg: "#f5f3ff",
    prefix: "QI",
    displayFlow: ["preparacion", "separacion", "prensado", "envasado"],
    stageLabels: {
      preparacion: "Recepción",
      separacion: "Colando",
      prensado: "Saborizado",
      calidad: "Calidad",
      envasado: "Envasando",
      finalizado: "Finalizado",
    },
  },
  {
    type: "kefir_agua",
    label: "Kéfir de Agua",
    icon: Wine,
    accent: "#3b82f6",
    bg: "#eff6ff",
    prefix: "KA",
    displayFlow: ["preparacion", "fermentacion", "filtrado", "envasado"],
    stageLabels: {
      preparacion: "Preparación",
      fermentacion: "Fermentando",
      filtrado: "Aditivos",
      calidad: "Calidad",
      envasado: "Envasando",
      finalizado: "Finalizado",
    },
  },
  {
    type: "suero",
    label: "Suero de Kéfir",
    icon: Waves,
    accent: "#06b6d4",
    bg: "#ecfeff",
    prefix: "SU",
    displayFlow: ["preparacion", "separacion", "filtrado", "envasado"],
    stageLabels: {
      preparacion: "Preparación",
      separacion: "Separación",
      filtrado: "Filtrado",
      envasado: "Envasando",
      finalizado: "Finalizado",
    },
  },
];

const INITIAL_CREATE = {
  type: "kefir" as ProductionType,
  operator: "María",
  initialVolumeLiters: 5.6,
  expectedVolumeLiters: 5,
  expectedQuesoGr: 0,
  expectedSueroMl: 0,
  grainsGr: 100,
  strainId: "",
  milkType: "Leche de vaca",
  sugarBrownGr: 0,
  sugarWhiteGr: 0,
  notes: "",
  leftoverVolumeMl: 0,
  saveLeftoverToInventory: true,
};

const SUERO_TYPES: ProductionType[] = ["suero"];
const QUESO_TYPES: ProductionType[] = ["queso_directo", "queso_indirecto"];

/* ─── Static fallback milk types (always shown if nothing from catalog) ─── */
const STATIC_MILK_OPTIONS = [
  "Leche de vaca",
  "Leche entera",
  "Leche deslactosada",
  "Sobrante de leche",
];

const INITIAL_QUALITY = {
  status: "aprobado" as QualityStatus,
  ph: 4.0,
  temperature: 20,
  acidity: 0,
  aspectColor: "Blanco",
  outputLiters: 0,
  approvedBy: "Calidad",
  notes: "",
};

const INITIAL_COMPLETE = {
  finalUnits: 0,
  finalVolumeLiters: 0,
  finalQuesoGr: 0,
  finalSueroMl: 0,
  qualityStatus: "aprobado" as QualityStatus,
  qualityPh: 4.4,
  qualityTemperature: 22,
  qualityAcidity: 0,
  qualityAspectColor: "Blanco",
  qualityOutputLiters: 0,
  qualityApprovedBy: "Calidad",
  qualityNotes: "",
  notes: "",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDisplayStageLabel(cfg: TypeConfig, stage: BatchStage): string {
  return cfg.stageLabels[stage] ?? stage;
}

function getStageIndex(cfg: TypeConfig, stage: BatchStage): number {
  return cfg.displayFlow.indexOf(stage);
}

function getStagePct(cfg: TypeConfig, stage: BatchStage): number {
  const idx = getStageIndex(cfg, stage);
  const total = cfg.displayFlow.length;
  return idx < 0 ? 0 : Math.round(((idx + 1) / total) * 100);
}

function getShortLabel(cfg: TypeConfig, stage: BatchStage): string {
  const full = getDisplayStageLabel(cfg, stage);
  return full.slice(0, 4);
}

// ─── BatchCard ─────────────────────────────────────────────────────────────────

function BatchCard({
  batch,
  cfg,
  onAdvance,
  onQuality,
  onComplete,
  onDelete,
}: {
  batch: ProductionBatch;
  cfg: TypeConfig;
  onAdvance: () => void;
  onQuality: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const pct = getStagePct(cfg, batch.stage);
  const currentIdx = getStageIndex(cfg, batch.stage);
  const isActive     = batch.status === "en_proceso";
  const isEnCalidad  = batch.status === "en_calidad";
  const isFinalizado = batch.status === "finalizado";
  const isRechazado  = batch.status === "rechazado";
  const stageQuality: QualityStatus | null = batch.stageQuality?.[batch.stage]?.status ?? null;

  const badgeColor =
    isRechazado    ? "#ef4444" :
    isFinalizado   ? "#64748b" :
    isEnCalidad    ? "#06b6d4" :
    stageQuality === "aprobado"  ? "#00a878" :
    stageQuality === "rechazado" ? "#ef4444" :
    cfg.accent;

  const badgeLabel =
    isRechazado   ? "Rechazado" :
    isFinalizado  ? "Finalizado" :
    isEnCalidad   ? "En Calidad" :
    getDisplayStageLabel(cfg, batch.stage);

  const isLastActive = batch.stage === "envasado" || batch.stage === "calidad";

  return (
    <article style={{
      background: "#fff",
      borderRadius: 14,
      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      border: "1px solid #e8ecf0",
      overflow: "hidden",
    }}>
      <div style={{ height: 3, background: isRechazado ? "#ef4444" : `linear-gradient(90deg,${cfg.accent},${cfg.accent}88)` }} />

      <div style={{ padding: "14px 16px 12px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${cfg.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <cfg.icon style={{ width: 13, height: 13, color: cfg.accent }} />
            </div>
            <div>
              <span style={{ display: "block", fontWeight: 800, fontSize: 14, color: "#1a1a2e" }}>
                {batch.batchNumber}
              </span>
              <span style={{ fontSize: 10, color: "#616569" }}>
                {getTypeLabel(batch.type)} • {batch.operator}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 20,
              background: `${badgeColor}15`, color: badgeColor, border: `1px solid ${badgeColor}40`,
            }}>
              {badgeLabel}
            </span>
            <button type="button" onClick={onDelete} title="Eliminar"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#adb5bd", padding: 2 }}>
              <Trash2 style={{ width: 13, height: 13 }} />
            </button>
          </div>
        </div>

        {/* OP + leche */}
        {(batch.orderRef || batch.milkType) && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }}>
            {batch.orderRef && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#313131" }}>
                <ClipboardList style={{ width: 11, height: 11 }} />{batch.orderRef}
              </span>
            )}
            {batch.milkType && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: `${cfg.accent}12`, color: cfg.accent, border: `1px solid ${cfg.accent}30` }}>
                {batch.milkType}
              </span>
            )}
          </div>
        )}

        {/* Progress */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#adb5bd" }}>PROGRESO</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: cfg.accent }}>{pct}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: "#e8ecf0", marginBottom: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${cfg.accent},${cfg.accent}bb)`, borderRadius: 99, transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {cfg.displayFlow.map((s, idx) => (
              <span key={s} style={{
                fontSize: 8, fontWeight: idx === currentIdx ? 800 : idx < currentIdx ? 700 : 400,
                color: idx === currentIdx ? cfg.accent : idx < currentIdx ? "#313131" : "#d1d5db",
                borderBottom: idx === currentIdx ? `2px solid ${cfg.accent}` : "none",
                paddingBottom: 1,
              }}>
                {getShortLabel(cfg, s)}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f3f5" }}>
          <div>
            <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#adb5bd", display: "block" }}>CARGA INICIAL</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: "#1a1a2e" }}>
              {batch.type === "queso_directo" || batch.type === "queso_indirecto"
                ? `${batch.initialVolumeLiters}L`
                : `${batch.initialVolumeLiters}L`}
              <span style={{ fontSize: 9, fontWeight: 500, color: "#616569", marginLeft: 3 }}>
                (Esp: {batch.expectedVolumeLiters || batch.expectedQuesoGr || 0}
                {batch.expectedVolumeLiters ? "L" : "g"})
              </span>
            </span>
          </div>
          <div>
            <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#adb5bd", display: "block" }}>RENDIMIENTO</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: "#1a1a2e" }}>
              {batch.finalVolumeLiters
                ? `${batch.finalVolumeLiters}L`
                : batch.finalQuesoGr
                ? `${batch.finalQuesoGr}g`
                : "—"}
            </span>
          </div>
        </div>

        {/* Quality indicator */}
        {stageQuality && !isFinalizado && (
          <div style={{
            marginTop: 8, padding: "5px 8px", borderRadius: 7, fontSize: 10, fontWeight: 700,
            background: stageQuality === "aprobado" ? "#f0fdf9" : stageQuality === "rechazado" ? "#fff1f0" : "#fffbeb",
            color: stageQuality === "aprobado" ? "#00a878" : stageQuality === "rechazado" ? "#ef4444" : "#f59e0b",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <Beaker style={{ width: 11, height: 11 }} />
            Calidad etapa: {getQualityLabel(stageQuality)}
          </div>
        )}

        {/* Acciones — solo si está en proceso */}
        {isActive && !isRechazado && (
          <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
            <button type="button" onClick={isLastActive ? onComplete : onAdvance} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg,${cfg.accent},${cfg.accent}cc)`,
              color: "#fff", fontWeight: 700, fontSize: 12,
              boxShadow: `0 4px 12px ${cfg.accent}40`,
            }}>
              <SkipForward style={{ width: 13, height: 13 }} />
              Avanzar
            </button>
            <button type="button" onClick={onQuality} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e1e4e8",
              background: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12, color: "#313131",
            }}>
              <FlaskConical style={{ width: 13, height: 13, color: cfg.accent }} />
              Calidad
            </button>
          </div>
        )}

        {/* Estado: En Calidad — esperando liberación */}
        {isEnCalidad && (
          <>
            <div style={{
              marginTop: 10, padding: "9px 12px", borderRadius: 9,
              background: "linear-gradient(135deg,#ecfeff,#f0f9ff)",
              border: "1.5px solid #06b6d4",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <ShieldCheck style={{ width: 16, height: 16, color: "#06b6d4", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#06b6d4" }}>Producción completa</div>
                <div style={{ fontSize: 10, color: "#616569" }}>Esperando liberación final en Calidad</div>
              </div>
            </div>
            <Link href="/production/quality">
              <a style={{
                marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#06b6d4,#0891b2)",
                color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none",
                boxShadow: "0 4px 12px rgba(6,182,212,0.35)",
              }}>
                <Send style={{ width: 13, height: 13 }} />
                → Ir a Módulo de Calidad
              </a>
            </Link>
          </>
        )}

        {isFinalizado && (
          <div style={{ marginTop: 10, padding: "7px 10px", borderRadius: 9, background: "#f0fdf9", border: "1px solid #c6f1e1", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#00a878" }}>
            <Check style={{ width: 13, height: 13 }} /> Lote finalizado
          </div>
        )}

        {isRechazado && (
          <div style={{ marginTop: 10, padding: "7px 10px", borderRadius: 9, background: "#fff1f0", border: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#ef4444" }}>
            <X style={{ width: 13, height: 13 }} /> Lote rechazado
          </div>
        )}

        {/* Historial */}
        <button type="button" onClick={() => setHistoryOpen(v => !v)} style={{
          marginTop: 9, display: "flex", alignItems: "center", gap: 4,
          fontSize: 10, fontWeight: 600, color: "#616569", background: "none", border: "none", cursor: "pointer", padding: 0,
        }}>
          {historyOpen ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
          Ver Historial de Tiempos
        </button>

        {historyOpen && (
          <div style={{ marginTop: 7, borderTop: "1px solid #f1f3f5", paddingTop: 7 }}>
            {batch.history?.length > 0 ? (
              batch.history.map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, color: "#616569", marginTop: 3 }}>
                  <span style={{ fontWeight: 600 }}>{item.event}</span>
                  <span style={{ color: "#adb5bd", flexShrink: 0 }}>{item.date?.slice(0, 16).replace("T", " ")}</span>
                </div>
              ))
            ) : (
              <p style={{ margin: 0, fontSize: 10, color: "#adb5bd" }}>Sin historial</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Sección kanban por tipo ───────────────────────────────────────────────────

function TypeSection({
  cfg,
  batches,
  onAdvance,
  onQuality,
  onComplete,
  onDelete,
  onNewBatch,
}: {
  cfg: TypeConfig;
  batches: ProductionBatch[];
  onAdvance: (b: ProductionBatch) => void;
  onQuality: (b: ProductionBatch) => void;
  onComplete: (b: ProductionBatch) => void;
  onDelete: (b: ProductionBatch) => void;
  onNewBatch: (type: ProductionType) => void;
}) {
  const [collapsed, setCollapsed] = useState(batches.length === 0);
  const active = batches.filter(b => b.status === "en_proceso").length;

  // Agrupar por etapa interna
  const grouped = useMemo(() => {
    const map = new Map<BatchStage, ProductionBatch[]>();
    for (const s of cfg.displayFlow) map.set(s, []);
    for (const batch of batches) {
      const key = batch.stage;
      if (map.has(key)) map.set(key, [...(map.get(key)!), batch]);
      else {
        // Si la etapa no está en el displayFlow (ej: rechazado), la ponemos en la última
        const last = cfg.displayFlow[cfg.displayFlow.length - 1];
        map.set(last, [...(map.get(last) || []), batch]);
      }
    }
    return map;
  }, [batches, cfg.displayFlow]);

  return (
    <section style={{
      border: `1.5px solid ${cfg.accent}30`,
      borderRadius: 18,
      background: collapsed && batches.length === 0 ? "#fafbfc" : "#fff",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      overflow: "hidden",
      marginBottom: 20,
    }}>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px",
        background: cfg.bg,
        borderBottom: `1.5px solid ${cfg.accent}20`,
        cursor: "pointer",
      }} onClick={() => setCollapsed(v => !v)}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cfg.accent}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <cfg.icon style={{ width: 18, height: 18, color: cfg.accent }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "#1a1a2e" }}>{cfg.label}</span>
              {active > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: cfg.accent, color: "#fff" }}>
                  {active} activo{active !== 1 ? "s" : ""}
                </span>
              )}
              {batches.length === 0 && (
                <span style={{ fontSize: 10, color: "#adb5bd", fontWeight: 600 }}>Sin lotes</span>
              )}
            </div>
            {/* Flow pills */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              {cfg.displayFlow.map((s, idx) => (
                <span key={s} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: `${cfg.accent}cc`, background: `${cfg.accent}12`, padding: "1px 6px", borderRadius: 10 }}>
                    {getDisplayStageLabel(cfg, s)}
                  </span>
                  {idx < cfg.displayFlow.length - 1 && (
                    <ChevronRight style={{ width: 9, height: 9, color: "#adb5bd" }} />
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNewBatch(cfg.type); }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: cfg.accent, color: "#fff", fontWeight: 700, fontSize: 12,
              boxShadow: `0 2px 8px ${cfg.accent}40`,
            }}
          >
            <Plus style={{ width: 13, height: 13 }} />
            Nuevo Lote
          </button>
          {collapsed
            ? <ChevronDown style={{ width: 18, height: 18, color: cfg.accent }} />
            : <ChevronUp   style={{ width: 18, height: 18, color: cfg.accent }} />}
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: "16px", overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 14, minWidth: "max-content", alignItems: "flex-start" }}>
            {cfg.displayFlow.map((stage) => {
              const colBatches = grouped.get(stage) || [];
              const stageLabel = getDisplayStageLabel(cfg, stage);
              const isFinal = stage === "finalizado";
              return (
                <div key={stage} style={{ width: 260, flexShrink: 0 }}>
                  {/* Column header */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: 9, marginBottom: 10,
                    background: isFinal ? "#f8fafc" : `${cfg.accent}10`,
                    border: `1.5px solid ${cfg.accent}25`,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: cfg.accent, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                      {stageLabel}
                    </span>
                    <span style={{
                      minWidth: 20, height: 20, borderRadius: "50%",
                      background: colBatches.length > 0 ? cfg.accent : "#e8ecf0",
                      color: colBatches.length > 0 ? "#fff" : "#adb5bd",
                      fontSize: 10, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{colBatches.length}</span>
                  </div>

                  {/* Cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {colBatches.length === 0 ? (
                      <div style={{
                        padding: "20px 10px", textAlign: "center", fontSize: 11, color: "#adb5bd",
                        border: "1.5px dashed #e1e4e8", borderRadius: 12,
                      }}>
                        Sin lotes
                      </div>
                    ) : (
                      colBatches.map(batch => (
                        <BatchCard
                          key={batch.id}
                          batch={batch}
                          cfg={cfg}
                          onAdvance={() => onAdvance(batch)}
                          onQuality={() => onQuality(batch)}
                          onComplete={() => onComplete(batch)}
                          onDelete={() => onDelete(batch)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function ProductionBatches() {
  const { data: rawProducts } = (trpc.inventory as any).listProducts.useQuery();
  const control = useProductionControl(rawProducts as any);
  
  const leftoverMilkItem = control.inventory.find(item => item.name === "Sobrante de leche");
  const leftoverMilkQty = leftoverMilkItem ? leftoverMilkItem.quantity : 0;

  const [createOpen, setCreateOpen]   = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [qualityOpen, setQualityOpen]  = useState(false);

  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  const [qualityBatch, setQualityBatch]   = useState<ProductionBatch | null>(null);
  const [qualityStage, setQualityStage]   = useState<BatchStage>("preparacion");

  const [createDraft, setCreateDraft] = useState(INITIAL_CREATE);
  const [qualityDraft, setQualityDraft] = useState(INITIAL_QUALITY);
  const [completeDraft, setCompleteDraft] = useState(INITIAL_COMPLETE);

  // Estados para calculadora de masa / volumen
  const [calcVolume, setCalcVolume] = useState<number>(900);
  const [customVolume, setCustomVolume] = useState<number>(0);
  const [calcQuantity, setCalcQuantity] = useState<number>(0);

  /* ─── Dynamic milk options from raw materials catalog ─── */
  const milkOptions = useMemo(() => {
    const fromCatalog = (rawProducts || [])
      .filter((p: any) => p.category === "raw_material" && p.productionRole === "milk")
      .map((p: any) => p.name as string);
    const seen = new Set(fromCatalog.map((n: string) => n.toLowerCase()));
    const merged = [...fromCatalog];
    for (const s of STATIC_MILK_OPTIONS) {
      if (!seen.has(s.toLowerCase())) {
        merged.push(s);
        seen.add(s.toLowerCase());
      }
    }
    return merged.length > 0 ? merged : STATIC_MILK_OPTIONS;
  }, [rawProducts]);

  const recalcVolumes = (draft: typeof INITIAL_CREATE, activeVol: number, qty: number, expectedLiters: number) => {
    const totalMl = activeVol * qty;
    const initialLiters = Number((totalMl / 1000).toFixed(2));
    let requiredLiters = expectedLiters;
    
    if (draft.type === "kefir" && expectedLiters > 0) {
      requiredLiters = expectedLiters / (control.factors.kefirYieldPct / 100);
    } else if (draft.type === "kefir_agua" && expectedLiters > 0) {
      requiredLiters = expectedLiters / (control.factors.kefirWaterYieldPct / 100);
    }
    
    let leftoverVolumeMl = 0;
    let newInitial = draft.initialVolumeLiters;
    
    if (totalMl > 0) {
      if (requiredLiters < initialLiters) {
        leftoverVolumeMl = Math.max(0, totalMl - Math.round(requiredLiters * 1000));
        newInitial = Number(requiredLiters.toFixed(2));
      } else {
        newInitial = initialLiters;
      }
    }
    
    return { ...draft, expectedVolumeLiters: expectedLiters, initialVolumeLiters: newInitial, leftoverVolumeMl };
  };

  const handleCalcChange = (vol: number, qty: number, customVal = customVolume) => {
    setCalcVolume(vol);
    setCalcQuantity(qty);
    const activeVol = vol > 0 ? vol : customVal;
    const isSuero = SUERO_TYPES.includes(createDraft.type);
    if (isSuero) {
      setCreateDraft(prev => ({ ...prev, expectedSueroMl: activeVol * qty }));
    } else {
      setCreateDraft(prev => recalcVolumes(prev, activeVol, qty, prev.expectedVolumeLiters));
    }
  };

  // Agrupar todos los lotes activos (en_proceso) por tipo
  const batchesByType = useMemo(() => {
    const map = new Map<ProductionType, ProductionBatch[]>();
    for (const cfg of TYPE_CONFIG) map.set(cfg.type, []);
    for (const batch of control.batches) {
      if (batch.status === "en_proceso") {
        const list = map.get(batch.type) || [];
        map.set(batch.type, [...list, batch]);
      }
    }
    return map;
  }, [control.batches]);

  const openQuality = (batch: ProductionBatch) => {
    const record = batch.stageQuality?.[batch.stage];
    setQualityBatch(batch);
    setQualityStage(batch.stage);
    setQualityDraft({
      status:       record?.status === "pendiente" || !record ? "aprobado" : record.status,
      ph:           record?.ph           ?? 4,
      temperature:  record?.temperature  ?? 20,
      acidity:      record?.acidity      ?? 0,
      aspectColor:  record?.aspectColor  ?? "Blanco",
      outputLiters: record?.outputLiters ?? batch.expectedVolumeLiters ?? batch.initialVolumeLiters,
      approvedBy:   record?.approvedBy   ?? "Calidad",
      notes:        record?.notes        ?? "",
    });
    setQualityOpen(true);
  };

  const handleQuality = (e: FormEvent) => {
    e.preventDefault();
    if (!qualityBatch) return;
    control.recordQuality(qualityBatch.id, { ...qualityDraft, stage: qualityStage, scope: "stage" });
    const cfg = TYPE_CONFIG.find(c => c.type === qualityBatch.type)!;
    toast.success(`Calidad en "${getDisplayStageLabel(cfg, qualityStage)}" registrada para ${qualityBatch.batchNumber}`);
    setQualityOpen(false);
  };

  const openComplete = (batch: ProductionBatch) => {
    setSelectedBatch(batch);
    setCompleteDraft({
      finalUnits: Math.round(batch.expectedVolumeLiters || batch.expectedQuesoGr / 250 || 0),
      finalVolumeLiters: batch.expectedVolumeLiters,
      finalQuesoGr: batch.expectedQuesoGr,
      finalSueroMl: batch.expectedSueroMl,
      qualityStatus: batch.finalQuality?.status || "aprobado",
      qualityPh: batch.finalQuality?.ph || 4.4,
      qualityTemperature: batch.finalQuality?.temperature || 22,
      qualityAcidity: batch.finalQuality?.acidity || 0,
      qualityAspectColor: batch.finalQuality?.aspectColor || "Blanco",
      qualityOutputLiters: batch.finalQuality?.outputLiters || batch.finalVolumeLiters || batch.expectedVolumeLiters,
      qualityApprovedBy: batch.finalQuality?.approvedBy || "Calidad",
      qualityNotes: batch.finalQuality?.notes || "",
      notes: "",
    });
    setCompleteOpen(true);
  };

  const handleComplete = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    control.completeBatch(selectedBatch.id, {
      finalUnits: completeDraft.finalUnits,
      finalVolumeLiters: completeDraft.finalVolumeLiters,
      finalQuesoGr: completeDraft.finalQuesoGr,
      finalSueroMl: completeDraft.finalSueroMl,
      notes: completeDraft.notes,
      quality: {
        status: completeDraft.qualityStatus,
        ph: completeDraft.qualityPh,
        temperature: completeDraft.qualityTemperature,
        acidity: completeDraft.qualityAcidity,
        aspectColor: completeDraft.qualityAspectColor,
        outputLiters: completeDraft.qualityOutputLiters,
        approvedBy: completeDraft.qualityApprovedBy,
        notes: completeDraft.qualityNotes,
        stage: "final",
        scope: "final",
      },
    });
    toast.success(`Lote ${selectedBatch.batchNumber} finalizado`);
    setCompleteOpen(false);
  };

  const handleAdvance = (batch: ProductionBatch) => {
    const flow = getBatchStageFlow(batch.type);
    const idx = flow.indexOf(batch.stage);
    const next = flow[idx + 1];
    if (!next || next === "finalizado") {
      openComplete(batch);
    } else {
      control.advanceBatch(batch.id);
      const cfg = TYPE_CONFIG.find(c => c.type === batch.type)!;
      toast.success(`Lote ${batch.batchNumber} avanzó a ${getDisplayStageLabel(cfg, next)}`);
    }
  };

  const handleDelete = (batch: ProductionBatch) => {
    if (!window.confirm(`¿Eliminar el lote ${batch.batchNumber}? Esta acción no se puede deshacer.`)) return;
    toast.error(`Lote ${batch.batchNumber} eliminado`);
  };

  const openCreate = (type: ProductionType) => {
    const isQueso = QUESO_TYPES.includes(type);
    const isSuero = SUERO_TYPES.includes(type);
    setCalcVolume(900);
    setCustomVolume(0);
    setCalcQuantity(0);
    setCreateDraft({
      ...INITIAL_CREATE,
      type,
      grainsGr: type === "kefir_agua" ? 80 : 100,
      expectedVolumeLiters: (!isQueso && !isSuero) ? 5 : 0,
      expectedQuesoGr: isQueso ? 900 : 0,
      expectedSueroMl: isQueso ? 4200 : isSuero ? 5000 : 0,
      sugarBrownGr: type === "kefir_agua" ? 300 : 0,
      sugarWhiteGr: type === "kefir_agua" ? 150 : 0,
      milkType: isSuero ? "Suero de kéfir" : "Leche de vaca",
    });
    setCreateOpen(true);
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const batch = control.createBatch({
      ...createDraft,
      milkUsedQuantity: calcQuantity,
    });
    toast.success(`Lote ${batch.batchNumber} creado`);
    setCreateOpen(false);
  };

  const currentCfg = TYPE_CONFIG.find(c => c.type === createDraft.type) ?? TYPE_CONFIG[0];

  return (
    <div style={{ padding: "22px 24px" }}>

      {/* Header global */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: 21, color: "#1a1a2e" }}>Gestión de Lotes</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: "#616569" }}>
              {control.activeBatches.length} lote{control.activeBatches.length !== 1 ? "s" : ""} activo{control.activeBatches.length !== 1 ? "s" : ""} en planta
            </span>
            <span style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: 4, 
              background: "#fef3c7", 
              color: "#d97706", 
              padding: "2px 8px", 
              borderRadius: "12px", 
              fontSize: "11px", 
              fontWeight: 700,
              border: "1px solid #fde68a" 
            }}>
              🥛 Leche sobrante: {leftoverMilkQty.toFixed(2)} L
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {TYPE_CONFIG.map(cfg => (
            <button key={cfg.type} type="button" onClick={() => openCreate(cfg.type)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${cfg.accent}40`,
              background: `${cfg.accent}10`, color: cfg.accent, fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>
              <cfg.icon style={{ width: 14, height: 14 }} />
              {cfg.prefix}
            </button>
          ))}
        </div>
      </div>

      {/* Secciones por tipo */}
      {TYPE_CONFIG.map(cfg => (
        <TypeSection
          key={cfg.type}
          cfg={cfg}
          batches={batchesByType.get(cfg.type) || []}
          onAdvance={handleAdvance}
          onQuality={openQuality}
          onComplete={openComplete}
          onDelete={handleDelete}
          onNewBatch={openCreate}
        />
      ))}

      {/* ── Modal: Crear Lote ──────────────────────────────────────── */}
      {createOpen && (
        <div className="kefir-modal-overlay" role="dialog" aria-modal="true">
          <div className="kefir-modal">
            <div className="kefir-modal-header">
              <h2>Crear Nuevo Lote</h2>
              <button type="button" className="kefir-modal-close" onClick={() => setCreateOpen(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="kefir-modal-body" onSubmit={handleCreate}>
              {/* Selector de tipo */}
              <label>Tipo de producto</label>
              <div className="kefir-type-selector">
                {TYPE_CONFIG.map(cfg => (
                  <button key={cfg.type} type="button"
                    className={`kefir-type-option ${createDraft.type === cfg.type ? "is-active" : ""}`}
                    onClick={() => openCreate(cfg.type)}
                    style={{ borderColor: createDraft.type === cfg.type ? cfg.accent : undefined, color: createDraft.type === cfg.type ? cfg.accent : undefined }}>
                    <cfg.icon className="h-5 w-5" />
                    {cfg.label}
                  </button>
                ))}
              </div>

              {/* Flujo visual */}
              <div className="kefir-flow-box" style={{ borderColor: `${currentCfg.accent}40`, background: `${currentCfg.accent}08` }}>
                <label style={{ color: currentCfg.accent, marginBottom: 8 }}>Flujo de producción</label>
                <div className="kefir-flow-steps">
                  {currentCfg.displayFlow.map((s, idx) => (
                    <span key={s} className={`kefir-flow-step ${idx === 0 ? "is-current" : ""}`}
                      style={idx === 0 ? { background: currentCfg.accent, color: "#fff", borderColor: currentCfg.accent } : {}}>
                      {getDisplayStageLabel(currentCfg, s)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="kefir-form-grid">
                <div className="kefir-field">
                  <label>{SUERO_TYPES.includes(createDraft.type) ? "Fuente de suero" : "Tipo de leche / base"}</label>
                  <select value={createDraft.milkType} onChange={(e) => {
                    const newType = e.target.value;
                    setCreateDraft({ ...createDraft, milkType: newType });
                    const selectedProduct = (rawProducts as any[])?.find((p) => p.name === newType);
                    if (selectedProduct && selectedProduct.presentationVolumeMl) {
                      handleCalcChange(selectedProduct.presentationVolumeMl, calcQuantity);
                    }
                  }}>
                    {SUERO_TYPES.includes(createDraft.type) ? (
                      <>
                        <option>Suero de kéfir</option>
                        <option>Suero de queso directo</option>
                        <option>Suero de queso indirecto</option>
                      </>
                    ) : (
                      <>
                        {milkOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                        {createDraft.type === "kefir_agua" && <option>Agua filtrada</option>}
                      </>
                    )}
                  </select>
                </div>
                <div className="kefir-field">
                  <label>Cepa de nódulos</label>
                  <select value={createDraft.strainId} onChange={e => setCreateDraft({ ...createDraft, strainId: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {control.strains.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="kefir-field">
                  <label>Volumen inicial (L)</label>
                  <input type="number" step="0.1" value={createDraft.initialVolumeLiters}
                    onChange={e => {
                      const liters = Number(e.target.value);
                      const activeVol = calcVolume > 0 ? calcVolume : customVolume;
                      const totalMl = calcQuantity * activeVol;
                      const leftover = calcQuantity > 0 ? Math.max(0, totalMl - Math.round(liters * 1000)) : 0;
                      setCreateDraft({ 
                        ...createDraft, 
                        initialVolumeLiters: liters,
                        leftoverVolumeMl: leftover
                      });
                    }} />
                </div>
                {QUESO_TYPES.includes(createDraft.type) ? (
                  <>
                    <div className="kefir-field">
                      <label>Queso esperado (g)</label>
                      <input type="number" value={createDraft.expectedQuesoGr}
                        onChange={e => setCreateDraft({ ...createDraft, expectedQuesoGr: Number(e.target.value) })} />
                    </div>
                    <div className="kefir-field">
                      <label>Suero esperado (ml)</label>
                      <input type="number" value={createDraft.expectedSueroMl}
                        onChange={e => setCreateDraft({ ...createDraft, expectedSueroMl: Number(e.target.value) })} />
                    </div>
                  </>
                ) : SUERO_TYPES.includes(createDraft.type) ? (
                  <div className="kefir-field">
                    <label>Volumen de suero (ml)</label>
                    <input type="number" step="100" value={createDraft.expectedSueroMl}
                      onChange={e => setCreateDraft({ ...createDraft, expectedSueroMl: Number(e.target.value) })} />
                  </div>
                ) : (
                  <div className="kefir-field">
                    <label>Volumen esperado (L)</label>
                    <input type="number" step="0.1" value={createDraft.expectedVolumeLiters}
                      onChange={e => {
                        const liters = Number(e.target.value);
                        const activeVol = calcVolume > 0 ? calcVolume : customVolume;
                        setCreateDraft(prev => recalcVolumes(prev, activeVol, calcQuantity, liters));
                      }} />
                  </div>
                )}

                {/* Calculadora de Masa/Volumen de Insumos */}
                <div style={{
                  gridColumn: "1 / -1",
                  background: "#f0f9ff",
                  border: "1.5px dashed #0088cc44",
                  borderRadius: "12px",
                  padding: "16px",
                  marginTop: "4px",
                  marginBottom: "10px",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "16px" }}>📏</span>
                    <strong style={{ fontSize: "12px", color: "#0077b6", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Control de Masa/Volumen — Cálculo por Envase
                    </strong>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 800, color: "#616569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                        Presentación
                      </label>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                        {[800, 900, 1000].map(vol => (
                          <button
                            key={vol}
                            type="button"
                            onClick={() => handleCalcChange(vol, calcQuantity)}
                            style={{
                              flex: 1,
                              minHeight: "32px",
                              padding: "4px 8px",
                              fontSize: "11px",
                              fontWeight: 800,
                              borderRadius: "6px",
                              border: "1px solid",
                              borderColor: calcVolume === vol ? "#0077b6" : "#cbd5e1",
                              background: calcVolume === vol ? "#e0f2fe" : "#ffffff",
                              color: calcVolume === vol ? "#0369a1" : "#475569",
                              cursor: "pointer",
                              transition: "all 0.15s ease"
                            }}
                          >
                            {vol} ml
                          </button>
                        ))}
                        <button
                          key="otro"
                          type="button"
                          onClick={() => handleCalcChange(0, calcQuantity)}
                          style={{
                            flex: 1,
                            minHeight: "32px",
                            padding: "4px 8px",
                            fontSize: "11px",
                            fontWeight: 800,
                            borderRadius: "6px",
                            border: "1px solid",
                            borderColor: calcVolume === 0 || ![800, 900, 1000].includes(calcVolume) ? "#0077b6" : "#cbd5e1",
                            background: calcVolume === 0 || ![800, 900, 1000].includes(calcVolume) ? "#e0f2fe" : "#ffffff",
                            color: calcVolume === 0 || ![800, 900, 1000].includes(calcVolume) ? "#0369a1" : "#475569",
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                          }}
                        >
                          Otro
                        </button>
                      </div>

                      {(calcVolume === 0 || ![800, 900, 1000].includes(calcVolume)) && (
                        <input
                          type="number"
                          placeholder="Especificar ml"
                          value={customVolume || ""}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setCustomVolume(val);
                            handleCalcChange(0, calcQuantity, val);
                          }}
                          style={{
                            minHeight: "34px",
                            padding: "6px 10px",
                            fontSize: "12px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            width: "100%",
                            boxSizing: "border-box"
                          }}
                        />
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 800, color: "#616569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                        Cantidad de envases / bolsas
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={calcQuantity || ""}
                        onChange={e => {
                          const qty = Number(e.target.value);
                          handleCalcChange(calcVolume, qty);
                        }}
                        style={{
                          minHeight: "38px",
                          padding: "6px 10px",
                          fontSize: "13px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          width: "100%",
                          boxSizing: "border-box",
                          marginBottom: "6px"
                        }}
                      />
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", marginTop: "4px" }}>
                        Total calculado:{" "}
                        {SUERO_TYPES.includes(createDraft.type) ? (
                          <span>
                            {((calcVolume > 0 ? calcVolume : customVolume) * calcQuantity).toLocaleString()} ml
                          </span>
                        ) : (
                          <span>
                            {(((calcVolume > 0 ? calcVolume : customVolume) * calcQuantity) / 1000).toFixed(2)} L
                          </span>
                        )}
                      </div>
                      {createDraft.leftoverVolumeMl !== undefined && createDraft.leftoverVolumeMl > 0 && (
                        <div style={{ 
                          fontSize: "11px", 
                          fontWeight: 700, 
                          color: "#d97706", 
                          marginTop: "6px",
                          background: "#fffbeb",
                          border: "1px solid #fef3c7",
                          padding: "6px 8px",
                          borderRadius: "4px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px"
                        }}>
                          <span>⚠️ Sobrante a acumular: {createDraft.leftoverVolumeMl} ml ({(createDraft.leftoverVolumeMl / 1000).toFixed(2)} L)</span>
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, marginTop: "2px" }}>
                            <input 
                              type="checkbox" 
                              checked={createDraft.saveLeftoverToInventory !== false} 
                              onChange={(e) => setCreateDraft({ ...createDraft, saveLeftoverToInventory: e.target.checked })}
                            />
                            Enviar sobrante a Inventario de Leche Sobrante
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="kefir-field">
                  <label>Gramos de nódulos</label>
                  <input type="number" value={createDraft.grainsGr}
                    onChange={e => setCreateDraft({ ...createDraft, grainsGr: Number(e.target.value) })} />
                </div>
                <div className="kefir-field">
                  <label>Operario responsable</label>
                  <input value={createDraft.operator}
                    onChange={e => setCreateDraft({ ...createDraft, operator: e.target.value })} />
                </div>
                {(createDraft.type === "kefir_agua") && (
                  <>
                    <div className="kefir-field">
                      <label>Azúcar morena (g)</label>
                      <input type="number" value={createDraft.sugarBrownGr}
                        onChange={e => setCreateDraft({ ...createDraft, sugarBrownGr: Number(e.target.value) })} />
                    </div>
                    <div className="kefir-field">
                      <label>Azúcar blanca (g)</label>
                      <input type="number" value={createDraft.sugarWhiteGr}
                        onChange={e => setCreateDraft({ ...createDraft, sugarWhiteGr: Number(e.target.value) })} />
                    </div>
                  </>
                )}
              </div>

              <div className="kefir-field mt-4">
                <label>Notas</label>
                <textarea value={createDraft.notes} onChange={e => setCreateDraft({ ...createDraft, notes: e.target.value })} />
              </div>

              <div className="kefir-modal-footer">
                <button type="button" className="kefir-btn is-soft" onClick={() => setCreateOpen(false)}>Cancelar</button>
                <button type="submit" className="kefir-btn is-primary"
                  style={{ background: `linear-gradient(135deg,${currentCfg.accent},${currentCfg.accent}bb)` }}>
                  Crear Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Calidad de Etapa ────────────────────────────────── */}
      {qualityOpen && qualityBatch && (() => {
        const cfg = TYPE_CONFIG.find(c => c.type === qualityBatch.type) ?? TYPE_CONFIG[0];
        return (
          <div className="kefir-modal-overlay" role="dialog" aria-modal="true">
            <div className="kefir-modal">
              <div className="kefir-modal-header">
                <h2>Calidad de Etapa — {qualityBatch.batchNumber}</h2>
                <button type="button" className="kefir-modal-close" onClick={() => setQualityOpen(false)} aria-label="Cerrar">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form className="kefir-modal-body" onSubmit={handleQuality}>
                <div className="kefir-info-box is-green">
                  <FlaskConical className="h-6 w-6" />
                  <div>
                    <strong>{cfg.label} — Evaluación de calidad</strong>
                    <span className="block text-[12px] text-[#616569]">
                      Etapa actual: <b>{getDisplayStageLabel(cfg, qualityStage)}</b>
                    </span>
                  </div>
                </div>

                <div className="kefir-quality-baseline">
                  <div><span>Carga inicial</span><strong>{qualityBatch.initialVolumeLiters} L</strong></div>
                  <div>
                    <span>Rendimiento esperado</span>
                    <strong>
                      {qualityBatch.expectedVolumeLiters || qualityBatch.expectedQuesoGr || 0}{" "}
                      {qualityBatch.expectedVolumeLiters ? "L" : "g"}
                    </strong>
                  </div>
                </div>

                <div className="kefir-form-grid">
                  <div className="kefir-field">
                    <label>pH medido</label>
                    <input type="number" step="0.1" value={qualityDraft.ph}
                      onChange={e => setQualityDraft({ ...qualityDraft, ph: Number(e.target.value) })} />
                  </div>
                  <div className="kefir-field">
                    <label>Temperatura (°C)</label>
                    <input type="number" step="0.1" value={qualityDraft.temperature}
                      onChange={e => setQualityDraft({ ...qualityDraft, temperature: Number(e.target.value) })} />
                  </div>
                  <div className="kefir-field">
                    <label>Aspecto / Color</label>
                    <input value={qualityDraft.aspectColor}
                      onChange={e => setQualityDraft({ ...qualityDraft, aspectColor: e.target.value })} />
                  </div>
                  <div className="kefir-field">
                    <label>Acidez</label>
                    <input type="number" step="0.01" value={qualityDraft.acidity}
                      onChange={e => setQualityDraft({ ...qualityDraft, acidity: Number(e.target.value) })} />
                  </div>
                  <div className="kefir-field">
                    <label>Salida obtenida (L/g)</label>
                    <input type="number" step="0.1" value={qualityDraft.outputLiters}
                      onChange={e => setQualityDraft({ ...qualityDraft, outputLiters: Number(e.target.value) })} />
                  </div>
                  <div className="kefir-field">
                    <label>Responsable</label>
                    <input value={qualityDraft.approvedBy}
                      onChange={e => setQualityDraft({ ...qualityDraft, approvedBy: e.target.value })} />
                  </div>
                </div>

                <div className="kefir-quality-divider" />
                <div className="kefir-field">
                  <label>Veredicto</label>
                  <div className="kefir-verdict-group">
                    <button type="button" className={`kefir-verdict ${qualityDraft.status === "aprobado" ? "is-active" : ""}`}
                      onClick={() => setQualityDraft({ ...qualityDraft, status: "aprobado" })}>
                      <Check className="h-4 w-4" /> Aprobado
                    </button>
                    <button type="button" className={`kefir-verdict is-reject ${qualityDraft.status === "rechazado" ? "is-active" : ""}`}
                      onClick={() => setQualityDraft({ ...qualityDraft, status: "rechazado" })}>
                      <X className="h-4 w-4" /> Rechazado
                    </button>
                    <button type="button" className={`kefir-verdict is-pending ${qualityDraft.status === "pendiente" ? "is-active" : ""}`}
                      onClick={() => setQualityDraft({ ...qualityDraft, status: "pendiente" })}>
                      En observación
                    </button>
                  </div>
                </div>
                <div className="kefir-field mt-3">
                  <label>Observación</label>
                  <input value={qualityDraft.notes} onChange={e => setQualityDraft({ ...qualityDraft, notes: e.target.value })} />
                </div>

                <div className="kefir-modal-footer">
                  <button type="button" className="kefir-btn is-soft" onClick={() => setQualityOpen(false)}>Cancelar</button>
                  <button type="submit" className="kefir-btn is-green">Guardar Evaluación</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ── Modal: Finalizar Lote ──────────────────────────────────── */}
      {completeOpen && selectedBatch && (() => {
        const cfg = TYPE_CONFIG.find(c => c.type === selectedBatch.type) ?? TYPE_CONFIG[0];
        const isQueso = QUESO_TYPES.includes(selectedBatch.type);
        const isSuero = SUERO_TYPES.includes(selectedBatch.type);
        return (
          <div className="kefir-modal-overlay" role="dialog" aria-modal="true">
            <div className="kefir-modal">
              <div className="kefir-modal-header">
                <h2>Finalizar — {selectedBatch.batchNumber}</h2>
                <button type="button" className="kefir-modal-close" onClick={() => setCompleteOpen(false)} aria-label="Cerrar">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form className="kefir-modal-body" onSubmit={handleComplete}>
                <div className="kefir-info-box">
                  <CheckCircle2 className="h-6 w-6" />
                  <div>
                    <strong>Control final — {cfg.label}</strong>
                    <span className="block text-[12px] text-[#616569]">
                      Ingresa los valores reales y la calidad del producto terminado.
                    </span>
                  </div>
                </div>

                <div className="kefir-form-grid">
                  <div className="kefir-field">
                    <label>Unidades producidas</label>
                    <input type="number" min={0} value={completeDraft.finalUnits}
                      onChange={e => setCompleteDraft({ ...completeDraft, finalUnits: Number(e.target.value) })} />
                  </div>
                  {isQueso ? (
                    <>
                      <div className="kefir-field">
                        <label>Queso obtenido (g)</label>
                        <input type="number" value={completeDraft.finalQuesoGr}
                          onChange={e => setCompleteDraft({ ...completeDraft, finalQuesoGr: Number(e.target.value) })} />
                      </div>
                      <div className="kefir-field">
                        <label>Suero obtenido (ml)</label>
                        <input type="number" value={completeDraft.finalSueroMl}
                          onChange={e => setCompleteDraft({ ...completeDraft, finalSueroMl: Number(e.target.value) })} />
                      </div>
                    </>
                  ) : isSuero ? (
                    <div className="kefir-field">
                      <label>Suero envasado (ml)</label>
                      <input type="number" step="100" value={completeDraft.finalSueroMl}
                        onChange={e => setCompleteDraft({ ...completeDraft, finalSueroMl: Number(e.target.value) })} />
                    </div>
                  ) : (
                    <div className="kefir-field">
                      <label>Volumen final (L)</label>
                      <input type="number" step="0.1" value={completeDraft.finalVolumeLiters}
                        onChange={e => setCompleteDraft({ ...completeDraft, finalVolumeLiters: Number(e.target.value) })} />
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-[#e1e4e8] pt-4">
                  <div className="kefir-section-title">
                    <Beaker className="h-4 w-4" /> Evaluación final de calidad
                  </div>
                  <div className="kefir-form-grid is-three">
                    <div className="kefir-field">
                      <label>Resultado</label>
                      <select value={completeDraft.qualityStatus}
                        onChange={e => setCompleteDraft({ ...completeDraft, qualityStatus: e.target.value as QualityStatus })}>
                        <option value="aprobado">Aprobado</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="rechazado">Rechazado</option>
                      </select>
                    </div>
                    <div className="kefir-field">
                      <label>pH final</label>
                      <input type="number" step="0.1" value={completeDraft.qualityPh}
                        onChange={e => setCompleteDraft({ ...completeDraft, qualityPh: Number(e.target.value) })} />
                    </div>
                    <div className="kefir-field">
                      <label>Temperatura (°C)</label>
                      <input type="number" step="0.1" value={completeDraft.qualityTemperature}
                        onChange={e => setCompleteDraft({ ...completeDraft, qualityTemperature: Number(e.target.value) })} />
                    </div>
                    <div className="kefir-field">
                      <label>Acidez</label>
                      <input type="number" step="0.01" value={completeDraft.qualityAcidity}
                        onChange={e => setCompleteDraft({ ...completeDraft, qualityAcidity: Number(e.target.value) })} />
                    </div>
                    <div className="kefir-field">
                      <label>Aspecto / Color</label>
                      <input value={completeDraft.qualityAspectColor}
                        onChange={e => setCompleteDraft({ ...completeDraft, qualityAspectColor: e.target.value })} />
                    </div>
                    <div className="kefir-field">
                      <label>Salida real (L/g)</label>
                      <input type="number" step="0.1" value={completeDraft.qualityOutputLiters}
                        onChange={e => setCompleteDraft({ ...completeDraft, qualityOutputLiters: Number(e.target.value) })} />
                    </div>
                    <div className="kefir-field">
                      <label>Responsable</label>
                      <input value={completeDraft.qualityApprovedBy}
                        onChange={e => setCompleteDraft({ ...completeDraft, qualityApprovedBy: e.target.value })} />
                    </div>
                    <div className="kefir-field">
                      <label>Observación</label>
                      <input value={completeDraft.qualityNotes}
                        onChange={e => setCompleteDraft({ ...completeDraft, qualityNotes: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="kefir-field mt-3">
                  <label>Notas de cierre</label>
                  <textarea value={completeDraft.notes}
                    onChange={e => setCompleteDraft({ ...completeDraft, notes: e.target.value })} />
                </div>

                <div className="kefir-modal-footer">
                  <button type="button" className="kefir-btn is-soft" onClick={() => setCompleteOpen(false)}>Cancelar</button>
                  <button type="submit" className="kefir-btn is-green">Cerrar lote y registrar stock</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
