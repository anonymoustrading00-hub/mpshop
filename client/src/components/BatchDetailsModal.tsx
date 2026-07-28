import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Hash, 
  User, 
  Calendar, 
  Clock, 
  Package, 
  Activity, 
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight
} from 'lucide-react';

interface BatchDetailsModalProps {
  batch: any;
  isOpen: boolean;
  onClose: () => void;
}

export function BatchDetailsModal({ batch, isOpen, onClose }: BatchDetailsModalProps) {
  if (!batch) return null;

  const { data: batchDetails, isLoading } = trpc.production.getBatchDetails.useQuery(
    { batchId: batch.id },
    { enabled: isOpen }
  );
  const outputs = batchDetails?.outputs ?? [];

  const isCompleted = batch.status === 'completed';
  const isElaboracion = batch.type === 'kefir_production';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col w-full max-w-lg rounded-[1.5rem] p-0 overflow-hidden bg-white shadow-2xl border-0">
        
        {/* Header con gradiente */}
        <div className={`px-6 py-6 text-white ${isElaboracion ? 'bg-gradient-to-br from-indigo-600 to-violet-700' : 'bg-gradient-to-br from-sky-600 to-blue-700'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <Hash className="h-6 w-6 text-white" />
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border ${isCompleted ? 'bg-green-500/20 border-green-400/30 text-green-100' : 'bg-amber-500/20 border-amber-400/30 text-amber-100'}`}>
              {isCompleted ? 'Finalizado' : 'En Progreso'}
            </div>
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight">{batch.batchNumber}</DialogTitle>
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
            {isElaboracion ? 'Elaboración de Kéfir' : 'Lavado de Nódulos'}
          </p>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70dvh]">
          
          {/* Grid de Información Principal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operario</p>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <span className="text-sm font-extrabold text-slate-700">{batch.operatorName || 'Admin'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Inicio</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700">
                  {format(new Date(batch.startDate ?? batch.createdAt), "d MMM, HH:mm", { locale: es })}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duración</p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700">
                  {batch.endDate 
                    ? `${Math.round((new Date(batch.endDate).getTime() - new Date(batch.startDate ?? batch.createdAt).getTime()) / 60000)} min`
                    : '--'
                  }
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Final</p>
              <div className="flex items-center gap-2">
                {isCompleted ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Activity className="h-4 w-4 text-amber-500 animate-pulse" />}
                <span className={`text-sm font-bold ${isCompleted ? 'text-green-700' : 'text-amber-700'}`}>
                  {isCompleted ? 'Lote Cerrado' : 'Pendiente'}
                </span>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Resultados de Producción */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Producción Obtenida</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100">
                {outputs.length} items
              </span>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
              </div>
            ) : outputs.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-6 text-center">
                <p className="text-xs font-bold text-slate-400 italic">No hay productos registrados en este lote</p>
              </div>
            ) : (
              <div className="space-y-2">
                {outputs.map((out: any) => (
                  <div key={out.id} className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isElaboracion ? 'bg-indigo-50 text-indigo-600' : 'bg-sky-50 text-sky-600'}`}>
                        <Package className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-sm font-extrabold text-slate-700">{out.productName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-black text-slate-900">+{out.quantity}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{isElaboracion ? 'unid' : out.productName.toLowerCase().includes('queso') ? 'gr' : 'ml'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {batch.notes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-400">
                <FileText className="h-4 w-4" />
                <h3 className="text-xs font-black uppercase tracking-widest">Notas</h3>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-600 italic">
                "{batch.notes}"
              </div>
            </div>
          )}

          {!isCompleted && (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-800 tracking-tight">Lote en proceso</p>
                <p className="text-xs text-amber-700 leading-relaxed font-medium">Este lote aún no ha sido finalizado. Los productos solo se sumarán al inventario una vez que el lote pase a estado "Completado".</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={onClose}
            className="w-full rounded-2xl bg-white border border-slate-200 py-3 text-sm font-extrabold text-slate-700 shadow-sm active:scale-[0.98] transition-all"
          >
            Cerrar Detalle
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
