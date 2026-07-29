import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/useMobile";
import { useBranch } from "@/contexts/BranchContext";
import {
  Box,
  Edit2,
  Sparkles,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddProductDialog } from "@/components/AddProductDialog";
import { EditProductDialog } from "@/components/EditProductDialog";
import { ProductHistoryDialog } from "@/components/ProductHistoryDialog";
import { TransferToProductionDialog } from "@/components/TransferToProductionDialog";
import { InventoryTransfersDialog } from "@/components/InventoryTransfersDialog";
import { TransferToBranchDialog } from "@/components/TransferToBranchDialog";
import { formatCurrency } from "@/lib/currency";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Package, AlertTriangle, Info, History as HistoryIcon, LayoutGrid, List, Calendar, TriangleAlert, FileDown, Filter, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { exportInventoryToPDF, exportInventoryToExcel } from "@/lib/inventory-export";

type InventoryTab = "all" | "finished" | "raw";

function formatExpiryDate(value?: string | Date | null) {
  if (!value) return "Sin vencimiento";
  return new Date(value).toLocaleDateString("es-BO");
}

function getExpiryTone(value?: string | Date | null) {
  if (!value) return "text-muted-foreground";
  return new Date(value) < new Date() ? "text-red-600 font-semibold" : "text-orange-600";
}

function getProductionRoleLabel(role?: string | null) {
  const labels: Record<string, string> = {
    none: "Sin rol",
    milk: "Leche/base",
    sugar: "Azucar",
    culture: "Cultivo/nodulo",
    bottle: "Envase",
    cap: "Tapa",
    label: "Etiqueta",
    packaging: "Empaque",
    finished_good: "Terminado",
    other: "Otro",
  };
  return labels[role || "none"] || "Sin rol";
}

function getPresentationLabel(product?: any) {
  if (!product) return "Sin presentacion";
  const qty = product.presentationQuantity || 1;
  const unit = product.presentationUnit || product.unit || "unidad";
  const details = [
    product.presentationVolumeMl ? `${product.presentationVolumeMl} ml` : null,
    product.presentationWeightGr ? `${product.presentationWeightGr} g` : null,
  ].filter(Boolean);
  return `${qty} ${unit}${details.length ? ` (${details.join(" / ")})` : ""}`;
}

