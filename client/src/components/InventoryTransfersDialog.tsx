import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { History, FileDown, ArrowRight, ArrowLeft } from "lucide-react";
import { exportTransfersHistoryToPDF, exportTransfersHistoryToExcel, exportTransferToPDF, exportTransferToExcel } from "@/lib/transfer-export";
import { Badge } from "@/components/ui/badge";

export function InventoryTransfersDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: transfers = [], isLoading } = trpc.inventory.getTransfers.useQuery(undefined, {
    enabled: isOpen
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-white/80 border-2 border-transparent hover:border-blue-500 transition-all duration-200">
          <History className="h-4 w-4 text-blue-600" />
          Historial de Traspasos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col rounded-[2rem] border-white/70 bg-white/95 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-slate-100 flex-row justify-between items-center">
          <div>
            <DialogTitle className="text-2xl font-black text-slate-900">Historial de Traspasos</DialogTitle>
            <p className="text-sm text-slate-500 font-medium">Registro de movimientos entre Inventario General y Producción</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportTransfersHistoryToPDF(transfers)} className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100">
              <FileDown className="h-4 w-4 mr-2" /> PDF Total
            </Button>
            <Button variant="outline" onClick={() => exportTransfersHistoryToExcel(transfers)} className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100">
              <FileDown className="h-4 w-4 mr-2" /> Excel Total
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {isLoading ? (
            <div className="text-center py-10 text-slate-500 font-medium animate-pulse">Cargando traspasos...</div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-medium">No hay traspasos registrados.</div>
          ) : (
            <div className="space-y-4">
              {transfers.map((t: any) => (
                <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                    <div className="flex gap-4 items-center">
                      <div className={`p-3 rounded-xl ${t.direction === 'to_production' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {t.direction === 'to_production' ? <ArrowRight className="h-6 w-6" /> : <ArrowLeft className="h-6 w-6" />}
                      </div>
                      <div>
                        <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                          {t.transferNumber}
                          <Badge variant="outline" className={`${t.direction === 'to_production' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                            {t.direction === 'to_production' ? 'A Producción' : 'A General'}
                          </Badge>
                        </h3>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">
                          {new Date(t.createdAt).toLocaleString("es-BO")} • Por {t.userFullName || t.username}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => exportTransferToPDF(t)} className="h-8 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50">
                        <FileDown className="h-3 w-3 mr-1" /> PDF
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => exportTransferToExcel(t)} className="h-8 text-xs font-bold text-slate-500 hover:text-green-600 hover:bg-green-50">
                        <FileDown className="h-3 w-3 mr-1" /> Excel
                      </Button>
                    </div>
                  </div>
                  
                  {t.notes && (
                    <div className="mb-3 px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-600 border border-slate-100">
                      <strong>Notas:</strong> {t.notes}
                    </div>
                  )}

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-left">
                        <th className="pb-2 font-bold uppercase text-[10px] tracking-widest">Producto</th>
                        <th className="pb-2 font-bold uppercase text-[10px] tracking-widest text-right">Cantidad</th>
                        <th className="pb-2 font-bold uppercase text-[10px] tracking-widest text-right w-24">Unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(t.items || []).map((item: any) => (
                        <tr key={item.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 font-semibold text-slate-700">{item.productName}</td>
                          <td className="py-2 font-black text-slate-900 text-right">{item.quantity}</td>
                          <td className="py-2 font-semibold text-slate-500 text-right uppercase text-[10px] tracking-wider">{item.productUnit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
