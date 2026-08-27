import { useState } from "react";
import { trpc } from "../utils/trpc";
import { format } from "date-fns";
import {
  generateOrdersPDF,
  generateSalesPDF,
  generateInventoryPDF,
  generateFinancePDF,
  generateCustomersPDF,
  generateInventoryMovementsPDF,
  generateAuditPDF,
} from "../utils/pdfReports";
import { Download, FileText, Calendar, DollarSign, Package, Users, Activity, History } from "lucide-react";

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
    inventoryQuery.isLoading ||
    movementsQuery.isLoading ||
    financeQuery.isLoading ||
    customersQuery.isLoading ||
    auditQuery.isLoading;

  // Funciones de descarga
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

  const reportTypes = [
    {
      id: "orders",
      name: "Pedidos",
      icon: FileText,
      description: "Reporte de todos los pedidos",
      onDownload: downloadOrdersReport,
      dataCount: ordersQuery.data?.length || 0,
    },
    {
      id: "sales",
      name: "Ventas",
      icon: DollarSign,
      description: "Reporte de ventas y cobranzas",
      onDownload: downloadSalesReport,
      dataCount: salesQuery.data?.length || 0,
    },
    {
      id: "inventory",
      name: "Inventario (Unidades)",
      icon: Package,
      description: "Valoración y análisis del inventario",
      onDownload: downloadInventoryReport,
      dataCount: inventoryQuery.data?.units?.length || 0,
    },
    {
      id: "movements",
      name: "Movimientos",
      icon: Activity,
      description: "Historial de movimientos",
      onDownload: downloadMovementsReport,
      dataCount: movementsQuery.data?.movements?.length || 0,
    },
    {
      id: "finance",
      name: "Finanzas",
      icon: Calendar,
      description: "Transacciones y cierres de caja",
      onDownload: downloadFinanceReport,
      dataCount: financeQuery.data?.transactions?.length || 0,
    },
    {
      id: "customers",
      name: "Clientes",
      icon: Users,
      description: "Lista de clientes registrados",
      onDownload: downloadCustomersReport,
      dataCount: customersQuery.data?.length || 0,
    },
    {
      id: "audit",
      name: "Auditoría",
      icon: History,
      description: "Historial de cambios del sistema",
      onDownload: downloadAuditReport,
      dataCount: auditQuery.data?.length || 0,
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight"><span className="text-teal-600">Reportes</span></h1>
        <p className="text-sm text-slate-500 mt-1.5">Genera y descarga reportes del sistema</p>
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

      {/* Reportes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            className={`bg-white rounded-lg border p-5 transition-all cursor-pointer ${
              selectedReport === report.id
                ? "border-green-500 shadow-md"
                : "border-gray-200 hover:border-green-300"
            }`}
            onClick={() => setSelectedReport(report.id)}
          >
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
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                {report.dataCount} registros
              </span>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">{report.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{report.description}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                report.onDownload();
              }}
              disabled={isLoading || report.dataCount === 0}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg transition-colors"
            >
              <Download size={16} />
              Descargar PDF
            </button>
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

  const excelReports = [
    {
      name: "Reporte Financiero Excel",
      description: `Ingresos, egresos por categoría, utilidad neta del período ${from} → ${to}`,
      icon: DollarSign,
      loading: financialMut.isPending,
      onClick: () => financialMut.mutate({ from, to }),
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
