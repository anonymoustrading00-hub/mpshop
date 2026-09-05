import { useState } from "react";
import { trpc } from "../utils/trpc";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  generateOrdersPDF,
  generateSalesPDF,
  generatePurchasesPDF,
  generateInventoryPDF,
  generateFinancePDF,
  generateCustomersPDF,
  generateInventoryMovementsPDF,
  generateAuditPDF,
} from "../utils/pdfReports";
import { Download, FileText, Calendar, DollarSign, Package, Users, Activity, History, ShoppingCart, FileSpreadsheet } from "lucide-react";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    startDate: format(new Date(new Date().setDate(new Date().getDate() - 30)), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [selectedReport, setSelectedReport] = useState("orders");

  // Queries para obtener datos
  const ordersQuery = trpc.reports.ordersReport.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const salesQuery = trpc.reports.salesReport.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const purchasesQuery = (trpc.reports as any).purchasesReport.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const inventoryQuery = trpc.reports.inventoryReport.useQuery();
  const movementsQuery = trpc.reports.inventoryMovementsReport.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const financeQuery = trpc.reports.financeReport.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const customersQuery = trpc.reports.customersReport.useQuery();
  const auditQuery = trpc.audit.list.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    limit: 200,
  });
  const { data: companyConfig } = trpc.settings.getCompanyConfig.useQuery();

  const isLoading = ordersQuery.isLoading ||
    salesQuery.isLoading ||
    purchasesQuery.isLoading ||
    inventoryQuery.isLoading ||
    movementsQuery.isLoading ||
    financeQuery.isLoading ||
    customersQuery.isLoading ||
    auditQuery.isLoading;

  // Funciones de descarga PDF
  const downloadOrdersReport = () => {
    if (ordersQuery.data) {
      const doc = generateOrdersPDF(ordersQuery.data, dateRange, companyConfig);
      doc.save(`reporte-pedidos-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadSalesReport = () => {
    if (salesQuery.data) {
      const doc = generateSalesPDF(salesQuery.data, dateRange, companyConfig);
      doc.save(`reporte-ventas-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadPurchasesReport = () => {
    if (purchasesQuery.data) {
      const doc = generatePurchasesPDF(purchasesQuery.data, dateRange, companyConfig);
      doc.save(`reporte-compras-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadInventoryReport = () => {
    if (inventoryQuery.data) {
      const doc = generateInventoryPDF(inventoryQuery.data, companyConfig);
      doc.save(`reporte-inventario-unidades-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadMovementsReport = () => {
    if (movementsQuery.data) {
      const doc = generateInventoryMovementsPDF(
        movementsQuery.data.movements,
        movementsQuery.data.products,
        companyConfig
      );
      doc.save(`reporte-movimientos-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadFinanceReport = () => {
    if (financeQuery.data) {
      const doc = generateFinancePDF(
        financeQuery.data.transactions,
        financeQuery.data.closures,
        companyConfig
      );
      doc.save(`reporte-financiero-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadCustomersReport = () => {
    if (customersQuery.data) {
      const doc = generateCustomersPDF(customersQuery.data, companyConfig);
      doc.save(`reporte-clientes-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadAuditReport = () => {
    if (auditQuery.data) {
      const doc = generateAuditPDF(auditQuery.data, companyConfig);
      doc.save(`reporte-auditoria-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  // Funciones de descarga EXCEL (.xlsx)
  const downloadOrdersExcel = () => {
    if (!ordersQuery.data || ordersQuery.data.length === 0) return;
    const rows = ordersQuery.data.map((o: any) => ({
      "Nº Pedido": o.orderNumber,
      "Cliente": o.customer?.name || o.customerName || "N/A",
      "Celular": o.customer?.phone || o.customer?.whatsapp || o.customer?.clientNumber || "-",
      "Fecha": o.createdAt ? format(new Date(o.createdAt), "dd/MM/yyyy HH:mm") : "-",
      "Estado": o.status === "pending" ? "Pendiente"
        : o.status === "assigned" ? "Asignado"
        : o.status === "in_transit" ? "En camino"
        : o.status === "delivered" ? "Entregado"
        : o.status === "cancelled" ? "Cancelado"
        : o.status || "-",
      "Total (Bs.)": (o.totalPrice || 0) / 100,
      "Estado de Pago": o.paymentStatus || "pendiente",
      "Método de Pago": o.paymentMethod || "-",
      "Repartidor": o.deliveryPerson?.name || "-",
      "Dirección": o.shippingAddress || o.customer?.address || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, `reporte-pedidos-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const downloadSalesExcel = () => {
    if (!salesQuery.data || salesQuery.data.length === 0) return;
    const rows = salesQuery.data.map((s: any) => ({
      "Nº Venta": s.saleNumber,
      "Cliente": s.customerName || s.customer?.name || "Venta anónima",
      "Fecha": s.createdAt ? format(new Date(s.createdAt), "dd/MM/yyyy HH:mm") : "-",
      "Canal": s.saleChannel === "delivery" ? "Delivery" : "Local",
      "Método Pago": s.paymentMethod === "cash" ? "Efectivo"
        : s.paymentMethod === "qr" ? "QR"
        : s.paymentMethod === "transfer" ? "Transferencia"
        : s.paymentMethod === "credit" ? "Crédito"
        : s.paymentMethod || "-",
      "Subtotal (Bs.)": (s.subtotal || 0) / 100,
      "Descuento (Bs.)": (s.discountAmount || 0) / 100,
      "Total (Bs.)": (s.total || 0) / 100,
      "Estado Pago": s.paymentStatus === "completed" ? "Pagado" : "Pendiente",
      "Vendedor": s.seller?.name || "-",
      "Garantía (Días)": s.warrantyDays || 30,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, `reporte-ventas-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const downloadPurchasesExcel = () => {
    if (!purchasesQuery.data || purchasesQuery.data.length === 0) return;
    const rows = purchasesQuery.data.map((p: any) => ({
      "Nº Compra": p.purchaseNumber,
      "Proveedor": p.supplier?.name || p.supplierName || "Proveedor General",
      "Teléfono Proveedor": p.supplier?.phone || "-",
      "Fecha de Compra": (p.orderDate || p.createdAt) ? format(new Date(p.orderDate || p.createdAt), "dd/MM/yyyy HH:mm") : "-",
      "Estado": p.status === "received" ? "Recibido" : p.status === "cancelled" ? "Cancelado" : "Pendiente",
      "Método Pago": p.paymentMethod === "cash" ? "Efectivo"
        : p.paymentMethod === "qr" ? "QR"
        : p.paymentMethod === "transfer" ? "Transferencia"
        : p.paymentMethod === "credit" ? "Crédito"
        : p.paymentMethod || "Efectivo",
      "Estado Pago": p.paymentStatus === "paid" ? "Pagado" : "Pendiente",
      "A Crédito": p.isCredit ? "Sí" : "No",
      "Total Compra (Bs.)": (p.totalAmount || 0) / 100,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Compras");
    XLSX.writeFile(wb, `reporte-compras-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const downloadInventoryExcel = () => {
    const units = inventoryQuery.data?.units || [];
    if (units.length === 0) return;
    const rows = units.map((u: any) => {
      const pCost = (u.purchasePrice || 0) / 100;
      const sPrice = (u.salePrice || 0) / 100;
      const margin = sPrice - pCost;
      const purchaseMatch = u.purchaseId ? purchasesQuery.data?.find((p: any) => p.id === u.purchaseId) : null;
      const rawDate = u.purchaseDate || purchaseMatch?.orderDate || purchaseMatch?.createdAt || u.createdAt;
      const purchaseDate = rawDate ? new Date(rawDate) : null;
      const validPurchaseDate = purchaseDate && !isNaN(purchaseDate.getTime()) ? format(purchaseDate, "dd/MM/yyyy") : "-";
      const days = purchaseDate && !isNaN(purchaseDate.getTime()) ? Math.max(0, Math.floor((Date.now() - purchaseDate.getTime()) / 86400000)) : 0;
      return {
        "Código": u.code || `UNI-${u.id}`,
        "Tipo": u.type || "-",
        "Marca": u.brand || "-",
        "Modelo": u.model || "-",
        "Nº Serie / IMEI": u.serialNumber || "-",
        "Condición (1-10)": u.condition ?? "-",
        "Estado": u.status === "available" ? "Disponible"
          : u.status === "in_repair" ? "En Taller"
          : u.status === "in_diagnosis" ? "Diagnóstico"
          : u.status === "sold" ? "Vendido"
          : u.status === "reserved" ? "Reservado"
          : u.status === "returned" ? "Garantía"
          : u.status || "-",
        "Fecha de Compra": validPurchaseDate,
        "Días en Stock": days,
        "Precio Compra (Bs.)": pCost,
        "Precio Venta (Bs.)": sPrice,
        "Margen Estimado (Bs.)": margin,
        "% Margen": marginPct,
        "Fecha Registro": u.createdAt ? format(new Date(u.createdAt), "dd/MM/yyyy") : "-",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario_Unidades");
    XLSX.writeFile(wb, `reporte-inventario-unidades-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const downloadMovementsExcel = () => {
    const movements = movementsQuery.data?.movements || (Array.isArray(movementsQuery.data) ? movementsQuery.data : []);
    if (movements.length === 0) return;
    const products = movementsQuery.data?.products || [];
    const rows = movements.map((m: any) => {
      const product = products.find((p: any) => p.id === m.productId);
      return {
        "Fecha": m.createdAt ? format(new Date(m.createdAt), "dd/MM/yyyy HH:mm") : "-",
        "ID Unidad": m.unitId || "-",
        "Producto / Detalle": product?.name || m.unitCode || "Movimiento",
        "Tipo Movimiento": m.type === "entry" ? "ENTRADA" : m.type === "exit" ? "SALIDA" : m.type || "AJUSTE",
        "Estado Anterior": m.fromStatus || "-",
        "Estado Nuevo": m.toStatus || "-",
        "Cantidad": m.quantity ?? 1,
        "Razón / Motivo": m.reason || m.notes || "-",
        "Usuario ID": m.userId || "-",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
    XLSX.writeFile(wb, `reporte-movimientos-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const downloadFinanceExcel = () => {
    const transactions = financeQuery.data?.transactions || (Array.isArray(financeQuery.data) ? financeQuery.data : []);
    if (transactions.length === 0) return;
    const rows = transactions.map((t: any) => ({
      "Fecha": t.createdAt ? format(new Date(t.createdAt), "dd/MM/yyyy HH:mm") : "-",
      "Tipo": t.type === "income" ? "Ingreso" : "Egreso / Gasto",
      "Categoría": t.category || "General",
      "Método Pago": t.paymentMethod === "cash" ? "Efectivo"
        : t.paymentMethod === "qr" ? "QR"
        : t.paymentMethod === "transfer" ? "Transferencia"
        : t.paymentMethod || "Efectivo",
      "Monto (Bs.)": (t.amount || 0) / 100,
      "Notas / Referencia": t.notes || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transacciones");
    XLSX.writeFile(wb, `reporte-finanzas-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const downloadCustomersExcel = () => {
    if (!customersQuery.data || customersQuery.data.length === 0) return;
    const rows = customersQuery.data.map((c: any) => ({
      "Código": c.clientNumber || `CLI-${c.id}`,
      "Nombre": c.name || "-",
      "Teléfono / Celular": c.phone || "-",
      "WhatsApp": c.whatsapp || "-",
      "Zona": c.zona || "Sin zona",
      "Dirección": c.address || "-",
      "Email": c.email || "-",
      "Límite Crédito (Bs.)": (c.creditLimit || 0) / 100,
      "Saldo Pendiente (Bs.)": (c.currentBalance || 0) / 100,
      "Fecha Registro": c.createdAt ? format(new Date(c.createdAt), "dd/MM/yyyy") : "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `reporte-clientes-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const downloadAuditExcel = () => {
    if (!auditQuery.data || auditQuery.data.length === 0) return;
    const rows = auditQuery.data.map((l: any) => ({
      "Fecha": l.createdAt ? format(new Date(l.createdAt), "dd/MM/yyyy HH:mm") : "-",
      "Entidad": l.entityType || "-",
      "ID Registro": l.entityId || "-",
      "Acción": l.action || "-",
      "Usuario": l.user?.name || l.userName || (l.userId ? `ID #${l.userId}` : "Sistema"),
      "Descripción": l.description || "-",
      "Dirección IP": l.ipAddress || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoría");
    XLSX.writeFile(wb, `reporte-auditoria-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const reportTypes = [
    {
      id: "orders",
      name: "Pedidos",
      icon: FileText,
      description: "Reporte de todos los pedidos",
      onDownloadPDF: downloadOrdersReport,
      onDownloadExcel: downloadOrdersExcel,
      dataCount: ordersQuery.data?.length || 0,
    },
    {
      id: "sales",
      name: "Ventas",
      icon: DollarSign,
      description: "Reporte de ventas y cobranzas",
      onDownloadPDF: downloadSalesReport,
      onDownloadExcel: downloadSalesExcel,
      dataCount: salesQuery.data?.length || 0,
    },
    {
      id: "purchases",
      name: "Compras",
      icon: ShoppingCart,
      description: "Reporte de compras a proveedores",
      onDownloadPDF: downloadPurchasesReport,
      onDownloadExcel: downloadPurchasesExcel,
      dataCount: purchasesQuery.data?.length || 0,
    },
    {
      id: "inventory",
      name: "Inventario (Unidades)",
      icon: Package,
      description: "Valoración y análisis del inventario",
      onDownloadPDF: downloadInventoryReport,
      onDownloadExcel: downloadInventoryExcel,
      dataCount: inventoryQuery.data?.units?.length || 0,
    },
    {
      id: "movements",
      name: "Movimientos",
      icon: Activity,
      description: "Historial de movimientos",
      onDownloadPDF: downloadMovementsReport,
      onDownloadExcel: downloadMovementsExcel,
      dataCount: movementsQuery.data?.movements?.length || 0,
    },
    {
      id: "finance",
      name: "Finanzas",
      icon: Calendar,
      description: "Transacciones y cierres de caja",
      onDownloadPDF: downloadFinanceReport,
      onDownloadExcel: downloadFinanceExcel,
      dataCount: financeQuery.data?.transactions?.length || 0,
    },
    {
      id: "customers",
      name: "Clientes",
      icon: Users,
      description: "Lista de clientes registrados",
      onDownloadPDF: downloadCustomersReport,
      onDownloadExcel: downloadCustomersExcel,
      dataCount: customersQuery.data?.length || 0,
    },
    {
      id: "audit",
      name: "Auditoría",
      icon: History,
      description: "Historial de cambios del sistema",
      onDownloadPDF: downloadAuditReport,
      onDownloadExcel: downloadAuditExcel,
      dataCount: auditQuery.data?.length || 0,
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight"><span className="text-teal-600">Reportes</span></h1>
        <p className="text-sm text-slate-500 mt-1.5">Genera y descarga reportes en PDF y Excel del sistema</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <h2 className="font-medium text-gray-700 mb-3">Período de Reporte</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
              }
              className="border rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
              }
              className="border rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
        </div>
      </div>

      {/* Reportes con Botones Uno al Lado de Otro (PDF y Excel) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            className={`bg-white rounded-xl border p-5 transition-all cursor-pointer flex flex-col justify-between ${
              selectedReport === report.id
                ? "border-green-500 shadow-md ring-1 ring-green-500/20"
                : "border-gray-200 hover:border-green-300 shadow-sm"
            }`}
            onClick={() => setSelectedReport(report.id)}
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`p-2 rounded-lg ${
                    selectedReport === report.id
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <report.icon size={24} />
                </div>
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {report.dataCount} registros
                </span>
              </div>
              <h3 className="font-bold text-gray-800 text-base mb-1">{report.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{report.description}</p>
            </div>

            {/* BOTONES UNO AL LADO DE OTRO */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  report.onDownloadPDF();
                }}
                disabled={isLoading || report.dataCount === 0}
                className="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 disabled:pointer-events-none"
                title="Descargar reporte en formato PDF"
              >
                <Download size={14} />
                <span>PDF</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  report.onDownloadExcel();
                }}
                disabled={isLoading || report.dataCount === 0}
                className="flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 disabled:pointer-events-none"
                title="Descargar reporte en formato Excel .xlsx"
              >
                <FileSpreadsheet size={14} />
                <span>Excel</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-3"></div>
            <p className="text-gray-600">Generando reporte...</p>
          </div>
        </div>
      )}

      {/* Vista previa del reporte seleccionado */}
      {selectedReport && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-700 mb-3">
            Vista previa: {reportTypes.find((r) => r.id === selectedReport)?.name}
          </h3>
          <div className="text-sm text-gray-500">
            {selectedReport === "orders" &&
              ordersQuery.data?.length === 0 &&
              "No hay pedidos en el período seleccionado"}
            {selectedReport === "sales" &&
              salesQuery.data?.length === 0 &&
              "No hay ventas en el período seleccionado"}
            {selectedReport === "purchases" &&
              purchasesQuery.data?.length === 0 &&
              "No hay compras en el período seleccionado"}
            {selectedReport === "inventory" &&
              inventoryQuery.data?.units?.length === 0 &&
              "No hay unidades registradas"}
            {selectedReport === "movements" &&
              movementsQuery.data?.movements.length === 0 &&
              "No hay movimientos en el período seleccionado"}
            {selectedReport === "finance" &&
              financeQuery.data?.transactions.length === 0 &&
              "No hay transacciones en el período seleccionado"}
            {selectedReport === "customers" &&
              customersQuery.data?.length === 0 &&
              "No hay clientes registrados"}
            {selectedReport === "audit" &&
              auditQuery.data?.length === 0 &&
              "No hay registros de auditoría"}
          </div>
        </div>
      )}

      {/* ─── EXPORTACIONES EXCEL ─────────────────────────────────────────── */}
      <ExcelExportSection from={dateRange.startDate} to={dateRange.endDate} />

    </div>
  );
}

// ─── Excel Export Section ──────────────────────────────────────────────────

function downloadBase64Excel(base64: string, filename: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = Array.from(byteCharacters, (c) => c.charCodeAt(0));
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ExcelExportSection({ from, to }: { from: string; to: string }) {
  const [cutoff, setCutoff] = useState(format(new Date(), "yyyy-MM-dd"));

  const financialMut = (trpc.reportsExcel as any).financialExcel.useMutation({
    onSuccess: (data: any) => downloadBase64Excel(data.base64, data.filename),
    onError: (e: any) => alert("Error: " + e.message),
  });
  const inventoryMut = (trpc.reportsExcel as any).inventoryExcel.useMutation({
    onSuccess: (data: any) => downloadBase64Excel(data.base64, data.filename),
    onError: (e: any) => alert("Error: " + e.message),
  });
  const warrantyMut = (trpc.reportsExcel as any).warrantyReturnsExcel.useMutation({
    onSuccess: (data: any) => downloadBase64Excel(data.base64, data.filename),
    onError: (e: any) => alert("Error: " + e.message),
  });
  const purchasesMut = (trpc.reportsExcel as any).purchasesExcel.useMutation({
    onSuccess: (data: any) => downloadBase64Excel(data.base64, data.filename),
    onError: (e: any) => alert("Error: " + e.message),
  });

  const excelReports = [
    {
      name: "Reporte Financiero Excel",
      description: `Ingresos, egresos por categoría, utilidad neta del período ${from} → ${to}`,
      icon: DollarSign,
      loading: financialMut.isPending,
      onClick: () => financialMut.mutate({ from, to }),
    },
    {
      name: "Compras del Período Excel",
      description: `Detalle de compras a proveedores con Fecha de Compra del período ${from} → ${to}`,
      icon: ShoppingCart,
      loading: purchasesMut.isPending,
      onClick: () => purchasesMut.mutate({ from, to }),
    },
    {
      name: "Inventario a Fecha de Corte",
      description: `Unidades activas, costo acumulado, antigüedad al ${cutoff}`,
      icon: Package,
      loading: inventoryMut.isPending,
      onClick: () => inventoryMut.mutate({ cutoffDate: cutoff }),
      extra: (
        <div className="mt-2">
          <label className="text-xs text-gray-500 block mb-1">Fecha de corte:</label>
          <input
            type="date"
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
            className="border rounded px-2 py-1 text-xs w-full"
          />
        </div>
      ),
    },
    {
      name: "Garantías y Devoluciones Excel",
      description: `Devoluciones y garantías del período ${from} → ${to}`,
      icon: Activity,
      loading: warrantyMut.isPending,
      onClick: () => warrantyMut.mutate({ from, to }),
    },
  ];

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
          <FileText size={16} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Exportar a Excel</h2>
          <p className="text-sm text-gray-500">Reportes de período cerrado exportables a .xlsx</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {excelReports.map((rep) => (
          <div key={rep.name} className="bg-white rounded-lg border border-gray-200 p-5 hover:border-emerald-300 transition-all">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <rep.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 text-sm leading-snug">{rep.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{rep.description}</p>
              </div>
            </div>
            {rep.extra}
            <button
              onClick={rep.onClick}
              disabled={rep.loading}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-colors"
            >
              <Download size={14} />
              {rep.loading ? "Generando..." : "Descargar Excel"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