function ProductThumb({ item }: { item: any }) {
  if (item.product?.imageUrl) {
    return (
      <img
        src={item.product.imageUrl}
        alt={item.product?.name || "Producto"}
        className="h-14 w-14 rounded-2xl border border-white/70 object-cover shadow-sm"
      />
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/60 text-xs font-semibold text-muted-foreground">
      N/A
    </div>
  );
}

function AdjustInventoryDialog({
  item,
  isOpen,
  onOpenChange,
  quantity,
  setQuantity,
  reason,
  setReason,
  type,
  setType,
  price,
  setPrice,
  expiryDate,
  setExpiryDate,
  registerPurchase,
  setRegisterPurchase,
  paymentMethod,
  setPaymentMethod,
  batchNumber,
  setBatchNumber,
  onSubmit,
  isPending,
}: {
  item: any;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
  quantity: string;
  setQuantity: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  type: "entry" | "exit" | "adjustment" | "production";
  setType: (value: "entry" | "exit" | "adjustment" | "production") => void;
  price: string;
  setPrice: (value: string) => void;
  expiryDate: string;
  setExpiryDate: (value: string) => void;
  registerPurchase: boolean;
  setRegisterPurchase: (value: boolean) => void;
  paymentMethod: "cash" | "qr" | "transfer";
  setPaymentMethod: (value: "cash" | "qr" | "transfer") => void;
  batchNumber: string;
  setBatchNumber: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Edit2 className="h-4 w-4" />
          Ajustar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-[1.6rem] border-white/70 bg-white/95">
        <DialogHeader>
          <DialogTitle>Ajustar stock de {item.product?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Tipo de ajuste</Label>
            <select
              className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-white/80 px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring/40"
              value={type}
              onChange={(e) => setType(e.target.value as "entry" | "exit" | "adjustment" | "production")}
            >
              <option value="adjustment">Ajuste de stock</option>
              <option value="entry">Entrada (compra externa)</option>
              <option value="production">Entrada por Producción (sin gasto)</option>
              <option value="exit">Salida (baja o perdida)</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Cantidad</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                onFocus={(e) => e.target.select()}
                placeholder="Ej: 10 o -5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 rounded-xl border-white/70 bg-white/80"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price">
                Precio compra {registerPurchase ? "(obligatorio)" : "(opcional)"}
              </Label>
              <Input
                id="price"
                type="number"
                step="any"
                onFocus={(e) => e.target.select()}
                placeholder={item.product?.price != null ? `Actual: ${(item.product.price / 100).toFixed(2)}` : "Mantener actual"}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-11 rounded-xl border-white/70 bg-white/80"
              />
            </div>
          </div>

          {type === "entry" && (
            <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2 sm:items-start">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={registerPurchase}
                  onChange={(e) => setRegisterPurchase(e.target.checked)}
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Compra rápida</p>
                  <p className="text-xs text-muted-foreground">
                    Registra la entrada como compra: crea movimiento en Finanzas (egreso) y aparece en Historial de Compras.
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="purchase-payment-method" className={!registerPurchase ? "text-muted-foreground" : ""}>
                  Método de pago
                </Label>
                <select
                  id="purchase-payment-method"
                  disabled={!registerPurchase}
                  className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-white/80 px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                >
                  <option value="cash">Efectivo</option>
                  <option value="qr">QR</option>
                  <option value="transfer">Cuenta Bancaria</option>
                </select>
              </div>

              {false && (
                <div className="grid gap-2">
                  <Label>Método de pago</Label>
                  <select
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-white/80 px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring/40"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="qr">QR</option>
                    <option value="transfer">Cuenta Bancaria</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="expiry">Vencimiento</Label>
              <Input
                id="expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-11 rounded-xl border-white/70 bg-white/80"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="batch">Número de Lote</Label>
              <Input
                id="batch"
                type="text"
                placeholder="Ej: LOTE-2024-001"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="h-11 rounded-xl border-white/70 bg-white/80"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reason">Motivo</Label>
            <Input
              id="reason"
              type="text"
              placeholder="Ajuste manual"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-11 rounded-xl border-white/70 bg-white/80"
            />
          </div>

          <Button onClick={onSubmit} disabled={isPending} className="h-11 w-full">
            {isPending ? "Actualizando..." : "Actualizar producto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const utils = trpc.useContext();
  const { activeBranchId, setActiveBranchId, branches } = useBranch();
  const { data: inventory, isLoading, refetch } = trpc.inventory.listInventory.useQuery();
  const [activeTab, setActiveTab] = useState<InventoryTab>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"entry" | "exit" | "adjustment" | "production">("adjustment");
  const [price, setPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [registerPurchase, setRegisterPurchase] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr" | "transfer">("cash");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "stock" | "expiry">("name");
  const [filterStock, setFilterStock] = useState<"all" | "low" | "out" | "sufficient">("all");
  const [filterExpiry, setFilterExpiry] = useState<"all" | "expired" | "soon">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === "list" ? 15 : 12;

  const currentBranch = branches.find((b: any) => b.id === activeBranchId);

  useEffect(() => {
    if (selectedItem) {
      setQuantity("");
      setReason("");
      setType("adjustment");
      setPrice("");
      setExpiryDate(selectedItem.expiryDate ? new Date(selectedItem.expiryDate).toISOString().split("T")[0] : "");
      setBatchNumber(selectedItem.batchNumber || "");
      setRegisterPurchase(false);
      setPaymentMethod("cash");
    }
  }, [selectedItem]);

  // Si es entrada, por defecto asumimos "compra rápida" para que no se olvide registrar el pago
  useEffect(() => {
    if (!isDialogOpen) return;
    if (type === "entry") {
      setRegisterPurchase(true);
      if (selectedItem?.product?.price != null && !price) {
        setPrice((selectedItem.product.price / 100).toFixed(2));
      }
    } else if (type === "production") {
      setRegisterPurchase(false);
      setReason("Ingreso por Producción");
    } else {
      setRegisterPurchase(false);
    }
  }, [type, isDialogOpen, selectedItem?.product?.price]);

  const updateInventoryMutation = trpc.inventory.updateQuantity.useMutation({
    onSuccess: () => {
      toast.success("Inventario actualizado");
      setIsDialogOpen(false);
      setQuantity("");
      setReason("");
      refetch();
      (utils as any).purchases?.list?.invalidate?.();
      (utils as any).finance?.getTransactions?.invalidate?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar inventario");
    },
  });

  const finishedProducts = useMemo(
    () => inventory?.filter((item: any) => item.product?.category === "finished_product") || [],
    [inventory]
  );
  const rawMaterials = useMemo(
    () => inventory?.filter((item: any) => item.product?.category === "raw_material") || [],
    [inventory]
  );
  const supplies = useMemo(
    () => inventory?.filter((item: any) => item.product?.category === "supplies") || [],
    [inventory]
  );
  const insumos = useMemo(
    () => inventory?.filter((item: any) => item.product?.category === "insumo") || [],
    [inventory]
  );
  const allRawItems = useMemo(() => [...rawMaterials, ...supplies, ...insumos], [rawMaterials, supplies, insumos]);

  const lowStockFinished = useMemo(
    () => finishedProducts.filter((item: any) => item.isLowStock) || [],
    [finishedProducts]
  );
  const lowStockRaw = useMemo(() => allRawItems.filter((item: any) => item.isLowStock) || [], [allRawItems]);

  // Reset page when filters change
  const resetPage = () => setCurrentPage(1);

  const displayItems = useMemo(() => {
    let baseItems = [];
    if (activeTab === "all") baseItems = [...finishedProducts, ...allRawItems];
    else if (activeTab === "finished") baseItems = finishedProducts;
    else if (activeTab === "raw") baseItems = rawMaterials;
    else if (activeTab === "insumo") baseItems = insumos;
    else if (activeTab === "supplies") baseItems = supplies;
    
    let filtered = baseItems;

    // Filtro por término de búsqueda
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((item: any) => 
        item.product?.name?.toLowerCase().includes(lowerSearch) ||
        item.product?.code?.toLowerCase().includes(lowerSearch)
      );
    }

    // Filtro por estado de stock
    if (filterStock !== "all") {
      filtered = filtered.filter((item: any) => {
        if (filterStock === "out") return (item.quantity || 0) <= 0;
        if (filterStock === "low") return item.isLowStock && (item.quantity || 0) > 0;
        if (filterStock === "sufficient") return !item.isLowStock && (item.quantity || 0) > 0;
        return true;
      });
    }

    // Filtro por vencimiento
    if (filterExpiry !== "all") {
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      filtered = filtered.filter((item: any) => {
        if (!item.expiryDate) return false;
        const expiry = new Date(item.expiryDate);
        if (filterExpiry === "expired") return expiry < now;
        if (filterExpiry === "soon") return expiry >= now && expiry <= thirtyDays;
        return true;
      });
    }

    // Aplicar ordenamiento
    return [...filtered].sort((a: any, b: any) => {
      if (sortBy === "name") {
        return (a.product?.name || "").localeCompare(b.product?.name || "");
      }
      if (sortBy === "stock") {
        return (a.quantity || 0) - (b.quantity || 0);
      }
      if (sortBy === "expiry") {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      }
      return 0;
    });
  }, [activeTab, finishedProducts, allRawItems, searchTerm, sortBy, filterStock, filterExpiry]);

  const lowStockItems = activeTab === "all" ? [...lowStockFinished, ...lowStockRaw] : activeTab === "finished" ? lowStockFinished : activeTab === "raw" ? rawMaterials.filter((i:any)=>i.isLowStock) : activeTab === "insumo" ? insumos.filter((i:any)=>i.isLowStock) : supplies.filter((i:any)=>i.isLowStock);

  const inventorySummary = useMemo(() => {
    let currentItems = [];
    if (activeTab === "all") currentItems = [...finishedProducts, ...allRawItems];
    else if (activeTab === "finished") currentItems = finishedProducts;
    else if (activeTab === "raw") currentItems = rawMaterials;
    else if (activeTab === "insumo") currentItems = insumos;
    else if (activeTab === "supplies") currentItems = supplies;

    const available = currentItems.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);
    const reserved = currentItems.reduce((acc: number, item: any) => acc + (item.onOrder || 0), 0);
    const costValuation = currentItems.reduce((acc: number, item: any) => acc + ((item.quantity || 0) * (item.product?.price || 0)), 0);
    const saleValuation = currentItems.reduce((acc: number, item: any) => acc + ((item.quantity || 0) * (item.product?.salePrice || 0)), 0);

    return {
      totalItems: currentItems.length,
      physicalStock: available + reserved,
      availableStock: available,
      reservedStock: reserved,
      lowStock: currentItems.filter((item: any) => item.isLowStock).length,
      costValuation,
      saleValuation,
    };
  }, [activeTab, finishedProducts, allRawItems]);

  const handleUpdateInventory = () => {
    if (!selectedItem) return;

    const priceInCents = price ? Math.round(parseFloat(price) * 100) : undefined;
    let parsedQuantity = quantity ? parseInt(quantity, 10) : 0;
    
    if (type === "exit" && parsedQuantity > 0) {
      parsedQuantity = -parsedQuantity;
    } else if ((type === "entry" || type === "production") && parsedQuantity < 0) {
      parsedQuantity = Math.abs(parsedQuantity);
    }

    const currentExpiryDate = selectedItem.expiryDate
      ? new Date(selectedItem.expiryDate).toISOString().split("T")[0]
      : "";
    const hasExpiryChange = expiryDate !== currentExpiryDate;

    if (parsedQuantity === 0 && priceInCents === undefined && !hasExpiryChange) {
      toast.error("Ingresa una cantidad, un precio o cambia el vencimiento para actualizar");
      return;
    }

    if (registerPurchase) {
      if (type !== "entry") {
        toast.error("La compra rápida solo aplica para entradas de inventario.");
        return;
      }
      if (!Number.isFinite(priceInCents) || (priceInCents || 0) <= 0) {
        toast.error("Para compra rápida debes ingresar el precio de compra.");
        return;
      }
      if (parsedQuantity <= 0) {
        toast.error("Para compra rápida la cantidad debe ser mayor a 0.");
        return;
      }
    }

    updateInventoryMutation.mutate({
      productId: selectedItem.productId,
      quantity: parsedQuantity,
      price: priceInCents,
      reason: reason || (type === "production" ? "Ingreso por Producción" : "Ajuste manual"),
      type: type === "production" ? "entry" : type,
      expiryDate: expiryDate || undefined,
      batchNumber: batchNumber || undefined,
      registerPurchase,
      paymentMethod: registerPurchase ? paymentMethod : undefined,
    });
  };

  const { data: closureStatus } = trpc.finance.hasPendingClosure.useQuery();
  const isLocked = user?.role === "user" && closureStatus?.hasPending;

  if (isLocked) {
    return (
      <div className="page-shell flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-4 border-t-blue-500 shadow-xl">
          <CardHeader className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Box className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-800">Aplicación Inhabilitada</CardTitle>
            <CardDescription className="text-slate-500 font-medium text-base">
              Para poder utilizar la aplicación, solicite la habilitación en administración.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-6">
            <p className="text-sm text-slate-500 mb-6">
              Una vez el administrador apruebe tu cierre, podrás volver a acceder a esta sección.
            </p>
            <Link href="/repartidor/finance">
              <Button className="w-full">
                Ir a Cierre de Caja
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="glass-panel flex min-h-[220px] w-full max-w-md items-center justify-center px-6 text-center">
          <p className="text-lg font-semibold">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container space-y-6 print:hidden">
        <section className="p-0 sm:p-2 md:p-4">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="mt-2 text-4xl font-black text-slate-900 tracking-tight">
                Inventario
              </h1>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sucursal:</span>
                <select
                  value={activeBranchId}
                  onChange={(e) => setActiveBranchId(Number(e.target.value))}
                  className="bg-transparent text-sm font-extrabold text-blue-600 outline-none cursor-pointer"
                >
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.isMainWarehouse ? "🏢 " : "🏪 "}{b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {user?.role === "admin" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => window.print()} variant="outline" className="gap-2 bg-white/80 no-print">
                  <Printer className="h-4 w-4" /> Imprimir Inventario
                </Button>
                <InventoryTransfersDialog />
                <TransferToBranchDialog inventoryItems={inventory || []} onSuccess={() => refetch()} />
                <TransferToProductionDialog inventoryItems={inventory || []} onSuccess={() => refetch()} />
                <AddProductDialog onProductAdded={() => refetch()} />
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="relative overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-white group transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-900" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-slate-50 rounded-2xl text-slate-900">
                  <Package className="h-6 w-6" />
                </div>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items Visibles</p>
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{inventorySummary.totalItems}</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Registros en vista actual</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-white group transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                  <Box className="h-6 w-6" />
                </div>
                {inventorySummary.reservedStock > 0 && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none">
                    {inventorySummary.reservedStock} Reservados
                  </Badge>
                )}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unidades Disponibles</p>
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{inventorySummary.availableStock}</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Físico Total: <span className="font-bold text-blue-600">{inventorySummary.physicalStock}</span></p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-white group transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-sky-500" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-sky-50 rounded-2xl text-sky-600">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valuación Inventario (Costo)</p>
              <p className="text-xl font-black text-slate-900 tracking-tighter">{formatCurrency(inventorySummary.costValuation)}</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Basado en precio de compra</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-slate-900 group transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/10 rounded-2xl text-white">
                  <TriangleAlert className="h-6 w-6" />
                </div>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valuación Potencial (Venta)</p>
              <p className="text-xl font-black text-white tracking-tighter">{formatCurrency(inventorySummary.saleValuation)}</p>
              <p className="text-xs text-slate-500 font-medium mt-1 text-white/50">Si se vendiera todo el stock</p>
            </CardContent>
          </Card>
        </section>

        {/* Barra de Búsqueda y Tabs Sticky */}
        <div className="sticky top-14 md:top-0 z-30 -mx-4 px-4 md:mx-0 md:px-0 pt-2 pb-4 bg-slate-50/80 backdrop-blur-md">
          <div className="flex flex-col gap-4">
            <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[1.5rem] overflow-visible bg-white/95 p-3">
              <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center">
                <Tabs value={activeTab} onValueChange={(val: any) => { setActiveTab(val); setCurrentPage(1); }} className="w-full xl:max-w-[620px] xl:flex-none">
                  <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 sm:grid-cols-3 lg:grid-cols-5">
                    <TabsTrigger value="all" className="min-w-0 rounded-xl h-10 px-3 text-center text-[11px] font-bold uppercase tracking-wide border-2 border-transparent hover:border-blue-500 transition-all duration-200">
                      Todos
                    </TabsTrigger>
                    <TabsTrigger value="finished" className="min-w-0 rounded-xl h-10 px-3 text-center text-[11px] font-bold uppercase tracking-wide border-2 border-transparent hover:border-blue-500 transition-all duration-200">
                      Terminados
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="min-w-0 rounded-xl h-10 px-3 text-center text-[11px] font-bold uppercase tracking-wide border-2 border-transparent hover:border-blue-500 transition-all duration-200">
                      Materia Prima
                    </TabsTrigger>
                    <TabsTrigger value="insumo" className="min-w-0 rounded-xl h-10 px-3 text-center text-[11px] font-bold uppercase tracking-wide border-2 border-transparent hover:border-blue-500 transition-all duration-200">
                      Insumos
                    </TabsTrigger>
                    <TabsTrigger value="supplies" className="min-w-0 rounded-xl h-10 px-3 text-center text-[11px] font-bold uppercase tracking-wide border-2 border-transparent hover:border-blue-500 transition-all duration-200">
                      Suministros
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <div className="relative min-w-[220px] flex-1 group w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Buscar por nombre o código de producto..." 
                    className="h-12 pl-12 rounded-2xl border-slate-100 bg-slate-50/50 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all w-full"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:w-auto xl:justify-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
                    <Button
                      variant={showFilters ? "secondary" : "ghost"}
                      size="icon"
                      className={`rounded-xl h-10 w-10 transition-all ${showFilters ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-5 w-5" />
                    </Button>
                    <div className="h-6 w-px bg-slate-200 mx-0.5" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-500">
                          <FileDown className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl p-2 border-slate-100 shadow-xl">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exportar vista actual</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="rounded-xl font-bold gap-2 cursor-pointer" onClick={() => exportInventoryToPDF(displayItems, activeTab === "all" ? "Todos" : activeTab === "finished" ? "Terminados" : activeTab === "raw" ? "Materia Prima" : activeTab === "insumo" ? "Insumos" : "Suministros")}>
                          <div className="p-1.5 bg-red-50 text-red-600 rounded-lg"><FileDown className="h-4 w-4" /></div>
                          Descargar PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-xl font-bold gap-2 cursor-pointer" onClick={() => exportInventoryToExcel(displayItems, activeTab === "all" ? "Todos" : activeTab === "finished" ? "Terminados" : activeTab === "raw" ? "Materia Prima" : activeTab === "insumo" ? "Insumos" : "Suministros")}>
                          <div className="p-1.5 bg-green-50 text-green-600 rounded-lg"><FileDown className="h-4 w-4" /></div>
                          Descargar Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`rounded-xl h-10 w-10 ${viewMode === "grid" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}
                      onClick={() => setViewMode("grid")}
                    >
                      <LayoutGrid className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`rounded-xl h-10 w-10 ${viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-5 w-5" />
                    </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-white p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ordenar por</Label>
                      <div className="flex bg-slate-100 rounded-2xl p-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`flex-1 rounded-xl h-10 text-xs font-bold ${sortBy === "name" ? "bg-white shadow-sm text-primary" : "text-slate-500"}`}
                          onClick={() => setSortBy("name")}
                        >
                          Nombre
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`flex-1 rounded-xl h-10 text-xs font-bold ${sortBy === "stock" ? "bg-white shadow-sm text-primary" : "text-slate-500"}`}
                          onClick={() => setSortBy("stock")}
                        >
                          Stock
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`flex-1 rounded-xl h-10 text-xs font-bold ${sortBy === "expiry" ? "bg-white shadow-sm text-primary" : "text-slate-500"}`}
                          onClick={() => setSortBy("expiry")}
                        >
                          Vencimiento
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Estado de Stock</Label>
                      <div className="flex bg-slate-100 rounded-2xl p-1">
                        {[
                          { id: "all", label: "Todo" },
                          { id: "low", label: "Bajo" },
                          { id: "out", label: "Agotado" },
                          { id: "sufficient", label: "Ok" }
                        ].map((s) => (
                          <Button
                            key={s.id}
                            variant="ghost"
                            size="sm"
                            className={`flex-1 rounded-xl h-10 text-[10px] font-bold ${filterStock === s.id ? "bg-white shadow-sm text-primary" : "text-slate-500"}`}
                            onClick={() => setFilterStock(s.id as any)}
                          >
                            {s.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vencimiento</Label>
                      <div className="flex bg-slate-100 rounded-2xl p-1">
                        {[
                          { id: "all", label: "Todo" },
                          { id: "soon", label: "Pronto" },
                          { id: "expired", label: "Vencido" }
                        ].map((e) => (
                          <Button
                            key={e.id}
                            variant="ghost"
                            size="sm"
                            className={`flex-1 rounded-xl h-10 text-[10px] font-bold ${filterExpiry === e.id ? "bg-white shadow-sm text-primary" : "text-slate-500"}`}
                            onClick={() => setFilterExpiry(e.id as any)}
                          >
                            {e.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <SmartAlerts />

        {/* Contador y paginación info */}
        {displayItems.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-black text-slate-800">{displayItems.length}</span> productos
              {searchTerm && <> · "<span className="text-blue-600 font-bold">{searchTerm}</span>"</>}
            </p>
            {Math.ceil(displayItems.length / ITEMS_PER_PAGE) > 1 && (
              <p className="text-xs text-slate-400 font-medium">
                Página {currentPage} de {Math.ceil(displayItems.length / ITEMS_PER_PAGE)}
              </p>
            )}
          </div>
        )}

        {displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
            <div className="relative">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-inner">
                <Package className="h-10 w-10 text-slate-400" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-800">Sin resultados</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xs">
                {searchTerm
                  ? `No encontramos productos que coincidan con "${searchTerm}".`
                  : "No hay productos en esta categoría con los filtros actuales."}
              </p>
            </div>
            <div className="flex gap-2">
              {searchTerm && (
                <Button variant="outline" className="rounded-xl gap-2" onClick={() => setSearchTerm("")}>Limpiar búsqueda</Button>
              )}
            </div>
          </div>
        ) : (
          <>
          {viewMode === "grid" || isMobile ? (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {displayItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((item: any) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <InventoryCard 
                    item={item} 
                    user={user} 
                    refetch={refetch}
                    isDialogOpen={isDialogOpen}
                    selectedItem={selectedItem}
                    setSelectedItem={setSelectedItem}
                    setIsDialogOpen={setIsDialogOpen}
                    quantity={quantity}
                    setQuantity={setQuantity}
                    reason={reason}
                    setReason={setReason}
                    type={type}
                    setType={setType}
                    price={price}
                    setPrice={setPrice}
                    expiryDate={expiryDate}
                    setExpiryDate={setExpiryDate}
                    registerPurchase={registerPurchase}
                    setRegisterPurchase={setRegisterPurchase}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    handleUpdateInventory={handleUpdateInventory}
                    updateInventoryMutation={updateInventoryMutation}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          ) : (
            <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] overflow-hidden bg-white">
              <CardContent className="p-0">
                <div className="table-shell">
                  <div className="table-scroll">
                    <table className="min-w-[980px] w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 shadow-sm">
                        <tr className="border-b border-border/70">
                          <th className="w-16 px-6 py-5 text-left font-semibold uppercase text-[10px] tracking-widest">Imagen</th>
                          <th className="px-6 py-5 text-left font-semibold uppercase text-[10px] tracking-widest">Producto</th>
                          <th className="px-6 py-5 text-left font-semibold uppercase text-[10px] tracking-widest">Código</th>
                          <th className="px-6 py-5 text-right font-semibold uppercase text-[10px] tracking-widest">P. Compra</th>
                          <th className="px-6 py-5 text-right font-semibold uppercase text-[10px] tracking-widest">P. Venta</th>
                          <th className="px-6 py-5 text-center font-semibold uppercase text-[10px] tracking-widest">Disponibles / Total</th>
                          <th className="px-6 py-5 text-center font-semibold uppercase text-[10px] tracking-widest">Vencimiento</th>
                          <th className="px-6 py-5 text-center font-semibold uppercase text-[10px] tracking-widest">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((item: any) => (
                          <InventoryRow 
                            key={item.id} 
                            item={item} 
                            user={user} 
                            refetch={refetch}
                            isDialogOpen={isDialogOpen}
                            selectedItem={selectedItem}
                            setSelectedItem={setSelectedItem}
                            setIsDialogOpen={setIsDialogOpen}
                            quantity={quantity}
                            setQuantity={setQuantity}
                            reason={reason}
                            setReason={setReason}
                            type={type}
                            setType={setType}
                            price={price}
                            setPrice={setPrice}
                            expiryDate={expiryDate}
                            setExpiryDate={setExpiryDate}
                            registerPurchase={registerPurchase}
                            setRegisterPurchase={setRegisterPurchase}
                            paymentMethod={paymentMethod}
                            setPaymentMethod={setPaymentMethod}
                            handleUpdateInventory={handleUpdateInventory}
                            updateInventoryMutation={updateInventoryMutation}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paginación */}
          {Math.ceil(displayItems.length / ITEMS_PER_PAGE) > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl h-10 w-10 border-slate-200"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              </Button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.ceil(displayItems.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
                  .filter((page) => page === 1 || page === Math.ceil(displayItems.length / ITEMS_PER_PAGE) || Math.abs(page - currentPage) <= 2)
                  .reduce((acc: (number | string)[], page, idx, arr) => {
                    if (idx > 0 && (page as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === '...' ? (
                      <span key={`ellipsis-${idx}`} className="w-8 text-center text-slate-400 text-sm">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setCurrentPage(item as number)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-200 ${
                          currentPage === item
                            ? "bg-slate-900 text-white shadow-md"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )
                }
              </div>

              <Button
                variant="outline"
                size="icon"
                className="rounded-xl h-10 w-10 border-slate-200"
                disabled={currentPage === Math.ceil(displayItems.length / ITEMS_PER_PAGE)}
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(displayItems.length / ITEMS_PER_PAGE), p + 1))}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </Button>
            </div>
          )}
          </>
        )}
      </div>

      <PrintInventoryContent inventory={inventory || []} />
    </div>
  );
}

function PrintInventoryContent({ inventory }: { inventory: any[] }) {
  const finishedProducts = inventory.filter((item: any) => item.product?.category === "finished_product");
  const rawMaterials = inventory.filter((item: any) => item.product?.category === "raw_material");
  const insumos = inventory.filter((item: any) => item.product?.category === "insumo");
  const supplies = inventory.filter((item: any) => item.product?.category === "supplies");
  
  const calculateTotalCost = (items: any[]) => items.reduce((acc, item) => acc + (item.quantity * ((item.product?.price || 0) / 100)), 0);
  const calculateTotalSale = (items: any[]) => items.reduce((acc, item) => acc + (item.quantity * ((item.product?.salePrice || 0) / 100)), 0);
  
  const totalCostFinished = calculateTotalCost(finishedProducts);
  const totalSaleFinished = calculateTotalSale(finishedProducts);
  const totalCostRaw = calculateTotalCost(rawMaterials);
  const totalSaleRaw = calculateTotalSale(rawMaterials);
  const totalCostInsumos = calculateTotalCost(insumos);
  const totalSaleInsumos = calculateTotalSale(insumos);
  const totalCostSupplies = calculateTotalCost(supplies);
  const totalSaleSupplies = calculateTotalSale(supplies);
  
  const grandTotalCost = totalCostFinished + totalCostRaw + totalCostInsumos + totalCostSupplies;
  const grandTotalSale = totalSaleFinished + totalSaleRaw + totalSaleInsumos + totalSaleSupplies;

  return (
    <div className="hidden print:block bg-white text-slate-900 w-full min-h-screen p-8 font-sans">
      <div className="text-center mb-8 border-b-2 border-slate-200 pb-6">
        <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">Valuacion de Inventario</h1>
        <p className="text-sm text-slate-500 mt-1">Generado el {new Date().toLocaleDateString("es-BO")} a las {new Date().toLocaleTimeString("es-BO")}</p>
      </div>

      {finishedProducts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 bg-slate-100 p-2 uppercase tracking-widest text-slate-700">Productos Terminados</h2>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2 font-semibold">Codigo</th>
                <th className="py-2 font-semibold">Producto</th>
                <th className="py-2 text-center font-semibold">Cant.</th>
                <th className="py-2 text-right font-semibold">Costo Unit.</th>
                <th className="py-2 text-right font-semibold">Total Costo</th>
                <th className="py-2 text-right font-semibold text-blue-800">Precio Venta</th>
                <th className="py-2 text-right font-semibold text-blue-800">Total Venta</th>
              </tr>
            </thead>
            <tbody>
              {finishedProducts.map((item: any) => {
                const costPrice = (item.product?.price || 0) / 100;
                const salePrice = (item.product?.salePrice || 0) / 100;
                const totalCost = item.quantity * costPrice;
                const totalSale = item.quantity * salePrice;
                return (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">{item.product?.code}</td>
                    <td className="py-2 font-medium">{item.product?.name}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(Math.round(costPrice * 100))}</td>
                    <td className="py-2 text-right font-semibold">{formatCurrency(Math.round(totalCost * 100))}</td>
                    <td className="py-2 text-right text-blue-700">{formatCurrency(Math.round(salePrice * 100))}</td>
                    <td className="py-2 text-right font-semibold text-blue-800">{formatCurrency(Math.round(totalSale * 100))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="py-3 text-right font-bold">Subtotal Terminados:</td>
                <td className="py-3 text-right font-bold text-lg">{formatCurrency(Math.round(totalCostFinished * 100))}</td>
                <td colSpan={2} className="py-3 text-right font-bold text-lg text-blue-800">{formatCurrency(Math.round(totalSaleFinished * 100))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {rawMaterials.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 bg-slate-100 p-2 uppercase tracking-widest text-slate-700">Materias Primas</h2>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2 font-semibold">Codigo</th>
                <th className="py-2 font-semibold">Producto</th>
                <th className="py-2 text-center font-semibold">Cant.</th>
                <th className="py-2 text-right font-semibold">Costo Unit.</th>
                <th className="py-2 text-right font-semibold">Total Costo</th>
                <th className="py-2 text-right font-semibold text-blue-800">Precio Venta</th>
                <th className="py-2 text-right font-semibold text-blue-800">Total Venta</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.map((item: any) => {
                const costPrice = (item.product?.price || 0) / 100;
                const salePrice = (item.product?.salePrice || 0) / 100;
                const totalCost = item.quantity * costPrice;
                const totalSale = item.quantity * salePrice;
                return (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">{item.product?.code}</td>
                    <td className="py-2 font-medium">{item.product?.name}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(Math.round(costPrice * 100))}</td>
                    <td className="py-2 text-right font-semibold">{formatCurrency(Math.round(totalCost * 100))}</td>
                    <td className="py-2 text-right text-blue-700">{formatCurrency(Math.round(salePrice * 100))}</td>
                    <td className="py-2 text-right font-semibold text-blue-800">{formatCurrency(Math.round(totalSale * 100))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="py-3 text-right font-bold">Subtotal Materias Primas:</td>
                <td className="py-3 text-right font-bold text-lg">{formatCurrency(Math.round(totalCostRaw * 100))}</td>
                <td colSpan={2} className="py-3 text-right font-bold text-lg text-blue-800">{formatCurrency(Math.round(totalSaleRaw * 100))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {insumos.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 bg-slate-100 p-2 uppercase tracking-widest text-slate-700">Insumos</h2>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2 font-semibold">Codigo</th>
                <th className="py-2 font-semibold">Insumo</th>
                <th className="py-2 text-center font-semibold">Cant.</th>
                <th className="py-2 text-right font-semibold">Costo Unit.</th>
                <th className="py-2 text-right font-semibold">Total Costo</th>
                <th className="py-2 text-right font-semibold text-blue-800">Precio Venta</th>
                <th className="py-2 text-right font-semibold text-blue-800">Total Venta</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((item: any) => {
                const costPrice = (item.product?.price || 0) / 100;
                const salePrice = (item.product?.salePrice || 0) / 100;
                const totalCost = item.quantity * costPrice;
                const totalSale = item.quantity * salePrice;
                return (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">{item.product?.code}</td>
                    <td className="py-2 font-medium">{item.product?.name}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(Math.round(costPrice * 100))}</td>
                    <td className="py-2 text-right font-semibold">{formatCurrency(Math.round(totalCost * 100))}</td>
                    <td className="py-2 text-right text-blue-700">{formatCurrency(Math.round(salePrice * 100))}</td>
                    <td className="py-2 text-right font-semibold text-blue-800">{formatCurrency(Math.round(totalSale * 100))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="py-3 text-right font-bold">Subtotal Insumos:</td>
                <td className="py-3 text-right font-bold text-lg">{formatCurrency(Math.round(totalCostInsumos * 100))}</td>
                <td colSpan={2} className="py-3 text-right font-bold text-lg text-blue-800">{formatCurrency(Math.round(totalSaleInsumos * 100))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {supplies.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 bg-slate-100 p-2 uppercase tracking-widest text-slate-700">Suministros</h2>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2 font-semibold">Codigo</th>
                <th className="py-2 font-semibold">Suministro</th>
                <th className="py-2 text-center font-semibold">Cant.</th>
                <th className="py-2 text-right font-semibold">Costo Unit.</th>
                <th className="py-2 text-right font-semibold">Total Costo</th>
                <th className="py-2 text-right font-semibold text-blue-800">Precio Venta</th>
                <th className="py-2 text-right font-semibold text-blue-800">Total Venta</th>
              </tr>
            </thead>
            <tbody>
              {supplies.map((item: any) => {
                const costPrice = (item.product?.price || 0) / 100;
                const salePrice = (item.product?.salePrice || 0) / 100;
                const totalCost = item.quantity * costPrice;
                const totalSale = item.quantity * salePrice;
                return (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">{item.product?.code}</td>
                    <td className="py-2 font-medium">{item.product?.name}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(Math.round(costPrice * 100))}</td>
                    <td className="py-2 text-right font-semibold">{formatCurrency(Math.round(totalCost * 100))}</td>
                    <td className="py-2 text-right text-blue-700">{formatCurrency(Math.round(salePrice * 100))}</td>
                    <td className="py-2 text-right font-semibold text-blue-800">{formatCurrency(Math.round(totalSale * 100))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="py-3 text-right font-bold">Subtotal Suministros:</td>
                <td className="py-3 text-right font-bold text-lg">{formatCurrency(Math.round(totalCostSupplies * 100))}</td>
                <td colSpan={2} className="py-3 text-right font-bold text-lg text-blue-800">{formatCurrency(Math.round(totalSaleSupplies * 100))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="mt-12 border-t-4 border-slate-900 pt-6 flex flex-col items-end space-y-2">
        <div className="flex justify-between items-center w-2/3">
          <h2 className="text-xl font-bold uppercase text-slate-700">Total Valuacion (Costo):</h2>
          <span className="text-2xl font-bold">{formatCurrency(Math.round(grandTotalCost * 100))}</span>
        </div>
        <div className="flex justify-between items-center w-2/3">
          <h2 className="text-xl font-black uppercase text-blue-900">Total Valuacion (Precio Venta):</h2>
          <span className="text-2xl font-black text-blue-900">{formatCurrency(Math.round(grandTotalSale * 100))}</span>
        </div>
      </div>
    </div>
  );
}

function InventoryCard({ 
  item, user, refetch, isDialogOpen, selectedItem, setSelectedItem, setIsDialogOpen, 
  quantity, setQuantity, reason, setReason, type, setType, price, setPrice, 
  expiryDate, setExpiryDate, batchNumber, setBatchNumber, registerPurchase, setRegisterPurchase, paymentMethod, setPaymentMethod, 
  handleUpdateInventory, updateInventoryMutation 
}: any) {
  const margin = item.product?.price != null && item.product?.salePrice != null
    ? item.product.salePrice - item.product.price
    : null;

  return (
    <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-[2.5rem] overflow-hidden bg-white group">
      <CardContent className="p-0">
        <div className="p-6 md:p-8 flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <ProductThumb item={item} />
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">{item.product?.name}</h3>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{item.product?.code}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary" className="rounded-full bg-blue-50 text-blue-700">
                    {getProductionRoleLabel(item.product?.productionRole)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {item.product?.unit || "unidad"}
                  </Badge>
                </div>
              </div>
            </div>
            {item.isLowStock && (
              <Badge variant="destructive" className="animate-pulse px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Stock Bajo
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-2xl bg-green-50 border border-green-100 flex flex-col justify-between">
              <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Disponibles</p>
              <div className="flex items-end gap-1">
                <p className="text-xl font-black text-green-700 tracking-tighter">{item.quantity}</p>
                <p className="text-[10px] text-green-500 font-bold mb-1 uppercase">Uds.</p>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-tight">Entrega Pendiente</p>
              <div className="flex items-end gap-1 mt-1">
                <p className="text-xl font-black text-orange-600 tracking-tighter">{item.onOrder || 0}</p>
                <p className="text-[10px] text-orange-400 font-bold mb-1 uppercase">Uds.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Unitario</p>
              <p className="text-sm font-black text-slate-900">{item.product?.salePrice != null ? formatCurrency(item.product.salePrice) : "-"}</p>
            </div>
            <div className="p-3 rounded-2xl border border-emerald-100 bg-emerald-50/30">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Descuento</p>
              <p className="text-sm font-black text-emerald-900">{item.product?.discountPrice != null ? formatCurrency(item.product.discountPrice) : "-"}</p>
            </div>
            <div className="p-3 rounded-2xl border border-violet-100 bg-violet-50/30">
              <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-1">Mayorista</p>
              <p className="text-sm font-black text-violet-900">{item.product?.wholesalePrice != null ? formatCurrency(item.product.wholesalePrice) : "-"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-2xl border border-blue-100 bg-blue-50/40">
              <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Presentacion</p>
              <p className="text-xs font-bold text-slate-800">{getPresentationLabel(item.product)}</p>
            </div>
            <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ubicacion / proveedor</p>
              <p className="text-xs font-bold text-slate-800">
                {item.product?.storageLocation || "Sin ubicacion"}
                {item.product?.supplierName ? ` - ${item.product.supplierName}` : ""}
              </p>
            </div>
          </div>

          {margin != null && (
             <div className={`p-4 rounded-3xl flex items-center justify-between ${margin < 0 ? 'bg-red-50 border border-red-100' : 'bg-slate-900 border border-slate-800'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${margin < 0 ? 'text-red-600' : 'text-slate-400'}`}>Margen por unidad</p>
                <p className={`text-xl font-black tracking-tighter ${margin < 0 ? 'text-red-700' : 'text-emerald-400'}`}>{formatCurrency(margin)}</p>
             </div>
          )}

          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
            <Calendar className={`h-4 w-4 ${getExpiryTone(item.expiryDate)}`} />
            <div className="flex flex-col">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimiento</p>
               <p className={`text-xs font-bold ${getExpiryTone(item.expiryDate)}`}>{formatExpiryDate(item.expiryDate)}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2">
          <ProductHistoryDialog productId={item.productId} productName={item.product?.name || "Producto"} />
          {user?.role === "admin" && (
            <>
              <EditProductDialog product={item.product} onProductUpdated={() => refetch()} />
              <AdjustInventoryDialog
                item={item}
                isOpen={isDialogOpen && selectedItem?.id === item.id}
                onOpenChange={(value) => {
                  setIsDialogOpen(value);
                  if (value) setSelectedItem(item);
                }}
                quantity={quantity}
                setQuantity={setQuantity}
                reason={reason}
                setReason={setReason}
                type={type}
                setType={setType}
                price={price}
                setPrice={setPrice}
                expiryDate={expiryDate}
                setExpiryDate={setExpiryDate}
                batchNumber={batchNumber}
                setBatchNumber={setBatchNumber}
                registerPurchase={registerPurchase}
                setRegisterPurchase={setRegisterPurchase}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                onSubmit={handleUpdateInventory}
                isPending={updateInventoryMutation.isPending}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InventoryRow({ 
  item, user, refetch, isDialogOpen, selectedItem, setSelectedItem, setIsDialogOpen, 
  quantity, setQuantity, reason, setReason, type, setType, price, setPrice, 
  expiryDate, setExpiryDate, batchNumber, setBatchNumber, registerPurchase, setRegisterPurchase, paymentMethod, setPaymentMethod, 
  handleUpdateInventory, updateInventoryMutation 
}: any) {
  const margin = item.product?.price != null && item.product?.salePrice != null
    ? item.product.salePrice - item.product.price
    : null;

  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-slate-50/50 group">
      <td className="px-6 py-4">
        <ProductThumb item={item} />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">{item.product?.name}</span>
          {item.isLowStock && <Badge variant="destructive" className="h-4 w-4 rounded-full p-0 flex items-center justify-center" title="Stock Bajo" />}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="rounded-full bg-blue-50 text-[10px] text-blue-700">
            {getProductionRoleLabel(item.product?.productionRole)}
          </Badge>
          <Badge variant="outline" className="rounded-full text-[10px]">
            {item.product?.unit || "unidad"}
          </Badge>
        </div>
      </td>
      <td className="px-6 py-4 text-slate-400 font-medium">{item.product?.code}</td>
      <td className="px-6 py-4 text-right font-black text-sky-700">
        {item.product?.price != null ? formatCurrency(item.product.price) : "-"}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex flex-col gap-1 items-end">
          <span className="text-xs font-bold text-slate-900" title="Precio Unitario">{item.product?.salePrice != null ? formatCurrency(item.product.salePrice) : "-"}</span>
          <span className="text-[10px] font-black text-emerald-600" title="Precio Descuento">{item.product?.discountPrice != null ? formatCurrency(item.product.discountPrice) : "-"}</span>
          <span className="text-[10px] font-black text-violet-600" title="Precio Mayorista">{item.product?.wholesalePrice != null ? formatCurrency(item.product.wholesalePrice) : "-"}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="flex flex-col items-center">
          <span className="text-base font-black text-green-600" title="Disponibles">{item.quantity}</span>
          {item.onOrder > 0 && <span className="text-[10px] text-orange-500 font-bold" title="Entrega Pendiente">({item.onOrder} pendientes)</span>}
        </div>
      </td>
      <td className={`px-6 py-4 text-center font-bold text-xs ${getExpiryTone(item.expiryDate)}`}>
        <div className="flex flex-col gap-1">
          <span>{item.expiryDate ? formatExpiryDate(item.expiryDate) : "-"}</span>
          <span className="text-[10px] font-semibold text-slate-400">{getPresentationLabel(item.product)}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <ProductHistoryDialog productId={item.productId} productName={item.product?.name || "Producto"} />
          {user?.role === "admin" && (
            <>
              <EditProductDialog product={item.product} onProductUpdated={() => refetch()} />
              <AdjustInventoryDialog
                item={item}
                isOpen={isDialogOpen && selectedItem?.id === item.id}
                onOpenChange={(value) => {
                  setIsDialogOpen(value);
                  if (value) setSelectedItem(item);
                }}
                quantity={quantity}
                setQuantity={setQuantity}
                reason={reason}
                setReason={setReason}
                type={type}
                setType={setType}
                price={price}
                setPrice={setPrice}
                expiryDate={expiryDate}
                setExpiryDate={setExpiryDate}
                batchNumber={batchNumber}
                setBatchNumber={setBatchNumber}
                registerPurchase={registerPurchase}
                setRegisterPurchase={setRegisterPurchase}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                onSubmit={handleUpdateInventory}
                isPending={updateInventoryMutation.isPending}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function InfoBlock({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${accent || "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function SmartAlerts() {
  const { data: alerts, isLoading } = trpc.inventory.getSmartAlerts.useQuery();

  if (isLoading || !alerts || alerts.length === 0) return null;

  return (
    <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-amber-50/50 overflow-hidden no-print mb-8">
      <CardHeader className="py-6 px-8">
        <div className="flex items-center gap-3 text-amber-700">
          <div className="p-2 bg-amber-100 rounded-xl">
             <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-tight">Asistente de Inventario</CardTitle>
            <CardDescription className="text-amber-600 font-medium">Análisis basado en la velocidad de ventas (30 días)</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-amber-100/50">
          {alerts.map((alert: any) => (
            <div key={alert.productId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 px-8 hover:bg-amber-100/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`h-3 w-3 rounded-full ${alert.status === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                <div>
                  <p className="font-black text-slate-900 text-base">{alert.productName}</p>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Stock: {alert.totalStock} uds. | Venta: {alert.dailyVelocity} uds/día</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:items-end gap-2">
                <Badge variant={alert.status === 'critical' ? 'destructive' : 'outline'} className="rounded-full px-4 py-1 font-black uppercase text-[10px] tracking-widest border-none shadow-sm">
                  {alert.daysRemaining <= 0 ? '¡SIN STOCK!' : `QUEDAN ~${alert.daysRemaining} DÍAS`}
                </Badge>
                {alert.urgentExpiry && (
                  <p className="text-[10px] text-red-600 font-black uppercase tracking-widest flex items-center gap-1">
                    <TriangleAlert className="h-3 w-3" /> Vence: {new Date(alert.urgentExpiry).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
