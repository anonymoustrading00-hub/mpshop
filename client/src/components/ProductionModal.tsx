import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { FlaskConical, Droplets, ChevronRight, CheckCircle2, Loader2, Hash, Minus, Plus, ChevronLeft, Package } from 'lucide-react';

interface ProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'kefir_production' | 'nodule_washing';
  onSuccess: () => void;
}

const CFG = {
  kefir_production: {
    icon: FlaskConical, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600',
    accent: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800',
    accentLight: 'bg-indigo-50', accentText: 'text-indigo-700',
    accentBorder: 'border-indigo-200', bar: 'bg-indigo-600', label: 'Elaboración de Kéfir',
  },
  nodule_washing: {
    icon: Droplets, iconBg: 'bg-sky-100', iconColor: 'text-sky-600',
    accent: 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800',
    accentLight: 'bg-sky-50', accentText: 'text-sky-700',
    accentBorder: 'border-sky-200', bar: 'bg-sky-600', label: 'Lavado / Mantenimiento',
  },
} as const;

// Stepper táctil independiente — stopPropagation para no activar el selector de la tarjeta
function TouchStepper({ value, onChange, unit, step = 1 }: {
  value: number; onChange: (v: number) => void; unit: string; step?: number;
}) {
  return (
    <div className="flex items-center rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(Math.max(0, value - step)); }}
        disabled={value <= 0}
        className="flex h-14 w-16 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 active:bg-slate-100 disabled:text-slate-300 text-slate-600 touch-manipulation select-none"
      >
        <Minus className="h-6 w-6 stroke-[2.5]" />
      </button>
      <div className="flex flex-1 flex-col items-center justify-center select-none py-1">
        <span className={`text-3xl font-black tracking-tighter ${value > 0 ? 'text-slate-900' : 'text-slate-300'}`}>{value}</span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{unit}</span>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(value + step); }}
        className="flex h-14 w-16 shrink-0 items-center justify-center border-l border-slate-200 bg-indigo-600 active:bg-indigo-700 text-white touch-manipulation select-none"
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </button>
    </div>
  );
}

// Tarjeta de producto kéfir — selector separado del stepper para evitar bubble
function KefirProductCard({ product, selected, quantity, onSelect, onChangeQty }: {
  product: { id: number; name: string; imageUrl?: string | null };
  selected: boolean; quantity: number;
  onSelect: () => void; onChangeQty: (v: number) => void;
}) {
  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all duration-150 ${selected ? 'border-indigo-400 shadow-md shadow-indigo-100' : 'border-slate-200 bg-white'}`}>
      {/* Zona de selección — separada del stepper */}
      <div
        onClick={onSelect}
        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer touch-manipulation ${selected ? 'bg-indigo-50' : 'active:bg-slate-50'}`}
      >
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-indigo-200' : 'bg-slate-100'}`}>
          <FlaskConical className={`h-6 w-6 ${selected ? 'text-indigo-600' : 'text-slate-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-extrabold ${selected ? 'text-indigo-800' : 'text-slate-800'} truncate`}>{product.name}</p>
          <p className="text-xs text-slate-400 font-medium">{selected ? 'Seleccionado ✓' : 'Toca para seleccionar'}</p>
        </div>
        {selected && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
        )}
      </div>

      {/* Stepper — solo visible cuando seleccionado, zona independiente */}
      {selected && (
        <div className="border-t border-indigo-100 bg-white px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Cantidad obtenida</p>
          <TouchStepper value={quantity} onChange={onChangeQty} unit="unid." />
        </div>
      )}
    </div>
  );
}

