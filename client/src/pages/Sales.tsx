import { useMemo, useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuotationsView from "@/components/QuotationsView";
import { trpc } from "@/lib/trpc";
import { formatCurrency, parsePrice } from "@/lib/currency";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BadgeDollarSign,
  Shield,
  Eye,
  Printer,
  Plus,
  Minus,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  Wallet,
  XCircle,
  Package,
  Receipt,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Grid,
  LayoutGrid,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  Banknote,
  QrCode,
  ArrowLeftRight,
  ChevronDown,
  Filter,
  CreditCard,
  AlertTriangle,
  Phone,
  X
} from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";

type DiscountType = "none" | "percentage" | "fixed";
type PaymentMethod = "cash" | "qr" | "transfer" | "credit";
type PaymentStatus = "pending" | "completed";

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

function getLinePricing(item: CartItem) {
  const safeBasePrice = Math.max(0, item.basePrice);
  const safeQuantity = Math.max(1, item.quantity);
  const safeDiscountValue = Math.max(0, item.discountValue);

  let finalUnitPrice = safeBasePrice;

  if (item.discountType === "percentage") {
    const percentage = Math.min(100, safeDiscountValue);
    finalUnitPrice = Math.max(0, Math.round(safeBasePrice * (1 - percentage / 100)));
  }

  if (item.discountType === "fixed") {
    finalUnitPrice = Math.max(0, safeBasePrice - safeDiscountValue);
  }

  const subtotal = finalUnitPrice * safeQuantity;
  const discountAmount = Math.max(0, safeBasePrice * safeQuantity - subtotal);

  return {
    finalUnitPrice,
    subtotal,
    discountAmount,
  };
}

function getGlobalDiscountAmount(subtotal: number, discountType: DiscountType, discountValue: number) {
  if (discountType === "percentage") {
    return Math.min(subtotal, Math.round(subtotal * (Math.min(100, discountValue) / 100)));
  }

  if (discountType === "fixed") {
    return Math.min(subtotal, Math.max(0, discountValue));
  }

  return 0;
}

function paymentMethodLabel(method: PaymentMethod) {
  if (method === "cash") return "Efectivo";
  if (method === "qr") return "QR";
  if (method === "credit") return "Crédito";
  return "Transferencia";
}

function saleStatusLabel(status: string) {
  return status === "cancelled" ? "Anulada" : "Activa";
}

function paymentStatusLabel(status: PaymentStatus | string) {
  return status === "completed" ? "Pagada" : "Pendiente";
}

function printSaleTicket(detail: any) {
  if (!detail?.sale) {
    toast.error("Abre el detalle de la venta antes de imprimir");
    return;
  }

  const itemsRows = (detail.items || [])
    .map((item: any) => `
      <tr>
        <td>${item.productName}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">${formatCurrency(item.finalUnitPrice || item.basePrice)}</td>
        <td style="text-align:right;">${formatCurrency(item.subtotal)}</td>
      </tr>
    `)
    .join("");

  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) {
    toast.error("No se pudo abrir la ventana de impresión");
    return;
  }

  win.document.write(`
    <html>
      <head>
        <title>Ticket ${detail.sale.saleNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
          h1, p { margin: 0; }
          .header { text-align: center; margin-bottom: 16px; }
          .meta { margin: 12px 0; font-size: 14px; }
          .meta div { margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border-bottom: 1px solid #ddd; padding: 8px 4px; font-size: 14px; }
          th { text-transform: uppercase; font-size: 12px; color: #555; }
          .summary { margin-top: 16px; font-size: 14px; }
          .summary div { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .total { font-size: 18px; font-weight: 700; border-top: 2px solid #111; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Vitalia</h1>
          <p>Ticket simple de venta</p>
        </div>
        <div class="meta">
          <div><strong>Venta:</strong> ${detail.sale.saleNumber}</div>
          <div><strong>Fecha:</strong> ${new Date(detail.sale.createdAt).toLocaleString("es-BO")}</div>
          <div><strong>Cliente:</strong> ${detail.sale.customerDisplayName || "Anónimo"}</div>
          <div><strong>Vendedor:</strong> ${detail.sale.sellerName || "Sin nombre"}</div>
          <div><strong>Pago:</strong> ${paymentMethodLabel(detail.sale.paymentMethod)}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>P. Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="summary">
          <div><span>Subtotal</span><strong>${formatCurrency(detail.sale.subtotal)}</strong></div>
          <div><span>Descuento global</span><strong>${formatCurrency(detail.sale.discountAmount || 0)}</strong></div>
          <div class="total"><span>Total</span><strong>${formatCurrency(detail.sale.total)}</strong></div>
        </div>
      </body>
    </html>
  `);

  win.document.close();
  win.focus();
  win.print();
}

