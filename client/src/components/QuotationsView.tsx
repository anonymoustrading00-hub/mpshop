import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Eye,
  Plus,
  Minus,
  Trash2,
  Search,
  UserRound,
  FileText,
  Printer,
  CheckCircle2,
  XCircle,
  CopyPlus,
  BadgePercent
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

type DiscountType = "none" | "percentage" | "fixed";

type CartItem = {
  productId: number;
  productName: string;
  productCode: string;
  stock: number;
  quantity: number;
  basePrice: number;
  pricingType: "unit" | "wholesale" | "discount";
  discountType: DiscountType;
  discountValue: number;
};

export default function QuotationsView({ onSelectQuotation }: { onSelectQuotation?: (quotation: any, items: any[]) => void }) {
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();

  const { data: productsData } = trpc.units.list.useQuery({ status: "available", limit: 200 } as any);
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: quotationsList, isLoading } = trpc.quotations.list.useQuery();
  const { data: companyConfig } = trpc.settings.getCompanyConfig.useQuery();
  const { data: nextQuotationData } = trpc.quotations.getNextNumber.useQuery();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailQuotationId, setDetailQuotationId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [anonymousCustomerName, setAnonymousCustomerName] = useState("");
  const [globalDiscountType, setGlobalDiscountType] = useState<DiscountType>("none");
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState("Validez de la cotización: 7 días hábiles. Precios sujetos a cambios sin previo aviso.");
  const [validUntil, setValidUntil] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  const productSearchRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const detailQuery = trpc.quotations.getDetails.useQuery(
    { quotationId: detailQuotationId ?? 0 },
    { enabled: isDetailOpen && detailQuotationId !== null }
  );

  const createQuotationMutation = trpc.quotations.create.useMutation({
    onSuccess: async () => {
      toast.success("Cotización creada exitosamente");
      await utils.quotations.list.invalidate();
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo crear la cotización");
    },
  });

  const updateStatusMutation = trpc.quotations.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success("Estado actualizado");
      await utils.quotations.list.invalidate();
      await utils.quotations.getDetails.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo actualizar el estado");
    },
  });

  const resetForm = () => {
    setProductSearch("");
    setCustomerSearch("");
    setSelectedCustomerId(null);
    setAnonymousCustomerName("");
    setGlobalDiscountType("none");
    setGlobalDiscountValue(0);
    setNotes("");
    setCartItems([]);
  };

  const products = useMemo(() => {
    const items = (productsData as any)?.items ?? [];
    return items.map((u: any) => ({
      id: u.id,
      name: [u.brand, u.model].filter(Boolean).join(" ").trim() || u.code || `Unidad #${u.id}`,
      code: u.code,
      salePrice: u.salePrice ?? u.price ?? 0,
      discountPrice: u.discountPrice ?? null,
      wholesalePrice: u.wholesalePrice ?? null,
      stock: 1,
    }));
  }, [productsData]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const search = productSearch.trim().toLowerCase();
    return (products as any[])
      .filter((product: any) => !search || product.name.toLowerCase().includes(search) || product.code.toLowerCase().includes(search))
      .slice(0, 12);
  }, [products, productSearch]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const search = customerSearch.trim().toLowerCase();
    if (!search) return [];
    return (customers as any[])
      .filter((customer: any) => customer.name.toLowerCase().includes(search))
      .slice(0, 8);
  }, [customers, customerSearch]);

  const computedCart = useMemo(() => {
    const items = cartItems.map((item) => {
      let finalUnitPrice = item.basePrice;
      if (item.discountType === "percentage") {
        finalUnitPrice = Math.max(0, item.basePrice * (1 - item.discountValue / 100));
      } else if (item.discountType === "fixed") {
        finalUnitPrice = Math.max(0, item.basePrice - (item.discountValue * 100));
      }
      return { ...item, subtotal: finalUnitPrice * item.quantity };
    });

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    let globalDiscountAmount = 0;
    if (globalDiscountType === "percentage") {
      globalDiscountAmount = subtotal * (globalDiscountValue / 100);
    } else if (globalDiscountType === "fixed") {
      globalDiscountAmount = globalDiscountValue * 100;
    }
    const total = Math.max(0, subtotal - globalDiscountAmount);

    return { items, subtotal, globalDiscountAmount, total };
  }, [cartItems, globalDiscountType, globalDiscountValue]);

  const addProductToCart = (product: any) => {
    setCartItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          stock: product.stock,
          quantity: 1,
          basePrice: product.salePrice,
          pricingType: "unit",
          discountType: "none",
          discountValue: 0,
        },
      ];
    });
    setProductSearch("");
  };

  const updateCartItem = (productId: number, changes: Partial<CartItem>) => {
    setCartItems((current) =>
      current.map((item) => (item.productId === productId ? { ...item, ...changes } : item))
    );
  };

  const removeCartItem = (productId: number) => {
    const itemToRemove = cartItems.find((item) => item.productId === productId);
    setCartItems((current) => current.filter((item) => item.productId !== productId));
    
    if (itemToRemove) {
      toast("Producto eliminado", {
        description: `${itemToRemove.productName} retirado de la cotización.`,
        action: {
          label: "Deshacer",
          onClick: () => setCartItems((current) => [...current, itemToRemove]),
        },
        duration: 5000,
      });
    }
  };

  const submitQuotation = () => {
    if (cartItems.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }
    createQuotationMutation.mutate({
      customerId: selectedCustomerId || undefined,
      customerName: selectedCustomerId ? undefined : anonymousCustomerName.trim() || "Cliente anónimo",
      discountType: globalDiscountType,
      discountValue: globalDiscountValue,
      notes,
      termsAndConditions,
      validUntil: validUntil || undefined,
      items: cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        basePrice: item.basePrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
      })),
    });
  };

  const handleExportPDF = () => {
    if (!detailQuery.data || !printRef.current) return;
    
    // Abrir la cotización en una ventana nueva para imprimir/guardar como PDF nativo
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("El navegador bloqueó la nueva ventana. Por favor permite las ventanas emergentes.");
      return;
    }

    const htmlContent = printRef.current.innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cotizacion-${detailQuery.data.quotation.quotationNumber}</title>
          <style>
            body { 
              margin: 0; 
              padding: 0;
              font-family: sans-serif;
            }
            @media print {
              @page { margin: 15mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div style="padding: 20px; color: #111;">
            ${htmlContent}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleLoadToSale = () => {
    if (detailQuery.data && onSelectQuotation) {
      onSelectQuotation(detailQuery.data.quotation, detailQuery.data.items);
      toast.success("Cotización cargada para la venta");
      setIsDetailOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 p-0 sm:p-2 md:p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cotizaciones</h1>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="h-11 gap-2">
          <FileText className="h-4 w-4" />
          Nueva Cotización
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Cotizaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse items-center">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-24 hidden md:block" />
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Creado por</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(quotationsList as any[])?.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-semibold">{q.quotationNumber}</TableCell>
                    <TableCell>{q.customerDisplayName}</TableCell>
                    <TableCell>{q.creatorName}</TableCell>
                    <TableCell>
                      <Badge variant={q.status === 'accepted' ? 'default' : q.status === 'rejected' ? 'destructive' : 'secondary'}>
                        {q.status === 'accepted' ? 'Aceptada' : q.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(q.total)}</TableCell>
                    <TableCell>{new Date(q.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setDetailQuotationId(q.id);
                        setIsDetailOpen(true);
                      }}>
                        <Eye className="h-4 w-4 mr-1" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {quotationsList?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-[300px]">
                      <Empty className="border-0 bg-transparent">
                        <EmptyHeader>
                          <EmptyMedia className="bg-indigo-50">
                            <FileText className="h-8 w-8 text-indigo-600" />
                          </EmptyMedia>
                          <EmptyTitle>No hay cotizaciones</EmptyTitle>
                          <EmptyDescription>
                            Aún no has creado ninguna cotización. Empieza ahora para enviarla a tus clientes.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="h-4 w-4" />
                            Crear tu primera cotización
                          </Button>
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* CREATION DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          className={
            isMobile
              ? "max-h-[94vh] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[1.6rem] border-white/70 bg-white/95 p-4 sm:max-w-[calc(100vw-1.5rem)] sm:p-6"
              : "h-[88vh] w-[min(1200px,96vw)] sm:max-w-[min(1200px,96vw)] overflow-hidden rounded-[1.8rem] border-white/70 bg-white/95 p-0"
          }
        >
          <DialogHeader className={isMobile ? "" : "border-b border-border/70 px-6 pt-6 pb-4"}>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              Nueva Cotización {nextQuotationData?.quotationNumber ? `- ${nextQuotationData.quotationNumber}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className={isMobile ? "mt-6 space-y-6" : "grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.14fr)_380px]"}>
            <div className={isMobile ? "space-y-6" : "min-h-0 space-y-6 overflow-y-auto px-6 py-6"}>
              
              <Card className="border-indigo-100/50">
                <CardHeader>
                  <CardTitle className="text-base text-indigo-900">Datos Principales</CardTitle>
                </CardHeader>
                <CardContent className={isMobile ? "grid gap-4" : "grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]"}>
                  <div className="space-y-2">
                    <Label>Buscar Cliente</Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        autoFocus
                        value={customerSearch} 
                        onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomerId(null); }} 
                        className="pl-9 focus-visible:ring-indigo-500" 
                        placeholder="Buscar cliente registrado..." 
                      />
                    </div>
                    {filteredCustomers.length > 0 && !selectedCustomerId && (
                      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                        {filteredCustomers.map((c: any) => (
                          <button key={c.id} className="block w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 border-b last:border-0" onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); }}>
                            <span className="font-medium">{c.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!selectedCustomerId ? (
                      <Input value={anonymousCustomerName} onChange={e => setAnonymousCustomerName(e.target.value)} placeholder="O escribe nombre libre / anónimo" className="focus-visible:ring-indigo-500" />
                    ) : (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50">Cliente seleccionado</Badge>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setSelectedCustomerId(null); setCustomerSearch(""); }}>
                          Cambiar
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Válido hasta</Label>
                      <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="focus-visible:ring-indigo-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-100/50">
                <CardHeader>
                  <CardTitle className="text-base text-indigo-900">Productos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      ref={productSearchRef} 
                      value={productSearch} 
                      onChange={e => setProductSearch(e.target.value)} 
                      placeholder="Buscar producto por nombre o código..." 
                      className="pl-9 focus-visible:ring-indigo-500"
                    />
                  </div>
                  {filteredProducts.length > 0 && (
                    <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/50 p-2 grid gap-2">
                      {filteredProducts.map((p: any) => (
                        <button key={p.id} className="flex justify-between items-center w-full text-left p-3 bg-white rounded-lg border hover:border-indigo-300 hover:shadow-sm transition-all" onClick={() => addProductToCart(p)}>
                          <div>
                            <p className="font-medium text-sm">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.code}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900">{formatCurrency(p.salePrice)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-indigo-100/50">
                <CardHeader>
                  <CardTitle className="text-base text-indigo-900">Términos y Notas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Términos y Condiciones (Visibles en PDF)</Label>
                    <Textarea value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)} className="min-h-[80px] focus-visible:ring-indigo-500" />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas Internas (Opcional)</Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[60px] focus-visible:ring-indigo-500" placeholder="Observaciones internas..." />
                  </div>
                </CardContent>
              </Card>

            </div>

            <div className={isMobile ? "space-y-6" : "min-h-0 space-y-6 overflow-y-auto border-t border-border/70 pt-6 lg:border-t-0 lg:border-l lg:bg-indigo-50/30 lg:px-6 lg:py-6"}>
              <div className="sticky top-0 space-y-4">
                
                {/* Resumen Total (Estilo Ticket) */}
                <div className="rounded-2xl border-2 border-slate-900 bg-white shadow-sm overflow-hidden">
                  <div className="bg-slate-900 px-4 py-3 text-white flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-bold text-sm">Resumen de Cotización</span>
                  </div>
                  <div className="bg-indigo-50 px-4 py-4 border-b border-indigo-100">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 mb-1">Total Estimado</p>
                    <p className="text-3xl font-black text-indigo-900">{formatCurrency(computedCart.total)}</p>
                  </div>
                  <div className="px-4 py-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Productos</span>
                      <span className="font-medium">{computedCart.items.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(computedCart.subtotal)}</span>
                    </div>
                    {computedCart.globalDiscountAmount > 0 && (
                      <div className="flex items-center justify-between text-indigo-600">
                        <span>Descuento global</span>
                        <span className="font-medium">-{formatCurrency(computedCart.globalDiscountAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Descuento Global */}
                <Card className="border-indigo-100/50 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-indigo-900">
                      <BadgePercent className="h-4 w-4 text-indigo-600" />
                      Descuento global
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select value={globalDiscountType} onValueChange={(value: DiscountType) => { setGlobalDiscountType(value); setGlobalDiscountValue(0); }}>
                      <SelectTrigger className="w-full focus:ring-indigo-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin descuento</SelectItem>
                        <SelectItem value="percentage">% Porcentaje</SelectItem>
                        <SelectItem value="fixed">$ Fijo</SelectItem>
                      </SelectContent>
                    </Select>
                    {globalDiscountType !== "none" && (
                      <Input
                        type="number"
                        className="focus-visible:ring-indigo-500"
                        value={globalDiscountValue || ""}
                        onChange={(e) => setGlobalDiscountValue(parseFloat(e.target.value) || 0)}
                        placeholder={globalDiscountType === "percentage" ? "%" : "$"}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Lista de Carrito */}
                <div className="space-y-3">
                  <h3 className="font-bold text-indigo-950 flex justify-between items-center">
                    Detalle
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200">{cartItems.length}</Badge>
                  </h3>
                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-indigo-100 rounded-xl">
                      <FileText className="mb-2 h-8 w-8 text-indigo-200" />
                      <p className="text-sm text-muted-foreground">Carrito vacío</p>
                    </div>
                  ) : (
                    computedCart.items.map((item) => (
                      <div key={item.productId} className="flex flex-col gap-2 rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm leading-tight text-slate-900">{item.productName}</p>
                            <div className="flex gap-1 mt-1">
                              <Badge variant={item.pricingType === "unit" ? "default" : "outline"} className="text-[8px] h-4 px-1" onClick={() => updateCartItem(item.productId, { pricingType: "unit", basePrice: (products as any)?.find((p: any) => p.id === item.productId)?.salePrice || item.basePrice })}>U</Badge>
                              <Badge variant={item.pricingType === "discount" ? "default" : "outline"} className="text-[8px] h-4 px-1" onClick={() => updateCartItem(item.productId, { pricingType: "discount", basePrice: (products as any)?.find((p: any) => p.id === item.productId)?.discountPrice || item.basePrice })}>D</Badge>
                              <Badge variant={item.pricingType === "wholesale" ? "default" : "outline"} className="text-[8px] h-4 px-1" onClick={() => updateCartItem(item.productId, { pricingType: "wholesale", basePrice: (products as any)?.find((p: any) => p.id === item.productId)?.wholesalePrice || item.basePrice })}>M</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{formatCurrency(item.basePrice)} c/u</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mt-1 -mr-1" onClick={() => removeCartItem(item.productId)}>
                            <XCircle className="h-4 w-4 text-red-400 hover:text-red-600" />
                          </Button>
                        </div>
                        
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-indigo-50">
                          <div className="flex items-center gap-2">
                            <Select 
                              value={item.discountType} 
                              onValueChange={(value: DiscountType) => updateCartItem(item.productId, { discountType: value, discountValue: 0 })}
                            >
                              <SelectTrigger className="h-8 text-xs focus:ring-indigo-500 w-[120px]">
                                <SelectValue placeholder="Descuento" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin dto</SelectItem>
                                <SelectItem value="percentage">% Dto</SelectItem>
                                <SelectItem value="fixed">$ Fijo</SelectItem>
                              </SelectContent>
                            </Select>
                            {item.discountType !== "none" && (
                              <Input
                                type="number"
                                className="h-8 text-xs focus-visible:ring-indigo-500 w-[80px]"
                                value={item.discountValue || ""}
                                onChange={(e) => updateCartItem(item.productId, { discountValue: parseFloat(e.target.value) || 0 })}
                                placeholder={item.discountType === "percentage" ? "%" : "$"}
                              />
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex h-8 items-center rounded-md border border-slate-200 bg-slate-50">
                              <button
                                type="button"
                                className="flex h-full w-8 items-center justify-center text-slate-500 hover:text-indigo-600 disabled:opacity-50"
                                onClick={() => updateCartItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="flex-1 text-center text-sm font-medium min-w-[2rem]">{item.quantity}</span>
                              <button
                                type="button"
                                className="flex h-full w-8 items-center justify-center text-slate-500 hover:text-indigo-600"
                                onClick={() => updateCartItem(item.productId, { quantity: item.quantity + 1 })}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              {item.discountType !== "none" && (
                                <span className="text-[10px] text-red-500 line-through mb-0.5">{formatCurrency(item.basePrice * item.quantity)}</span>
                              )}
                              <p className="font-bold text-indigo-950">{formatCurrency(item.subtotal)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Button 
                  className="w-full h-12 text-base font-bold shadow-sm bg-indigo-600 hover:bg-indigo-700" 
                  size="lg" 
                  onClick={submitQuotation}
                  disabled={cartItems.length === 0 || createQuotationMutation.isPending}
                >
                  {createQuotationMutation.isPending ? "Procesando..." : "Guardar Cotización"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DETAILS & PDF DIALOG */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-[80vw] max-h-[90vh] overflow-y-auto">
          {detailQuery.isLoading ? <div className="p-8 text-center">Cargando detalles...</div> : detailQuery.data ? (
            <div className="space-y-6">
              <div className="flex justify-between">
                <h2 className="text-2xl font-bold">Detalle {detailQuery.data.quotation.quotationNumber}</h2>
                <div className="space-x-2">
                  {onSelectQuotation && detailQuery.data.quotation.status === 'pending' && (
                    <Button onClick={handleLoadToSale} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <CopyPlus className="w-4 h-4" /> Cargar a Venta
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleExportPDF}><Printer className="w-4 h-4 mr-2"/> PDF</Button>
                  {detailQuery.data.quotation.status === 'pending' && (
                     <Button variant="destructive" onClick={() => updateStatusMutation.mutate({ quotationId: detailQuery.data.quotation.id, status: 'rejected' })}>Rechazar</Button>
                  )}
                </div>
              </div>
              
              {/* HIDDEN PDF TEMPLATE */}
              <div className="absolute left-[-9999px] top-[-9999px] w-[800px]">
                <div ref={printRef} style={{ padding: '40px', fontFamily: 'sans-serif', color: '#111', background: 'white' }}>
                  <div style={{ borderBottom: '2px solid #111', paddingBottom: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      {companyConfig?.logo ? (
                        <img src={companyConfig.logo} alt={companyConfig.name || "Logo"} style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
                      ) : (
                        <img src={`${window.location.origin}/logo.png`} alt="Logo" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
                      )}
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{companyConfig?.name || "HK EQUIPOS TECNOLÓGICOS"}</div>
                        <h1 style={{ margin: 0, fontSize: '26px' }}>COTIZACIÓN</h1>
                        <p style={{ margin: '3px 0 0 0', color: '#555' }}>Nº {detailQuery.data.quotation.quotationNumber}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0 }}><strong>Fecha:</strong> {new Date(detailQuery.data.quotation.createdAt).toLocaleDateString()}</p>
                      {detailQuery.data.quotation.validUntil && <p style={{ margin: '5px 0 0 0' }}><strong>Válido hasta:</strong> {new Date(detailQuery.data.quotation.validUntil).toLocaleDateString()}</p>}
                    </div>
                  </div>

                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Preparado para:</h3>
                    <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{detailQuery.data.quotation.customerDisplayName}</p>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f4f4f5', textAlign: 'left' }}>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Descripción</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd', textAlign: 'center' }}>Cant.</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>P. Unit.</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailQuery.data.items.map((item: any) => (
                        <tr key={item.id}>
                          <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{item.productName}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #ddd', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{formatCurrency(item.finalUnitPrice || item.basePrice)}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ width: '300px', marginLeft: 'auto', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                      <span>Subtotal:</span>
                      <strong>{formatCurrency(detailQuery.data.quotation.subtotal)}</strong>
                    </div>
                    {detailQuery.data.quotation.discountAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: 'red' }}>
                        <span>Descuento:</span>
                        <strong>-{formatCurrency(detailQuery.data.quotation.discountAmount)}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #111', fontSize: '18px', marginTop: '10px' }}>
                      <span><strong>Total:</strong></span>
                      <strong>{formatCurrency(detailQuery.data.quotation.total)}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '50px', fontSize: '12px', color: '#555' }}>
                    {detailQuery.data.quotation.termsAndConditions && (
                      <div style={{ marginBottom: '15px' }}>
                        <strong>Términos y Condiciones:</strong><br/>
                        {detailQuery.data.quotation.termsAndConditions}
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #ddd', paddingTop: '10px' }}>
                      Documento generado por: {detailQuery.data.quotation.creatorName}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* VISIBLE PREVIEW */}
              <div className="border rounded-md p-4 bg-slate-50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Cliente</p>
                    <p className="font-semibold">{detailQuery.data.quotation.customerDisplayName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
                    <p className="font-semibold">{formatCurrency(detailQuery.data.quotation.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Estado</p>
                    <Badge variant={detailQuery.data.quotation.status === 'accepted' ? 'default' : detailQuery.data.quotation.status === 'rejected' ? 'destructive' : 'secondary'}>
                      {detailQuery.data.quotation.status === 'accepted' ? 'Aceptada' : detailQuery.data.quotation.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                    </Badge>
                  </div>
                </div>

                {detailQuery.data.items.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Productos</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-center">Cant.</TableHead>
                          <TableHead className="text-right">P. Unit.</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailQuery.data.items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.productName}</div>
                              <div className="text-xs text-muted-foreground">{item.productCode}</div>
                            </TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.finalUnitPrice || item.basePrice)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {detailQuery.data.quotation.notes && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm whitespace-pre-wrap">{detailQuery.data.quotation.notes}</p>
                  </div>
                )}

                {detailQuery.data.quotation.termsAndConditions && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Términos y Condiciones</p>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{detailQuery.data.quotation.termsAndConditions}</p>
                  </div>
                )}
              </div>

            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
