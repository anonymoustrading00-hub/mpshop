import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ShoppingCart,
  Plus,
  Package,
  Calendar,
  User,
  Trash2,
  Eye,
  Printer,
  FileText,
  XCircle,
  Edit,
  Search,
  Banknote,
  QrCode,
  ArrowLeftRight,
  TrendingUp,
  CreditCard,
  Building2,
  Receipt,
  CheckCircle2,
  ArrowLeft,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { useBranch } from "@/contexts/BranchContext";

export default function Purchases() {
  const { activeBranchId, setActiveBranchId, branches } = useBranch();
  const isMobile = useIsMobile();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<number>(0);
  const [openNewProduct, setOpenNewProduct] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [purchaseData, setPurchaseData] = useState({
    purchaseNumber: "COM-" + Math.floor(Math.random() * 10000),
    status: "received" as const,
    isCredit: 0,
    paymentMethod: "cash",
    totalAmount: 0,
    dueDate: "",
  });

  const [items, setItems] = useState<any[]>([]);
  const [currentItem, setCurrentItem] = useState({
    productId: 0,
    quantity: 1,
    price: 0,
    expiryDate: "",
  });

  const { user } = useAuth();
  const utils = trpc.useContext();
  const { data: purchases, isLoading: isPurchasesLoading } = (trpc.purchases as any).listAll.useQuery();
  const { data: suppliers } = (trpc.suppliers as any).list.useQuery();
  const { data: products } = (trpc.inventory as any).listProducts.useQuery();

  const selectedProduct = (products as any[])?.find((p: any) => p.id === currentItem.productId);

  const createMutation = (trpc.purchases as any).create.useMutation({
    onSuccess: () => {
      toast.success("Compra registrada e inventario actualizado");
      setIsCreateOpen(false);
      resetCreateForm();
      utils.purchases.list.invalidate();
      (utils as any).inventory.listInventory.invalidate();
    },
    onError: (error: any) => {
      console.error("Error creating purchase:", error);
      toast.error(error.message || "Error al registrar la compra");
    }
  });

  const resetCreateForm = () => {
    setItems([]);
    setSupplierId(0);
    setPurchaseData({
      purchaseNumber: "COM-" + Math.floor(Math.random() * 10000),
      status: "received",
      isCredit: 0,
      paymentMethod: "cash",
      totalAmount: 0,
      dueDate: "",
    });
    setCurrentItem({ productId: 0, quantity: 1, price: 0, expiryDate: "" });
  };

  const addItem = () => {
    if (currentItem.productId === 0 || currentItem.quantity <= 0) return;
    const product = (products as any[])?.find((p: any) => p.id === currentItem.productId);
    const priceInCents = Math.round(currentItem.price * 100);
    
    setItems([...items, { ...currentItem, price: priceInCents, productName: product?.name }]);
    
    setPurchaseData(prev => ({
      ...prev,
      totalAmount: prev.totalAmount + (currentItem.quantity * priceInCents)
    }));
    setCurrentItem({ productId: 0, quantity: 1, price: 0, expiryDate: "" });
  };

  const removeItem = (index: number) => {
    const item = items[index];
    setPurchaseData(prev => ({
      ...prev,
      totalAmount: prev.totalAmount - (item.quantity * item.price)
    }));
    setItems(items.filter((_, i) => i !== index));
  };

  const { data: transactions } = trpc.finance.getTransactions.useQuery();
  const { data: cashOpenings } = trpc.finance.getCashOpenings.useQuery();
  const { data: openingStatus } = trpc.finance.hasActiveOpening.useQuery({ paymentMethod: purchaseData.paymentMethod as any });

  const balances = useMemo(() => {
    if (!transactions) return { cash: 0, qr: 0, transfer: 0 };
    
    const getBalance = (method: string) => {
      const txs = (transactions as any[]) || [];
      const income = txs.filter(t => t.type === "income" && (t.paymentMethod === method || (!t.paymentMethod && method === 'cash'))).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const expense = txs.filter(t => t.type === "expense" && (t.paymentMethod === method || (!t.paymentMethod && method === 'cash'))).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      return income - expense;
    };

    const getOpening = (method: string) => {
      const openings = (cashOpenings as any[]) || [];
      return openings
        .filter(o => o.paymentMethod === method || (!o.paymentMethod && method === 'cash'))
        .reduce((sum, o) => sum + (Number(o.openingAmount) || 0), 0);
    };

    return {
      cash: getBalance('cash') + getOpening('cash'),
      qr: getBalance('qr') + getOpening('qr'),
      transfer: getBalance('transfer') + getOpening('transfer')
    };
  }, [transactions, cashOpenings]);

  const currentBalance = purchaseData.paymentMethod === 'cash' ? balances.cash : 
                         purchaseData.paymentMethod === 'qr' ? balances.qr : 
                         balances.transfer;

  const isInsufficient = purchaseData.totalAmount > currentBalance;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    // Las compras a crédito no requieren caja abierta (se registra la deuda, no sale efectivo)
    if (purchaseData.isCredit === 0 && !openingStatus?.hasActive) {
      toast.error(`Caja cerrada: Para registrar compras en ${purchaseData.paymentMethod.toUpperCase()}, primero debes realizar la apertura de caja.`);
      return;
    }
    if (items.length === 0) {
      toast.error("Añade al menos un producto a la compra");
      return;
    }
    if (purchaseData.isCredit === 1 && !purchaseData.dueDate) {
      toast.error("Las compras a crédito requieren una fecha de vencimiento.");
      return;
    }
    const purchasePayload = {
      ...purchaseData,
      supplierId: supplierId === 0 ? undefined : supplierId,
      dueDate: purchaseData.dueDate || undefined,
      items: items.map(item => ({
        ...item,
        expiryDate: item.expiryDate || undefined
      }))
    };
    createMutation.mutate(purchasePayload);
  };

  const handlePrint = (purchase: any) => {
    const printContent = document.getElementById(`purchase-print-${purchase.id}`);
    if (!printContent) return;
    
    const win = window.open('', '', 'height=700,width=900');
    if (!win) return;
    
    win.document.write('<html><head><title>Comprobante de Compra</title>');
    win.document.write('<style>');
    win.document.write('body { font-family: sans-serif; padding: 20px; }');
    win.document.write('.header { border-bottom: 2px solid #333; margin-bottom: 20px; padding-bottom: 10px; }');
    win.document.write('.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }');
    win.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
    win.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
    win.document.write('th { background-color: #f2f2f2; }');
    win.document.write('.total { text-align: right; margin-top: 20px; font-size: 1.2rem; font-weight: bold; }');
    win.document.write('</style></head><body>');
    win.document.write(printContent.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];
    return (purchases as any[]).filter((p: any) => {
      const matchesSearch = !searchQuery || 
        p.purchaseNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPayment = filterPayment === "all" || p.paymentMethod === filterPayment || (filterPayment === "credit" && p.isCredit === 1);
      const purchaseDate = p.createdAt ? new Date(p.createdAt) : null;
      const matchesFrom = !filterDateFrom || (purchaseDate && purchaseDate >= new Date(filterDateFrom + "T00:00:00"));
      const matchesTo = !filterDateTo || (purchaseDate && purchaseDate <= new Date(filterDateTo + "T23:59:59"));
      return matchesSearch && matchesPayment && matchesFrom && matchesTo;
    });
  }, [purchases, searchQuery, filterPayment, filterDateFrom, filterDateTo]);

  const totalSpent = useMemo(() => {
    if (!purchases) return 0;
    return (purchases as any[]).reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [purchases]);

  const creditPurchasesCount = useMemo(() => {
    if (!purchases) return 0;
    return (purchases as any[]).filter(p => p.isCredit === 1).length;
  }, [purchases]);

  // Bloqueo de seguridad: Si tiene un cierre pendiente
  const { data: closureStatus } = trpc.finance.hasPendingClosure.useQuery();
  const isLockedByPending = closureStatus && closureStatus.hasPending;

  if (isLockedByPending) {
    return (
      <div className="page-shell flex items-center justify-center pt-20">
        <Card className="max-w-md w-full border-t-4 border-t-blue-500 shadow-xl">
          <CardHeader className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-800">
              Compras Inhabilitadas
            </CardTitle>
            <CardDescription className="text-slate-500 font-medium text-base">
              Para poder registrar compras, primero debes solicitar la habilitación de tu caja en administración.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-6">
            <p className="text-sm text-slate-500 mb-6">
              Una vez el administrador apruebe tu cierre anterior, podrás volver a registrar compras.
            </p>
            <Link href={user?.role === "admin" ? "/finance" : "/repartidor/finance"}>
              <Button className="w-full h-11 font-bold">
                Ver estado de mi caja
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto mb-20 md:mb-0">
      {/* Header con botón destacado de Nueva Compra */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Gestión de <span className="text-blue-600">Compras</span>
            </h1>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sucursal:</span>
              <select
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(Number(e.target.value))}
                className="bg-transparent text-sm font-extrabold text-blue-600 outline-none cursor-pointer"
              >
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.isMainWarehouse ? '🏢 ' : '🏪 '}{b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1.5">
            Registro de entrada de mercancía, insumos y control de proveedores
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="hidden h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg gap-3 shadow-xl shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" />
          Nueva Compra
        </Button>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md rounded-2xl bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registros</p>
                <p className="text-2xl font-black text-slate-900">{purchases?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Invertido</p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Compras a Crédito</p>
                <p className="text-2xl font-black text-slate-900">{creditPurchasesCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-violet-50 rounded-2xl text-violet-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Proveedores</p>
                <p className="text-2xl font-black text-slate-900">{suppliers?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial de Compras en FILAS / TABLA (Igual a Historial de Ventas) */}
      <Card className="border-0 shadow-xl shadow-slate-100 rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="flex flex-col gap-4 px-8 py-6 border-b border-slate-100">
          {/* Título */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-900">Historial de Compras</CardTitle>
              <CardDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Compras tradicionales + compras por registro de unidades
              </CardDescription>
            </div>
          </div>

          {/* Filtros — siempre visibles en dos filas */}
          <div className="flex flex-col gap-3">
            {/* Fila 1: búsqueda + método de pago */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por N° Nota o Proveedor..."
                  className="pl-9 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl border-slate-200 bg-slate-50/50">
                  <SelectValue placeholder="Método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los pagos</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="qr">Transferencia QR</SelectItem>
                  <SelectItem value="transfer">Cuenta Bancaria</SelectItem>
                  <SelectItem value="credit">A Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fila 2: rango de fechas */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 shrink-0">Desde</span>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50/50 text-sm w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 shrink-0">Hasta</span>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50/50 text-sm w-40"
                />
              </div>
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                  className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                >
                  ✕ Limpiar fechas
                </button>
              )}
              {(filterDateFrom || filterDateTo) && (
                <span className="text-xs text-slate-400 font-medium">
                  {filteredPurchases.length} resultado{filteredPurchases.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          {isMobile ? (
            <div className="space-y-3">
              {isPurchasesLoading ? (
                <div className="py-10 text-center text-slate-400">Cargando compras...</div>
              ) : filteredPurchases.length === 0 ? (
                <div className="py-10 text-center text-slate-400">No hay compras que coincidan con el filtro.</div>
              ) : (
                filteredPurchases.map((purchase: any) => (
                  <div key={purchase.id} className="group relative rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-black text-slate-900">{purchase.purchaseNumber}</span>
                          {purchase.source === "unit_purchase" && (
                            <span className="text-[10px] font-black text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">
                              📱 Unidad
                            </span>
                          )}
                          <Badge variant="outline" className={`rounded-full text-[10px] font-black uppercase ${purchase.status === 'received' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            {purchase.status === "received" ? "OK" : "PENDIENTE"}
                          </Badge>
                        </div>
                        <p className="text-sm font-bold text-slate-600 truncate max-w-[200px]">
                          {purchase.source === "unit_purchase"
                            ? `${purchase.unitBrand || ""} ${purchase.unitModel || ""} · ${purchase.unitCode || ""}`
                            : purchase.supplierName || "Sin Proveedor"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                           <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center">
                             <User className="h-3 w-3 text-slate-400" />
                           </div>
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{new Date(purchase.createdAt).toLocaleDateString("es-BO")}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900">{formatCurrency(purchase.totalAmount)}</p>
                        <div className="mt-1 flex flex-col items-end gap-1">
                          <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase tracking-wider px-2 bg-slate-50 border-slate-200">
                            {purchase.paymentMethod === "cash" ? "Efectivo" : purchase.paymentMethod === "qr" ? "QR" : "Transferencia"}
                          </Badge>
                          {purchase.isCredit === 1 && (
                            <Badge variant="destructive" className="rounded-full text-[9px] font-black uppercase tracking-widest px-2 bg-red-100 text-red-700 border-0">
                              Crédito
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                      <Button variant="outline" className="flex-1 h-11 rounded-2xl border-slate-200 text-slate-600 font-black text-xs gap-2" onClick={() => { setSelectedPurchase(purchase); setShowDetails(true); }}>
                        <Eye className="h-4 w-4" />
                        VER DETALLE
                      </Button>
                      <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-slate-200" onClick={() => { setSelectedPurchase(purchase); setShowEdit(true); }} title="Editar Compra">
                        <Edit className="h-4 w-4 text-amber-600" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-slate-200" onClick={() => handlePrint(purchase)} title="Imprimir Comprobante">
                        <Printer className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>

                    {/* Template para impresión oculto */}
                    <div id={`purchase-print-${purchase.id}`} className="hidden">
                      <div className="header">
                        <h1>Comprobante de Compra</h1>
                        <p><strong>Nro:</strong> {purchase.purchaseNumber}</p>
                      </div>
                      <div className="grid">
                        <div>
                          <p><strong>Proveedor:</strong> {purchase.supplierName || "Sin Proveedor"}</p>
                          <p><strong>Fecha:</strong> {new Date(purchase.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p><strong>Método:</strong> {purchase.paymentMethod}</p>
                          <p><strong>Estado:</strong> {purchase.status}</p>
                        </div>
                      </div>
                      <div className="total">
                        TOTAL: {formatCurrency(purchase.totalAmount)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100">
                  <TableHead className="font-black text-xs uppercase text-slate-400 py-4">N° Compra</TableHead>
                  <TableHead className="font-black text-xs uppercase text-slate-400">Proveedor</TableHead>
                  <TableHead className="font-black text-xs uppercase text-slate-400">Estado</TableHead>
                  <TableHead className="font-black text-xs uppercase text-slate-400">Pago</TableHead>
                  <TableHead className="font-black text-xs uppercase text-slate-400 text-right">Total</TableHead>
                  <TableHead className="font-black text-xs uppercase text-slate-400">Fecha</TableHead>
                  <TableHead className="font-black text-xs uppercase text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPurchasesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-slate-400">
                      Cargando compras...
                    </TableCell>
                  </TableRow>
                ) : filteredPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-slate-400">
                      No hay compras que coincidan con el filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPurchases.map((purchase: any) => (
                    <TableRow key={purchase.id} className="group hover:bg-slate-50/80 transition-colors border-slate-100">
                      <TableCell className="font-black text-slate-900 py-5 text-base">
                        <div className="flex flex-col gap-1">
                          <span>{purchase.purchaseNumber}</span>
                          {purchase.source === "unit_purchase" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5 w-fit">
                              📱 Registro Unidad
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">
                            {purchase.source === "unit_purchase"
                              ? `${purchase.unitBrand || ""} ${purchase.unitModel || ""} · ${purchase.unitCode || ""}`
                              : purchase.supplierName || "Sin Proveedor"}
                          </span>
                          {purchase.source === "unit_purchase" && (
                            <span className="text-xs text-slate-400">Compra directa de equipo</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full px-3 font-black text-[10px] uppercase tracking-widest ${
                            purchase.status === "received"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : "bg-amber-50 text-amber-600 border-amber-100"
                          }`}
                        >
                          {purchase.status === "received" ? "OK" : "PENDIENTE"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            {purchase.paymentMethod === "cash" ? (
                              <Banknote className="h-3.5 w-3.5 text-emerald-500" />
                            ) : purchase.paymentMethod === "qr" ? (
                              <QrCode className="h-3.5 w-3.5 text-violet-500" />
                            ) : (
                              <ArrowLeftRight className="h-3.5 w-3.5 text-blue-500" />
                            )}
                            <span>{purchase.paymentMethod === "cash" ? "Efectivo" : purchase.paymentMethod === "qr" ? "QR" : "Transferencia"}</span>
                          </div>
                          {purchase.isCredit === 1 && (
                            <Badge variant="destructive" className="rounded-full text-[9px] font-black uppercase tracking-wider w-fit px-2 py-0 bg-red-100 text-red-700 border-0">
                              A Crédito
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-base font-black text-slate-900">{formatCurrency(purchase.totalAmount)}</span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs font-medium">
                        {new Date(purchase.createdAt).toLocaleString("es-BO", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 w-9 rounded-xl border-slate-200 hover:bg-blue-50 hover:text-blue-600" 
                            onClick={() => { setSelectedPurchase(purchase); setShowDetails(true); }}
                            title="Ver Detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 w-9 rounded-xl border-slate-200 hover:bg-amber-50 hover:text-amber-600" 
                            onClick={() => { setSelectedPurchase(purchase); setShowEdit(true); }}
                            title="Editar Compra"
                          >
                            <Edit className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 w-9 rounded-xl border-slate-200" 
                            onClick={() => handlePrint(purchase)}
                            title="Imprimir"
                          >
                            <Printer className="h-4 w-4 text-slate-400" />
                          </Button>
                        </div>

                        {/* Template para impresión oculto */}
                        <div id={`purchase-print-${purchase.id}`} className="hidden">
                          <div className="header">
                            <h1>Comprobante de Compra</h1>
                            <p><strong>Nro:</strong> {purchase.purchaseNumber}</p>
                          </div>
                          <div className="grid">
                            <div>
                              <p><strong>Proveedor:</strong> {purchase.supplierName || "Sin Proveedor"}</p>
                              <p><strong>Fecha:</strong> {new Date(purchase.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p><strong>Método:</strong> {purchase.paymentMethod}</p>
                              <p><strong>Estado:</strong> {purchase.status}</p>
                            </div>
                          </div>
                          <div className="total">
                            TOTAL: {formatCurrency(purchase.totalAmount)}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal AMPLIADO de Formulario de Nueva Compra (Estilo Modal de Ventas Amplio) */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent
          className={
            isMobile
              ? "max-h-[94vh] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[1.6rem] border-white/70 bg-white p-4 sm:max-w-[calc(100vw-1.5rem)] sm:p-6"
              : "flex flex-col h-[92vh] w-[min(1360px,96vw)] sm:max-w-[min(1360px,96vw)] overflow-hidden rounded-[1.8rem] border-slate-200/60 bg-white shadow-2xl shadow-slate-900/10 p-0"
          }
        >
          <DialogHeader className={isMobile ? "" : "border-b border-slate-100 px-8 pt-6 pb-4 bg-gradient-to-r from-slate-50/80 to-white shrink-0"}>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <span className="font-black text-slate-900">Nueva Entrada de Mercancía / Insumos</span>
                <span className="ml-3 text-sm font-bold text-slate-400 font-mono">#{purchaseData.purchaseNumber}</span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Registra una nueva compra con proveedores, insumos y actualización automática de stock de inventario.
            </DialogDescription>
          </DialogHeader>

          <div className={isMobile ? "mt-6 space-y-6" : "grid min-h-0 flex-1 overflow-hidden gap-0 lg:grid-cols-[minmax(0,1.1fr)_420px]"}>
            {/* LADO IZQUIERDO: Formulario de Selección e Ítems */}
            <div className={isMobile ? "space-y-6" : "min-h-0 space-y-5 overflow-y-auto px-8 py-6"}>
              {/* Card de Datos Generales */}
              <Card className="border-slate-100 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-slate-800 font-black">
                    <Building2 className="h-4 w-4 text-blue-600" /> Datos de la Factura y Proveedor
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Proveedor</Label>
                    <Select
                      value={supplierId === 0 ? "" : supplierId.toString()}
                      onValueChange={(val) => setSupplierId(parseInt(val))}
                    >
                      <SelectTrigger className="rounded-xl h-11 bg-slate-50/50">
                        <SelectValue placeholder="Sin proveedor (Directo)" />
                      </SelectTrigger>
                      <SelectContent>
                        {(suppliers as any[])?.map((s: any) => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nro de Factura / Nota</Label>
                    <Input 
                      value={purchaseData.purchaseNumber} 
                      onChange={(e) => setPurchaseData({...purchaseData, purchaseNumber: e.target.value})}
                      className="font-mono bg-slate-50/50 rounded-xl h-11 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Método de Pago</Label>
                    <Select value={purchaseData.paymentMethod} onValueChange={(val: any) => setPurchaseData({...purchaseData, paymentMethod: val})}>
                      <SelectTrigger className="bg-slate-50/50 rounded-xl h-11">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="qr">Transferencia QR</SelectItem>
                        <SelectItem value="transfer">Cuenta Bancaria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Card de Detalle de Productos */}
              <Card className="border-slate-100 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-slate-800 font-black">
                    <Package className="h-4 w-4 text-blue-600" /> Productos e Insumos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div className="sm:col-span-2 space-y-1 min-w-0">
                      <Label className="text-xs font-bold text-slate-600 uppercase">Producto / Insumo</Label>
                      <div className="flex gap-2 items-center">
                        {currentItem.productId !== 0 && selectedProduct?.imageUrl ? (
                          <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="h-11 w-11 rounded-xl object-cover border flex-shrink-0 bg-white" />
                        ) : (
                          <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 flex-shrink-0">
                            <Package className={`h-5 w-5 ${currentItem.productId === 0 ? 'text-blue-300' : 'text-blue-500'}`} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex gap-2">
                          <Select 
                            value={currentItem.productId === 0 ? "" : currentItem.productId.toString()} 
                            onValueChange={(val) => setCurrentItem({...currentItem, productId: parseInt(val), price: 0})}
                          >
                            <SelectTrigger className={`bg-slate-50/50 rounded-xl h-11 truncate flex-1 ${currentItem.productId === 0 ? 'text-slate-500' : 'font-semibold'}`}>
                              <SelectValue placeholder="Buscar o seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(products as any[])?.map((p: any) => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            className="shrink-0 h-11 w-11 rounded-xl bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" 
                            onClick={() => setOpenNewProduct(true)}
                            title="Nuevo Ítem de Inventario"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-600 uppercase">Cantidad</Label>
                      <Input 
                        type="number" 
                        step="any"
                        onFocus={(e) => e.target.select()}
                        value={currentItem.quantity} 
                        onChange={(e) => setCurrentItem({...currentItem, quantity: parseInt(e.target.value) || 1})}
                        className="rounded-xl h-11 bg-slate-50/50 text-center font-black"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-emerald-700 uppercase">P. Unit. Compra (Bs)</Label>
                      <Input 
                        type="text" 
                        inputMode="decimal"
                        onFocus={(e) => e.target.select()}
                        value={currentItem.price === 0 ? "" : currentItem.price} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          setCurrentItem({...currentItem, price: val as any});
                        }}
                        placeholder="0.00"
                        className="rounded-xl h-11 bg-slate-50/50 font-black text-right"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10px] text-orange-600 uppercase font-bold">Fecha Vencimiento (opcional)</Label>
                      <Input 
                        type="date" 
                        value={currentItem.expiryDate} 
                        onChange={(e) => setCurrentItem({...currentItem, expiryDate: e.target.value})}
                        className="rounded-xl h-11 bg-slate-50/50"
                      />
                    </div>

                    <div className="space-y-1 bg-blue-50/50 border border-blue-100 rounded-xl p-2 text-center flex flex-col justify-center h-11">
                      <Label className="text-[8px] font-bold text-blue-500 uppercase">TOTAL ITEM</Label>
                      <p className="text-sm font-black text-blue-700">
                        {formatCurrency(Math.round(currentItem.quantity * (Number(currentItem.price) || 0) * 100))}
                      </p>
                    </div>

                    <Button type="button" className="w-full font-black h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20" onClick={() => {
                      const priceNum = Number(currentItem.price) || 0;
                      setCurrentItem({...currentItem, price: priceNum});
                      addItem();
                    }}>
                      Añadir Item
                    </Button>
                  </div>

                  {/* Info del producto seleccionado & Control de Masa */}
                  {selectedProduct && (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3 text-center">
                          <p className="text-[9px] font-bold uppercase text-blue-500 tracking-wide">Stock Disponible</p>
                          <p className="text-lg font-black text-blue-700">{selectedProduct.stock ?? selectedProduct.quantity ?? 0}</p>
                          <p className="text-[9px] text-blue-400">{selectedProduct.unit || 'unidades'}</p>
                        </div>
                        <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3 text-center">
                          <p className="text-[9px] font-bold uppercase text-emerald-500 tracking-wide">Precio Venta Ref.</p>
                          <p className="text-lg font-black text-emerald-700">{formatCurrency((selectedProduct.salePrice ?? selectedProduct.price ?? 0))}</p>
                          <p className="text-[9px] text-emerald-400">por unidad</p>
                        </div>
                        <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-3 text-center">
                          <p className="text-[9px] font-bold uppercase text-amber-500 tracking-wide">Saldo Inventario</p>
                          <p className="text-lg font-black text-amber-700">{formatCurrency((selectedProduct.stock ?? selectedProduct.quantity ?? 0) * (selectedProduct.salePrice ?? selectedProduct.price ?? 0))}</p>
                          <p className="text-[9px] text-amber-400">valor total</p>
                        </div>
                      </div>

                      {(selectedProduct.presentationVolumeMl > 0 || selectedProduct.presentationWeightGr > 0 || selectedProduct.productionRole === 'milk' || selectedProduct.productionRole === 'sugar') && (
                        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4">
                          <h4 className="text-blue-700 text-xs font-bold flex items-center gap-2 mb-2 uppercase">
                            <span className="text-base">📏</span> CONTROL DE MASA — PRESENTACIÓN DEL INSUMO
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">Presentación</p>
                              <p className="font-semibold text-slate-700">{selectedProduct.presentationQuantity || 1} {selectedProduct.presentationUnit || selectedProduct.unit}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">
                                {selectedProduct.presentationVolumeMl > 0 ? "Volumen (ML)" : "Peso (GR)"}
                              </p>
                              <p className="font-semibold text-slate-700">
                                {selectedProduct.presentationVolumeMl > 0 
                                  ? selectedProduct.presentationVolumeMl 
                                  : selectedProduct.presentationWeightGr}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">Volumen/Peso Total</p>
                              <p className="font-black text-blue-700">
                                {currentItem.quantity * (selectedProduct.presentationVolumeMl || selectedProduct.presentationWeightGr || 0)} {selectedProduct.presentationVolumeMl ? 'ML' : 'GR'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">
                                Costo por {selectedProduct.presentationVolumeMl ? 'Litro' : 'Kilo'}
                              </p>
                              <p className="font-black text-emerald-700">
                                {currentItem.price > 0 && (selectedProduct.presentationVolumeMl > 0 || selectedProduct.presentationWeightGr > 0)
                                  ? formatCurrency((currentItem.price / (selectedProduct.presentationVolumeMl || selectedProduct.presentationWeightGr)) * 1000)
                                  : "Bs 0.00"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista de Ítems añadidos */}
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Lista de Artículos Añadidos</h3>
                      {items.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setItems([])} className="h-7 text-[10px] font-black text-red-500 uppercase hover:bg-red-50">
                          <RotateCcw className="h-3 w-3 mr-1" /> Vaciado rápido
                        </Button>
                      )}
                    </div>
                    {items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{item.productName}</p>
                            <p className="text-[11px] text-slate-500">
                              <span className="text-emerald-700 font-bold">P. Unit:</span> {formatCurrency(item.price)} x {item.quantity} unidades
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Subtotal Item</p>
                            <p className="font-mono font-bold text-blue-700 text-base">{formatCurrency(item.quantity * item.price)}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => removeItem(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="py-10 text-center rounded-2xl border-2 border-dashed border-slate-100 bg-white/50">
                        <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-medium">No hay productos añadidos a la compra todavía.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* LADO DERECHO: Resumen de la Transacción & Botón de Acción */}
            <div className={isMobile ? "space-y-6" : "min-h-0 space-y-5 overflow-y-auto border-l border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-6"}>
              <div className="space-y-4">
                {/* Resumen Tipo Ticket */}
                <div className="rounded-[2.2rem] border-2 border-slate-900 bg-white shadow-xl overflow-hidden relative">
                  <div className="bg-slate-900 px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <span className="font-black uppercase tracking-widest text-xs">Entrada de Mercancía</span>
                      </div>
                      <Badge className="bg-blue-600 text-white border-none font-black text-[10px]">OFICIAL</Badge>
                    </div>
                    <div className="mt-4">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Comprobante N°</p>
                      <p className="text-lg font-black font-mono tracking-tighter">{purchaseData.purchaseNumber}</p>
                    </div>
                  </div>

                  <div className="bg-blue-600 px-6 py-6 text-white border-b border-white/10 relative overflow-hidden">
                    <div className="absolute top-[-20%] right-[-10%] h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100 mb-1">Total a Pagar</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black">{formatCurrency(purchaseData.totalAmount).split(' ')[1]}</span>
                      <span className="text-sm font-bold opacity-80">Bs.</span>
                    </div>
                  </div>

                  <div className="px-6 py-5 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Artículos Añadidos</span>
                      <span className="font-black text-slate-900">{items.reduce((sum, i) => sum + i.quantity, 0)} uds.</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Caja Seleccionada</span>
                      <span className="font-bold text-slate-900 capitalize">{purchaseData.paymentMethod}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Saldo Disponible</span>
                      <span className={`font-bold ${isInsufficient ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(currentBalance)}</span>
                    </div>

                    <div className="py-2">
                      <div className="border-t border-dashed border-slate-200 w-full" />
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setPurchaseData({...purchaseData, isCredit: purchaseData.isCredit === 1 ? 0 : 1, dueDate: ""})}>
                        <div className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${purchaseData.isCredit === 1 ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                          {purchaseData.isCredit === 1 && <ShoppingCart className="h-3 w-3" />}
                        </div>
                        <Label className="text-xs font-bold text-slate-700 cursor-pointer">Marcar como compra a crédito</Label>
                      </div>
                      {purchaseData.isCredit === 1 && (
                        <Badge variant="destructive" className="animate-pulse text-[9px] font-black">Crédito</Badge>
                      )}
                    </div>

                    {/* Campo de fecha de vencimiento para compras a crédito */}
                    {purchaseData.isCredit === 1 && (
                      <div className="p-3 rounded-2xl bg-red-50 border border-red-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-red-600 shrink-0" />
                          <Label className="text-xs font-black text-red-700 uppercase tracking-wider">Fecha de Vencimiento del Crédito *</Label>
                        </div>
                        <Input
                          type="date"
                          value={purchaseData.dueDate}
                          onChange={(e) => setPurchaseData({...purchaseData, dueDate: e.target.value})}
                          className="rounded-xl h-10 border-red-200 bg-white font-bold text-slate-800 focus:border-red-400"
                          min={new Date().toISOString().split('T')[0]}
                        />
                        {!purchaseData.dueDate && (
                          <p className="text-[10px] text-red-600 font-bold">⚠ Obligatorio para registrar a crédito</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {!openingStatus?.hasActive && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>LA CAJA DE {purchaseData.paymentMethod.toUpperCase()} ESTÁ CERRADA. ABRA LA CAJA EN FINANZAS.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className={isMobile ? "gap-2" : "border-t border-slate-100 bg-gradient-to-r from-slate-50/60 to-white px-8 py-4 gap-3 shrink-0"}>
            <Button
              variant="outline"
              onClick={() => { setIsCreateOpen(false); resetCreateForm(); }}
              className="min-w-36 h-12 rounded-xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Cancelar
            </Button>
            <Button
              onClick={() => handleSubmit()}
              disabled={createMutation.isPending || items.length === 0 || (purchaseData.isCredit === 0 && !openingStatus?.hasActive) || (purchaseData.isCredit === 1 && !purchaseData.dueDate)}
              className="min-w-72 gap-2.5 h-12 rounded-xl text-base bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30"
            >
              {createMutation.isPending ? (
                "Registrando..."
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Registrar Compra · {formatCurrency(purchaseData.totalAmount)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalles de Compra */}
      <PurchaseDetailDialog 
        purchase={selectedPurchase}
        open={showDetails}
        onOpenChange={setShowDetails}
      />

      <EditPurchaseDialog
        purchase={selectedPurchase}
        open={showEdit}
        onOpenChange={setShowEdit}
      />
      
      <QuickCreateProductDialog
        open={openNewProduct}
        onOpenChange={setOpenNewProduct}
        onSuccess={(newProduct: any) => {
          setCurrentItem({...currentItem, productId: newProduct.id, price: newProduct.price / 100});
        }}
      />
    </div>
  );
}

function PurchaseDetailDialog({ purchase, open, onOpenChange }: any) {
  const { data: items, isLoading } = (trpc.purchases as any).getItems.useQuery(
    { purchaseId: purchase?.id },
    { enabled: !!purchase?.id }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[2rem] p-6 bg-white border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <FileText className="h-5 w-5 text-blue-600" /> Detalle de Compra: {purchase?.purchaseNumber}
          </DialogTitle>
        </DialogHeader>
        
        {purchase && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl text-sm border border-slate-100">
              <div>
                <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Proveedor</p>
                <p className="font-bold text-slate-800">{purchase.supplierName || "Sin Proveedor"}</p>
              </div>
              <div>
                <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Fecha</p>
                <p className="font-bold text-slate-800">{new Date(purchase.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Método de Pago</p>
                <Badge variant="outline" className="capitalize rounded-full font-bold">{purchase.paymentMethod}</Badge>
              </div>
              <div>
                <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Estado</p>
                <Badge variant={purchase.status === "received" ? "default" : "outline"} className="capitalize rounded-full font-bold">
                  {purchase.status === "received" ? "Recibido" : purchase.status}
                </Badge>
              </div>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-black text-xs uppercase">Producto</th>
                    <th className="px-4 py-3 text-center font-black text-xs uppercase">Cant.</th>
                    <th className="px-4 py-3 text-right font-black text-xs uppercase">Precio Uni.</th>
                    <th className="px-4 py-3 text-right font-black text-xs uppercase">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-400 italic">
                        Cargando items...
                      </td>
                    </tr>
                  ) : items?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{item.productName}</p>
                        <p className="text-[10px] text-slate-400">{item.productCode}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(item.price)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">{formatCurrency(item.quantity * item.price)}</td>
                    </tr>
                  ))}
                  {(!items || items.length === 0) && !isLoading && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400 italic">
                        No hay detalles disponibles para esta compra.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Compra</span>
                <span className="text-2xl font-black font-mono">
                  {formatCurrency(purchase.totalAmount)}
                </span>
              </div>
            </div>

            {purchase.notes && (
              <div className="text-xs text-slate-600 bg-amber-50 border border-amber-100 p-3 rounded-xl">
                 <p className="font-bold uppercase text-[9px] text-amber-800 mb-1">Notas:</p>
                 {purchase.notes}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditPurchaseDialog({ purchase, open, onOpenChange }: any) {
  const utils = trpc.useContext();
  const [supplierId, setSupplierId] = useState<number>(0);
  const [purchaseData, setPurchaseData] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);
  
  const [currentItem, setCurrentItem] = useState({
    productId: 0,
    quantity: 1,
    price: 0,
    expiryDate: "",
  });

  const { data: suppliers } = (trpc.suppliers as any).list.useQuery();
  const { data: products } = (trpc.inventory as any).listProducts.useQuery();
  const { data: originalItems, isLoading } = (trpc.purchases as any).getItems.useQuery(
    { purchaseId: purchase?.id },
    { enabled: !!purchase?.id }
  );

  const updateMutation = (trpc.purchases as any).update.useMutation({
    onSuccess: () => {
      toast.success("Compra actualizada correctamente");
      onOpenChange(false);
      utils.purchases.list.invalidate();
      (utils as any).inventory.listInventory.invalidate();
      utils.finance.getTransactions.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar la compra");
    }
  });

  if (open && purchase && items.length === 0 && originalItems && !isLoading && purchaseData.id !== purchase.id) {
    setSupplierId(purchase.supplierId || 0);
    setPurchaseData({
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      status: purchase.status,
      isCredit: purchase.isCredit,
      paymentMethod: purchase.paymentMethod,
      totalAmount: purchase.totalAmount,
    });
    setItems(originalItems.map((item: any) => ({
      ...item,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      productName: item.productName,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : "",
    })));
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPurchaseData({});
      setItems([]);
    }
    onOpenChange(newOpen);
  };

  const addItem = () => {
    if (currentItem.productId === 0 || currentItem.quantity <= 0) return;
    const product = (products as any[])?.find((p: any) => p.id === currentItem.productId);
    const priceInCents = Math.round(currentItem.price * 100);
    
    setItems([...items, { ...currentItem, price: priceInCents, productName: product?.name }]);
    setPurchaseData((prev: any) => ({
      ...prev,
      totalAmount: prev.totalAmount + (currentItem.quantity * priceInCents)
    }));
    setCurrentItem({ productId: 0, quantity: 1, price: 0, expiryDate: "" });
  };

  const removeItem = (index: number) => {
    const item = items[index];
    setPurchaseData((prev: any) => ({
      ...prev,
      totalAmount: prev.totalAmount - (item.quantity * item.price)
    }));
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Añade al menos un producto a la compra");
      return;
    }
    updateMutation.mutate({
      ...purchaseData,
      supplierId: supplierId === 0 ? undefined : supplierId,
      items: items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        expiryDate: item.expiryDate || undefined
      }))
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] p-6 bg-white border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <Edit className="h-5 w-5 text-amber-600" /> Editar Compra: {purchase?.purchaseNumber}
          </DialogTitle>
        </DialogHeader>
        
        {purchase && !isLoading && (
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Proveedor</Label>
                <Select value={supplierId === 0 ? "" : supplierId.toString()} onValueChange={(val) => setSupplierId(parseInt(val))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                  <SelectContent>
                    {(suppliers as any[])?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Método de Pago</Label>
                <Select value={purchaseData.paymentMethod} onValueChange={(val: any) => setPurchaseData({...purchaseData, paymentMethod: val})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="qr">Transferencia QR</SelectItem>
                    <SelectItem value="transfer">Cuenta Bancaria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Total Actualizado</Label>
                <p className="text-xl font-black text-slate-900">{formatCurrency(purchaseData.totalAmount || 0)}</p>
              </div>
            </div>

            <div className="border border-slate-100 p-5 rounded-3xl bg-slate-50/50 space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                <Package className="h-4 w-4 text-amber-600" /> Modificar Productos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs font-bold text-slate-600">Producto</Label>
                  <Select 
                    value={currentItem.productId === 0 ? "" : currentItem.productId.toString()} 
                    onValueChange={(val) => setCurrentItem({...currentItem, productId: parseInt(val), price: 0})}
                  >
                    <SelectTrigger className="bg-white rounded-xl h-11 truncate">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(products as any[])?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Cant.</Label>
                  <Input type="number" className="rounded-xl h-11" value={currentItem.quantity} onChange={(e) => setCurrentItem({...currentItem, quantity: parseInt(e.target.value) || 1})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-emerald-700 uppercase">P. Unit. (Bs)</Label>
                  <Input type="number" step="any" className="rounded-xl h-11" value={currentItem.price} onChange={(e) => setCurrentItem({...currentItem, price: parseFloat(e.target.value) || 0})} />
                </div>
                <Button type="button" variant="secondary" className="w-full font-bold h-11 rounded-xl border-2 md:col-span-4" onClick={addItem}>
                  Añadir Item
                </Button>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm bg-white p-3 rounded-2xl border border-amber-100">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{item.productName}</span>
                      <span className="text-[11px] text-slate-500">{formatCurrency(item.price)} x {item.quantity} unidades</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-blue-700">{formatCurrency(item.quantity * item.price)}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-lg font-black rounded-xl bg-amber-600 hover:bg-amber-700 text-white" disabled={updateMutation.isPending || items.length === 0}>
              {updateMutation.isPending ? "Guardando..." : "Guardar Cambios de Compra"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuickCreateProductDialog({ open, onOpenChange, onSuccess }: any) {
  const utils = trpc.useContext();
  const [formData, setFormData] = useState({
    name: "",
    unit: "bolsa",
    initialStock: 0,
    minStock: 10,
    volumeMl: 0,
    weightGr: 0,
    costPerUnit: 0 as any,
    paymentMethod: "cash",
  });

  const { data: openingStatus } = trpc.finance.hasActiveOpening.useQuery({ paymentMethod: formData.paymentMethod as any });

  const createProductMutation = (trpc.inventory as any).createProduct.useMutation();
  const createPurchaseMutation = (trpc.purchases as any).create.useMutation();

  const isVolume = formData.unit === "bolsa" || formData.unit === "litro" || formData.unit === "botella";
  
  const costNum = Number(formData.costPerUnit) || 0;
  const costPerUnitCalc = formData.volumeMl > 0 
    ? (costNum / formData.volumeMl) * 1000 
    : formData.weightGr > 0 
      ? (costNum / formData.weightGr) * 1000 
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("El nombre es requerido");
      return;
    }
    
    if (formData.initialStock > 0 && !openingStatus?.hasActive) {
      toast.error("La caja seleccionada está cerrada. No se puede generar movimiento de efectivo.");
      return;
    }

    try {
      const prodRes = await createProductMutation.mutateAsync({
        code: `INS-${Math.floor(Math.random() * 10000)}`,
        name: formData.name,
        category: "raw_material",
        price: costNum,
        unit: formData.unit,
        presentationQuantity: 1,
        presentationUnit: formData.unit,
        presentationVolumeMl: formData.volumeMl,
        presentationWeightGr: formData.weightGr,
        productionRole: formData.unit === 'botella' ? 'bottle' : 'none'
      });

      if (prodRes.success && prodRes.productId) {
        if (formData.initialStock > 0) {
          await createPurchaseMutation.mutateAsync({
            purchaseNumber: `INI-${Math.floor(Math.random() * 10000)}`,
            status: "received",
            isCredit: 0,
            paymentMethod: formData.paymentMethod,
            totalAmount: costNum * formData.initialStock * 100,
            supplierId: undefined,
            items: [{
              productId: prodRes.productId,
              quantity: formData.initialStock,
              price: costNum * 100,
            }]
          });
        }
        
        toast.success("Ítem de inventario creado exitosamente");
        utils.units.list.invalidate();
        utils.purchases.list.invalidate();
        utils.finance.getTransactions.invalidate();
        
        onSuccess({ id: prodRes.productId, price: costNum * 100 });
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al crear producto");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border-0 shadow-2xl p-0 overflow-hidden rounded-[2rem]">
        <div className="bg-slate-50 border-b px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-xl font-black text-slate-800">Nuevo Ítem de Inventario</DialogTitle>
            <p className="text-xs text-slate-500">Materia prima o insumo con movimiento de caja</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600 uppercase">Nombre del Ítem *</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Ej. Leche natural, Azúcar blanca..."
                className="font-medium rounded-xl h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600 uppercase">Unidad *</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData({...formData, unit: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bolsa">Bolsa</SelectItem>
                    <SelectItem value="litro">Litro</SelectItem>
                    <SelectItem value="kg">Kilogramo</SelectItem>
                    <SelectItem value="botella">Botella</SelectItem>
                    <SelectItem value="unidad">Unidad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600 uppercase">Stock Inicial *</Label>
                <Input 
                  type="number" min="0" 
                  value={formData.initialStock}
                  onChange={(e) => setFormData({...formData, initialStock: parseFloat(e.target.value) || 0})}
                  className="rounded-xl h-11 font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600 uppercase">Stock Mínimo (Alerta) *</Label>
              <Input 
                type="number" min="0" 
                value={formData.minStock}
                onChange={(e) => setFormData({...formData, minStock: parseFloat(e.target.value) || 0})}
                className="rounded-xl h-11"
              />
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 relative overflow-hidden">
              <h4 className="text-blue-700 text-xs font-bold flex items-center gap-2 mb-3 uppercase">
                <span className="text-sm">📏</span> CONTROL DE MASA — PRESENTACIÓN
              </h4>
              
              <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                Ingresa el volumen/peso de cada {formData.unit} para que el sistema calcule automáticamente cuántas unidades necesitas por lote.
              </p>

              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-600 uppercase">{isVolume ? 'Volumen por ' + formData.unit + ' (ML) *' : 'Peso por ' + formData.unit + ' (GR) *'}</Label>
                  <Input 
                    type="number" min="0" 
                    placeholder={isVolume ? "Ej. 800 para bolsas de 800ml" : "Ej. 1000 para bolsa de 1kg"}
                    value={isVolume ? (formData.volumeMl || '') : (formData.weightGr || '')}
                    onChange={(e) => setFormData({...formData, [isVolume ? 'volumeMl' : 'weightGr']: parseFloat(e.target.value) || 0})}
                    className="bg-white rounded-xl h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">Costo por {formData.unit} (Bs) *</Label>
                    <Input 
                      type="text" inputMode="decimal"
                      value={formData.costPerUnit === 0 ? '' : formData.costPerUnit}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        setFormData({...formData, costPerUnit: val as any});
                      }}
                      placeholder="0.00"
                      className="bg-white font-bold rounded-xl h-11"
                    />
                  </div>
                  <div className="flex justify-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/></svg>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">Costo por {isVolume ? 'Litro' : 'Kilo'} (Bs)</Label>
                    <div className="h-11 bg-white border rounded-xl flex items-center px-3 font-bold text-slate-500 text-sm">
                      {formatCurrency(costPerUnitCalc * 100)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {formData.initialStock > 0 && (
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <Label className="text-[10px] font-bold text-slate-600 uppercase">Movimiento de Caja (Pago por Stock Inicial)</Label>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-500">Total a debitar:</span>
                  <span className="font-bold text-red-600">{formatCurrency(costNum * formData.initialStock * 100)}</span>
                </div>
                <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({...formData, paymentMethod: v})}>
                  <SelectTrigger className="bg-white rounded-xl h-11"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="qr">Transferencia QR</SelectItem>
                    <SelectItem value="transfer">Cuenta Bancaria</SelectItem>
                  </SelectContent>
                </Select>
                {!openingStatus?.hasActive && (
                  <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ La caja seleccionada está cerrada</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-xl h-11 font-bold" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-11 shadow-lg shadow-blue-600/20" disabled={createProductMutation.isPending || createPurchaseMutation.isPending}>
              {createProductMutation.isPending ? "Procesando..." : "+ Registrar en Inventario"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