export default function Sales() {
  const { activeBranchId, setActiveBranchId, branches } = useBranch();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();

  const { data: closureStatus } = trpc.finance.hasPendingClosure.useQuery();
  const { data: salesList, isLoading } = trpc.sales.list.useQuery();
  const { data: nextSaleData } = trpc.sales.getNextSaleNumber.useQuery();

  const [activeTab, setActiveTab] = useState("sales");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailSaleId, setDetailSaleId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleNumber, setLastSaleNumber] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCustomerType, setSelectedCustomerType] = useState<"retail" | "wholesale">("retail");
  const [anonymousCustomerName, setAnonymousCustomerName] = useState("");
  const [saleChannel, setSaleChannel] = useState<"local" | "delivery">("local");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("completed");
  const [globalDiscountType, setGlobalDiscountType] = useState<DiscountType>("none");
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [anonymousCustomerPhone, setAnonymousCustomerPhone] = useState("");
  const [anonymousCustomerTaxId, setAnonymousCustomerTaxId] = useState("");
  const [creditDays, setCreditDays] = useState(30);
  const [warrantyDays, setWarrantyDays] = useState(30);
  const [innerProductSearch, setInnerProductSearch] = useState("");
  const [currentPricingMode, setCurrentPricingMode] = useState<"unit" | "discount" | "wholesale">("unit");

  const { data: openingStatus } = trpc.finance.hasActiveOpening.useQuery({ paymentMethod: paymentMethod === "credit" ? "cash" : paymentMethod });
  const { data: unitsList } = trpc.units.list.useQuery({ status: "available" });
  const products = unitsList?.items?.map((u: any) => ({
    id: u.id,
    name: `${u.brand} ${u.model}`,
    code: u.code,
    salePrice: u.salePrice || 0,
    wholesalePrice: u.wholesalePrice || u.salePrice || 0,
    discountPrice: u.discountPrice || u.salePrice || 0,
    price: u.salePrice || 0,
    // Pass through fields needed for filtering
    status: u.status,           // "available", "in_repair", "sold", etc.
    category: "unit",           // distinguish from regular products
    unitType: u.type,           // "laptop", "accessory", etc.
  })) || [];
  const { data: customers } = trpc.customers.list.useQuery();

  const [historySearch, setHistorySearch] = useState("");
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyStatus, setHistoryStatus] = useState<"all" | "completed" | "cancelled">("all");
  const productSearchRef = useRef<HTMLInputElement>(null);

  const detailQuery = trpc.sales.getDetails.useQuery(
    { saleId: detailSaleId ?? 0 },
    { enabled: isDetailOpen && detailSaleId !== null }
  );

  const createSaleMutation = trpc.sales.create.useMutation({
    onSuccess: async (data) => {
      const saleNumber = (data as any)?.saleNumber || nextSaleData?.saleNumber || "";
      setLastSaleNumber(saleNumber);
      setShowSuccess(true);
      await Promise.all([
        utils.sales.list.invalidate(),
        utils.units.list.invalidate(),
        utils.finance.getTransactions.invalidate(),
        utils.credit.listReceivable.invalidate(),
      ]);
      setTimeout(() => {
        setShowSuccess(false);
        setIsCreateOpen(false);
        resetForm();
      }, 1800);
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo registrar la venta");
    },
  });

  const cancelSaleMutation = trpc.sales.cancel.useMutation({
    onSuccess: async () => {
      toast.success("Venta anulada y stock repuesto");
      setCancelReason("");
      await Promise.all([
        utils.sales.list.invalidate(),
        utils.sales.getDetails.invalidate(),
        utils.units.list.invalidate(),
        utils.finance.getTransactions.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo anular la venta");
    },
  });

  const markPaidMutation = trpc.sales.markPaymentCompleted.useMutation({
    onSuccess: async () => {
      toast.success("Venta marcada como pagada");
      await Promise.all([
        utils.sales.list.invalidate(),
        utils.sales.getDetails.invalidate(),
        utils.finance.getTransactions.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo actualizar el pago");
    },
  });

  // Bloqueo de seguridad: Si tiene un cierre pendiente
  // Solo bloqueamos si las consultas ya cargaron para evitar falsos positivos (flicker) durante la carga
  const isLockedByPending = closureStatus && closureStatus.hasPending;

  if (isLockedByPending) {
    return (
      <div className="page-shell flex items-center justify-center pt-20 bg-slate-950 min-h-full">
        <Card className="max-w-md w-full border-none shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] bg-slate-900 text-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="text-center pt-10">
            <div className="bg-emerald-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-12">
              <AlertCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight">
              Módulo Restringido
            </CardTitle>
            <CardDescription className="text-slate-400 font-medium text-lg mt-2">
              Tu última caja está pendiente de habilitación.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center px-10 pb-12">
            <p className="text-sm text-slate-500 mb-10 leading-relaxed">
              Para garantizar la integridad financiera, el administrador debe aprobar tu reporte anterior antes de iniciar nuevas ventas.
            </p>
            <Link href={user?.role === "admin" ? "/finance" : "/repartidor/finance"}>
              <Button className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg gap-2 shadow-xl shadow-emerald-500/20">
                Revisar Estado de Caja
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <div className="fixed bottom-6 right-6 text-[10px] text-slate-700 font-bold uppercase tracking-[0.3em] font-mono italic">Secure Protocol v1.2</div>
      </div>
    );
  }


  const resetForm = () => {
    setProductSearch("");
    setCustomerSearch("");
    setSelectedCustomerId(null);
    setAnonymousCustomerName("");
    setSaleChannel("local");
    setPaymentMethod("cash");
    setPaymentStatus("completed");
    setGlobalDiscountType("none");
    setGlobalDiscountValue(0);
    setNotes("");
    setCartItems([]);
    setAnonymousCustomerPhone("");
    setAnonymousCustomerTaxId("");
    setCreditDays(30);
    setWarrantyDays(30);
    setSelectedCustomerType("retail");
  };

  const clearCart = () => {
    setCartItems([]);
    setProductSearch("");
    toast.info("Carrito vaciado");
  };

  // All available units/products for sale - full text multi-word filter
  const filteredProducts = useMemo(() => {
    const search = (productSearch || "").trim().toLowerCase();
    const allItems = unitsList?.items || [];
    const available = allItems.filter((u: any) => u.status === "available");

    if (!search) return available.slice(0, 50);

    const searchWords = search.split(/\s+/).filter(Boolean);

    return available
      .filter((u: any) => {
        const fullText = [
          u.code,
          u.brand,
          u.model,
          u.type,
          typeof u.specs === "object" ? JSON.stringify(u.specs) : u.specs,
          typeof u.damageNotes === "string" ? u.damageNotes : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchWords.every((word) => fullText.includes(word));
      })
      .slice(0, 50);
  }, [unitsList, productSearch]);

  // Grouped products: group available units by brand+model+salePrice so we show
  // one card per product type with an available count badge
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, { representative: any; units: any[]; count: number }>();
    for (const u of filteredProducts) {
      const key = `${u.brand}|${u.model}|${u.salePrice ?? 0}`;
      if (!groups.has(key)) {
        groups.set(key, { representative: u, units: [], count: 0 });
      }
      const g = groups.get(key)!;
      g.units.push(u);
      g.count += 1;
    }
    return Array.from(groups.values());
  }, [filteredProducts]);

  // Map a raw unit item to the product shape used in the cart
  const toProductShape = (u: any) => ({
    id: u.id,
    name: `${u.brand} ${u.model}`,
    code: u.code,
    salePrice: u.salePrice || 0,
    wholesalePrice: u.wholesalePrice || u.salePrice || 0,
    discountPrice: u.discountPrice || u.salePrice || 0,
    price: u.salePrice || 0,
    status: u.status,
    category: "unit",
    stock: 1,
  });

  // Total available units (for empty state messaging)
  const totalAvailable = useMemo(() => {
    const allItems = unitsList?.items || [];
    return allItems.filter((u: any) => u.status === "available").length;
  }, [unitsList]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const search = (anonymousCustomerName || customerSearch || "").trim().toLowerCase();
    if (!search || search.length < 2) return [];

    return (customers as any[])
      .filter((customer: any) =>
        customer.name.toLowerCase().includes(search) ||
        customer.phone?.toLowerCase().includes(search) ||
        customer.taxId?.toLowerCase().includes(search) ||
        customer.clientNumber?.toLowerCase().includes(search)
      )
      .slice(0, 6);
  }, [customers, anonymousCustomerName, customerSearch]);

  const computedCart = useMemo(() => {
    const items = cartItems.map((item) => ({
      ...item,
      ...getLinePricing(item),
    }));

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const globalDiscountAmount = getGlobalDiscountAmount(subtotal, globalDiscountType, globalDiscountValue);
    const total = Math.max(0, subtotal - globalDiscountAmount);

    return {
      items,
      subtotal,
      globalDiscountAmount,
      total,
    };
  }, [cartItems, globalDiscountType, globalDiscountValue]);

  const filteredSales = useMemo(() => {
    if (!salesList) return [];

    return (salesList as any[]).filter((sale: any) => {
      const matchesSearch =
        !historySearch ||
        sale.saleNumber?.toLowerCase().includes(historySearch.toLowerCase()) ||
        (sale.customerDisplayName || "").toLowerCase().includes(historySearch.toLowerCase()) ||
        (sale.sellerName || "").toLowerCase().includes(historySearch.toLowerCase());

      const saleDate = sale.createdAt ? new Date(sale.createdAt) : null;
      const matchesFrom = !historyDateFrom || (saleDate && saleDate >= new Date(historyDateFrom + "T00:00:00"));
      const matchesTo = !historyDateTo || (saleDate && saleDate <= new Date(historyDateTo + "T23:59:59"));

      const matchesStatus = historyStatus === "all" || sale.status === historyStatus;

      return matchesSearch && matchesFrom && matchesTo && matchesStatus;
    });
  }, [historyDateFrom, historyDateTo, historySearch, historyStatus, salesList]);

  const handlePricingModeChange = (mode: "unit" | "discount" | "wholesale") => {
    setCurrentPricingMode(mode);
    setCartItems((current) =>
      current.map((item) => {
        const prod = products?.find((p: any) => p.id === item.productId);
        if (!prod) return item;
        let basePrice = prod.salePrice || 0;
        if (mode === "discount") basePrice = prod.discountPrice || prod.salePrice || 0;
        if (mode === "wholesale") basePrice = prod.wholesalePrice || prod.salePrice || 0;
        return { ...item, pricingType: mode, basePrice };
      })
    );
  };

  const addProductToCart = (product: any, forcedPricingType?: "unit" | "discount" | "wholesale") => {
    // Units (laptops/accesorios) don't have a stock field - they are single items
    const isUnit = product.category === "unit";
    if (!isUnit && product.stock <= 0) {
      toast.error("Ese producto no tiene stock disponible");
      return;
    }

    const mode = forcedPricingType || (selectedCustomerType === "wholesale" ? "wholesale" : currentPricingMode);
    let calculatedBasePrice = product.salePrice;
    if (mode === "discount") {
      calculatedBasePrice = product.discountPrice || product.salePrice;
    } else if (mode === "wholesale") {
      calculatedBasePrice = product.wholesalePrice || product.salePrice;
    }

    setCartItems((current) => {
      const existingIndex = current.findIndex((item) => item.productId === product.id);

      if (existingIndex >= 0) {
        // Units can only be sold once
        if (isUnit) {
          toast.error("Este equipo ya está en el carrito");
          return current;
        }
        const existing = current[existingIndex];
        if (existing.quantity >= product.stock) {
          toast.error(`Solo hay ${product.stock} unidades disponibles`);
          return current;
        }

        const updated = [...current];
        updated[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
        return updated;
      }

      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          stock: isUnit ? 1 : product.stock,
          quantity: 1,
          basePrice: calculatedBasePrice,
          pricingType: mode,
          discountType: "none",
          discountValue: 0,
        },
      ];
    });

    setProductSearch("");
    productSearchRef.current?.focus();
  };

  // Add a unit from a grouped product card — picks the first unit not already in cart
  const addGroupToCart = (
    group: { representative: any; units: any[]; count: number },
    forcedPricingType?: "unit" | "discount" | "wholesale"
  ) => {
    const alreadyInCart = new Set(cartItems.map((i) => i.productId));
    const nextUnit = group.units.find((u: any) => !alreadyInCart.has(u.id));
    if (!nextUnit) {
      toast.error("Todos los equipos de este tipo ya están en el carrito");
      return;
    }
    addProductToCart(toProductShape(nextUnit), forcedPricingType);
  };

  const updateCartItem = (productId: number, changes: Partial<CartItem>) => {
    setCartItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) return item;
        const next = { ...item, ...changes };
        if (next.quantity > item.stock) {
          toast.error(`Solo hay ${item.stock} unidades disponibles`);
          return item;
        }
        return next;
      })
    );
  };

  const removeCartItem = (productId: number) => {
    setCartItems((current) => current.filter((item) => item.productId !== productId));
  };

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomerId(customer.id);
    setAnonymousCustomerName(customer.name);
    setAnonymousCustomerPhone(customer.phone || "");
    setAnonymousCustomerTaxId(customer.taxId || "");
    const type = customer.customerType || "retail";
    setSelectedCustomerType(type);

    if (type === "wholesale") {
      setCartItems((current) =>
        current.map((item) => {
          const prod = products?.find((p: any) => p.id === item.productId);
          return {
            ...item,
            pricingType: "wholesale",
            basePrice: prod?.wholesalePrice || item.basePrice,
          };
        })
      );
    } else {
      setCartItems((current) =>
        current.map((item) => {
          const prod = products?.find((p: any) => p.id === item.productId);
          return {
            ...item,
            pricingType: "unit",
            basePrice: prod?.salePrice || item.basePrice,
          };
        })
      );
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId(null);
    setAnonymousCustomerName("");
    setAnonymousCustomerPhone("");
    setAnonymousCustomerTaxId("");
    setSelectedCustomerType("retail");
  };

  const openDetail = (saleId: number) => {
    setDetailSaleId(saleId);
    setCancelReason("");
    setIsDetailOpen(true);
  };

  const openSaleForm = (saleId: number) => {
    openDetail(saleId);
  };

  // Validación de crédito: todos los campos del cliente son requeridos
  const _selectedCustForValidation = selectedCustomerId
    ? (customers as any[] | undefined)?.find((c: any) => c.id === selectedCustomerId)
    : null;

  const creditDataComplete = paymentMethod !== "credit" || (
    _selectedCustForValidation
      ? Boolean(_selectedCustForValidation.phone?.trim() && _selectedCustForValidation.taxId?.trim())
      : Boolean((anonymousCustomerName || "").trim() && (anonymousCustomerPhone || "").trim() && (anonymousCustomerTaxId || "").trim())
  );

  const submitSale = () => {
    const isAdmin = user?.role === "admin";
    if (paymentMethod !== "credit" && !openingStatus?.hasActive && !isAdmin) {
      toast.error(`Caja cerrada: Para registrar ventas en ${paymentMethodLabel(paymentMethod)}, primero debes realizar la apertura de caja.`);
      return;
    }

    if (paymentMethod === "credit" && !creditDataComplete) {
      toast.error("Para ventas a crédito DEBES ingresar Nombre, Teléfono y NIT/CI del cliente obligatoriamente.");
      return;
    }

    // Para crédito, siempre paymentStatus = pending
    const resolvedPaymentStatus = paymentMethod === "credit" ? "pending" : paymentStatus;

    createSaleMutation.mutate({
      customerId: selectedCustomerId || undefined,
      customerName: selectedCustomerId ? undefined : (anonymousCustomerName || "").trim() || undefined,
      customerPhone: selectedCustomerId ? undefined : (anonymousCustomerPhone || "").trim() || undefined,
      customerTaxId: selectedCustomerId ? undefined : (anonymousCustomerTaxId || "").trim() || undefined,
      creditDays,
      warrantyDays,
      saleChannel,
      paymentMethod,
      paymentStatus: resolvedPaymentStatus,
      discountType: globalDiscountType,
      discountValue: globalDiscountValue,
      notes,
      customerType: selectedCustomerType,
      items: computedCart.items.map((item) => ({
        unitId: item.productId,
        pricingType: item.pricingType,
        quantity: item.quantity,
        basePrice: item.basePrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
      })),
    });
  };

  const detail = detailQuery.data;
  const totalSalesAmount = filteredSales.reduce((sum: number, sale: any) => sum + sale.total, 0);

  // Auto-refetch catalog and auto-focus product search when modal opens (for barcode scanner support)
  useEffect(() => {
    if (isCreateOpen) {
      utils.units.list.invalidate();
      const timer = setTimeout(() => {
        productSearchRef.current?.focus();
        productSearchRef.current?.select();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isCreateOpen, utils]);

  const handleLoadQuotation = (quotation: any, items: any[]) => {
    setActiveTab("sales");
    setIsCreateOpen(true);
    setCustomerSearch(quotation.customerDisplayName || "");
    setSelectedCustomerId(quotation.customerId || null);
    setAnonymousCustomerName(quotation.customerName || "");
    setGlobalDiscountType(quotation.discountType);
    setGlobalDiscountValue(quotation.discountValue);
    setNotes(quotation.notes || "");
    
    setCartItems(items.map(item => ({
      productId: item.unitId ?? item.productId,
      productName: item.productName,
      productCode: item.productCode,
      stock: 9999, // Hack to allow loading without failing stock validation immediately
      quantity: item.quantity,
      basePrice: item.basePrice,
      pricingType: item.pricingType || "unit",
      discountType: item.discountType,
      discountValue: item.discountValue
    })));
  };


  return (
    <div className="page-shell">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="page-container pt-6 pb-0 flex justify-center md:justify-start">
          <TabsList className="grid w-[360px] grid-cols-2 h-12 rounded-full bg-slate-200/60 p-1 shadow-inner border border-slate-200/80 mb-2">
            <TabsTrigger value="sales" className="rounded-full text-sm font-semibold h-full transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md">
              <ShoppingBag className="w-4 h-4 mr-2" /> Ventas
            </TabsTrigger>
            <TabsTrigger value="quotations" className="rounded-full text-sm font-semibold h-full transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <FileText className="w-4 h-4 mr-2" /> Cotizaciones
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="sales" className="mt-0">
          <div className="page-container space-y-6">
            <div className="flex flex-col gap-4 p-0 sm:p-2 md:p-4 md:flex-row md:items-center md:justify-between">
               
               <div className="relative z-10">
                 <div className="flex flex-wrap items-center gap-3">
                   <h1 className="text-4xl font-black tracking-tight text-slate-900">Gestión de <span className="text-emerald-500">Ventas</span></h1>
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
               </div>
               <div className="relative z-10 flex flex-col sm:flex-row gap-3">
                 <Button onClick={() => setIsCreateOpen(true)} className="h-14 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg gap-3 shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95">
                   <Plus className="h-6 w-6" />
                   Nueva Venta
                 </Button>
               </div>
             </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="bg-white border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Ventas registradas</CardTitle>
              <div className="min-h-full bg-slate-50 flex items-center justify-center p-4 rounded-lg">
                <ShoppingBag className="h-4 w-4 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{salesList?.length || 0}</div>
              <p className="text-[10px] text-slate-400 font-bold mt-1">TOTAL ACUMULADO</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-500">Total vendido</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <BadgeDollarSign className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-600">{formatCurrency(totalSalesAmount)}</div>
              <p className="text-[10px] text-emerald-500/70 font-bold mt-1">INGRESOS BRUTOS</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-500">Pendientes de cobro</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-600">
                {(salesList as any[] | undefined)?.filter((sale: any) => sale.paymentStatus === "pending" && sale.status !== "cancelled").length || 0}
              </div>
              <p className="text-[10px] text-amber-500/70 font-bold mt-1">POR REGULARIZAR</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.1em] text-blue-500">Próximo número</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-blue-600">{nextSaleData?.saleNumber || "..."}</div>
              <p className="text-[10px] text-blue-500/70 font-bold mt-1">ORDEN SIGUIENTE</p>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-none shadow-xl shadow-slate-100 rounded-[2.5rem]">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-8 py-6 border-b border-slate-50">
            <div 
              className="flex items-center justify-between w-full md:w-auto cursor-pointer md:cursor-default"
              onClick={() => isMobile && setIsFiltersVisible(!isFiltersVisible)}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <RotateCcw className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black text-slate-900">Historial de Operaciones</CardTitle>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Ventas y Anulaciones</p>
                </div>
              </div>
              <div className="md:hidden">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isFiltersVisible ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>

            <div className={`flex flex-col gap-3 md:flex-row w-full md:w-auto transition-all duration-300 ${isFiltersVisible ? 'flex' : 'hidden md:flex'}`}>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                <Input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Buscar por No. Venta o Cliente..."
                  className="w-full pl-9 md:w-80 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 shrink-0">Desde</span>
                <Input
                  type="date"
                  value={historyDateFrom}
                  onChange={(event) => setHistoryDateFrom(event.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50 text-sm w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 shrink-0">Hasta</span>
                <Input
                  type="date"
                  value={historyDateTo}
                  onChange={(event) => setHistoryDateTo(event.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50 text-sm w-40"
                />
              </div>
              {(historyDateFrom || historyDateTo) && (
                <button
                  onClick={() => { setHistoryDateFrom(""); setHistoryDateTo(""); }}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors shrink-0 px-2 self-center"
                  title="Limpiar fechas"
                >
                  ✕ Limpiar
                </button>
              )}
              <Select value={historyStatus} onValueChange={(value: "all" | "completed" | "cancelled") => setHistoryStatus(value)}>
                <SelectTrigger className="w-full md:w-44 h-11 rounded-xl border-slate-200 bg-slate-50/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="completed">Ventas Activas</SelectItem>
                  <SelectItem value="cancelled">Ventas Anuladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {isMobile ? (
              <div className="space-y-3">
                {isLoading ? (
                  <div className="py-10 text-center text-muted-foreground">Cargando ventas...</div>
                ) : filteredSales.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">No hay ventas que coincidan con el filtro.</div>
                ) : (
                  filteredSales.map((sale: any) => (
                    <div key={sale.id} className="group relative rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-black text-slate-900">{sale.saleNumber}</span>
                            <Badge variant={sale.status === "cancelled" ? "destructive" : "outline"} className={`rounded-full text-[10px] font-black uppercase ${sale.status !== 'cancelled' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ''}`}>
                              {saleStatusLabel(sale.status)}
                            </Badge>
                          </div>
                          <p className="text-sm font-bold text-slate-600 truncate max-w-[200px]">{sale.customerDisplayName || "Anónimo"}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                             <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center">
                               <UserRound className="h-3 w-3 text-slate-400" />
                             </div>
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{sale.sellerName || "Sin nombre"}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900">{formatCurrency(sale.total)}</p>
                          <div className="mt-1 flex flex-col items-end gap-1">
                            <Badge 
                              variant="outline"
                              className={`rounded-full text-[9px] font-black uppercase tracking-wider px-2 ${
                                sale.paymentMethod === "credit"
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : sale.paymentStatus === "completed" 
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {sale.paymentMethod === "credit" ? "Por Cobrar" : paymentStatusLabel(sale.paymentStatus)}
                            </Badge>
                            <span className="text-[10px] font-bold text-slate-400">{paymentMethodLabel(sale.paymentMethod)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 flex items-center gap-2">
                        <Button variant="outline" className="flex-1 h-11 rounded-2xl border-slate-200 text-slate-600 font-black text-xs gap-2" onClick={() => openDetail(sale.id)}>
                          <Eye className="h-4 w-4" />
                          VER DETALLE
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-2xl border-slate-200"
                          onClick={() => openSaleForm(sale.id)}
                          title="Ver formulario de venta"
                        >
                          <Printer className="h-4 w-4 text-slate-400" />
                        </Button>
                      </div>
                      <div className="absolute top-4 right-4 h-1 w-1 rounded-full bg-slate-100" />
                    </div>
                  ))
                )}
              </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      Cargando ventas...
                    </TableCell>
                  </TableRow>
                ) : filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No hay ventas que coincidan con el filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale: any) => (
                    <TableRow key={sale.id} className="group hover:bg-slate-50/80 transition-colors border-slate-100">
                      <TableCell className="font-black text-slate-900 py-5">{sale.saleNumber}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{sale.customerDisplayName || "Anónimo"}</span>
                          {sale.customerCode && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{sale.customerCode}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                           <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center">
                             <UserRound className="h-3.5 w-3.5 text-slate-400" />
                           </div>
                           <span className="font-medium text-slate-600">{sale.sellerName || "Sin nombre"}</span>
                         </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.status === "cancelled" ? "destructive" : "outline"} className={`rounded-full px-3 font-black text-[10px] uppercase tracking-widest ${sale.status !== 'cancelled' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ''}`}>
                          {saleStatusLabel(sale.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            {sale.paymentMethod === "cash" ? (
                              <Banknote className="h-3.5 w-3.5 text-emerald-500" />
                            ) : sale.paymentMethod === "qr" ? (
                              <QrCode className="h-3.5 w-3.5 text-violet-500" />
                            ) : sale.paymentMethod === "credit" ? (
                              <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                            ) : (
                              <ArrowLeftRight className="h-3.5 w-3.5 text-blue-500" />
                            )}
                            <span className="tracking-tight">{paymentMethodLabel(sale.paymentMethod)}</span>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`rounded-full text-[9px] font-black uppercase tracking-wider w-fit px-2 py-0 ${
                              sale.paymentMethod === "credit"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : sale.paymentStatus === "completed" 
                                ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {sale.paymentMethod === "credit" ? "Por Cobrar" : paymentStatusLabel(sale.paymentStatus)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-base font-black text-slate-900">{formatCurrency(sale.total)}</span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs font-medium">
                        {new Date(sale.createdAt).toLocaleString("es-BO", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 w-9 rounded-xl border-slate-200" 
                            onClick={() => openDetail(sale.id)}
                            title="Ver Detalle"
                          >
                            <Eye className="h-4 w-4 text-slate-600" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 w-9 rounded-xl border-slate-200" 
                            onClick={() => openSaleForm(sale.id)}
                            title="Ver formulario de venta"
                          >
                            <Printer className="h-4 w-4 text-slate-400" />
                          </Button>
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
      </div>

      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent
          className={
            isMobile
              ? "max-h-[94vh] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[1.6rem] border-white/70 bg-white/95 p-4 sm:max-w-[calc(100vw-1.5rem)] sm:p-6"
              : "flex flex-col h-[92vh] w-[min(1360px,96vw)] sm:max-w-[min(1360px,96vw)] overflow-hidden rounded-[1.8rem] border-slate-200/60 bg-white shadow-2xl shadow-slate-900/10 p-0"
          }
        >
          {/* Success overlay */}
          {showSuccess && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 rounded-[1.8rem]">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">¡Venta registrada!</p>
                  <p className="mt-1 text-muted-foreground">{lastSaleNumber ? `Comprobante #${lastSaleNumber}` : ""}</p>
                </div>
                <p className="text-sm text-muted-foreground">Redirigiendo...</p>
              </div>
            </div>
          )}

          <DialogHeader className={isMobile ? "" : "border-b border-slate-100 px-8 pt-6 pb-4 bg-gradient-to-r from-slate-50/80 to-white"}>
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <ShoppingBag className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <span className="font-black text-slate-900">Nueva Venta</span>
                {nextSaleData?.saleNumber && (
                  <span className="ml-2 text-sm font-bold text-slate-400">#{nextSaleData.saleNumber}</span>
                )}
              </div>
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Registra una venta con productos, descuentos y método de pago.
            </DialogDescription>
          </DialogHeader>

          <div className={isMobile ? "mt-6 space-y-6" : "grid min-h-0 flex-1 overflow-hidden gap-0 lg:grid-cols-[minmax(0,1.1fr)_420px]"}>
            <div className={isMobile ? "space-y-6" : "min-h-0 space-y-5 overflow-y-auto px-8 py-6"}>
              {/* ─── Cliente y condiciones (Diseño Compacto Unificado) ─── */}
              <Card className="border-slate-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5 text-slate-400" />
                    Cliente y Condiciones
                  </span>
                  {selectedCustomerId ? (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold py-0 h-5">
                        ✓ Cliente Registrado
                      </Badge>
                      {selectedCustomerType === "wholesale" && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold py-0 h-5">
                          Mayorista
                        </Badge>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleClearCustomer}
                        className="h-5 px-1.5 text-[11px] text-slate-400 hover:text-red-600 gap-1"
                        title="Cambiar cliente"
                      >
                        <X className="h-3 w-3" />
                        <span className="text-[10px]">Cambiar</span>
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
                  {/* Campo 1: Nombre / Buscador de Cliente */}
                  <div className="relative space-y-1 sm:col-span-1 lg:col-span-2">
                    <Label className="text-[11px] font-semibold text-slate-600">
                      Cliente (Escribe o busca):
                    </Label>
                    <div className="relative">
                      <UserRound className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={anonymousCustomerName}
                        onChange={(e) => {
                          setAnonymousCustomerName(e.target.value);
                          if (selectedCustomerId) setSelectedCustomerId(null);
                        }}
                        placeholder="Nombre del cliente o busca registrado..."
                        className="pl-8 h-9 text-sm focus:border-blue-500"
                      />
                    </div>

                    {/* Dropdown flotante de clientes encontrados */}
                    {filteredCustomers.length > 0 && !selectedCustomerId && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        <div className="px-2.5 py-1 bg-slate-50 border-b text-[10px] font-bold text-slate-400 uppercase">
                          Clientes Registrados Encontrados
                        </div>
                        {filteredCustomers.map((customer: any) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="flex items-center justify-between w-full px-3 py-2 text-left text-xs border-b last:border-b-0 hover:bg-blue-50 transition-colors"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <div>
                              <p className="font-bold text-slate-800">{customer.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {customer.phone ? `📞 ${customer.phone}` : "Sin teléfono"}
                                {customer.taxId ? ` · CI/NIT: ${customer.taxId}` : ""}
                              </p>
                            </div>
                            {customer.customerType === "wholesale" && (
                              <Badge className="bg-amber-100 text-amber-800 text-[9px] py-0 h-4 border-none">
                                Mayorista
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Campo 2: Teléfono / WhatsApp (en la misma fila) */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">
                      Teléfono / WhatsApp:
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={anonymousCustomerPhone}
                        onChange={(e) => setAnonymousCustomerPhone(e.target.value)}
                        placeholder="ej. 70012345 (opcional)"
                        className="pl-8 h-9 text-sm"
                      />
                    </div>
                  </div>

                  {/* Campo 3: Canal de Venta */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">
                      Canal:
                    </Label>
                    <Select value={saleChannel} onValueChange={(value: "local" | "delivery") => setSaleChannel(value)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Tienda / Local</SelectItem>
                        <SelectItem value="delivery">A Domicilio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Si es venta a crédito, mostrar campo de NIT/CI en fila compacta */}
                {paymentMethod === "credit" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-amber-800">
                        NIT / CI del Cliente * (Requerido para crédito):
                      </Label>
                      <Input
                        value={anonymousCustomerTaxId}
                        onChange={(e) => setAnonymousCustomerTaxId(e.target.value)}
                        placeholder="Número de CI o NIT..."
                        className="h-9 text-sm border-amber-300 focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-amber-800">
                        Días de Crédito:
                      </Label>
                      <Input
                        type="number"
                        value={creditDays}
                        onChange={(e) => setCreditDays(parseInt(e.target.value) || 30)}
                        className="h-9 text-sm border-amber-300"
                      />
                    </div>
                  </div>
                )}
              </Card>

              <Card className={isMobile ? "" : "border-slate-100 shadow-sm hover:shadow-md transition-shadow"}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4 text-slate-400" />
                      Productos
                    </CardTitle>

                    {/* Selector de Nivel de Precio de Venta */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight px-1.5 hidden sm:inline">Precio:</span>
                      <button
                        type="button"
                        onClick={() => handlePricingModeChange("unit")}
                        className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                          currentPricingMode === "unit"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-white/80"
                        }`}
                        title="Precio de Venta Sugerido (Unitario)"
                      >
                        💰 Unit.
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePricingModeChange("discount")}
                        className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                          currentPricingMode === "discount"
                            ? "bg-amber-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-white/80"
                        }`}
                        title="Precio con Descuento"
                      >
                        🏷️ Desc.
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePricingModeChange("wholesale")}
                        className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                          currentPricingMode === "wholesale"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-white/80"
                        }`}
                        title="Precio por Mayor"
                      >
                        📦 Mayor
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <div className="flex gap-2">
                      <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                        <Input
                          ref={productSearchRef}
                          autoFocus
                          value={productSearch}
                          onChange={(event) => setProductSearch(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && filteredProducts.length > 0) {
                              addProductToCart(toProductShape(filteredProducts[0]));
                            }
                          }}
                          placeholder="Buscar producto (Ctrl+B)..."
                          className="pl-9 pr-16 h-12 rounded-2xl border-white/70 bg-white/75"
                        />
                        <kbd className="absolute right-2 top-3 hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
                          Ctrl+B
                        </kbd>
                      </div>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-12 w-12 rounded-2xl bg-white/75 border-white/70 shadow-sm"
                        onClick={() => setProductSearch("")}
                        title="Ver Catálogo"
                      >
                        <Grid className="h-5 w-5 text-slate-600" />
                      </Button>
                    </div>
                  </div>

                  {productSearch.length > 0 ? (
                    groupedProducts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200">
                      {groupedProducts.map((group) => {
                        const u = group.representative;
                        const activePrice =
                          currentPricingMode === "discount" ? (u.discountPrice || u.salePrice || 0) :
                          currentPricingMode === "wholesale" ? (u.wholesalePrice || u.salePrice || 0) :
                          (u.salePrice || 0);

                        // How many of this group are already in the cart
                        const alreadyInCart = cartItems.filter((ci) =>
                          group.units.some((gu: any) => gu.id === ci.productId)
                        ).length;
                        const remaining = group.count - alreadyInCart;

                        return (
                          <div
                            key={`${u.brand}|${u.model}|${u.salePrice}`}
                            className={`group relative flex flex-col p-3 rounded-2xl border transition-all text-left shadow-sm cursor-pointer ${
                              remaining <= 0
                                ? "opacity-50 cursor-not-allowed border-slate-100 bg-slate-50"
                                : "border-slate-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/20 hover:shadow-md"
                            }`}
                            onClick={() => remaining > 0 && addGroupToCart(group)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-emerald-100 transition-colors shrink-0">
                                <Package className="h-5 w-5 text-slate-500 group-hover:text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-900 truncate text-sm">{u.brand} {u.model}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {group.count} unidad{group.count !== 1 ? "es" : ""} disponible{group.count !== 1 ? "s" : ""}
                                  {alreadyInCart > 0 && (
                                    <span className="ml-1 text-amber-600">· {alreadyInCart} en carrito</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-black text-slate-900 text-sm">{formatCurrency(activePrice)}</div>
                                <div className={`text-[10px] font-bold ${remaining > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                                  {remaining > 0 ? `${remaining} disponible${remaining !== 1 ? "s" : ""}` : "Agotado"}
                                </div>
                              </div>
                            </div>

                            {/* 3 Precios Desglosados */}
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                              <span
                                onClick={(e) => { e.stopPropagation(); remaining > 0 && addGroupToCart(group, "unit"); }}
                                className={`px-1.5 py-0.5 rounded ${currentPricingMode === "unit" ? "bg-blue-100 text-blue-800 font-black" : "text-slate-500 hover:bg-slate-100"}`}
                              >
                                Unit: {formatCurrency(u.salePrice || 0)}
                              </span>
                              <span
                                onClick={(e) => { e.stopPropagation(); remaining > 0 && addGroupToCart(group, "discount"); }}
                                className={`px-1.5 py-0.5 rounded ${currentPricingMode === "discount" ? "bg-amber-100 text-amber-800 font-black" : "text-slate-500 hover:bg-slate-100"}`}
                              >
                                Desc: {formatCurrency(u.discountPrice || u.salePrice || 0)}
                              </span>
                              <span
                                onClick={(e) => { e.stopPropagation(); remaining > 0 && addGroupToCart(group, "wholesale"); }}
                                className={`px-1.5 py-0.5 rounded ${currentPricingMode === "wholesale" ? "bg-emerald-100 text-emerald-800 font-black" : "text-slate-500 hover:bg-slate-100"}`}
                              >
                                Mayor: {formatCurrency(u.wholesalePrice || u.salePrice || 0)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    ) : (
                    <div className="py-8 text-center rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50">
                      <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 font-medium">No se encontraron productos para "{productSearch}"</p>
                    </div>
                    )
                  ) : totalAvailable === 0 ? (
                    <div className="py-8 text-center rounded-2xl border-2 border-dashed border-emerald-100 bg-emerald-50/30">
                      <Package className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
                      <p className="text-sm text-emerald-700 font-semibold">Sin equipos disponibles</p>
                      <p className="text-xs text-slate-400 mt-1">Marca unidades como <strong>Disponible</strong> desde el Catálogo</p>
                    </div>
                  ) : (
                    <div className="py-6 text-center rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/30">
                      <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 font-semibold">Escribe en el buscador para encontrar productos</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {totalAvailable} equipo{totalAvailable !== 1 ? "s" : ""} disponible{totalAvailable !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}

                  {isMobile ? (
                    <div className="space-y-2">
                      {computedCart.items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <Package className="mb-3 h-10 w-10 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">Agrega productos para comenzar.</p>
                        </div>
                      ) : (
                        computedCart.items.map((item) => (
                          <div key={item.productId} className="flex items-center gap-3 rounded-xl border bg-white px-3 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{item.productName}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                 <Badge variant={item.pricingType === "unit" ? "default" : "outline"} className="text-[8px] h-4 px-1" onClick={() => updateCartItem(item.productId, { pricingType: "unit", basePrice: products?.find((p: any) => p.id === item.productId)?.salePrice || item.basePrice })}>U</Badge>
                                <Badge variant={item.pricingType === "discount" ? "default" : "outline"} className="text-[8px] h-4 px-1" onClick={() => updateCartItem(item.productId, { pricingType: "discount", basePrice: products?.find((p: any) => p.id === item.productId)?.discountPrice || item.basePrice })}>D</Badge>
                                <Badge variant={item.pricingType === "wholesale" ? "default" : "outline"} className="text-[8px] h-4 px-1" onClick={() => updateCartItem(item.productId, { pricingType: "wholesale", basePrice: products?.find((p: any) => p.id === item.productId)?.wholesalePrice || item.basePrice })}>M</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(item.basePrice)} c/u</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateCartItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateCartItem(item.productId, { quantity: Math.min(item.stock, item.quantity + 1) })}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="w-20 text-right">
                              <p className="text-sm font-semibold">{formatCurrency(item.subtotal)}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCartItem(item.productId)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {computedCart.items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/30">
                          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <ShoppingBag className="h-8 w-8 text-slate-300" />
                          </div>
                          <p className="text-slate-500 font-bold">Carrito vacío</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Empieza buscando productos para agregarlos a la venta</p>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="mt-6 rounded-xl border-slate-200 text-slate-600 font-bold h-9"
                            onClick={() => productSearchRef.current?.focus()}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Buscar Productos
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Lista de Artículos</h3>
                            <Button variant="ghost" size="sm" onClick={clearCart} className="h-7 text-[10px] font-black text-red-500 uppercase hover:bg-red-50 hover:text-red-600">
                              <RotateCcw className="h-3 w-3 mr-1" /> Vaciado rápido
                            </Button>
                          </div>
                          {computedCart.items.map((item) => (
                            <div key={item.productId} className="group relative flex items-center gap-4 p-4 rounded-3xl border border-slate-100 bg-white hover:border-slate-200 transition-all shadow-sm">
                              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:scale-105 transition-transform">
                                <Package className="h-6 w-6 text-slate-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-900 truncate">{item.productName}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    <button 
                                      onClick={() => updateCartItem(item.productId, { pricingType: "unit", basePrice: products?.find((p: any) => p.id === item.productId)?.salePrice || 0 })}
                                      className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all ${item.pricingType === "unit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                      UNIT.
                                    </button>
                                    <button 
                                      onClick={() => updateCartItem(item.productId, { pricingType: "discount", basePrice: products?.find((p: any) => p.id === item.productId)?.discountPrice || 0 })}
                                      className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all ${item.pricingType === "discount" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                      DESC.
                                    </button>
                                    <button 
                                      onClick={() => updateCartItem(item.productId, { pricingType: "wholesale", basePrice: products?.find((p: any) => p.id === item.productId)?.wholesalePrice || 0 })}
                                      className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all ${item.pricingType === "wholesale" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                      MAYOR.
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-500">{formatCurrency(item.basePrice)}</span>
                                    {item.discountAmount > 0 && (
                                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] h-4 px-1.5 font-black">
                                        - {formatCurrency(item.discountAmount)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                                  onClick={() => updateCartItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}
                                >
                                  <Minus className="h-3 w-3 text-slate-600" />
                                </Button>
                                <Input
                                   type="number"
                                   min="1"
                                   step="any"
                                   onFocus={(e) => e.target.select()}
                                   max={item.stock}
                                   value={item.quantity}
                                   onChange={(event) => updateCartItem(item.productId, { quantity: Math.max(1, parseInt(event.target.value || "1", 10)) })}
                                   className="h-8 w-12 text-center text-sm font-black bg-transparent border-none focus-visible:ring-0"
                                 />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                                  onClick={() => updateCartItem(item.productId, { quantity: Math.min(item.stock, item.quantity + 1) })}
                                >
                                  <Plus className="h-3 w-3 text-slate-600" />
                                </Button>
                              </div>
                              <div className="w-24 text-right">
                                <p className="font-black text-slate-900">{formatCurrency(item.subtotal)}</p>
                              </div>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors" onClick={() => removeCartItem(item.productId)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className={isMobile ? "space-y-6" : "min-h-0 space-y-5 overflow-y-auto border-t border-slate-100 pt-6 lg:border-t-0 lg:border-l lg:border-slate-100 lg:bg-gradient-to-b lg:from-slate-50/80 lg:to-white lg:px-6 lg:py-6"}>              
              <div className="space-y-4">
                {/* Resumen tipo ticket */}
                <div className="rounded-[2.2rem] border-2 border-slate-900 bg-white shadow-xl overflow-hidden relative">
                   {/* Decorative circle for punch-hole effect */}
                   <div className="absolute left-[-10px] top-[140px] h-5 w-5 rounded-full bg-slate-50 border-2 border-slate-900 z-10" />
                   <div className="absolute right-[-10px] top-[140px] h-5 w-5 rounded-full bg-slate-50 border-2 border-slate-900 z-10" />
                   
                  <div className="bg-slate-900 px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <span className="font-black uppercase tracking-widest text-xs">Venta Directa</span>
                      </div>
                      <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-none font-black text-[10px]">OFICIAL</Badge>
                    </div>
                    <div className="mt-4">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Comprobante No.</p>
                      <p className="text-lg font-black font-mono tracking-tighter">
                        {nextSaleData?.saleNumber ? nextSaleData.saleNumber : "VTA-000"}
                      </p>
                    </div>
                  </div>

                  <div className="bg-emerald-600 px-6 py-6 text-white border-b border-white/10 relative overflow-hidden">
                    {/* Background pattern */}
                    <div className="absolute top-[-20%] right-[-10%] h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100 mb-1">Total Final</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black">{formatCurrency(computedCart.total).split(' ')[1]}</span>
                      <span className="text-sm font-bold opacity-80">Bs.</span>
                    </div>
                  </div>

                  <div className="px-6 py-5 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Artículos</span>
                      <span className="font-black text-slate-900">{computedCart.items.reduce((sum, i) => sum + i.quantity, 0)} uds.</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Subtotal</span>
                      <span className="font-bold text-slate-900">{formatCurrency(computedCart.subtotal)}</span>
                    </div>
                    
                    {/* Dashed line */}
                    <div className="py-2">
                      <div className="border-t border-dashed border-slate-200 w-full" />
                    </div>

                    {(computedCart.globalDiscountAmount > 0 || computedCart.items.reduce((sum, i) => sum + i.discountAmount, 0) > 0) && (
                      <div className="flex items-center justify-between text-emerald-600 bg-emerald-50/50 p-2 rounded-xl border border-emerald-100">
                        <div className="flex items-center gap-1.5">
                          <BadgeDollarSign className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Ahorro total</span>
                        </div>
                        <span className="font-black">-{formatCurrency(computedCart.globalDiscountAmount + computedCart.items.reduce((sum, i) => sum + i.discountAmount, 0))}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Fecha</span>
                      <span className="font-medium text-slate-600">{new Date().toLocaleDateString('es-BO')}</span>
                    </div>
                  </div>
                  <div className="px-6 pb-6 pt-2">
                    <div className="flex items-center justify-center min-h-full text-[9px] text-slate-300 font-bold uppercase tracking-widest">
                      <div className="h-1 w-1 rounded-full bg-slate-200" />
                      Gracias por su preferencia
                      <div className="h-1 w-1 rounded-full bg-slate-200" />
                    </div>
                  </div>
                </div>

                {/* Descuento global */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BadgeDollarSign className="h-4 w-4 text-emerald-600" />
                      Descuento global
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select value={globalDiscountType} onValueChange={(value: DiscountType) => {
                      setGlobalDiscountType(value);
                      setGlobalDiscountValue(0);
                    }}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin descuento</SelectItem>
                        <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                        <SelectItem value="fixed">Monto fijo (Bs)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Input
                         type="number"
                         min="0"
                         step="any"
                         onFocus={(e) => e.target.select()}
                         disabled={globalDiscountType === "none"}
                         value={globalDiscountType === "fixed" ? globalDiscountValue / 100 : globalDiscountValue}
                         onChange={(event) => {
                           if (globalDiscountType === "fixed") {
                             setGlobalDiscountValue(parsePrice(event.target.value || "0"));
                             return;
                           }
                           setGlobalDiscountValue(Math.max(0, Math.round(parseFloat(event.target.value || "0"))));
                         }}
                         className="pr-12"
                         placeholder={globalDiscountType === "percentage" ? "Ej: 10" : "Ej: 5.00"}
                       />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {globalDiscountType === "percentage" ? "%" : "Bs"}
                      </span>
                    </div>
                    {computedCart.globalDiscountAmount > 0 && (
                      <p className="text-xs text-emerald-600 font-medium">
                        Ahorro: {formatCurrency(computedCart.globalDiscountAmount)}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Método de pago destacado */}
                <Card className={isMobile ? "" : "border-slate-100 shadow-sm"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-slate-400" />
                      Forma de pago
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2">
                      {(["cash", "qr", "transfer", "credit"] as PaymentMethod[]).map((method) => {
                        const isActive = paymentMethod === method;
                        const icon = method === "cash" ? <Banknote className="h-5 w-5" /> : method === "qr" ? <QrCode className="h-5 w-5" /> : method === "credit" ? <CreditCard className="h-5 w-5" /> : <ArrowLeftRight className="h-5 w-5" />;
                        const colors = method === "cash"
                          ? isActive ? "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50"
                          : method === "qr"
                          ? isActive ? "border-violet-500 bg-violet-500 text-white shadow-lg shadow-violet-500/25" : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50/50"
                          : method === "credit"
                          ? isActive ? "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/25" : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/50"
                          : isActive ? "border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/25" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50";
                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(method);
                              if (method === "credit") setPaymentStatus("pending");
                            }}
                            className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center text-xs font-bold transition-all duration-200 ${colors}`}
                          >
                            {icon}
                            {method === "cash" ? "Efectivo" : method === "qr" ? "QR" : method === "credit" ? "Crédito" : "Transfer."}
                          </button>
                        );
                      })}
                    </div>
                    {paymentMethod === "cash" && (
                      <p className="mt-3 text-[11px] text-center text-slate-400 font-medium">
                        Pago en efectivo al momento de la venta
                      </p>
                    )}
                    {paymentMethod === "qr" && (
                      <p className="mt-3 text-[11px] text-center text-slate-400 font-medium">
                        Pago mediante código QR
                      </p>
                    )}
                    {paymentMethod === "transfer" && (
                      <p className="mt-3 text-[11px] text-center text-slate-400 font-medium">
                        Pago por transferencia bancaria
                      </p>
                    )}
                    {paymentMethod === "credit" && (
                      <div className="mt-3 p-3 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-3">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                          <CreditCard className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Configuración de Venta a Crédito</span>
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                            Plazo de Pago (Días)
                          </Label>
                          <Select value={String(creditDays)} onValueChange={(val) => setCreditDays(Number(val))}>
                            <SelectTrigger className="bg-white rounded-xl h-9 text-xs border-amber-300 font-semibold">
                              <SelectValue placeholder="Seleccionar plazo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">7 Días (1 Semana)</SelectItem>
                              <SelectItem value="15">15 Días (Quincenal)</SelectItem>
                              <SelectItem value="30">30 Días (1 Mes - Estándar)</SelectItem>
                              <SelectItem value="45">45 Días</SelectItem>
                              <SelectItem value="60">60 Días (2 Meses)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="p-2 bg-white/90 rounded-xl border border-amber-200 text-xs flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Fecha Límite:</span>
                          <span className="font-black text-amber-700 font-mono">
                            {(() => {
                              const d = new Date();
                              d.setDate(d.getDate() + creditDays);
                              return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                            })()}
                          </span>
                        </div>

                        {!creditDataComplete && (
                          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                            <div>
                              <p className="font-extrabold text-red-800">Faltan datos del cliente</p>
                              <p className="text-[11px] text-red-600 font-medium">Debes completar Nombre, Teléfono y NIT/CI para habilitar la venta a crédito.</p>
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-amber-700 italic">
                          * Se registrará una Cuenta por Cobrar (CXC) a nombre del cliente.
                        </p>
                      </div>
                    )}
                    {(!openingStatus?.hasActive && user?.role !== "admin") && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold flex items-center gap-2">
                        <XCircle className="h-4 w-4 shrink-0" />
                        LA CAJA DE {paymentMethodLabel(paymentMethod).toUpperCase()} ESTÁ CERRADA. ABRA LA CAJA EN FINANZAS.
                      </div>
                    )}
                    {(!openingStatus?.hasActive && user?.role === "admin") && (
                      <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold flex items-center gap-2">
                        <BadgeDollarSign className="h-4 w-4 shrink-0" />
                        MODO ADMIN: REGISTRANDO VENTA SIN APERTURA DE CAJA PROPIA.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Garantía */}
                <Card className="border-blue-200 bg-blue-50/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-blue-800 font-bold">
                      <Shield className="h-5 w-5 text-blue-600" />
                      Garantía del Equipo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Select value={String(warrantyDays)} onValueChange={(val) => setWarrantyDays(parseInt(val))}>
                      <SelectTrigger className="bg-background text-sm font-semibold border-blue-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">🛡️ 15 Días de Garantía</SelectItem>
                        <SelectItem value="30">🛡️ 30 Días de Garantía (Recomendado)</SelectItem>
                        <SelectItem value="60">🛡️ 60 Días de Garantía</SelectItem>
                        <SelectItem value="90">🛡️ 90 Días (3 Meses)</SelectItem>
                        <SelectItem value="180">🛡️ 180 Días (6 Meses)</SelectItem>
                        <SelectItem value="0">❌ Sin Garantía</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      * Se creará automáticamente un registro de garantía activa en el Módulo de Garantías.
                    </p>
                  </CardContent>
                </Card>

                {/* Notas */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Observaciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Notas opcionales de la venta..."
                      className="text-sm min-h-[72px]"
                      rows={3}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <DialogFooter className={isMobile ? "gap-2" : "border-t border-slate-100 bg-gradient-to-r from-slate-50/60 to-white px-8 py-4 gap-3"}>
            <Button
              variant="outline"
              onClick={() => { setIsCreateOpen(false); resetForm(); }}
              className={isMobile ? "" : "min-w-36 h-12 rounded-xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50"}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Cancelar
            </Button>
            <Button
              onClick={submitSale}
              disabled={
                createSaleMutation.isPending || 
                computedCart.items.length === 0 || 
                (paymentMethod !== "credit" && !openingStatus?.hasActive && user?.role !== "admin") ||
                !creditDataComplete
              }
              className={`${isMobile ? "gap-2 flex-1" : "min-w-72 gap-2.5 h-12 rounded-xl text-base"} ${
                paymentMethod === "credit" && !creditDataComplete 
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none hover:bg-slate-300" 
                  : "bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-600/20 transition-all hover:shadow-xl hover:shadow-emerald-600/30"
              }`}
            >
              {createSaleMutation.isPending ? (
                "Registrando..."
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  {paymentMethod === "credit" ? "Registrar Crédito · " : "Registrar Venta · "}{formatCurrency(computedCart.total)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[1.6rem] border-white/70 bg-white/95 p-4 sm:max-w-[min(960px,94vw)] sm:p-6">
          <DialogHeader>
            <DialogTitle>Formulario de venta</DialogTitle>
            <DialogDescription>
              Comprobante generado al momento de registrar la venta.
            </DialogDescription>
          </DialogHeader>

          {!detail ? (
            <div className="py-10 text-center text-muted-foreground">Cargando detalle...</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Venta</CardTitle>
                  </CardHeader>
                  <CardContent className="font-bold">{detail.sale.saleNumber}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="font-bold">{detail.sale.customerDisplayName || "Anónimo"}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Estado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={detail.sale.status === "cancelled" ? "destructive" : "default"}>
                      {detail.sale.status === "cancelled" ? "Anulada" : "Activa"}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Pago</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div>{paymentMethodLabel(detail.sale.paymentMethod)}</div>
                    <Badge variant={detail.sale.paymentStatus === "completed" ? "outline" : "secondary"}>
                      {detail.sale.paymentStatus === "completed" ? "Pagada" : "Pendiente"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {isMobile ? (
                <div className="space-y-3">
                  {(detail.items || []).map((item: any) => (
                    <div key={item.id} className="rounded-[1.3rem] border border-white/70 bg-white/85 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.productCode}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          x{item.quantity}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-white/70 bg-slate-50/80 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Base</p>
                          <p className="mt-1 font-semibold">{formatCurrency(item.basePrice)}</p>
                        </div>
                        <div className="rounded-xl border border-white/70 bg-slate-50/80 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Final</p>
                          <p className="mt-1 font-semibold">{formatCurrency(item.finalUnitPrice || item.basePrice)}</p>
                        </div>
                        <div className="rounded-xl border border-white/70 bg-slate-50/80 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Descuento</p>
                          <p className="mt-1 font-semibold">{formatCurrency(item.discountAmount || 0)}</p>
                        </div>
                        <div className="rounded-xl border border-white/70 bg-slate-50/80 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Subtotal</p>
                          <p className="mt-1 font-bold text-slate-900">{formatCurrency(item.subtotal)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Final</TableHead>
                      <TableHead className="text-right">Desc.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.items || []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.productCode}</div>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.basePrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.finalUnitPrice || item.basePrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.discountAmount || 0)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="grid gap-6 md:grid-cols-[1fr,320px]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notas y auditoría</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div><strong>Vendedor:</strong> {detail.sale.sellerName || "Sin nombre"}</div>
                    <div><strong>Fecha:</strong> {new Date(detail.sale.createdAt).toLocaleString("es-BO")}</div>
                    <div><strong>Canal:</strong> {detail.sale.saleChannel === "delivery" ? "Entrega" : "Local"}</div>
                    {detail.sale.notes ? <div><strong>Notas:</strong> {detail.sale.notes}</div> : null}
                    {detail.sale.cancelReason ? <div><strong>Motivo de anulación:</strong> {detail.sale.cancelReason}</div> : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Totales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <strong>{formatCurrency(detail.sale.subtotal)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Descuento global</span>
                      <strong>{formatCurrency(detail.sale.discountAmount || 0)}</strong>
                    </div>
                    <div className="flex items-center justify-between border-t pt-3 text-lg">
                      <span className="font-semibold">Total</span>
                      <strong>{formatCurrency(detail.sale.total)}</strong>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => printSaleTicket(detail)}>
                    <Printer className="h-4 w-4" />
                    Imprimir ticket
                  </Button>
                  {user?.role === "admin" && detail.sale.paymentStatus === "pending" && detail.sale.status !== "cancelled" ? (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => markPaidMutation.mutate({ saleId: detail.sale.id })}
                      disabled={markPaidMutation.isPending}
                    >
                      <Wallet className="h-4 w-4" />
                      Marcar como pagada
                    </Button>
                  ) : null}
                </div>

                {user?.role === "admin" && detail.sale.status !== "cancelled" ? (
                  <div className="w-full space-y-2 md:w-[420px]">
                    <Label>Anular venta</Label>
                    <div className="flex gap-2">
                      <Input
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                        placeholder="Motivo de la anulación"
                      />
                      <Button
                        variant="destructive"
                        className="gap-2"
                        onClick={() => cancelSaleMutation.mutate({ saleId: detail.sale.id, reason: cancelReason })}
                        disabled={cancelSaleMutation.isPending || (cancelReason || "").trim().length < 3}
                      >
                        <XCircle className="h-4 w-4" />
                        Anular
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>
        <TabsContent value="quotations" className="mt-0">
          <div className="page-container space-y-6">
            <QuotationsView onSelectQuotation={handleLoadQuotation} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