// Tarjeta subproducto lavado
function SubproductCard({ emoji, name, unit, value, onChange, step }: {
  emoji: string; name: string; unit: string; value: number; onChange: (v: number) => void; step: number;
}) {
  return (
    <div className={`rounded-2xl border-2 bg-white overflow-hidden shadow-sm transition-all ${value > 0 ? 'border-sky-400' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <span className="text-3xl select-none">{emoji}</span>
        <div className="flex-1">
          <p className="text-sm font-extrabold text-slate-800">{name}</p>
          <p className="text-xs text-slate-400 font-medium">en {unit}</p>
        </div>
        {value > 0 && <CheckCircle2 className="h-5 w-5 text-sky-500" />}
      </div>
      <div className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <TouchStepper value={value} onChange={onChange} unit={unit} step={step} />
      </div>
    </div>
  );
}

// Resumen antes de confirmar — muestra TODOS los productos con qty > 0
function SummaryView({ type, kefirProducts, kefirQtys, quesoQty, sueroQty, batchNumber }: {
  type: string;
  kefirProducts: { id: number; name: string }[];
  kefirQtys: Record<number, number>;
  quesoQty: number;
  sueroQty: number;
  batchNumber: string;
}) {
  const selectedKefirs = kefirProducts.filter((p) => (kefirQtys[p.id] ?? 0) > 0);

  return (
    <div className="space-y-4">
      {/* Número de lote */}
      <div className="flex items-center gap-2 rounded-2xl bg-slate-100 border border-slate-200 px-4 py-3">
        <Hash className="h-4 w-4 text-slate-500" />
        <span className="text-xs text-slate-500 font-semibold">Número de lote:</span>
        <span className="text-sm font-extrabold text-slate-900 ml-1">
          {batchNumber || <span className="text-slate-400 italic font-medium">generando...</span>}
        </span>
      </div>

      {/* Lista de productos */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Productos que se agregarán al inventario</p>

        {type === 'kefir_production' && (
          selectedKefirs.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin productos seleccionados</p>
          ) : (
            selectedKefirs.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-white border border-indigo-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-indigo-500" />
                  <span className="text-sm font-bold text-slate-800">{p.name}</span>
                </div>
                <span className="text-lg font-extrabold text-indigo-700">
                  +{kefirQtys[p.id]} <span className="text-xs font-semibold text-slate-400">unid.</span>
                </span>
              </div>
            ))
          )
        )}

        {type === 'nodule_washing' && (
          <>
            {quesoQty <= 0 && sueroQty <= 0 && (
              <p className="text-sm text-slate-400 italic">Sin cantidades registradas</p>
            )}
            {quesoQty > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-white border border-sky-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧀</span>
                  <span className="text-sm font-bold text-slate-800">Queso de Kéfir</span>
                </div>
                <span className="text-lg font-extrabold text-sky-700">+{quesoQty} <span className="text-xs font-semibold text-slate-400">gr</span></span>
              </div>
            )}
            {sueroQty > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-white border border-sky-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🥛</span>
                  <span className="text-sm font-bold text-slate-800">Suero de Kéfir</span>
                </div>
                <span className="text-lg font-extrabold text-sky-700">+{sueroQty} <span className="text-xs font-semibold text-slate-400">ml</span></span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
        <p className="text-xs text-green-700 font-medium">Al confirmar, el stock de inventario se actualizará automáticamente con las cantidades indicadas arriba.</p>
      </div>
    </div>
  );
}

// ── Modal principal ──
export function ProductionModal({ isOpen, onClose, type, onSuccess }: ProductionModalProps) {
  const { data: products = [] } = (trpc.inventory as any).listProducts.useQuery();
  const createBatchMutation = (trpc as any).production.createBatch.useMutation();
  const completeBatchMutation = (trpc as any).production.completeBatch.useMutation();

  // steps: 1 = confirmar inicio | 2 = registrar | 3 = resumen
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [batchNumber, setBatchNumber] = useState('');

  // Kefir production: mapa de cantidad por productId (evita compartir estado)
  const [selectedKefirId, setSelectedKefirId] = useState<number | null>(null);
  const [kefirQtys, setKefirQtys] = useState<Record<number, number>>({});

  // Nodule washing
  const [quesoQty, setQuesoQty] = useState(0);
  const [sueroQty, setSueroQty] = useState(0);

  const cfg = CFG[type];
  const Icon = cfg.icon;

  const kefirProducts = (products as any[]).filter(
    (p) => p.name.toLowerCase().includes('kefir') &&
      !p.name.toLowerCase().includes('queso') &&
      !p.name.toLowerCase().includes('suero')
  );
  const quesoProduct = (products as any[]).find((p) => p.name.toLowerCase().includes('queso de k'));
  const sueroProduct = (products as any[]).find((p) => p.name.toLowerCase().includes('suero de k'));

  const setQtyForProduct = (id: number, qty: number) => {
    setKefirQtys((prev) => ({ ...prev, [id]: qty }));
  };

  // Cualquier producto kéfir con qty > 0 es válido para continuar
  const anyKefirSelected = Object.values(kefirQtys).some((q) => q > 0);
  const canGoToSummary = type === 'kefir_production'
    ? anyKefirSelected
    : quesoQty > 0 || sueroQty > 0;

  const stepLabels = ['Confirmar inicio', 'Registrar resultados', 'Confirmar envío'];

  const handleStart = async () => {
    try {
      const res = await createBatchMutation.mutateAsync({ type });
      setBatchId(res.batchId);
      setBatchNumber(res.batchNumber ?? '');
      setStep(2);
      toast.success('✓ Lote iniciado');
    } catch { toast.error('Error al iniciar el lote.'); }
  };

  const handleComplete = async () => {
    if (!batchId) return;
    const outputs: { productId: number; quantity: number }[] = [];
    if (type === 'kefir_production') {
      // Enviar TODOS los productos con qty > 0
      Object.entries(kefirQtys).forEach(([id, qty]) => {
        if (qty > 0) outputs.push({ productId: Number(id), quantity: qty });
      });
      if (outputs.length === 0) { toast.error('Agrega cantidad a al menos un producto.'); return; }
    } else {
      if (quesoQty > 0) outputs.push({ productId: quesoProduct!.id, quantity: quesoQty });
      if (sueroQty > 0) outputs.push({ productId: sueroProduct!.id, quantity: sueroQty });
    }
    try {
      await completeBatchMutation.mutateAsync({ batchId, outputs });
      toast.success('✓ Lote completado. Inventario actualizado.');
      handleClose();
      onSuccess();
    } catch { toast.error('Error al finalizar el lote.'); }
  };

  const handleClose = () => {
    setStep(1); setBatchId(null); setBatchNumber('');
    setSelectedKefirId(null); setKefirQtys({});
    setQuesoQty(0); setSueroQty(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col w-full max-w-lg h-[100dvh] sm:h-auto sm:max-h-[90dvh] rounded-none sm:rounded-[1.5rem] border-0 sm:border bg-white p-0 shadow-2xl overflow-hidden gap-0">

        {/* Header */}
        <div className={`${cfg.accentLight} border-b ${cfg.accentBorder} px-5 py-4 shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.iconBg}`}>
              <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-extrabold text-slate-900 truncate">{cfg.label}</DialogTitle>
              <p className={`text-xs font-semibold ${cfg.accentText}`}>{stepLabels[step - 1]}</p>
            </div>
            {step >= 2 && batchNumber && (
              <div className="flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 border border-slate-200">
                <Hash className="h-3 w-3 text-slate-400" />
                <span className="text-xs font-black text-slate-700">{batchNumber}</span>
              </div>
            )}
          </div>
          {/* Progress */}
          <div className="mt-3 flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${step >= s ? cfg.bar : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4">

          {/* PASO 1 */}
          {step === 1 && (
            <div className={`rounded-2xl ${cfg.accentLight} border ${cfg.accentBorder} p-4 space-y-3`}>
              <p className={`text-sm font-bold ${cfg.accentText}`}>¿Qué sucederá?</p>
              <ul className="space-y-2.5">
                {(type === 'kefir_production'
                  ? ['Se asigna número de lote automático', 'Seleccionas el Kéfir y la cantidad obtenida', 'Revisas el resumen antes de confirmar', 'El stock se actualiza automáticamente']
                  : ['Se asigna número de lote automático', 'Registras gramos de Queso y ml de Suero', 'Revisas el resumen antes de confirmar', 'El stock se actualiza automáticamente']
                ).map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-xs font-black ${cfg.bar}`}>{i + 1}</div>
                    <span className="text-sm text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* PASO 2 – Kéfir */}
          {step === 2 && type === 'kefir_production' && (
            <>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Selecciona el producto obtenido</p>
              {kefirProducts.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 p-6 text-center">
                  <Package className="h-10 w-10 text-amber-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-amber-700">Sin productos Kéfir en catálogo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {kefirProducts.map((p: any) => (
                    <KefirProductCard
                      key={p.id}
                      product={p}
                      selected={selectedKefirId === p.id}
                      quantity={kefirQtys[p.id] ?? 0}
                      onSelect={() => {
                        setSelectedKefirId(p.id);
                        // inicializar en 1 si nunca se tocó este producto
                        if ((kefirQtys[p.id] ?? 0) === 0) {
                          setKefirQtys((prev) => ({ ...prev, [p.id]: 1 }));
                        }
                      }}
                      onChangeQty={(v) => setQtyForProduct(p.id, v)}
                    />
                  ))}
                  {anyKefirSelected && (
                    <p className="text-xs text-slate-400 text-center font-medium pt-1">
                      {Object.values(kefirQtys).filter(q => q > 0).length} producto(s) seleccionado(s)
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* PASO 2 – Lavado */}
          {step === 2 && type === 'nodule_washing' && (
            <>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Registra los subproductos obtenidos</p>
              {(!quesoProduct || !sueroProduct) && (
                <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">
                  ⚠️ Faltan en catálogo: {!quesoProduct && <b>"Queso de Kéfir" </b>}{!sueroProduct && <b>"Suero de Kéfir"</b>}
                </div>
              )}
              <SubproductCard emoji="🧀" name="Queso de Kéfir" unit="gramos" value={quesoQty} onChange={setQuesoQty} step={10} />
              <SubproductCard emoji="🥛" name="Suero de Kéfir" unit="ml" value={sueroQty} onChange={setSueroQty} step={50} />
            </>
          )}

          {/* PASO 3 – Resumen */}
          {step === 3 && (
            <SummaryView
              type={type}
              kefirProducts={kefirProducts}
              kefirQtys={kefirQtys}
              quesoQty={quesoQty}
              sueroQty={sueroQty}
              batchNumber={batchNumber}
            />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 space-y-2.5">
          {step === 1 && (
            <>
              <button onClick={handleStart} disabled={createBatchMutation.isPending}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl ${cfg.accent} px-4 py-4 text-base font-extrabold text-white shadow-md transition active:scale-[0.98] touch-manipulation disabled:opacity-60`}>
                {createBatchMutation.isPending ? <><Loader2 className="h-5 w-5 animate-spin" /> Iniciando...</> : <>Iniciar Lote <ChevronRight className="h-5 w-5" /></>}
              </button>
              <button onClick={handleClose}
                className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-600 transition active:scale-[0.98] touch-manipulation">
                Cancelar
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button onClick={() => { if (canGoToSummary) setStep(3); else toast.error(type === 'kefir_production' ? 'Selecciona un producto y agrega cantidad.' : 'Ingresa cantidad de Queso o Suero.'); }}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl ${cfg.accent} px-4 py-4 text-base font-extrabold text-white shadow-md transition active:scale-[0.98] touch-manipulation ${!canGoToSummary ? 'opacity-50' : ''}`}>
                Ver Resumen <ChevronRight className="h-5 w-5" />
              </button>
              <button onClick={handleClose}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-600 transition active:scale-[0.98] touch-manipulation">
                <ChevronLeft className="h-4 w-4" /> Cancelar
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button onClick={handleComplete} disabled={completeBatchMutation.isPending}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl ${cfg.accent} px-4 py-4 text-base font-extrabold text-white shadow-md transition active:scale-[0.98] touch-manipulation disabled:opacity-60`}>
                {completeBatchMutation.isPending ? <><Loader2 className="h-5 w-5 animate-spin" /> Guardando...</> : <><CheckCircle2 className="h-5 w-5" /> Confirmar y Actualizar Stock</>}
              </button>
              <button onClick={() => setStep(2)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-600 transition active:scale-[0.98] touch-manipulation">
                <ChevronLeft className="h-4 w-4" /> Volver a editar
              </button>
            </>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
