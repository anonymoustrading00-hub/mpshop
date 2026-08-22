import { useMemo, useState } from "react";
import {
  getQualityLabel,
  getStageLabel,
  getTypeLabel,
  type ProductionBatch,
  type ProductionType,
  type QualityStatus,
  useProductionControl,
} from "@/lib/productionControl";
import {
  AlertTriangle,
  BarChart3,
  Beaker,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  FlaskConical,
  Gauge,
  Link2,
  PackageCheck,
  Search,
  User,
} from "lucide-react";
import { Link } from "wouter";

type StatusFilter = "todos" | ProductionBatch["status"];

const qualityChip = (status: QualityStatus) => {
  if (status === "aprobado") return "kefir-chip is-green";
  if (status === "rechazado") return "kefir-chip is-red";
  return "kefir-chip is-blue";
};

const statusLabel = (status: ProductionBatch["status"]) => {
  if (status === "finalizado") return "Finalizado";
  if (status === "rechazado") return "Rechazado";
  if (status === "cancelado") return "Cancelado";
  return "En proceso";
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const durationBetween = (start?: string, end?: string) => {
  if (!start || !end) return "-";
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diff) || diff <= 0) return "-";
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const latestQuality = (batch: ProductionBatch) => {
  const records = Object.values(batch.stageQuality || {}).filter(Boolean);
  const latest = records.sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime())[0];
  return batch.finalQuality || latest || batch.quality;
};

export default function ProductionAudit() {
  const control = useProductionControl();
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"todos" | ProductionType>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [collapsedBatches, setCollapsedBatches] = useState<Set<string>>(new Set());

  const deviations = useMemo(
    () =>
      control.batches.filter(
        (batch) =>
          batch.status === "rechazado" ||
          Object.values(batch.stageQuality || {}).some((quality) => quality?.status === "rechazado")
      ),
    [control.batches]
  );

  const filteredBatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return control.batches.filter((batch) => {
      const matchesQuery = !normalized
        ? true
        : [batch.batchNumber, batch.operator, batch.orderRef, batch.orderClient, getTypeLabel(batch.type)]
            .join(" ")
            .toLowerCase()
            .includes(normalized);
      const matchesDate = !dateFilter || batch.startDate === dateFilter;
      const matchesType = typeFilter === "todos" || batch.type === typeFilter;
      const matchesStatus = statusFilter === "todos" || batch.status === statusFilter;
      return matchesQuery && matchesDate && matchesType && matchesStatus;
    });
  }, [control.batches, dateFilter, query, statusFilter, typeFilter]);

  return (
    <div className="kefir-page">
      <section className="kefir-spc-card">
        <div className="kefir-spc-header">
          <div>
            <span className="kefir-section-title">
              <BarChart3 className="h-4 w-4" />
              Control SPC de tiempos
            </span>
            <p>Lectura operacional basada en lotes y controles registrados.</p>
          </div>
          <span className={deviations.length > 0 ? "kefir-chip is-amber" : "kefir-chip is-green"}>
            {deviations.length > 0 ? `${deviations.length} fuera de limite` : "Dentro de limite"}
          </span>
        </div>
        <div className="kefir-spc-chart">
          <span className="kefir-spc-line is-top">LCS (24h)</span>
          <span className="kefir-spc-line is-mid">Media</span>
          <span className="kefir-spc-line is-bottom">LCI (18h)</span>
          {control.batches.slice(0, 10).map((batch, index) => {
            const left = control.batches.length <= 1 ? 50 : 8 + index * (84 / Math.max(1, Math.min(10, control.batches.length) - 1));
            const top = batch.status === "rechazado" ? 20 : batch.status === "finalizado" ? 52 : 38 + (index % 3) * 10;
            return (
              <span
                key={batch.id}
                className={`kefir-spc-point ${batch.status === "rechazado" ? "is-alert" : ""}`}
                style={{ left: `${left}%`, top: `${top}%` }}
                title={batch.batchNumber}
              >
                {batch.batchNumber}
              </span>
            );
          })}
        </div>
      </section>

      <div className={`kefir-audit-alert ${deviations.length > 0 ? "is-warning" : "is-ok"}`}>
        <AlertTriangle className="h-4 w-4" />
        <strong>Diagnostico SPC Tiempos:</strong>
        <span>
          De {control.batches.length} lotes analizados, {deviations.length} presentan desviaciones o rechazos.
          {deviations.length > 0 ? ` Revisar lotes: ${deviations.map((batch) => batch.batchNumber).join(", ")}` : " Proceso estable."}
        </span>
      </div>

      <section className="kefir-audit-filters">
        <div className="kefir-filter-field is-wide">
          <label>Busqueda por ID / operador</label>
          <div className="kefir-filter-input">
            <Search className="h-4 w-4" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. KF-2026-001..." />
          </div>
        </div>
        <div className="kefir-filter-field">
          <label>Fecha de inicio</label>
          <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        </div>
        <div className="kefir-filter-field">
          <label>Tipo de producto</label>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
            <option value="todos">Todos los Productos</option>
            <option value="kefir">Kefir de leche</option>
            <option value="kefir_agua">Kefir de agua</option>
            <option value="queso_directo">Queso directo</option>
            <option value="queso_indirecto">Queso indirecto</option>
          </select>
        </div>
        <div className="kefir-filter-field">
          <label>Estado de produccion</label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="todos">Todos los Estados</option>
            <option value="en_proceso">En proceso</option>
            <option value="finalizado">Finalizado</option>
            <option value="rechazado">Rechazado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </section>

      <div className="kefir-audit-list">
        {filteredBatches.length > 0 ? (
          filteredBatches.map((batch) => (
            <AuditBatchCard
              key={batch.id}
              batch={batch}
              isCollapsed={collapsedBatches.has(batch.id)}
              onToggle={() =>
                setCollapsedBatches((current) => {
                  const next = new Set(current);
                  if (next.has(batch.id)) next.delete(batch.id);
                  else next.add(batch.id);
                  return next;
                })
              }
            />
          ))
        ) : (
          <div className="kefir-empty">No hay lotes auditables con los filtros actuales.</div>
        )}
      </div>

      <Link href="/production/batches">
        <a className="kefir-floating-action">
          <PackageCheck className="h-4 w-4" />
          Producto terminado
        </a>
      </Link>
    </div>
  );
}

