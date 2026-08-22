import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type ProductionInventoryItem, useProductionControl } from "@/lib/productionControl";
import { AlertCircle, Package, Pencil, ClipboardList, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type InventoryFilter = "todos" | ProductionInventoryItem["category"];

const categoryClass = (category: string) => {
  if (category === "materia") return "bg-blue-50 text-blue-700 border-blue-200";
  if (category === "insumo") return "bg-violet-50 text-violet-700 border-violet-200";
  if (category === "subproducto") return "bg-cyan-50 text-cyan-700 border-cyan-200";
  return "bg-green-50 text-green-700 border-green-200";
};

export default function ProductionInventory() {
  const { data: rawProducts } = (trpc.inventory as any).listProducts.useQuery();
  const control = useProductionControl(rawProducts as any);
  const [categoryFilter, setCategoryFilter] = useState<InventoryFilter>("todos");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProductionInventoryItem | null>(null);
  const [selectedKardexItemId, setSelectedKardexItemId] = useState<string>("");
  const [draft, setDraft] = useState({ quantity: 0, reason: "" });

  const openAdjust = (item: ProductionInventoryItem) => {
    setSelectedItem(item);
    setDraft({ quantity: item.quantity, reason: "Ajuste manual de planta" });
    setAdjustOpen(true);
  };

  const handleAdjust = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedItem) return;
    control.adjustInventory(selectedItem.id, draft.quantity, draft.reason);
    toast.success(`Stock ajustado para ${selectedItem.name}`);
    setAdjustOpen(false);
    setSelectedItem(null);
  };

  const totalValue = control.inventory.reduce((sum, item) => sum + item.quantity * item.avgCost, 0);
  const filteredInventory = control.inventory.filter((item) => categoryFilter === "todos" || item.category === categoryFilter);
  const filters: { value: InventoryFilter; label: string; count: number }[] = [
    { value: "todos", label: "Todos", count: control.inventory.length },
    { value: "materia", label: "Materia", count: control.inventory.filter((item) => item.category === "materia").length },
    { value: "insumo", label: "Insumos", count: control.inventory.filter((item) => item.category === "insumo").length },
    { value: "terminado", label: "Terminados", count: control.inventory.filter((item) => item.category === "terminado").length },
    { value: "subproducto", label: "Subproductos", count: control.inventory.filter((item) => item.category === "subproducto").length },
  ];

  return (
    <div className="p-4 space-y-5 md:p-6 md:space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold md:text-3xl">Inventario de Produccion</h1>
        <p className="text-sm text-muted-foreground md:text-base">Stock de planta afectado por ordenes, lotes, consumos y cierres.</p>
      </div>

      <Tabs defaultValue="resumen" className="space-y-6">
        <TabsList className="bg-white border">
          <TabsTrigger value="resumen">Resumen de Stock</TabsTrigger>
          <TabsTrigger value="kardex">Kardex y Lotes (FEFO)</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-5 md:space-y-6">
          <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Items en planta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{control.inventory.length}</div>
            <p className="text-xs text-muted-foreground">Materias, insumos y terminados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alertas de minimo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{control.inventoryAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Requieren reposicion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor estimado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">Bs. {totalValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Segun costo promedio local</p>
          </CardContent>
        </Card>
      </div>

      {control.inventoryAlerts.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          {control.inventoryAlerts.slice(0, 6).map((item) => (
            <Card key={item.id} className="border-amber-200 bg-amber-50">
              <CardContent className="flex flex-col gap-3 p-4 text-amber-900">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-1 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-sm">
                      {item.quantity} / {item.minStock} {item.unit}
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="bg-white/80" onClick={() => openAdjust(item)}>
                  Ajustar stock
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Actual en Planta
          </CardTitle>
          <CardDescription>Los cierres de lote ingresan producto terminado y descuentan insumos usados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 rounded-lg border bg-white p-2">
            {filters.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                variant={categoryFilter === filter.value ? "default" : "outline"}
                onClick={() => setCategoryFilter(filter.value)}
                className="gap-2"
              >
                {filter.label}
                <Badge variant="secondary" className="bg-white/70 text-foreground">
                  {filter.count}
                </Badge>
              </Button>
            ))}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Detalles</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Minimo</TableHead>
                  <TableHead>Actualizado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={categoryClass(item.category)}>
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(() => {
                        const product = (rawProducts as any[])?.find(p => p.name === item.name);
                        if (!product) return "-";
                        const parts = [];
                        if (product.presentationVolumeMl) parts.push(`${product.presentationVolumeMl} ml`);
                        if (product.presentationWeightGr) parts.push(`${product.presentationWeightGr} gr`);
                        if (product.productionRole) parts.push(`Rol: ${product.productionRole}`);
                        return parts.length > 0 ? parts.join(" | ") : "-";
                      })()}
                    </TableCell>
                    <TableCell className={item.quantity <= item.minStock ? "text-right font-bold text-amber-700" : "text-right font-bold"}>
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell>
                      {item.minStock} {item.unit}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(item.updatedAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" className="gap-2" onClick={() => openAdjust(item)}>
                        <Pencil className="h-4 w-4" />
                        Ajustar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="kardex" className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Kardex y Control de Lotes
            </CardTitle>
            <CardDescription>Consulta el historial de movimientos y los lotes activos (Método FEFO).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-w-md">
              <Label className="mb-2 block">Seleccionar Producto</Label>
              <Select value={selectedKardexItemId} onValueChange={setSelectedKardexItemId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Elige un producto para ver su Kardex..." />
                </SelectTrigger>
                <SelectContent>
                  {control.inventory.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.quantity} {item.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedKardexItemId && (() => {
              const item = control.inventory.find(i => i.id === selectedKardexItemId);
              const movements = control.movements.filter(m => m.productName === item?.name);
              
              if (!item) return null;

              return (
                <div className="space-y-6">
                  {/* Lotes Activos */}
                  {item.lots && item.lots.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        Lotes Activos en Planta (FEFO)
                      </h3>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Lote (Referencia)</TableHead>
                              <TableHead>Fecha Creación</TableHead>
                              <TableHead>Vencimiento</TableHead>
                              <TableHead className="text-right">Cantidad Disponible</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {item.lots.map(lot => {
                              const expDate = new Date(lot.expirationDate);
                              const isExpiring = (expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24) < 5; // < 5 days
                              return (
                                <TableRow key={lot.id}>
                                  <TableCell className="font-bold">{lot.batchNumber}</TableCell>
                                  <TableCell>{new Date(lot.createdAt).toLocaleDateString()}</TableCell>
                                  <TableCell className={isExpiring ? "text-red-600 font-bold" : ""}>
                                    {expDate.toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-right font-bold">
                                    {lot.quantity} {item.unit}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Historial de Movimientos */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Historial de Movimientos (Kardex)
                    </h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha y Hora</TableHead>
                            <TableHead>Motivo / Tipo</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead className="text-right">Variación</TableHead>
                            <TableHead className="text-right">Saldo Final</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {movements.length > 0 ? movements.map(mov => (
                            <TableRow key={mov.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(mov.date).toLocaleString()}
                              </TableCell>
                              <TableCell>{mov.reason}</TableCell>
                              <TableCell>{mov.reference || "-"}</TableCell>
                              <TableCell className={`text-right font-bold ${mov.changeAmount > 0 ? "text-green-600" : "text-red-600"}`}>
                                {mov.changeAmount > 0 ? "+" : ""}{mov.changeAmount} {mov.unit}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {mov.newQuantity} {mov.unit}
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                No hay movimientos registrados para este producto.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
            <DialogDescription>{selectedItem?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nueva cantidad</Label>
              <Input
                type="number"
                step="0.001"
                value={draft.quantity}
                onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">
                Guardar ajuste
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
