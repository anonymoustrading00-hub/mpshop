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
  Info,
  X
} from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import jsPDF from "jspdf";
import "jspdf-autotable";

function getUnitTypeBadge(type?: string) {
  const t = (type || "").toLowerCase();
  switch (t) {
    case "charger":
      return { label: "Cargador", icon: "🔌", color: "bg-amber-50 text-amber-700 border-amber-200" };
    case "laptop":
      return { label: "Laptop", icon: "💻", color: "bg-blue-50 text-blue-700 border-blue-200" };
    case "monitor":
      return { label: "Monitor", icon: "🖥️", color: "bg-purple-50 text-purple-700 border-purple-200" };
    case "desktop":
      return { label: "PC Escritorio", icon: "🖥️", color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    case "phone":
    case "tablet":
      return { label: "Celular / Tab", icon: "📱", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "printer":
      return { label: "Impresora", icon: "🖨️", color: "bg-slate-50 text-slate-700 border-slate-200" };
    case "component":
      return { label: "Componente", icon: "⚙️", color: "bg-zinc-50 text-zinc-700 border-zinc-200" };
    case "accessory":
      return { label: "Accesorio", icon: "📦", color: "bg-orange-50 text-orange-700 border-orange-200" };
    default:
      return { label: type ? (type === "charger" ? "Cargador" : type) : "Equipo", icon: "📦", color: "bg-slate-50 text-slate-700 border-slate-200" };
  }
}

function getSpecsSummary(specs: any, damageNotes?: string): string {
  if (!specs) return damageNotes || "";
  if (typeof specs === "string") return specs;
  if (typeof specs === "object") {
    const parts: string[] = [];
    if (specs.watts) parts.push(`${specs.watts}W`);
    if (specs.voltage && specs.amperage) parts.push(`${specs.voltage}V ${specs.amperage}A`);
    else if (specs.voltage) parts.push(`${specs.voltage}V`);
    else if (specs.amperage) parts.push(`${specs.amperage}A`);
    if (specs.connector) parts.push(specs.connector);
    if (specs.cpu) parts.push(specs.cpu);
    if (specs.ram) parts.push(specs.ram);
    if (specs.storage) parts.push(specs.storage);
    if (specs.screen) parts.push(specs.screen);
    if (specs.gpu) parts.push(specs.gpu);
    if (parts.length > 0) return parts.join(" • ");
    return Object.entries(specs)
      .filter(([k, v]) => v && typeof v !== "object" && k !== "id")
      .map(([k, v]) => `${k}: ${v}`)
      .slice(0, 3)
      .join(" • ");
  }
  return damageNotes || "";
}

type DiscountType = "none" | "percentage" | "fixed";
type PaymentMethod = "cash" | "qr" | "transfer" | "credit";
type PaymentStatus = "pending" | "completed";

type CartItem = {
  productId: number;
  productName: string;
  productCode: string;
  unitType?: string;
  brand?: string;
  model?: string;
  specs?: any;
  serialNumber?: string;
  condition?: string;
  damageNotes?: string;
  location?: string;
  purchasePrice?: number;
  rawUnit?: any;
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

function numeroALetras(montoCentavos: number): string {
  const total = montoCentavos / 100;
  const entero = Math.floor(total);
  const centavos = Math.round((total - entero) * 100);
  const centavosStr = String(centavos).padStart(2, "0") + "/100";

  function unidades(num: number): string {
    switch (num) {
      case 1: return "UN";
      case 2: return "DOS";
      case 3: return "TRES";
      case 4: return "CUATRO";
      case 5: return "CINCO";
      case 6: return "SEIS";
      case 7: return "SIETE";
      case 8: return "OCHO";
      case 9: return "NUEVE";
      default: return "";
    }
  }

  function decenasY(strSin: string, numUnidades: number): string {
    if (numUnidades > 0) return `${strSin} Y ${unidades(numUnidades)}`;
    return strSin;
  }

  function decenas(num: number): string {
    if (num < 10) return unidades(num);
    if (num >= 11 && num <= 19) {
      switch (num) {
        case 11: return "ONCE";
        case 12: return "DOCE";
        case 13: return "TRECE";
        case 14: return "CATORCE";
        case 15: return "QUINCE";
        case 16: return "DIECISEIS";
        case 17: return "DIECISIETE";
        case 18: return "DIECIOCHO";
        case 19: return "DIECINUEVE";
      }
    }
    const d = Math.floor(num / 10);
    const u = num % 10;
    switch (d) {
      case 1: return "DIEZ";
      case 2: return u === 0 ? "VEINTE" : `VEINTI${unidades(u)}`;
      case 3: return decenasY("TREINTA", u);
      case 4: return decenasY("CUARENTA", u);
      case 5: return decenasY("CINCUENTA", u);
      case 6: return decenasY("SESENTA", u);
      case 7: return decenasY("SETENTA", u);
      case 8: return decenasY("OCHENTA", u);
      case 9: return decenasY("NOVENTA", u);
      default: return "";
    }
  }

  function centenas(num: number): string {
    if (num === 100) return "CIEN";
    if (num < 100) return decenas(num);
    const c = Math.floor(num / 100);
    const resto = num % 100;
    let textoC = "";
    switch (c) {
      case 1: textoC = "CIENTO"; break;
      case 2: textoC = "DOSCIENTOS"; break;
      case 3: textoC = "TRESCIENTOS"; break;
      case 4: textoC = "CUATROCIENTOS"; break;
      case 5: textoC = "QUINIENTOS"; break;
      case 6: textoC = "SEISCIENTOS"; break;
      case 7: textoC = "SETECIENTOS"; break;
      case 8: textoC = "OCHOCIENTOS"; break;
      case 9: textoC = "NOVECIENTOS"; break;
    }
    return resto === 0 ? textoC : `${textoC} ${decenas(resto)}`;
  }

  function seccion(num: number, divisor: number, strSingular: string, strPlural: string): string {
    const cientos = Math.floor(num / divisor);
    if (cientos > 0) {
      if (cientos > 1) {
        return `${centenas(cientos)} ${strPlural}`;
      } else {
        return strSingular;
      }
    }
    return "";
  }

  function miles(num: number): string {
    const divisor = 1000;
    const cientos = Math.floor(num / divisor);
    const resto = num - cientos * divisor;
    const strMiles = seccion(num, divisor, "UN MIL", "MIL");
    const strCentenas = centenas(resto);
    if (strMiles === "") return strCentenas;
    return `${strMiles} ${strCentenas}`.trim();
  }

  function millones(num: number): string {
    if (num === 0) return "CERO";
    const divisor = 1000000;
    const cientos = Math.floor(num / divisor);
    const resto = num - cientos * divisor;
    const strMillones = seccion(num, divisor, "UN MILLON", "MILLONES");
    const strMiles = miles(resto);
    if (strMillones === "") return strMiles;
    return `${strMillones} ${strMiles}`.trim();
  }

  return `${millones(entero)} ${centavosStr} BOLIVIANOS`;
}

function printSaleTicket(detail: any, companyConfig?: any) {
  if (!detail?.sale) {
    toast.error("Abre el detalle de la venta antes de imprimir");
    return;
  }

  const sale = detail.sale;
  const items = detail.items || [];
  const isCancelled = sale.status === "cancelled";

  const companyName = companyConfig?.name || "HK EQUIPOS TECNOLÓGICOS";
  const companyCity = companyConfig?.city || "La Paz - Bolivia";
  const companyPhone = companyConfig?.phone || companyConfig?.whatsapp || "";
  const companyAddress = companyConfig?.address || "";

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Encabezado / Logo
  let topY = 12;
  const companyLogo = companyConfig?.logo;
  if (companyLogo) {
    try {
      const format = companyLogo.startsWith("data:image/jpeg") || companyLogo.startsWith("data:image/jpg") ? "JPEG" : "PNG";
      doc.addImage(companyLogo, format, 14, topY, 26, 26);
    } catch (e) {
      console.log("Could not render company logo in PDF", e);
    }
  }

  // Títulos empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(companyName.toUpperCase(), 45, topY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(companyCity, 45, topY + 11);
  if (companyPhone) {
    doc.text(`Tel: ${companyPhone}`, 45, topY + 15);
  }
  if (companyAddress) {
    doc.text(companyAddress, 45, topY + (companyPhone ? 19 : 15));
  }

  // Cuadro Nota de Venta (Derecha)
  const boxX = pageWidth - 66;
  const boxW = 52;
  const boxH = 22;
  doc.setDrawColor(51, 65, 85); // slate-700
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX, topY, boxW, boxH, 2, 2, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("NOTA DE VENTA", boxX + boxW / 2, topY + 6, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(220, 38, 38);
  doc.text(`Nº: ${sale.saleNumber || "S/N"}`, boxX + boxW / 2, topY + 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Almacén: ${sale.branchName || "GENERAL"}`, boxX + boxW / 2, topY + 17, { align: "center" });

  // Cuadro Datos del Cliente
  const clientY = topY + 26;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(14, clientY, pageWidth - 28, 18, 1.5, 1.5, "FD");

  const formattedDate = new Date(sale.createdAt).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  // Fila 1
  doc.setFont("helvetica", "bold");
  doc.text("Fecha:", 18, clientY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(formattedDate, 32, clientY + 5.5);

  doc.setFont("helvetica", "bold");
  doc.text("Dirección:", 75, clientY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text((sale.customerAddress || companyAddress || "La Paz - Bolivia").substring(0, 45), 92, clientY + 5.5);

  doc.setFont("helvetica", "bold");
  doc.text("Vendedor:", 155, clientY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text((sale.sellerName || "—").substring(0, 20), 172, clientY + 5.5);

  // Fila 2
  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 18, clientY + 12);
  doc.setFont("helvetica", "normal");
  doc.text((sale.customerDisplayName || "Anónimo").substring(0, 30), 32, clientY + 12);

  doc.setFont("helvetica", "bold");
  doc.text("NIT/CI:", 75, clientY + 12);
  doc.setFont("helvetica", "normal");
  doc.text(sale.customerTaxId || "S/N", 92, clientY + 12);

  doc.setFont("helvetica", "bold");
  doc.text("Teléfono:", 155, clientY + 12);
  doc.setFont("helvetica", "normal");
  doc.text(sale.customerPhone || "S/N", 172, clientY + 12);

  // Tabla de Items
  const tableData = items.map((item: any, idx: number) => {
    const pUnit = ((item.finalUnitPrice || item.basePrice || 0) / 100).toFixed(2);
    const subtotal = ((item.subtotal || 0) / 100).toFixed(2);
    const code = item.productCode || `0000${idx + 1}`;
    const unitType = item.unitType || "PZA";
    const name = item.productName || "PRODUCTO GENERAL";
    const itemDiscount = item.discountAmount || 0;
    const descText = itemDiscount > 0
      ? `\n  ↳ Desc.: -Bs. ${(itemDiscount / 100).toFixed(2)}${item.discountType === "percentage" ? ` (${item.discountValue}%)` : ""}`
      : "";

    return [
      idx + 1,
      code,
      name + descText,
      unitType,
      item.quantity || 1,
      pUnit,
      subtotal,
    ];
  });

  // Si hay descuento global, agregar filas especiales al final
  const lineSubtotal = items.reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
  const globalDiscountAmount = sale.discountAmount || 0;
  const hasGlobalDiscount = globalDiscountAmount > 0;

  if (hasGlobalDiscount) {
    tableData.push([
      "",
      "",
      "SUBTOTAL:",
      "",
      "",
      "",
      (lineSubtotal / 100).toFixed(2),
    ]);
    const descLabel = `DESCUENTO${sale.discountType === "percentage" ? ` (${sale.discountValue}%)` : ""}${sale.notes ? ` — ${sale.notes}` : ""}`;
    tableData.push([
      "",
      "",
      descLabel,
      "",
      "",
      "",
      `-${(globalDiscountAmount / 100).toFixed(2)}`,
    ]);
  }

  (autoTable as any)(doc, {
    startY: clientY + 22,
    head: [["Nº", "CÓDIGO", "DESCRIPCIÓN", "UNIDAD", "CANT.", "P. UNIT.", "IMPORTE"]],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 24, font: "courier" },
      2: { halign: "left" },
      3: { halign: "center", cellWidth: 16 },
      4: { halign: "center", cellWidth: 14, fontStyle: "bold" },
      5: { halign: "right", cellWidth: 22, font: "courier" },
      6: { halign: "right", cellWidth: 24, font: "courier", fontStyle: "bold" },
    },
    theme: "grid",
    margin: { left: 14, right: 14 },
    didDrawCell: (data: any) => {
      // Resaltar descuento global
      if (hasGlobalDiscount && data.section === "body" && (data.row.index === tableData.length - 1)) {
        doc.setTextColor(146, 64, 14);
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 160;

  // Totales y Son
  const totalAmountStr = `Bs. ${((sale.total || 0) / 100).toFixed(2)}`;
  const literalTotal = numeroALetras(sale.total || 0);
  const totalQty = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
  const notesText = sale.notes
    ? sale.notes
    : `VENTA EN ${paymentMethodLabel(sale.paymentMethod).toUpperCase()} · GARANTÍA ${sale.warrantyDays || 30} DÍAS`;

  let currentY = finalY + 5;
  if (currentY + 45 > pageHeight) {
    doc.addPage();
    currentY = 20;
  }

  // Cuadro resumen
  doc.setDrawColor(203, 213, 225);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 4;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("SON:", 14, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(literalTotal, 24, currentY);

  doc.setFont("helvetica", "bold");
  doc.text("TOTAL CANT:", pageWidth - 70, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(`${totalQty} uds.`, pageWidth - 46, currentY);

  currentY += 5;
  doc.setFont("helvetica", "bold");
  doc.text("NOTA/REF.:", 14, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(notesText, 32, currentY);

  // Total destacado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL:", pageWidth - 65, currentY + 1);
  doc.setFontSize(12);
  doc.setTextColor(22, 101, 52); // green-800
  doc.text(totalAmountStr, pageWidth - 14, currentY + 1, { align: "right" });

  currentY += 16;

  // Firmas
  const sigWidth = 45;
  const col1 = 20;
  const col2 = (pageWidth - sigWidth) / 2;
  const col3 = pageWidth - 20 - sigWidth;

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);

  // Vendedor
  doc.line(col1, currentY, col1 + sigWidth, currentY);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("VENDEDOR", col1 + sigWidth / 2, currentY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(sale.sellerName || "—", col1 + sigWidth / 2, currentY + 7.5, { align: "center" });

  // Cliente
  doc.line(col2, currentY, col2 + sigWidth, currentY);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("CLIENTE", col2 + sigWidth / 2, currentY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(sale.customerDisplayName || "—", col2 + sigWidth / 2, currentY + 7.5, { align: "center" });

  // Recepción
  doc.line(col3, currentY, col3 + sigWidth, currentY);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("CONFORMIDAD", col3 + sigWidth / 2, currentY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma / Sello", col3 + sigWidth / 2, currentY + 7.5, { align: "center" });

  // MARCA DE AGUA VENTA ANULADA SI APLICA
  if (isCancelled) {
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.saveGraphicsState();
      try {
        // Configurar opacidad si es soportado por jsPDF
        if (typeof (doc as any).setGState === "function" && (doc as any).GState) {
          doc.setGState(new (doc as any).GState({ opacity: 0.22 }));
        }
      } catch (e) {}

      doc.setTextColor(220, 38, 38); // Rojo
      doc.setFont("helvetica", "bold");
      doc.setFontSize(55);
      
      // Dibujar texto inclinado en el centro de la página
      doc.text("VENTA ANULADA", pageWidth / 2, pageHeight / 2, {
        align: "center",
        angle: 45,
      });

      if (sale.cancelReason) {
        doc.setFontSize(16);
        doc.text(`Motivo: ${sale.cancelReason}`, pageWidth / 2, pageHeight / 2 + 18, {
          align: "center",
          angle: 45,
        });
      }

      doc.restoreGraphicsState();
    }
  }

  // Guardar PDF directamente
  const fileName = `NV-${sale.saleNumber || "venta"}.pdf`;
  doc.save(fileName);
  toast.success(`Nota de venta descargada como ${fileName}`);
}


export default function Sales() {
  const { activeBranchId, setActiveBranchId, branches } = useBranch();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();

  const { data: closureStatus } = trpc.finance.hasPendingClosure.useQuery();
  const { data: salesList, isLoading } = trpc.sales.list.useQuery({
    branchId: activeBranchId || undefined,
  });
  const { data: nextSaleData } = trpc.sales.getNextSaleNumber.useQuery();
  const { data: companyConfig } = trpc.settings.getCompanyConfig.useQuery();

  const [activeTab, setActiveTab] = useState("sales");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailSaleId, setDetailSaleId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleNumber, setLastSaleNumber] = useState("");

  // Si se ingresa desde el módulo de Garantías / RMA con ?anular=ID o ?saleId=ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const anularParam = params.get("anular") || params.get("saleId");
    if (anularParam) {
      const sId = parseInt(anularParam, 10);
      if (!isNaN(sId) && sId > 0) {
        setDetailSaleId(sId);
        setCancelReason("Devolución por Garantía / RMA");
        setIsDetailOpen(true);
      }
    }
  }, []);

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
  const [selectedUnitForDetail, setSelectedUnitForDetail] = useState<any>(null);
  const [isUnitDetailOpen, setIsUnitDetailOpen] = useState(false);

  const { data: openingStatus } = trpc.finance.hasActiveOpening.useQuery({ paymentMethod: paymentMethod === "credit" ? "cash" : paymentMethod });
  const { data: unitsList } = trpc.units.list.useQuery({ status: "available", limit: 5000 } as any);
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
      resetForm();
      await Promise.all([
        utils.sales.list.invalidate(),
        utils.units.list.invalidate(),
        utils.finance.getTransactions.invalidate(),
        utils.credit.listReceivable.invalidate(),
      ]);
      setTimeout(() => {
        setShowSuccess(false);
        setIsCreateOpen(false);
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
        utils.warranties.list.invalidate(),
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
    brand: u.brand,
    model: u.model,
    unitType: u.type,
    specs: u.specs,
    serialNumber: u.serialNumber,
    condition: u.condition,
    damageNotes: u.damageNotes,
    location: u.location,
    salePrice: u.salePrice || 0,
    wholesalePrice: u.wholesalePrice || u.salePrice || 0,
    discountPrice: u.discountPrice || u.salePrice || 0,
    purchasePrice: u.purchasePrice || 0,
    price: u.salePrice || 0,
    status: u.status,
    category: "unit",
    stock: 1,
    rawUnit: u,
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
    if (!salesList || !Array.isArray(salesList)) return [];

    return (salesList as any[])
      .filter((sale: any) => {
        const search = (historySearch || "").trim().toLowerCase();
        const matchesSearch =
          !search ||
          (sale.saleNumber || "").toLowerCase().includes(search) ||
          (sale.customerDisplayName || "").toLowerCase().includes(search) ||
          (sale.sellerName || "").toLowerCase().includes(search) ||
          (sale.notes || "").toLowerCase().includes(search);

        let matchesDate = true;
        if (historyDateFrom || historyDateTo) {
          if (!sale.createdAt) {
            matchesDate = false;
          } else {
            const saleDate = new Date(sale.createdAt);
            if (!isNaN(saleDate.getTime())) {
              if (historyDateFrom && saleDate < new Date(historyDateFrom + "T00:00:00")) matchesDate = false;
              if (historyDateTo && saleDate > new Date(historyDateTo + "T23:59:59")) matchesDate = false;
            }
          }
        }

        const matchesStatus = historyStatus === "all" || sale.status === historyStatus;

        return matchesSearch && matchesDate && matchesStatus;
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
          unitType: product.unitType || product.rawUnit?.type,
          brand: product.brand || product.rawUnit?.brand,
          model: product.model || product.rawUnit?.model,
          specs: product.specs || product.rawUnit?.specs,
          serialNumber: product.serialNumber || product.rawUnit?.serialNumber,
          condition: product.condition || product.rawUnit?.condition,
          damageNotes: product.damageNotes || product.rawUnit?.damageNotes,
          location: product.location || product.rawUnit?.location,
          purchasePrice: product.purchasePrice || product.rawUnit?.purchasePrice,
          rawUnit: product.rawUnit || product,
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
      branchId: activeBranchId || undefined,
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
      items: computedCart.items
        .filter((item) => item.productId && item.productId > 0)
        .map((item) => ({
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

  const activeFilteredSales = useMemo(() => {
    return filteredSales.filter((s: any) => s.status !== "cancelled");
  }, [filteredSales]);

  const totalSalesAmount = useMemo(() => {
    return activeFilteredSales.reduce((sum: number, sale: any) => sum + (sale.total || 0), 0);
  }, [activeFilteredSales]);

  const pendingSalesCount = useMemo(() => {
    return filteredSales.filter((sale: any) => sale.paymentStatus === "pending" && sale.status !== "cancelled").length;
  }, [filteredSales]);

  const dateRangeDescription = useMemo(() => {
    if (historyDateFrom && historyDateTo) {
      if (historyDateFrom === historyDateTo) {
        return `DEL ${new Date(historyDateFrom + "T12:00:00").toLocaleDateString("es-BO")}`;
      }
      return `DEL ${new Date(historyDateFrom + "T12:00:00").toLocaleDateString("es-BO")} AL ${new Date(historyDateTo + "T12:00:00").toLocaleDateString("es-BO")}`;
    }
    if (historyDateFrom) {
      return `DESDE EL ${new Date(historyDateFrom + "T12:00:00").toLocaleDateString("es-BO")}`;
    }
    if (historyDateTo) {
      return `HASTA EL ${new Date(historyDateTo + "T12:00:00").toLocaleDateString("es-BO")}`;
    }
    return "TOTAL ACUMULADO";
  }, [historyDateFrom, historyDateTo]);

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
                   <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900">Gestión de <span className="text-emerald-500">Ventas</span></h1>
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
                 <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="h-14 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg gap-3 shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95">
                   <Plus className="h-6 w-6" />
                   Nueva Venta
                 </Button>
               </div>
             </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="bg-white border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Ventas registradas</CardTitle>
              <div className="min-h-full bg-slate-50 flex items-center justify-center p-3 rounded-lg">
                <ShoppingBag className="h-4 w-4 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{filteredSales.length}</div>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight truncate" title={dateRangeDescription}>
                {dateRangeDescription}
              </p>
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
              <p className="text-[10px] text-emerald-600/80 font-bold mt-1 uppercase tracking-tight truncate" title={dateRangeDescription}>
                {dateRangeDescription === "TOTAL ACUMULADO" ? "INGRESOS BRUTOS" : dateRangeDescription}
              </p>
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
                {pendingSalesCount}
              </div>
              <p className="text-[10px] text-amber-600/80 font-bold mt-1 uppercase tracking-tight truncate" title={dateRangeDescription}>
                {dateRangeDescription === "TOTAL ACUMULADO" ? "POR REGULARIZAR" : dateRangeDescription}
              </p>
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
              ? "max-h-[96vh] w-[98vw] max-w-[calc(100vw-0.5rem)] overflow-y-auto rounded-3xl border-slate-200 bg-white p-3 sm:p-4"
              : "flex flex-col h-[90vh] max-h-[880px] w-[min(1380px,96vw)] sm:max-w-[min(1380px,96vw)] overflow-hidden rounded-3xl border-slate-200/90 bg-slate-100/70 shadow-2xl p-0"
          }
        >
          {/* Success overlay */}
          {showSuccess && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 rounded-3xl backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">¡Venta registrada con éxito!</p>
                  <p className="text-sm text-slate-500 mt-0.5">{lastSaleNumber ? `Comprobante #${lastSaleNumber}` : ""}</p>
                </div>
                <p className="text-xs text-slate-400">Actualizando datos...</p>
              </div>
            </div>
          )}

          {/* Header Ultra-Compacto */}
          <div className="px-5 py-2.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm">
                <ShoppingBag className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-sm text-white">Nueva Venta</span>
              {nextSaleData?.saleNumber && (
                <Badge className="bg-slate-800 text-emerald-400 font-mono text-[10px] px-2 py-0 border border-slate-700">
                  #{nextSaleData.saleNumber}
                </Badge>
              )}
              {user?.role === "admin" && (
                <Badge className="bg-blue-900/60 text-blue-300 border-none text-[9px] px-1.5 py-0 hidden sm:inline-flex">
                  Admin
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                {computedCart.items.reduce((sum, i) => sum + i.quantity, 0)} artículo{computedCart.items.reduce((sum, i) => sum + i.quantity, 0) !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => { setIsCreateOpen(false); resetForm(); }}
                className="h-6 w-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                title="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Cuerpo Principal del POS (2 Columnas sin scroll general) */}
          <div className={isMobile ? "p-4 space-y-4" : "grid grid-cols-12 gap-3 p-3 flex-1 min-h-0 overflow-hidden"}>
            
            {/* ─── Columna Izquierda: Cliente, Buscador & Carrito (7 Cols) ─── */}
            <div className={isMobile ? "space-y-4" : "col-span-7 flex flex-col gap-2.5 min-h-0 overflow-hidden"}>
              
              {/* 1. Barra de Cliente & Condiciones (Ultra-compacta) */}
              <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <UserRound className="h-3 w-3 text-slate-400" />
                    Cliente y Condiciones
                  </span>
                  {selectedCustomerId && (
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold py-0 h-4">
                        ✓ Registrado
                      </Badge>
                      {selectedCustomerType === "wholesale" && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] font-bold py-0 h-4">
                          Mayorista
                        </Badge>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleClearCustomer}
                        className="h-4 px-1 text-[9px] text-slate-400 hover:text-red-600"
                        title="Cambiar cliente"
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-start">
                  {/* Cliente / Buscador con Dropdown Flotante */}
                  <div className="relative sm:col-span-1">
                    <div className="relative">
                      <UserRound className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        value={anonymousCustomerName}
                        onChange={(e) => {
                          setAnonymousCustomerName(e.target.value);
                          if (selectedCustomerId) setSelectedCustomerId(null);
                        }}
                        placeholder="Cliente / Buscar..."
                        className="pl-7 h-8 text-xs focus:border-blue-500"
                      />
                    </div>
                    {/* Menú flotante de clientes encontrados */}
                    {filteredCustomers.length > 0 && !selectedCustomerId && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                        <div className="px-2 py-0.5 bg-slate-50 border-b text-[9px] font-bold text-slate-400 uppercase">
                          Sugeridos
                        </div>
                        {filteredCustomers.map((customer: any) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left text-xs border-b last:border-b-0 hover:bg-blue-50 transition-colors"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <div className="truncate">
                              <p className="font-bold text-slate-800 text-[11px] truncate">{customer.name}</p>
                              <p className="text-[9px] text-slate-400 truncate">
                                {customer.phone ? `📞 ${customer.phone}` : ""} {customer.taxId ? `· CI: ${customer.taxId}` : ""}
                              </p>
                            </div>
                            {customer.customerType === "wholesale" && (
                              <Badge className="bg-amber-100 text-amber-800 text-[8px] py-0 h-3.5 border-none shrink-0 ml-1">
                                Mayor
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Teléfono */}
                  <div>
                    <div className="relative">
                      <Phone className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        value={anonymousCustomerPhone}
                        onChange={(e) => setAnonymousCustomerPhone(e.target.value)}
                        placeholder="Tel / WhatsApp..."
                        className="pl-7 h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* NIT / CI */}
                  <div>
                    <Input
                      value={anonymousCustomerTaxId}
                      onChange={(e) => setAnonymousCustomerTaxId(e.target.value)}
                      placeholder="NIT / CI (opcional)..."
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Canal */}
                  <div>
                    <Select value={saleChannel} onValueChange={(value: "local" | "delivery") => setSaleChannel(value)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Tienda / Local</SelectItem>
                        <SelectItem value="delivery">A Domicilio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 2. Buscador & Carrito de Productos */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
                
                {/* Buscador de productos */}
                <div className="relative mb-2 shrink-0">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                    <Input
                      ref={productSearchRef}
                      autoFocus
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && productSearch.trim().length >= 2) {
                          const query = productSearch.trim().toLowerCase();
                          const exactMatch = groupedProducts.find((g) => {
                            const u = g.representative;
                            return (
                              u.code?.toLowerCase() === query ||
                              u.serialNumber?.toLowerCase() === query ||
                              `${u.brand} ${u.model}`.toLowerCase() === query
                            );
                          });
                          if (exactMatch) {
                            addGroupToCart(exactMatch);
                          }
                        }
                      }}
                      placeholder="Buscar producto por código, marca, modelo... (Ctrl+B)"
                      className="pl-8 pr-14 h-8.5 text-xs rounded-xl border-slate-200 bg-slate-50/70 focus:bg-white"
                    />
                    <kbd className="absolute right-2 top-2 hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-400 sm:block">
                      Ctrl+B
                    </kbd>
                  </div>

                  {/* Resultados de búsqueda flotantes/desplegables */}
                  {productSearch.trim().length >= 2 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-52 overflow-y-auto p-2">
                      {groupedProducts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {groupedProducts.map((group) => {
                            const u = group.representative;
                            const typeInfo = getUnitTypeBadge(u.type);
                            const specsText = getSpecsSummary(u.specs, u.damageNotes);
                            const activePrice =
                              currentPricingMode === "discount" ? (u.discountPrice || u.salePrice || 0) :
                              currentPricingMode === "wholesale" ? (u.wholesalePrice || u.salePrice || 0) :
                              (u.salePrice || 0);

                            const alreadyInCart = cartItems.filter((ci) =>
                              group.units.some((gu: any) => gu.id === ci.productId)
                            ).length;
                            const remaining = group.count - alreadyInCart;

                            return (
                              <div
                                key={`${u.brand}|${u.model}|${u.salePrice}`}
                                className={`flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                                  remaining <= 0
                                    ? "opacity-50 cursor-not-allowed border-slate-100 bg-slate-50"
                                    : "border-slate-100 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/30 shadow-xs"
                                }`}
                                onClick={() => remaining > 0 && addGroupToCart(group)}
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                    <Badge variant="outline" className={`font-bold text-[9px] px-1.5 py-0.2 ${typeInfo.color}`}>
                                      {typeInfo.icon} {typeInfo.label}
                                    </Badge>
                                    {u.code && (
                                      <span className="font-mono text-[9px] text-slate-500 font-semibold">{u.code}</span>
                                    )}
                                  </div>
                                  <p className="font-bold text-slate-900 text-xs truncate">{u.brand} {u.model}</p>
                                  {specsText && (
                                    <p className="text-[10px] text-slate-500 truncate font-medium">{specsText}</p>
                                  )}
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {remaining > 0 ? `${remaining} disp.` : "Agotado"}
                                    {alreadyInCart > 0 && <span className="text-amber-600 ml-1">({alreadyInCart} en carrito)</span>}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-black text-slate-900 text-xs block">{formatCurrency(activePrice)}</span>
                                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    + Agregar
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-slate-400 text-xs">
                          No se encontraron productos para "{productSearch}"
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Lista de Artículos en el Carrito */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Artículos en Carrito ({computedCart.items.reduce((s, i) => s + i.quantity, 0)})
                    </span>
                    {computedCart.items.length > 0 && (
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 hover:underline"
                      >
                        <RotateCcw className="h-2.5 w-2.5" /> Vaciar
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto py-1 space-y-1.5 pr-1 scrollbar-thin">
                    {computedCart.items.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center py-6 text-center text-slate-400">
                        <ShoppingBag className="h-8 w-8 text-slate-200 mb-1" />
                        <p className="text-xs font-semibold text-slate-500">Carrito vacío</p>
                        <p className="text-[10px] text-slate-400">Usa el buscador superior para agregar productos</p>
                      </div>
                    ) : (
                      computedCart.items.map((item) => {
                        const typeInfo = getUnitTypeBadge(item.unitType || item.rawUnit?.type);
                        const specsText = getSpecsSummary(item.specs || item.rawUnit?.specs, item.damageNotes || item.rawUnit?.damageNotes);
                        const unitObj = item.rawUnit || products?.find((p: any) => p.id === item.productId) || item;

                        return (
                          <div
                            key={item.productId}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 text-xs transition-all shadow-2xs"
                          >
                            {/* Info Producto */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className={`font-bold text-[9px] px-1.5 py-0.2 shrink-0 ${typeInfo.color}`}>
                                  {typeInfo.icon} {typeInfo.label}
                                </Badge>
                                {item.productCode && (
                                  <Badge variant="outline" className="font-mono text-[9px] px-1.5 py-0.2 bg-white text-slate-600 border-slate-200 shrink-0">
                                    {item.productCode}
                                  </Badge>
                                )}
                                <p className="font-bold text-slate-900 truncate text-xs">{item.productName}</p>
                              </div>

                              {/* Características resumidas */}
                              {specsText && (
                                <p className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">
                                  {specsText}
                                </p>
                              )}

                              <div className="flex items-center gap-1.5 mt-1">
                                {/* Selector de Precio Unit / Desc / Mayor */}
                                <div className="flex bg-slate-200/80 p-0.5 rounded text-[9px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => updateCartItem(item.productId, { pricingType: "unit", basePrice: products?.find((p: any) => p.id === item.productId)?.salePrice || item.basePrice })}
                                    className={`px-1.5 py-0.2 rounded ${item.pricingType === "unit" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
                                  >
                                    U
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateCartItem(item.productId, { pricingType: "discount", basePrice: products?.find((p: any) => p.id === item.productId)?.discountPrice || item.basePrice })}
                                    className={`px-1.5 py-0.2 rounded ${item.pricingType === "discount" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
                                  >
                                    D
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateCartItem(item.productId, { pricingType: "wholesale", basePrice: products?.find((p: any) => p.id === item.productId)?.wholesalePrice || item.basePrice })}
                                    className={`px-1.5 py-0.2 rounded ${item.pricingType === "wholesale" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
                                  >
                                    M
                                  </button>
                                </div>
                                <span className="text-slate-600 font-mono text-[11px] font-semibold">{formatCurrency(item.basePrice)}</span>
                              </div>
                            </div>

                            {/* Botón Ver Detalles (donde el usuario dibujó en rojo) */}
                            <button
                              type="button"
                              title="Ver características y detalles completos del equipo"
                              onClick={() => {
                                setSelectedUnitForDetail(unitObj);
                                setIsUnitDetailOpen(true);
                              }}
                              className="h-7 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[10px] flex items-center gap-1 transition-colors shrink-0"
                            >
                              <Info className="h-3 w-3" />
                              <span className="hidden sm:inline">Detalles</span>
                            </button>

                            {/* Cantidad */}
                            <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded-lg border border-slate-200 shrink-0">
                              <button
                                type="button"
                                className="h-5 w-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600"
                                onClick={() => updateCartItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}
                              >
                                <Minus className="h-2.5 w-2.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={item.stock}
                                value={item.quantity}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateCartItem(item.productId, { quantity: Math.max(1, parseInt(e.target.value || "1", 10)) })}
                                className="w-7 text-center font-bold text-xs bg-transparent border-none p-0 focus:outline-none"
                              />
                              <button
                                type="button"
                                className="h-5 w-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600"
                                onClick={() => updateCartItem(item.productId, { quantity: Math.min(item.stock, item.quantity + 1) })}
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </button>
                            </div>

                            {/* Subtotal */}
                            <div className="w-18 text-right shrink-0">
                              <span className="font-bold text-slate-900 text-xs block">{formatCurrency(item.subtotal)}</span>
                            </div>

                            {/* Eliminar */}
                            <button
                              type="button"
                              onClick={() => removeCartItem(item.productId)}
                              className="h-6 w-6 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 flex items-center justify-center shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Columna Derecha: Cobro, Liquidación & Resumen (5 Cols) ─── */}
            <div className={isMobile ? "space-y-4" : "col-span-5 flex flex-col gap-2.5 min-h-0 overflow-hidden"}>
              
              {/* Card 1: Métodos de Pago & Configuración */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5 shrink-0">
                
                {/* Métodos de Pago en 4 botones compactos */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Wallet className="h-3 w-3 text-slate-400" />
                      Forma de Pago
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {paymentMethod === "cash" ? "Efectivo al instante" :
                       paymentMethod === "qr" ? "Cobro con QR" :
                       paymentMethod === "credit" ? "Cuenta por cobrar" : "Transferencia"}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["cash", "qr", "transfer", "credit"] as PaymentMethod[]).map((method) => {
                      const isActive = paymentMethod === method;
                      const colors = method === "cash"
                        ? isActive ? "bg-emerald-600 text-white shadow-sm font-bold border-emerald-600" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                        : method === "qr"
                        ? isActive ? "bg-violet-600 text-white shadow-sm font-bold border-violet-600" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                        : method === "credit"
                        ? isActive ? "bg-amber-600 text-white shadow-sm font-bold border-amber-600" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                        : isActive ? "bg-blue-600 text-white shadow-sm font-bold border-blue-600" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200";

                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(method);
                            if (method === "credit") setPaymentStatus("pending");
                          }}
                          className={`h-11 sm:h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${colors}`}
                        >
                          {method === "cash" && <Banknote className="h-3.5 w-3.5" />}
                          {method === "qr" && <QrCode className="h-3.5 w-3.5" />}
                          {method === "transfer" && <ArrowLeftRight className="h-3.5 w-3.5" />}
                          {method === "credit" && <CreditCard className="h-3.5 w-3.5" />}
                          <span>{method === "cash" ? "Efectivo" : method === "qr" ? "QR" : method === "credit" ? "Crédito" : "Transf."}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Si es crédito: Plazo y Alerta compacta */}
                  {paymentMethod === "credit" && (
                    <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                        <CreditCard className="h-3.5 w-3.5 text-amber-600" />
                        <span>Plazo:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={String(creditDays)} onValueChange={(val) => setCreditDays(Number(val))}>
                          <SelectTrigger className="h-7 w-28 text-xs bg-white border-amber-300 font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 Días</SelectItem>
                            <SelectItem value="15">15 Días</SelectItem>
                            <SelectItem value="30">30 Días</SelectItem>
                            <SelectItem value="45">45 Días</SelectItem>
                            <SelectItem value="60">60 Días</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Alerta de caja si no está abierta */}
                  {(!openingStatus?.hasActive && user?.role !== "admin" && paymentMethod !== "credit") && (
                    <div className="mt-1.5 p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold flex items-center gap-1.5">
                      <XCircle className="h-3 w-3 shrink-0" />
                      <span>Caja de {paymentMethodLabel(paymentMethod)} no abierta en Finanzas.</span>
                    </div>
                  )}
                </div>

                {/* Fila compacta de Descuento & Garantía */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  {/* Descuento Global */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <BadgeDollarSign className="h-3 w-3 text-emerald-600" />
                      Desc. Global
                    </Label>
                    <div className="flex gap-1">
                      <Select value={globalDiscountType} onValueChange={(value: DiscountType) => {
                        setGlobalDiscountType(value);
                        setGlobalDiscountValue(0);
                      }}>
                        <SelectTrigger className="h-7 w-20 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin</SelectItem>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">Bs</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        disabled={globalDiscountType === "none"}
                        value={globalDiscountType === "fixed" ? globalDiscountValue / 100 : globalDiscountValue}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          if (globalDiscountType === "fixed") {
                            setGlobalDiscountValue(parsePrice(e.target.value || "0"));
                            return;
                          }
                          setGlobalDiscountValue(Math.max(0, Math.round(parseFloat(e.target.value || "0"))));
                        }}
                        placeholder="0"
                        className="h-7 text-[11px] flex-1"
                      />
                    </div>
                  </div>

                  {/* Garantía */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Shield className="h-3 w-3 text-blue-600" />
                      Garantía
                    </Label>
                    <Select value={String(warrantyDays)} onValueChange={(val) => setWarrantyDays(parseInt(val))}>
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 Días</SelectItem>
                        <SelectItem value="30">30 Días (Recomendado)</SelectItem>
                        <SelectItem value="60">60 Días</SelectItem>
                        <SelectItem value="90">90 Días</SelectItem>
                        <SelectItem value="180">180 Días</SelectItem>
                        <SelectItem value="0">Sin Garantía</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Observaciones / Motivo del Descuento */}
                <div className="pt-1 border-t border-slate-100">
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={globalDiscountType !== "none" ? "Motivo del descuento (aparecerá en la nota de venta)..." : "Observaciones / notas opcionales..."}
                    className={`h-7 text-[11px] ${globalDiscountType !== "none" ? "border-amber-300 bg-amber-50 placeholder:text-amber-500" : ""}`}
                  />
                </div>
              </div>


              {/* Card 2: Resumen Financiero & Botón de Acción Principal */}
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-lg flex flex-col justify-between flex-1 min-h-0">
                
                {/* Desglose */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-[11px]">Subtotal:</span>
                    <span className="font-semibold">{formatCurrency(computedCart.subtotal)}</span>
                  </div>

                  {(computedCart.globalDiscountAmount > 0 || computedCart.items.reduce((s, i) => s + i.discountAmount, 0) > 0) && (
                    <div className="flex items-center justify-between text-emerald-400 text-xs">
                      <span>Descuentos aplicados:</span>
                      <span className="font-bold">
                        -{formatCurrency(computedCart.globalDiscountAmount + computedCart.items.reduce((s, i) => s + i.discountAmount, 0))}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-400 text-[10px] border-t border-slate-800 pt-1.5">
                    <span>Fecha: {new Date().toLocaleDateString('es-BO')}</span>
                    <span>Canal: {saleChannel === "local" ? "En Local" : "A Domicilio"}</span>
                  </div>
                </div>

                {/* Bloque Destacado de TOTAL */}
                <div className="my-2 bg-emerald-600 p-2.5 rounded-xl flex items-center justify-between shadow-inner">
                  <div>
                    <span className="text-[9px] uppercase font-black tracking-widest text-emerald-100 block">
                      Total a Cobrar
                    </span>
                    <span className="text-2xl font-black tracking-tight text-white leading-none">
                      {formatCurrency(computedCart.total)}
                    </span>
                  </div>
                  <Badge className="bg-emerald-950/40 text-emerald-100 text-[10px] font-bold border-none">
                    {paymentMethodLabel(paymentMethod)}
                  </Badge>
                </div>

                {/* Botones de Acción */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setIsCreateOpen(false); resetForm(); }}
                    className="h-12 sm:h-10 px-4 rounded-xl border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-xs font-bold shrink-0"
                  >
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
                    className={`flex-1 h-12 sm:h-10 rounded-xl text-sm font-black shadow-md flex items-center justify-center gap-2 transition-all ${
                      paymentMethod === "credit" && !creditDataComplete 
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700" 
                        : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:shadow-emerald-500/20 active:scale-[0.99]"
                    }`}
                  >
                    {createSaleMutation.isPending ? (
                      "Registrando..."
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{paymentMethod === "credit" ? "Registrar Crédito" : "Completar Venta"}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[94vh] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-3xl border-slate-200 bg-slate-100/70 p-4 sm:max-w-[min(960px,94vw)] sm:p-6">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                Nota de Venta
                {detail?.sale?.saleNumber && (
                  <Badge className="bg-slate-900 text-emerald-400 font-mono text-xs ml-1 border-none">
                    #{detail.sale.saleNumber}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Comprobante oficial de venta y entrega de mercadería.
              </DialogDescription>
            </div>
            {detail?.sale && (
              <Button
                onClick={() => printSaleTicket(detail, companyConfig)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md"
              >
                <Printer className="h-4 w-4" />
                Imprimir Nota de Venta
              </Button>
            )}
          </DialogHeader>

          {!detail ? (
            <div className="py-12 text-center text-slate-400 text-sm">Cargando datos de la venta...</div>
          ) : (
            <div className="space-y-5">
              
              {/* Documento Visual NOTA DE VENTA (Papel / Preview) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-xs font-sans space-y-4">
                
                {/* Cabecera del Documento */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b border-dashed border-slate-300 pb-3">
                  <div className="flex items-center gap-2.5">
                    {companyConfig?.logo ? (
                      <img src={companyConfig.logo} alt="Logo" className="max-h-12 max-w-28 object-contain" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-amber-500 text-white flex items-center justify-center text-xl font-bold shadow-xs">
                        💡
                      </div>
                    )}
                    <div>
                      <h2 className="font-black text-sm text-slate-900 uppercase tracking-tight">
                        {companyConfig?.name || "HK EQUIPOS TECNOLÓGICOS"}
                      </h2>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {companyConfig?.city || "La Paz - Bolivia"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:self-center">
                    <div className="text-base font-black uppercase tracking-wider text-slate-900 mb-1">
                      NOTA DE VENTA
                    </div>
                    <div className="inline-block border border-dashed border-slate-400 rounded-xl px-3 py-1 bg-slate-50 text-left">
                      <div className="text-[11px] font-bold text-slate-800">
                        Nro: <span className="font-mono font-black">{detail.sale.saleNumber}</span>
                      </div>
                      <div className="text-[10px] text-slate-600">
                        Almacén: <span className="font-bold">{detail.sale.branchName || "GENERAL"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metadatos del Cliente y Transacción */}
                <div className="border-b border-dashed border-slate-300 pb-3 space-y-1.5 text-[11px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><strong>Fecha:</strong> {new Date(detail.sale.createdAt).toLocaleDateString("es-BO")} {new Date(detail.sale.createdAt).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}</div>
                    <div><strong>Dirección:</strong> {detail.sale.customerAddress || companyConfig?.address || "La Paz - Bolivia"}</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div><strong>Cliente:</strong> {detail.sale.customerDisplayName || "Anónimo"}</div>
                    <div><strong>NIT/CI:</strong> {detail.sale.customerTaxId || "S/N"}</div>
                    <div><strong>Teléfono:</strong> {detail.sale.customerPhone || "S/N"}</div>
                  </div>
                </div>

                {/* Tabla de Items */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-y border-dashed border-slate-400 text-[10px] uppercase font-black text-slate-700 bg-slate-50/50">
                        <th className="py-2 px-1 text-center w-8">Nº</th>
                        <th className="py-2 px-2 w-28">CODIGO</th>
                        <th className="py-2 px-2">DESCRIPCIÓN</th>
                        <th className="py-2 px-1 text-center w-14">UNIDAD</th>
                        <th className="py-2 px-1 text-center w-12">CANT.</th>
                        <th className="py-2 px-2 text-right w-20">P. UNIT.</th>
                        <th className="py-2 px-2 text-right w-24">IMPORTE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed divide-slate-200">
                      {(detail.items || []).map((item: any, idx: number) => (
                        <>
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            <td className="py-2 px-1 text-center font-bold text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-2 font-mono text-[11px] text-slate-600">{item.productCode || `0000${idx + 1}`}</td>
                            <td className="py-2 px-2 font-bold text-slate-900">{item.productName}</td>
                            <td className="py-2 px-1 text-center text-slate-600">{item.unitType || "PZA"}</td>
                            <td className="py-2 px-1 text-center font-bold text-slate-900">{item.quantity}</td>
                            <td className="py-2 px-2 text-right font-mono">{formatCurrency(item.finalUnitPrice || item.basePrice)}</td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">{formatCurrency(item.subtotal)}</td>
                          </tr>
                          {(item.discountAmount || 0) > 0 && (
                            <tr key={`disc-${item.id}`} className="bg-yellow-50">
                              <td colSpan={5} className="py-1 px-4 text-[10px] text-amber-700 italic">
                                ↳ Desc. sobre artículo: -{formatCurrency(item.discountAmount)}
                                {item.discountType === "percentage" && ` (${item.discountValue}%)`}
                              </td>
                              <td colSpan={2} className="py-1 px-2 text-right text-[10px] text-amber-700 italic font-mono">
                                -{formatCurrency(item.discountAmount)}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                      {(detail.sale.discountAmount || 0) > 0 && (() => {
                        const lineSubtotalAmt = (detail.items || []).reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
                        return (
                          <>
                            <tr className="border-t border-dashed border-slate-300 text-slate-500">
                              <td colSpan={5}></td>
                              <td className="py-1 px-2 text-right text-[10px] font-bold">SUBTOTAL:</td>
                              <td className="py-1 px-2 text-right font-mono text-[10px]">{formatCurrency(lineSubtotalAmt)}</td>
                            </tr>
                            <tr className="bg-yellow-50">
                              <td colSpan={5} className="py-1 px-4 text-[10px] text-amber-700 font-bold italic">
                                DESCUENTO
                                {detail.sale.discountType === "percentage" && ` (${detail.sale.discountValue}%)`}
                                {detail.sale.discountType === "fixed" && " (monto fijo)"}
                                {detail.sale.notes && ` — Motivo: ${detail.sale.notes}`}
                              </td>
                              <td className="py-1 px-2 text-right text-[10px] text-amber-700 font-bold">DESCUENTO:</td>
                              <td className="py-1 px-2 text-right font-mono text-[10px] text-amber-700 font-bold">
                                -{formatCurrency(detail.sale.discountAmount)}
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>

                  </table>
                </div>

                {/* Resumen Final, Son en Letras y Totales */}
                <div className="border-t border-dashed border-slate-400 pt-3 flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div className="space-y-1 sm:max-w-[65%]">
                    <div className="text-[11px] font-bold text-slate-800 uppercase">
                      <strong>SON:</strong> {numeroALetras(detail.sale.total)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      <strong>Nota/Ref.:</strong> {detail.sale.notes || `Pago: ${paymentMethodLabel(detail.sale.paymentMethod)} · Garantía: ${detail.sale.warrantyDays || 30} días`}
                    </div>
                  </div>

                  <div className="text-right sm:self-end">
                    <div className="flex items-baseline gap-4 justify-end">
                      <span className="text-xs font-bold text-slate-600">
                        TOTAL: <span className="font-mono">{detail.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 1}.00</span>
                      </span>
                      <span className="text-base font-black text-slate-900 font-mono border-b-2 border-dashed border-slate-900 pb-0.5">
                        {formatCurrency(detail.sale.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Firmas: VENDEDOR, CLIENTE, RECEPCIÓN */}
                <div className="pt-10 grid grid-cols-3 gap-6 text-center text-[10px]">
                  <div>
                    <div className="border-t border-dashed border-slate-400 pt-1 font-bold text-slate-700 uppercase">
                      VENDEDOR
                    </div>
                    <div className="text-slate-400 text-[9px] truncate">{detail.sale.sellerName || "—"}</div>
                  </div>
                  <div>
                    <div className="border-t border-dashed border-slate-400 pt-1 font-bold text-slate-700 uppercase">
                      CLIENTE
                    </div>
                    <div className="text-slate-400 text-[9px] truncate">{detail.sale.customerDisplayName || "—"}</div>
                  </div>
                  <div>
                    <div className="border-t border-dashed border-slate-400 pt-1 font-bold text-slate-700 uppercase">
                      RECEPCIÓN
                    </div>
                    <div className="text-slate-400 text-[9px]">&nbsp;</div>
                  </div>
                </div>

              </div>

              {/* Acciones de Auditoría / Admin */}
              <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">

                  {user?.role === "admin" && detail.sale.paymentStatus === "pending" && detail.sale.status !== "cancelled" ? (
                    <Button
                      variant="outline"
                      className="gap-2 bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      onClick={() => markPaidMutation.mutate({ saleId: detail.sale.id })}
                      disabled={markPaidMutation.isPending}
                    >
                      <Wallet className="h-4 w-4" />
                      Marcar como pagada
                    </Button>
                  ) : null}
                </div>

                {user?.role === "admin" && detail.sale.status !== "cancelled" ? (
                  <div className="w-full space-y-1.5 md:w-[380px]">
                    <div className="flex gap-2">
                      <Input
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                        placeholder="Motivo para anular venta..."
                        className="h-9 text-xs bg-white"
                      />
                      <Button
                        variant="destructive"
                        className="gap-1.5 h-9 text-xs"
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

      {/* ── Modal de Detalle Completo de Equipo/Producto en Venta ── */}
      <Dialog open={isUnitDetailOpen} onOpenChange={setIsUnitDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl border-slate-200 bg-white p-5 sm:p-6 shadow-2xl">
          {selectedUnitForDetail && (() => {
            const unit = selectedUnitForDetail.rawUnit || selectedUnitForDetail;
            const typeInfo = getUnitTypeBadge(unit.type || unit.unitType);
            const specs = typeof unit.specs === "object" ? unit.specs : {};
            const isCharger = (unit.type || unit.unitType) === "charger";

            return (
              <div className="space-y-4">
                <DialogHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`font-bold text-xs px-2.5 py-0.5 ${typeInfo.color}`}>
                      {typeInfo.icon} {typeInfo.label}
                    </Badge>
                    {unit.code && (
                      <Badge variant="outline" className="font-mono text-xs bg-slate-50 text-slate-700 border-slate-300">
                        {unit.code}
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-xl font-black text-slate-900 mt-2">
                    {unit.brand} {unit.model}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Ficha técnica completa y detalles del inventario
                  </DialogDescription>
                </DialogHeader>

                {/* Precios Disponibles */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                  <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Unitario</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{formatCurrency(unit.salePrice || 0)}</p>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-[9px] font-bold text-emerald-600 uppercase">Descuento</p>
                    <p className="text-sm font-black text-emerald-700 mt-0.5">{formatCurrency(unit.discountPrice || unit.salePrice || 0)}</p>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-[9px] font-bold text-blue-600 uppercase">Por Mayor</p>
                    <p className="text-sm font-black text-blue-700 mt-0.5">{formatCurrency(unit.wholesalePrice || unit.salePrice || 0)}</p>
                  </div>
                </div>

                {/* Especificaciones Técnicas */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Especificaciones Técnicas
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {isCharger ? (
                      <>
                        {specs.watts && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold">POTENCIA</span>
                            <span className="font-bold text-slate-800">{specs.watts}W</span>
                          </div>
                        )}
                        {(specs.voltage || specs.amperage) && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold">VOLTAJE / AMPERAJE</span>
                            <span className="font-bold text-slate-800">{specs.voltage ? `${specs.voltage}V` : ""} {specs.amperage ? `${specs.amperage}A` : ""}</span>
                          </div>
                        )}
                        {specs.connector && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                            <span className="text-[10px] text-slate-400 block font-bold">TIPO DE CONECTOR / PUNTA</span>
                            <span className="font-bold text-slate-800">{specs.connector}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {specs.cpu && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold">PROCESADOR (CPU)</span>
                            <span className="font-bold text-slate-800">{specs.cpu}</span>
                          </div>
                        )}
                        {specs.ram && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold">MEMORIA RAM</span>
                            <span className="font-bold text-slate-800">{specs.ram}</span>
                          </div>
                        )}
                        {specs.storage && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold">ALMACENAMIENTO</span>
                            <span className="font-bold text-slate-800">{specs.storage}</span>
                          </div>
                        )}
                        {specs.screen && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold">PANTALLA</span>
                            <span className="font-bold text-slate-800">{specs.screen}</span>
                          </div>
                        )}
                        {specs.gpu && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                            <span className="text-[10px] text-slate-400 block font-bold">TARJETA DE VIDEO (GPU)</span>
                            <span className="font-bold text-slate-800">{specs.gpu}</span>
                          </div>
                        )}
                      </>
                    )}

                    {unit.serialNumber && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                        <span className="text-[10px] text-slate-400 block font-bold">NÚMERO DE SERIE (S/N)</span>
                        <span className="font-mono font-bold text-slate-800">{unit.serialNumber}</span>
                      </div>
                    )}

                    {unit.condition && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-bold">CONDICIÓN</span>
                        <span className="font-bold text-slate-800 capitalize">
                          {unit.condition === "new" ? "Nuevo" : unit.condition === "refurbished" ? "Reacondicionado" : "Usado"}
                        </span>
                      </div>
                    )}

                    {unit.location && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-bold">UBICACIÓN / VITRINA</span>
                        <span className="font-bold text-slate-800">{unit.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notas o Daños */}
                {unit.damageNotes && (
                  <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs">
                    <span className="text-[10px] font-bold text-amber-800 uppercase block mb-0.5">Observaciones / Detalles</span>
                    <p className="text-amber-900">{unit.damageNotes}</p>
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    onClick={() => setIsUnitDetailOpen(false)}
                    className="w-full bg-slate-900 hover:bg-slate-800 font-bold"
                  >
                    Cerrar Detalle
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
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