function AuditBatchCard({
  batch,
  isCollapsed,
  onToggle,
}: {
  batch: ProductionBatch;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const quality = latestQuality(batch);
  const finalOutput = batch.finalVolumeLiters > 0 ? `${batch.finalVolumeLiters} L` : batch.finalQuesoGr > 0 ? `${batch.finalQuesoGr} g` : "Pendiente";
  const history = [...batch.history].reverse();

  return (
    <article className={`kefir-audit-card ${batch.status === "rechazado" ? "is-danger" : ""} ${isCollapsed ? "is-collapsed" : ""}`}>
      <div className="kefir-audit-card-head">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2>{batch.batchNumber}</h2>
            <span className="kefir-chip is-blue">{getTypeLabel(batch.type)}</span>
          </div>
          <div className="kefir-order-meta">
            <span>
              <Calendar className="inline h-3.5 w-3.5" /> Inicio: {batch.startDate}
            </span>
            <span>
              <User className="inline h-3.5 w-3.5" /> Responsable: {batch.operator}
            </span>
            <span>
              <FlaskConical className="inline h-3.5 w-3.5" /> Cepa: {batch.strainId || "-"} ({batch.grainsGr}g)
            </span>
            {batch.orderRef ? (
              <span className="kefir-chip is-mint">
                <Link2 className="h-3 w-3" />
                {batch.orderRef}
              </span>
            ) : null}
          </div>
        </div>
        <div className="kefir-audit-status">
          <span>Estado</span>
          <strong className={batch.status === "rechazado" ? "text-[#d32f2f]" : "text-[#00a878]"}>{statusLabel(batch.status)}</strong>
          <button
            type="button"
            className="kefir-order-toggle"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expandir lote" : "Contraer lote"}
            onClick={onToggle}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          <div className="kefir-audit-panels">
            <section className="kefir-audit-panel">
              <h3>
                <Gauge className="h-4 w-4 text-[#00a878]" />
                Balance de Masa y Rendimiento
              </h3>
              <div className="kefir-balance-grid">
                <div>
                  <span>Carga Inicial</span>
                  <strong>{batch.initialVolumeLiters} L</strong>
                  <small>{batch.milkType}</small>
                </div>
                <div>
                  <span>Rendimiento Esperado</span>
                  <strong>
                    {batch.expectedVolumeLiters || batch.expectedQuesoGr || "-"}{" "}
                    {batch.expectedVolumeLiters ? "L" : batch.expectedQuesoGr ? "g" : ""}
                  </strong>
                  <small>Segun estandar</small>
                </div>
              </div>
              <div className="kefir-balance-total">
                <span>Volumen Obtenido Final:</span>
                <strong className={finalOutput === "Pendiente" ? "text-[#00a878]" : "text-[#313131]"}>{finalOutput}</strong>
              </div>
            </section>

            <section className="kefir-audit-panel">
              <h3>
                <Beaker className="h-4 w-4 text-[#1976d2]" />
                Evaluacion de Calidad y Sabores
              </h3>
              {quality.status === "pendiente" ? (
                <div className="kefir-quality-note">
                  <Beaker className="h-4 w-4" />
                  Aun no se ha registrado el control de calidad para este lote.
                </div>
              ) : (
                <div className="kefir-quality-summary">
                  <span className={qualityChip(quality.status)}>{getQualityLabel(quality.status)}</span>
                  <dl>
                    <div>
                      <dt>pH</dt>
                      <dd>{quality.ph ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>Temp.</dt>
                      <dd>{quality.temperature ? `${quality.temperature} C` : "-"}</dd>
                    </div>
                    <div>
                      <dt>Acidez</dt>
                      <dd>{quality.acidity ?? "-"}</dd>
                    </div>
                  </dl>
                  <p>{quality.notes || "Sin observaciones adicionales."}</p>
                </div>
              )}
            </section>
          </div>

          <section className="kefir-audit-timeline">
            <h3>
              <Clock className="h-4 w-4 text-[#00a878]" />
              Cronograma y Tiempos por Etapa
            </h3>
            <div className="kefir-table-scroll">
              <table className="kefir-order-table">
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Inicio</th>
                    <th>Finalizacion</th>
                    <th className="text-right">Duracion exacta</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length > 0 ? (
                    history.map((entry, index) => {
                      const next = history[index + 1];
                      return (
                        <tr key={`${entry.date}-${entry.event}`}>
                          <td>
                            <span className="kefir-stage-dot" />
                            {String(entry.event || "").replace("Avanza a ", "").replace("Lote ", "")}
                          </td>
                          <td>{formatDateTime(entry.date)}</td>
                          <td>{next ? formatDateTime(next.date) : batch.status === "en_proceso" ? "En curso..." : formatDateTime(batch.endDate)}</td>
                          <td className="text-right">{next ? durationBetween(entry.date, next.date) : "-"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4}>Sin historial registrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </article>
  );
}
