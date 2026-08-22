import { type FormEvent, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  calculateOrderSuggestion,
  type CreateBatchInput,
  getOrderStatusLabel,
  getTypeLabel,
  type OrderPriority,
  type OrderStatus,
  type ProductionType,
  useProductionControl,
} from "@/lib/productionControl";

/* ─── Static fallback milk types (always shown if nothing from catalog) ─── */
const STATIC_MILK_OPTIONS = [
  "Leche de vaca",
  "Leche entera",
  "Leche deslactosada",
  "Sobrante de leche",
];
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Droplet,
  FlaskConical,
  Link2,
  Milk,
  PackagePlus,
  Plus,
  Printer,
  Recycle,
  Search,
  Send,
  Trash2,
  Wine,
  X,
} from "lucide-react";
import { toast } from "sonner";

type OrderDraftItem = { productId: string; quantity: number };
type StatusFilter = "todas" | OrderStatus;

const todayISO = () => new Date().toISOString().slice(0, 10);

const priorityMeta: Record<OrderPriority, { color: string; bg: string; chip: string }> = {
  Alta: { color: "#d32f2f", bg: "#ffebee", chip: "is-red" },
  Media: { color: "#f57c00", bg: "#fff3e0", chip: "is-amber" },
  Baja: { color: "#2e7d32", bg: "#e8f5e9", chip: "is-green" },
};

const statusChip: Record<OrderStatus, string> = {
  pendiente: "is-amber",
  en_proceso: "is-blue",
  completada: "is-green",
  cancelada: "is-red",
};

const typeOptions: Array<{ value: ProductionType; label: string; icon: React.ElementType }> = [
  { value: "kefir", label: "Kéfir de leche", icon: Droplet },
  { value: "queso_directo", label: "Queso directo", icon: Milk },
  { value: "queso_indirecto", label: "Queso indirecto", icon: Recycle },
  { value: "kefir_agua", label: "Kéfir de agua", icon: Wine },
];

function normalizeBatchType(type: ProductionType | "suero"): ProductionType {
  if (type === "suero" || type === "queso_directo" || type === "queso_indirecto") return "queso_directo";
  return type;
}

function flowForType(type: ProductionType) {
  if (type === "queso_directo") return ["Preparación", "Pasteurizando", "Fermentando", "Colando", "Prensando", "Envasando", "Finalizado"];
  if (type === "queso_indirecto") return ["Recepción", "Sobrefermentando", "Colando", "Prensando", "Saborizado", "Envasando", "Finalizado"];
  return ["Preparación", "Fermentando", "Aditivos", "Envasando", "Finalizado"];
}

