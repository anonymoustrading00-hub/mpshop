import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";

// The exact shape returned by server's getBusinessAnalysis
type BusinessData = {
  summary: {
    totalTransactions: number;
    totalDeliveries: number;
    totalSales: number;
    totalRevenue: number;
    totalExpenses: number;
    totalPurchases?: number;
    purchaseCount?: number;
    netIncome: number;
    avgOrderValue: number;
    activeZones: number;
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    retentionRate: number;
  };
  deliveriesData: { date: string; count: number }[];
  topFlavors: { name: string; quantity: number }[];
  channelsData: { name: string; value: number }[];
  zonesData: { name: string; value: number }[];
  customerDemographics: { name: string; value: number }[];
  paymentMethods: { name: string; value: number }[];
  topCustomers: { name: string; value: number; count: number }[];
  expensesByCategory: { name: string; value: number }[];
  customerRetention: { name: string; value: number }[];
};

export const exportBusinessToPDF = (data: BusinessData, periodStr: string) => {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("REPORTE DE ANÁLISIS DE NEGOCIO", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${periodStr}`, 14, 20);
  doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 145, 20);
  doc.setTextColor(0, 0, 0);

  let yPos = 38;

  // SECCIÓN 1: Resumen
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("1. Resumen Financiero y Operativo", 14, yPos);
  yPos += 5;

  const summaryData = [
    ["Transacciones Totales", data.summary.totalTransactions.toString()],
    ["  → Entregas (Delivery)", data.summary.totalDeliveries.toString()],
    ["  → Ventas (Caja/Directa)", data.summary.totalSales.toString()],
    ["Ingresos Brutos", `Bs. ${(data.summary.totalRevenue / 100).toFixed(2)}`],
    ["Compras", `Bs. ${((data.summary.totalPurchases || 0) / 100).toFixed(2)}`],
    ["Egresos Totales", `Bs. ${(data.summary.totalExpenses / 100).toFixed(2)}`],
    ["Utilidad Neta", `Bs. ${(data.summary.netIncome / 100).toFixed(2)}`],
    ["Ticket Promedio", `Bs. ${(data.summary.avgOrderValue / 100).toFixed(2)}`],
    ["Clientes Atendidos", data.summary.totalCustomers.toString()],
    ["  → Clientes Nuevos", `${data.summary.newCustomers} (${100 - data.summary.retentionRate}%)`],
    ["  → Clientes Recurrentes", `${data.summary.returningCustomers} (${data.summary.retentionRate}%)`],
    ["Zonas Activas", data.summary.activeZones.toString()],
  ];

  (doc as any).autoTable({
    startY: yPos,
    head: [["Métrica", "Valor"]],
    body: summaryData,
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129], textColor: 255 },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  if (yPos > 230) { doc.addPage(); yPos = 20; }

  // SECCIÓN 2: Top Productos
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("2. Top Productos / Sabores Más Vendidos", 14, yPos);
  yPos += 5;

  (doc as any).autoTable({
    startY: yPos,
    head: [["#", "Producto / Sabor", "Unidades"]],
    body: data.topFlavors.map((p, i) => [(i + 1).toString(), p.name, p.quantity.toString()]),
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 9 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  if (yPos > 230) { doc.addPage(); yPos = 20; }

  // SECCIÓN 3: Canales de Venta
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("3. Canales de Captación", 14, yPos);
  yPos += 5;

  (doc as any).autoTable({
    startY: yPos,
    head: [["Canal", "Cantidad", "% del Total"]],
    body: (() => {
      const total = data.channelsData.reduce((s, c) => s + c.value, 0);
      return data.channelsData.map(c => [c.name, c.value.toString(), `${Math.round((c.value / total) * 100)}%`]);
    })(),
    theme: "striped",
    headStyles: { fillColor: [245, 158, 11], textColor: 255 },
    styles: { fontSize: 9 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  if (yPos > 230) { doc.addPage(); yPos = 20; }

  // SECCIÓN 4: Zonas
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("4. Distribución por Zonas", 14, yPos);
  yPos += 5;

  (doc as any).autoTable({
    startY: yPos,
    head: [["Zona", "Pedidos"]],
    body: data.zonesData.map(z => [z.name, z.value.toString()]),
    theme: "striped",
    headStyles: { fillColor: [139, 92, 246], textColor: 255 },
    styles: { fontSize: 9 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  if (yPos > 230) { doc.addPage(); yPos = 20; }

  // SECCIÓN 5: Gastos por Categoría
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("5. Gastos Operativos por Categoría", 14, yPos);
  yPos += 5;

  (doc as any).autoTable({
    startY: yPos,
    head: [["Categoría", "Monto (Bs.)", "% del Total"]],
    body: (() => {
      const total = data.expensesByCategory.reduce((s, e) => s + e.value, 0);
      return data.expensesByCategory.map(e => [
        e.name,
        e.value.toFixed(2),
        total > 0 ? `${Math.round((e.value / total) * 100)}%` : "0%",
      ]);
    })(),
    theme: "striped",
    headStyles: { fillColor: [239, 68, 68], textColor: 255 },
    styles: { fontSize: 9 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;
  if (yPos > 230) { doc.addPage(); yPos = 20; }

  // SECCIÓN 6: Top Clientes
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("6. Top Clientes por Volumen de Compra", 14, yPos);
  yPos += 5;

  (doc as any).autoTable({
    startY: yPos,
    head: [["#", "Cliente", "Compras", "Monto Total (Bs.)"]],
    body: data.topCustomers.map((c, i) => [
      (i + 1).toString(), 
      c.name, 
      c.count.toString(),
      c.value.toFixed(2)
    ]),
    theme: "striped",
    headStyles: { fillColor: [75, 85, 99], textColor: 255 },
    styles: { fontSize: 9 },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Pág. ${i} de ${pageCount}`, 190, 290, { align: "right" });
  }

  doc.save(`analisis_negocio_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
};

export const exportBusinessToExcel = (data: BusinessData, periodStr: string) => {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: RESUMEN ──
  const wsSummary = XLSX.utils.aoa_to_sheet([
    ["REPORTE DE ANÁLISIS DE NEGOCIO"],
    [`Período: ${periodStr}`],
    [`Fecha de generación: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
    [],
    ["MÉTRICA", "VALOR"],
    ["Transacciones Totales", data.summary.totalTransactions],
    ["Entregas (Delivery)", data.summary.totalDeliveries],
    ["Ventas (Caja/Directa)", data.summary.totalSales],
    ["Ingresos Brutos (Bs.)", +(data.summary.totalRevenue / 100).toFixed(2)],
    ["Compras (Bs.)", +((data.summary.totalPurchases || 0) / 100).toFixed(2)],
    ["Egresos Totales (Bs.)", +(data.summary.totalExpenses / 100).toFixed(2)],
    ["Utilidad Neta (Bs.)", +(data.summary.netIncome / 100).toFixed(2)],
    ["Ticket Promedio (Bs.)", +(data.summary.avgOrderValue / 100).toFixed(2)],
    [],
    ["RETENCIÓN DE CLIENTES", ""],
    ["Clientes Atendidos en el Período", data.summary.totalCustomers],
    ["Clientes Nuevos", data.summary.newCustomers],
    ["Clientes Recurrentes", data.summary.returningCustomers],
    ["Tasa de Retención (%)", data.summary.retentionRate],
    [],
    ["Zonas Activas", data.summary.activeZones],
  ]);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

  // ── Hoja 2: TOP PRODUCTOS ──
  const wsProducts = XLSX.utils.aoa_to_sheet([
    ["#", "PRODUCTO / SABOR", "UNIDADES VENDIDAS"],
    ...data.topFlavors.map((p, i) => [i + 1, p.name, p.quantity]),
  ]);
  XLSX.utils.book_append_sheet(wb, wsProducts, "Top Productos");

  // ── Hoja 3: TENDENCIA DIARIA ──
  const wsTrend = XLSX.utils.aoa_to_sheet([
    ["FECHA", "TRANSACCIONES"],
    ...data.deliveriesData.map(d => [d.date, d.count]),
  ]);
  XLSX.utils.book_append_sheet(wb, wsTrend, "Tendencia Diaria");

  // ── Hoja 4: SEGMENTACIÓN ──
  const totalCh = data.channelsData.reduce((s, c) => s + c.value, 0);
  const wsSegment = XLSX.utils.aoa_to_sheet([
    ["CANAL DE CAPTACIÓN", "CANTIDAD", "% DEL TOTAL"],
    ...data.channelsData.map(c => [c.name, c.value, totalCh > 0 ? `${Math.round((c.value / totalCh) * 100)}%` : "0%"]),
    [],
    ["ZONA", "PEDIDOS"],
    ...data.zonesData.map(z => [z.name, z.value]),
    [],
    ["GÉNERO", "CANTIDAD"],
    ...data.customerDemographics.map(g => [g.name, g.value]),
    [],
    ["MÉTODO DE PAGO", "MONTO (Bs.)"],
    ...data.paymentMethods.map(m => [m.name, m.value.toFixed(2)]),
    [],
    ["RETENCIÓN", "CANTIDAD"],
    ...data.customerRetention.map(r => [r.name, r.value]),
  ]);
  XLSX.utils.book_append_sheet(wb, wsSegment, "Segmentación");

  // ── Hoja 5: GASTOS ──
  const totalExp = data.expensesByCategory.reduce((s, e) => s + e.value, 0);
  const wsExpenses = XLSX.utils.aoa_to_sheet([
    ["CATEGORÍA DE GASTO", "MONTO (Bs.)", "% DEL TOTAL"],
    ...data.expensesByCategory.map(e => [
      e.name,
      +e.value.toFixed(2),
      totalExp > 0 ? `${Math.round((e.value / totalExp) * 100)}%` : "0%",
    ]),
    [],
    ["TOTAL GASTOS", +totalExp.toFixed(2)],
  ]);
  XLSX.utils.book_append_sheet(wb, wsExpenses, "Gastos");

  // ── Hoja 6: TOP CLIENTES ──
  const wsClients = XLSX.utils.aoa_to_sheet([
    ["#", "CLIENTE", "CANT. COMPRAS", "MONTO TOTAL (Bs.)"],
    ...data.topCustomers.map((c, i) => [i + 1, c.name, c.count, +c.value.toFixed(2)]),
  ]);
  XLSX.utils.book_append_sheet(wb, wsClients, "Top Clientes");


  XLSX.writeFile(wb, `analisis_negocio_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
};