function daysLeft(dueDate: string) {
  const today = new Date(todayISO());
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function orderWhatsAppText(order: any) {
  const lines = [
    `Orden de producción: ${order.id}`,
    `Cliente: ${order.client}`,
    `Entrega: ${order.dueDate}`,
    `Prioridad: ${order.priority}`,
    `Estado: ${getOrderStatusLabel(order.status)}`,
    "",
    "Productos:",
    ...order.items.map((item: any) => `- ${item.productName}: ${item.quantity} ${item.unit}`),
  ];
  return lines.join("\n");
}

export default function ProductionOrders() {
  const { data: rawProducts } = (trpc.inventory as any).listProducts.useQuery();
  const control = useProductionControl(rawProducts as any);
  const [createOpen, setCreateOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [query, setQuery] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(control.orders[0]?.id || null);
  const [itemDraft, setItemDraft] = useState({ productId: "", quantity: "1" });
  const [orderDraft, setOrderDraft] = useState({
    client: "",
    dueDate: todayISO(),
    priority: "Media" as OrderPriority,
    notes: "",
    items: [] as OrderDraftItem[],
  });
  const [batchDraft, setBatchDraft] = useState<CreateBatchInput>({
    type: "kefir" as ProductionType,
    operator: "María",
    initialVolumeLiters: 0,
    expectedVolumeLiters: 0,
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
  });

  // Estados para calculadora de masa / volumen
  const [calcVolume, setCalcVolume] = useState<number>(900);
  const [customVolume, setCustomVolume] = useState<number>(0);
  const [calcQuantity, setCalcQuantity] = useState<number>(0);

  /* ─── Dynamic milk options from raw materials catalog ─── */
  const milkOptions = useMemo(() => {
    const fromCatalog = (rawProducts || [])
      .filter((p: any) => p.category === "raw_material" && p.productionRole === "milk")
      .map((p: any) => p.name as string);
    // Merge: catalog names first, then static fallbacks not already present
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

  const recalcVolumes = (draft: CreateBatchInput, activeVol: number, qty: number, expectedLiters: number) => {
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
    setBatchDraft((prev: CreateBatchInput) => recalcVolumes(prev, activeVol, qty, prev.expectedVolumeLiters));
  };

  const productOptions = control.products;
  const selectedProductId = itemDraft.productId || productOptions[0]?.id || "";

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return control.orders.filter((order) => {
      const byStatus = statusFilter === "todas" || order.status === statusFilter;
      const byQuery =
        !needle ||
        order.id.toLowerCase().includes(needle) ||
        order.client.toLowerCase().includes(needle) ||
        order.items.some((item) => item.productName.toLowerCase().includes(needle));
      return byStatus && byQuery;
    });
  }, [control.orders, query, statusFilter]);

  const selectedOrderForBatch = control.orders.find((order) => order.id === batchDraft.orderId);

  const addOrderItem = () => {
    const productId = selectedProductId;
    const quantity = Math.max(1, Number(itemDraft.quantity) || 1);
    if (!productId) {
      toast.error("Seleccione un producto");
      return;
    }
    setOrderDraft((draft) => ({
      ...draft,
      items: draft.items.some((item) => item.productId === productId)
        ? draft.items.map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item))
        : [...draft.items, { productId, quantity }],
    }));
    setItemDraft({ productId, quantity: "1" });
  };

  const updateOrderItem = (index: number, patch: Partial<OrderDraftItem>) => {
    setOrderDraft((draft) => ({
      ...draft,
      items: draft.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  };

  const removeOrderItem = (index: number) => {
    setOrderDraft((draft) => ({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const resetOrderDraft = () => {
    setOrderDraft({ client: "", dueDate: todayISO(), priority: "Media", notes: "", items: [] });
    setItemDraft({ productId: productOptions[0]?.id || "", quantity: "1" });
  };

  const handleCreateOrder = (event: FormEvent) => {
    event.preventDefault();
    const items = orderDraft.items
      .map((item) => ({ ...item, productId: item.productId || productOptions[0]?.id || "" }))
      .filter((item) => item.productId && item.quantity > 0);
    if (!orderDraft.client.trim()) {
      toast.error("Ingrese el cliente");
      return;
    }
    if (items.length === 0) {
      toast.error("Agregue al menos un producto");
      return;
    }
    const order = control.createOrder({ ...orderDraft, items });
    toast.success(`Orden ${order.id} creada`);
    setExpandedOrderId(order.id);
    setCreateOpen(false);
    resetOrderDraft();
  };

  const updateBatchType = (type: ProductionType, orderId = batchDraft.orderId) => {
    const suggestion = calculateOrderSuggestion(control.state, orderId, type);
    setBatchDraft((draft: CreateBatchInput) => ({
      ...draft,
      orderId,
      type,
      ...suggestion,
      grainsGr: type === "kefir_agua" ? 80 : 100,
      strainId: control.strains.find((strain) => (type === "kefir_agua" ? strain.type === "agua" : strain.type === "leche"))?.id || "",
      sugarBrownGr: type === "kefir_agua" ? Math.round(suggestion.initialVolumeLiters * 60) : 0,
      sugarWhiteGr: type === "kefir_agua" ? Math.round(suggestion.initialVolumeLiters * 30) : 0,
      leftoverVolumeMl: 0,
    }));
  };

  const openBatchDialog = (orderId: string, type: ProductionType) => {
    const order = control.orders.find((entry) => entry.id === orderId);
    setCalcVolume(900);
    setCustomVolume(0);
    setCalcQuantity(0);
    setBatchDraft((draft: CreateBatchInput) => ({ ...draft, orderId, notes: order?.notes || "", leftoverVolumeMl: 0 }));
    setBatchOpen(true);
    updateBatchType(type, orderId);
  };

  const handleCreateBatch = (event: FormEvent) => {
    event.preventDefault();
    const batch = control.createBatch({
      ...batchDraft,
      milkUsedQuantity: calcQuantity,
    });
    toast.success(`Lote ${batch.batchNumber} creado`);
    setBatchOpen(false);
    setExpandedOrderId(batch.orderRef || expandedOrderId);
  };

  return (
    <div className="kefir-page">
      <div className="kefir-metrics">
        <MetricCard tone="is-orange" icon={ClockIcon} value={control.orders.filter((order) => order.status === "pendiente").length} label="Pendientes" />
        <MetricCard tone="is-blue" icon={RefreshIcon} value={control.orders.filter((order) => order.status === "en_proceso").length} label="En proceso" />
        <MetricCard tone="is-green" icon={CheckCircle2} value={control.orders.filter((order) => order.status === "completada").length} label="Completadas" />
        <MetricCard tone="is-red" icon={AlertTriangle} value={control.orders.filter((order) => order.priority === "Alta").length} label="Alta prioridad" />
      </div>

      <div className="kefir-toolbar">
        <div className="kefir-toolbar-left">
          <div className="kefir-search">
            <Search className="h-4 w-4" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar orden, cliente..." />
          </div>
          <div className="kefir-tabs">
            {[
              { value: "todas", label: "Todas" },
              { value: "pendiente", label: "Pendiente" },
              { value: "en_proceso", label: "En Proceso" },
              { value: "completada", label: "Completada" },
              { value: "cancelada", label: "Cancelada" },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`kefir-tab ${statusFilter === filter.value ? "is-active" : ""}`}
                onClick={() => setStatusFilter(filter.value as StatusFilter)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="kefir-btn is-purple" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva Orden
        </button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="kefir-empty">
          <div>
            <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-25" />
            <p className="font-extrabold">Sin órdenes de producción</p>
            <p className="mt-1 text-sm">Crea una nueva orden con productos y cantidades requeridas.</p>
          </div>
        </div>
      ) : (
        <div className="kefir-order-list">
          {filteredOrders.map((order) => {
            const priority = priorityMeta[order.priority] || priorityMeta.Baja;
            const expanded = expandedOrderId === order.id || filteredOrders.length === 1;
            const linkedBatches = control.batches.filter((batch) => order.batchIds.includes(batch.id) || batch.orderRef === order.id);
            const batchTypes = Array.from(new Set(order.items.map((item) => normalizeBatchType(item.type))));
            const left = daysLeft(order.dueDate);
            return (
              <article
                key={order.id}
                className={`kefir-order-card ${expanded ? "is-expanded" : ""}`}
                style={{ borderLeftColor: priority.color }}
              >
                <button
                  type="button"
                  className="kefir-order-summary w-full text-left"
                  onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                >
                  <div className="kefir-order-main">
                    <span className="kefir-order-priority-icon" style={{ background: priority.bg, color: priority.color }}>
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="kefir-order-id">{order.id}</span>
                        <span className={`kefir-chip ${priority.chip}`}>{order.priority}</span>
                        <span className={`kefir-chip ${statusChip[order.status]}`}>{getOrderStatusLabel(order.status)}</span>
                      </span>
                      <span className="kefir-order-meta">
                        <span>▦ {order.client}</span>
                        <span>
                          <CalendarDays className="inline h-3.5 w-3.5" /> Entrega: <strong>{order.dueDate}</strong>
                        </span>
                        <span>{left >= 0 ? `${left} días restantes` : `${Math.abs(left)} días vencida`}</span>
                      </span>
                    </span>
                  </div>
                  <span className="flex items-center gap-5">
                    <span className="kefir-progress-stack">
                      <strong>{order.progress}%</strong>
                      <span>Cumpl.</span>
                    </span>
                    <span className="kefir-order-toggle">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
                  </span>
                </button>

                {expanded ? (
                  <div className="kefir-order-details">
                    <h3 className="kefir-section-title">
                      <ClipboardList className="h-4 w-4" />
                      Detalle de Productos Solicitados
                    </h3>
                    <table className="kefir-order-table">
                      <thead>
                        <tr>
                          <th style={{ width: "22%" }}>Producto</th>
                          <th>Sabor / Variedad</th>
                          <th style={{ width: "15%", textAlign: "center" }}>Cantidad</th>
                          <th style={{ width: "15%", textAlign: "center" }}>Unidad</th>
                          <th style={{ width: "18%", textAlign: "center" }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => {
                          const type = normalizeBatchType(item.type);
                          return (
                            <tr key={item.id}>
                              <td>
                                <span className="kefir-chip is-mint">{getTypeLabel(item.type)}</span>
                              </td>
                              <td>{item.productName}</td>
                              <td style={{ textAlign: "center", color: "#00a878", fontSize: 16 }}>{item.quantity}</td>
                              <td style={{ textAlign: "center" }}>{item.unit}</td>
                              <td style={{ textAlign: "center" }}>
                                <button type="button" className="kefir-btn is-soft" onClick={() => openBatchDialog(order.id, type)}>
                                  <PackagePlus className="h-3.5 w-3.5" />
                                  +Lote ({linkedBatches.filter((batch) => batch.type === type).length})
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <h3 className="kefir-section-title">
                      <Link2 className="h-4 w-4" />
                      Lotes Vinculados
                    </h3>
                    <div className="kefir-linked-lots">
                      {linkedBatches.length === 0 ? (
                        <button type="button" className="kefir-btn is-soft" onClick={() => openBatchDialog(order.id, batchTypes[0] || "kefir")}>
                          <Link2 className="h-3.5 w-3.5" />
                          Vincular Lote
                        </button>
                      ) : (
                        linkedBatches.map((batch) => (
                          <span key={batch.id} className="kefir-lot-pill">
                            <LayersIcon />
                            {batch.batchNumber}
                            <span style={{ color: "#616569", fontWeight: 600 }}>- {getOrderStatusLabel(order.status).toLowerCase()}</span>
                          </span>
                        ))
                      )}
                    </div>

                    <div className="kefir-order-actions">
                      {order.status !== "completada" ? (
                        <button type="button" className="kefir-btn is-green" onClick={() => control.updateOrderStatus(order.id, "completada")}>
                          <CheckCircle2 className="h-4 w-4" />
                          Marcar Completada
                        </button>
                      ) : null}
                      {order.status !== "cancelada" ? (
                        <button type="button" className="kefir-btn is-gray" onClick={() => control.updateOrderStatus(order.id, "cancelada")}>
                          <X className="h-4 w-4" />
                          Cancelar Orden
                        </button>
                      ) : null}
                      <button type="button" className="kefir-btn is-soft" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </button>
                      <button
                        type="button"
                        className="kefir-btn is-whatsapp"
                        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(orderWhatsAppText(order))}`, "_blank")}
                      >
                        <Send className="h-4 w-4" />
                        WhatsApp
                      </button>
                      <span className="spacer" />
                      <button type="button" className="kefir-btn is-danger" onClick={() => control.deleteOrder(order.id)}>
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {createOpen ? (
        <div className="kefir-modal-overlay" role="dialog" aria-modal="true">
          <div className="kefir-modal is-wide">
            <div className="kefir-modal-header">
              <h2>Crear Nueva Orden</h2>
              <button type="button" className="kefir-modal-close" onClick={() => setCreateOpen(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="kefir-modal-body" onSubmit={handleCreateOrder}>
              <div className="kefir-form-grid is-three">
                <div className="kefir-field">
                  <label>Cliente / destino</label>
                  <input value={orderDraft.client} onChange={(event) => setOrderDraft({ ...orderDraft, client: event.target.value })} />
                </div>
                <div className="kefir-field">
                  <label>Fecha requerida</label>
                  <input type="date" value={orderDraft.dueDate} onChange={(event) => setOrderDraft({ ...orderDraft, dueDate: event.target.value })} />
                </div>
                <div className="kefir-field">
                  <label>Prioridad</label>
                  <select value={orderDraft.priority} onChange={(event) => setOrderDraft({ ...orderDraft, priority: event.target.value as OrderPriority })}>
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label>Productos solicitados</label>
                <div className="kefir-form-grid is-three">
                  <select value={selectedProductId} onChange={(event) => setItemDraft({ ...itemDraft, productId: event.target.value })}>
                    {productOptions.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={itemDraft.quantity}
                    onChange={(event) => setItemDraft({ ...itemDraft, quantity: event.target.value })}
                  />
                  <button type="button" className="kefir-btn is-primary" onClick={addOrderItem}>
                    <Plus className="h-4 w-4" />
                    Agregar
                  </button>
                </div>
              </div>

              {orderDraft.items.length > 0 ? (
                <table className="kefir-order-table mt-4">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ width: "140px", textAlign: "center" }}>Cantidad</th>
                      <th style={{ width: "70px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {orderDraft.items.map((item, index) => {
                      const product = productOptions.find((entry) => entry.id === item.productId);
                      return (
                        <tr key={`${item.productId}-${index}`}>
                          <td>
                            <select value={item.productId} onChange={(event) => updateOrderItem(index, { productId: event.target.value })}>
                              {productOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                            <span className="text-xs text-[#92979d]">{product ? getTypeLabel(product.type) : ""}</span>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(event) => updateOrderItem(index, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                              style={{ textAlign: "center", fontWeight: 800 }}
                            />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button type="button" className="kefir-btn is-danger" onClick={() => removeOrderItem(index)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}

              <div className="kefir-field mt-4">
                <label>Notas</label>
                <textarea value={orderDraft.notes} onChange={(event) => setOrderDraft({ ...orderDraft, notes: event.target.value })} />
              </div>
              <div className="kefir-modal-footer">
                <button type="button" className="kefir-btn is-soft" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="kefir-btn is-purple">
                  Crear Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {batchOpen ? (
        <div className="kefir-modal-overlay" role="dialog" aria-modal="true">
          <div className="kefir-modal">
            <div className="kefir-modal-header">
              <h2>Crear Nuevo Lote</h2>
              <button type="button" className="kefir-modal-close" onClick={() => setBatchOpen(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="kefir-modal-body" onSubmit={handleCreateBatch}>
              {selectedOrderForBatch ? (
                <div className="kefir-info-box">
                  <ClipboardList className="h-6 w-6" />
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#1aa6d8]">Orden Asociada</div>
                    <strong>{selectedOrderForBatch.id} - Cliente: {selectedOrderForBatch.client}</strong>
                    <span className="block text-[12px] text-[#616569]">
                      Los volúmenes y masas sugeridas fueron calculados automáticamente para cubrir esta orden.
                    </span>
                  </div>
                </div>
              ) : null}

              <label>Tipo de producto</label>
              <div className="kefir-type-selector">
                {typeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`kefir-type-option ${batchDraft.type === option.value ? "is-active" : ""}`}
                      onClick={() => updateBatchType(option.value)}
                    >
                      <Icon className="h-5 w-5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="kefir-flow-box">
                <label style={{ color: "#00a878", marginBottom: 8 }}>Flujo de producción</label>
                <div className="kefir-flow-steps">
                  {flowForType(batchDraft.type).map((stage, index) => (
                    <span key={stage} className={`kefir-flow-step ${index === 0 ? "is-current" : ""}`}>
                      {stage}
                    </span>
                  ))}
                </div>
              </div>

              <div className="kefir-form-grid">
                <div className="kefir-field">
                  <label>Tipo de leche</label>
                  <select value={batchDraft.milkType} onChange={(event) => {
                    const newType = event.target.value;
                    setBatchDraft({ ...batchDraft, milkType: newType });
                    const selectedProduct = (rawProducts as any[])?.find((p) => p.name === newType);
                    if (selectedProduct && selectedProduct.presentationVolumeMl) {
                      handleCalcChange(selectedProduct.presentationVolumeMl, calcQuantity);
                    }
                  }}>
                    {milkOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="kefir-field">
                  <label>Cepa de nódulos</label>
                  <select value={batchDraft.strainId || ""} onChange={(event) => setBatchDraft({ ...batchDraft, strainId: event.target.value })}>
                    <option value="">Sin asignar</option>
                    {control.strains.map((strain) => (
                      <option key={strain.id} value={strain.id}>
                        {strain.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="kefir-field">
                  <label>Volumen inicial (L)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={batchDraft.initialVolumeLiters}
                    onChange={(event) => {
                      const liters = Number(event.target.value);
                      const activeVol = calcVolume > 0 ? calcVolume : customVolume;
                      setBatchDraft(prev => recalcVolumes(prev, activeVol, calcQuantity, liters));
                    }}
                  />
                </div>
                <div className="kefir-field">
                  <label>Volumen esperado (L)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={batchDraft.expectedVolumeLiters}
                    onChange={(event) => {
                      const liters = Number(event.target.value);
                      const activeVol = calcVolume > 0 ? calcVolume : customVolume;
                      setBatchDraft(prev => recalcVolumes(prev, activeVol, calcQuantity, liters));
                    }}
                  />
                </div>

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
                        <span>
                          {(((calcVolume > 0 ? calcVolume : customVolume) * calcQuantity) / 1000).toFixed(2)} L
                        </span>
                      </div>
                      {batchDraft.leftoverVolumeMl !== undefined && batchDraft.leftoverVolumeMl > 0 && (
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
                          <span>⚠️ Sobrante a acumular: {batchDraft.leftoverVolumeMl} ml ({(batchDraft.leftoverVolumeMl / 1000).toFixed(2)} L)</span>
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, marginTop: "2px" }}>
                            <input 
                              type="checkbox" 
                              checked={batchDraft.saveLeftoverToInventory !== false} 
                              onChange={(e) => setBatchDraft({ ...batchDraft, saveLeftoverToInventory: e.target.checked })}
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
                  <input type="number" value={batchDraft.grainsGr} onChange={(event) => setBatchDraft({ ...batchDraft, grainsGr: Number(event.target.value) })} />
                </div>
                <div className="kefir-field">
                  <label>Operario responsable</label>
                  <input value={batchDraft.operator} onChange={(event) => setBatchDraft({ ...batchDraft, operator: event.target.value })} />
                </div>
              </div>

              <div className="kefir-modal-footer">
                <button type="button" className="kefir-btn is-soft" onClick={() => setBatchOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="kefir-btn is-primary">
                  Crear Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ tone, icon: Icon, value, label }: { tone: string; icon: React.ElementType; value: number; label: string }) {
  return (
    <div className={`kefir-stat-card ${tone}`} style={{ color: tone === "is-orange" ? "#ff5a00" : tone === "is-blue" ? "#1976d2" : tone === "is-green" ? "#2e7d32" : "#d32f2f" }}>
      <span className="kefir-stat-icon">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="kefir-stat-value">{value}</span>
        <span className="kefir-stat-label">{label}</span>
      </span>
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return <AlertTriangle className={className} />;
}

function RefreshIcon({ className }: { className?: string }) {
  return <FlaskConical className={className} />;
}

function LayersIcon() {
  return <Droplet className="h-3.5 w-3.5" />;
}
