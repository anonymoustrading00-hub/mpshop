import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Formatear dinero en Bs.
export const formatBs = (cents: number | undefined | null) => {
  if (cents === undefined || cents === null) return "Bs. 0.00";
  return `Bs. ${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Función base para crear PDF
export const createPDF = (title: string, companyConfig?: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const companyName = companyConfig?.name || "HK EQUIPOS TECNOLÓGICOS";
  const companyLogo = companyConfig?.logo;

  // Logo de la empresa (si existe)
  if (companyLogo) {
    try {
      const format = companyLogo.startsWith("data:image/jpeg") || companyLogo.startsWith("data:image/jpg") ? "JPEG" : "PNG";
      doc.addImage(companyLogo, format, 14, 10, 24, 24);
    } catch (e) {
      console.log("Could not render companyConfig logo in PDF", e);
      try {
        doc.addImage("/logo.png", "PNG", 14, 10, 24, 24);
      } catch (e2) {}
    }
  } else {
    try {
      doc.addImage("/logo.png", "PNG", 14, 10, 24, 24);
    } catch (e) {}
  }

  // Header
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont("helvetica", "bold");
  doc.text(companyName.toUpperCase(), pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.setFont("helvetica", "normal");
  doc.text(title, pageWidth / 2, 27, { align: "center" });

  if (companyConfig?.address || companyConfig?.city || companyConfig?.phone || companyConfig?.whatsapp) {
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    const subtitle = [
      companyConfig?.address,
      companyConfig?.city,
      companyConfig?.phone || companyConfig?.whatsapp ? `Tel: ${companyConfig.phone || companyConfig.whatsapp}` : ""
    ].filter(Boolean).join(" · ");
    if (subtitle) {
      doc.text(subtitle, pageWidth / 2, 33, { align: "center" });
    }
  }

  // Línea separadora
  doc.setLineWidth(0.5);
  doc.setDrawColor(37, 99, 235); // Azul 600
  doc.line(14, 37, pageWidth - 14, 37);

  // Footer con fecha
  const now = new Date();
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${companyName} · Generado: ${format(now, "dd 'de' MMMM 'de' yyyy HH:mm", { locale: es })}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  return doc;
};

// Configuración de tabla base
export const getTableOptions = (startY: number) => ({
  startY,
  headStyles: {
    fillColor: [37, 99, 235], // Azul
    textColor: 255,
    fontStyle: "bold",
  },
  bodyStyles: {
    textColor: [30, 41, 59],
  },
  alternateRowStyles: {
    fillColor: [248, 250, 252] as [number, number, number],
  },
  margin: { top: 10, left: 14, right: 14 },
});

// 1. REPORTE DE PEDIDOS
export const generateOrdersPDF = (orders: any[], filters: any, companyConfig?: any) => {
  const doc = createPDF("Reporte de Pedidos", companyConfig);

  let y = 45;

  // Información de filtros
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  if (filters.startDate || filters.endDate) {
    doc.text(
      `Período: ${filters.startDate || "Inicio"} - ${filters.endDate || "Fin"}`,
      20,
      y
    );
    y += 7;
  }
  if (filters.status) {
    doc.text(`Estado: ${filters.status}`, 20, y);
    y += 7;
  }

  // Tabla de pedidos
  const tableData = orders.map((order) => [
    order.orderNumber,
    order.customer?.name || order.customerName || "N/A",
    order.customer?.phone || order.customer?.whatsapp || order.customer?.clientNumber || "-",
    format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
    order.status === "pending" ? "Pendiente"
      : order.status === "assigned" ? "Asignado"
      : order.status === "in_transit" ? "En camino"
      : order.status === "delivered" ? "Entregado"
      : order.status === "cancelled" ? "Cancelado"
      : order.status,
    formatBs(order.totalPrice),
    order.paymentStatus || "pendiente",
  ]);

  (autoTable as any)(doc, {
    ...getTableOptions(y),
    head: [["Nº Pedido", "Cliente", "Celular", "Fecha", "Estado", "Total", "Pago"]],
    body: tableData,
    styles: { fontSize: 8 },
  });

  // Totales al final
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  const totalPedidos = orders.length;
  const totalMonto = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const pendientes = orders.filter((o) => o.status === "pending").length;
  const entregados = orders.filter((o) => o.status === "delivered").length;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN", 20, finalY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total de Pedidos: ${totalPedidos}`, 20, finalY + 7);
  doc.text(`Entregados: ${entregados}`, 20, finalY + 14);
  doc.text(`Pendientes: ${pendientes}`, 20, finalY + 21);
  doc.setFont("helvetica", "bold");
  doc.text(`Monto Total: ${formatBs(totalMonto)}`, 20, finalY + 28);

  return doc;
};

// 2. REPORTE DE VENTAS
export const generateSalesPDF = (sales: any[], filters: any, companyConfig?: any) => {
  const doc = createPDF("Reporte de Ventas", companyConfig);

  let y = 45;

  // Filtros
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  if (filters.startDate || filters.endDate) {
    doc.text(
      `Período: ${filters.startDate || "Inicio"} - ${filters.endDate || "Fin"}`,
      20,
      y
    );
    y += 7;
  }

  // Tabla de ventas
  const tableData = sales.map((sale) => [
    sale.saleNumber,
    sale.customerName || sale.customer?.name || "Venta anónima",
    format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
    sale.saleChannel === "delivery" ? "Delivery" : "Local",
    sale.paymentMethod === "cash" ? "Efectivo"
      : sale.paymentMethod === "qr" ? "QR"
      : "Transferencia",
    formatBs(sale.total),
  ]);

  (autoTable as any)(doc, {
    ...getTableOptions(y),
    head: [["Nº Venta", "Cliente", "Fecha", "Canal", "Método Pago", "Total"]],
    body: tableData,
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Resumen
  const totalVentas = sales.length;
  const montoTotal = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const efectivo = sales
    .filter((s) => s.paymentMethod === "cash")
    .reduce((sum, s) => sum + s.total, 0);
  const qr = sales
    .filter((s) => s.paymentMethod === "qr")
    .reduce((sum, s) => sum + s.total, 0);
  const transferencia = sales
    .filter((s) => s.paymentMethod === "transfer")
    .reduce((sum, s) => sum + s.total, 0);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN", 20, finalY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total de Ventas: ${totalVentas}`, 20, finalY + 7);
  doc.text(`Efectivo: ${formatBs(efectivo)}`, 20, finalY + 14);
  doc.text(`QR: ${formatBs(qr)}`, 20, finalY + 21);
  doc.text(`Transferencia: ${formatBs(transferencia)}`, 20, finalY + 28);
  doc.setFont("helvetica", "bold");
  doc.text(`Ingresos Totales: ${formatBs(montoTotal)}`, 20, finalY + 35);

  return doc;
};

// 2.1 REPORTE DE COMPRAS
export const generatePurchasesPDF = (purchases: any[], filters: any, companyConfig?: any) => {
  const doc = createPDF("Reporte de Compras a Proveedores", companyConfig);

  let y = 45;

  // Filtros
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  if (filters.startDate || filters.endDate) {
    doc.text(
      `Período: ${filters.startDate || "Inicio"} - ${filters.endDate || "Fin"}`,
      20,
      y
    );
    y += 7;
  }

  // Tabla de compras
  const tableData = purchases.map((purchase) => [
    purchase.purchaseNumber,
    purchase.supplier?.name || purchase.supplierName || "Proveedor General",
    format(new Date(purchase.orderDate || purchase.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
    purchase.status === "received" ? "Recibido" : purchase.status === "cancelled" ? "Cancelado" : "Pendiente",
    purchase.paymentMethod === "cash" ? "Efectivo"
      : purchase.paymentMethod === "qr" ? "QR"
      : purchase.paymentMethod === "transfer" ? "Transferencia"
      : purchase.paymentMethod === "credit" ? "Crédito"
      : "Efectivo",
    purchase.paymentStatus === "paid" ? "Pagado" : "Pendiente",
    formatBs(purchase.totalAmount),
  ]);

  (autoTable as any)(doc, {
    ...getTableOptions(y),
    head: [["Nº Compra", "Proveedor", "Fecha de Compra", "Estado", "Método", "Pago", "Total"]],
    body: tableData,
    styles: { fontSize: 8 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Resumen
  const totalCompras = purchases.length;
  const montoTotal = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const pagadas = purchases
    .filter((p) => p.paymentStatus === "paid")
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const pendientes = purchases
    .filter((p) => p.paymentStatus !== "paid")
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN DE COMPRAS", 20, finalY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total de Órdenes: ${totalCompras}`, 20, finalY + 7);
  doc.text(`Total Pagado: ${formatBs(pagadas)}`, 20, finalY + 14);
  doc.text(`Saldo a Crédito / Pendiente: ${formatBs(pendientes)}`, 20, finalY + 21);
  doc.setFont("helvetica", "bold");
  doc.text(`Monto Total Compras: ${formatBs(montoTotal)}`, 20, finalY + 28);

  return doc;
};

// 3. REPORTE DE INVENTARIO Y VALUACIÓN (UNIDADES, TALLER Y ROTACIÓN) - MEJORADO
export const generateInventoryPDF = (data: any, companyConfig?: any) => {
  const units = data?.units || [];
  const stats = data?.stats || {};
  
  const doc = createPDF("Reporte Ejecutivo de Inventario y Valuación", companyConfig);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = 43;

  // ═══════════════════════════════════════════════════════════
  // SECCIÓN 1: RESUMEN EJECUTIVO Y VALUACIÓN DE STOCK
  // ═══════════════════════════════════════════════════════════
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(14, y - 4, pageWidth - 28, 56, 3, 3, "F");
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(14, y - 4, pageWidth - 28, 56, 3, 3, "D");

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text("1. RESUMEN EJECUTIVO Y VALUACION GLOBAL", 18, y + 2);
  doc.setTextColor(51, 65, 85); // slate-700
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const availableCost = stats.availableCostCents ?? stats.totalCost ?? 0;
  const availableSaleValue = stats.availableSaleValueCents ?? stats.totalSaleValue ?? 0;
  const potentialProfit = stats.availablePotentialProfitCents ?? stats.potentialProfit ?? Math.max(0, availableSaleValue - availableCost);
  const marginPct = stats.availableMarginPct ?? (availableCost > 0 ? Math.round((potentialProfit / availableCost) * 1000) / 10 : 0);

  const col1X = 18;
  const col2X = 76;
  const col3X = 138;

  const r1Y = y + 10;
  const r2Y = y + 18;
  const r3Y = y + 26;
  const r4Y = y + 34;
  const r5Y = y + 42;

  // Columna 1: Stock Disponible
  doc.setFont("helvetica", "bold");
  doc.text("STOCK DISPONIBLE:", col1X, r1Y);
  doc.setFont("helvetica", "normal");
  doc.text(`${stats.availableCount ?? stats.total ?? 0} unidades disponibles`, col1X, r2Y);

  doc.setFont("helvetica", "bold");
  doc.text("Inversion en Stock (Costo):", col1X, r3Y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 38, 38); // red-600
  doc.text(formatBs(availableCost), col1X, r4Y);
  doc.setTextColor(51, 65, 85);

  doc.setFont("helvetica", "normal");
  doc.text(`Valor de Venta (PVP): ${formatBs(availableSaleValue)}`, col1X, r5Y);

  // Columna 2: Ganancia Potencial y Margen
  doc.setFont("helvetica", "bold");
  doc.text("GANANCIA POTENCIAL:", col2X, r1Y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(formatBs(potentialProfit), col2X, r2Y);
  doc.setTextColor(51, 65, 85);

  doc.setFont("helvetica", "normal");
  doc.text(`Margen Comercial: ${marginPct}%`, col2X, r3Y);
  doc.text(`Total en Catalogo: ${stats.total || 0} unidades`, col2X, r4Y);
  doc.text(`Historico Vendidos: ${stats.soldCount || (stats.byStatus?.sold ?? 0)} unid.`, col2X, r5Y);

  // Columna 3: Taller y Rotación
  const workshopUnitsCount = stats.workshopCount ?? stats.inRepair ?? 0;
  const workshopTiedCapital = stats.workshopTotalTiedCapitalCents ?? stats.workshopUnitsCostCents ?? 0;

  doc.setFont("helvetica", "bold");
  doc.text("CAPITAL EN TALLER:", col3X, r1Y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(217, 119, 6); // amber-600
  doc.text(`${workshopUnitsCount} unidades en servicio`, col3X, r2Y);
  doc.text(formatBs(workshopTiedCapital), col3X, r3Y);
  doc.setTextColor(51, 65, 85);

  doc.setFont("helvetica", "normal");
  doc.text(`Rotacion Promedio: ${stats.avgDaysInStock || 0} dias`, col3X, r4Y);
  doc.text(`En Garantia Activa: ${stats.inWarrantyCount ?? stats.inWarranty ?? 0} unid.`, col3X, r5Y);

  y += 60;

  // ═══════════════════════════════════════════════════════════
  // SECCIÓN 2: DISTRIBUCIÓN Y VALUACIÓN POR ESTADO
  // ═══════════════════════════════════════════════════════════
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("2. DISTRIBUCION Y VALUACION POR ESTADO DE INVENTARIO", 14, y);
  doc.setTextColor(40, 40, 40);
  y += 4;

  const statusRows: any[] = [];
  if (Array.isArray(stats.byStatus)) {
    stats.byStatus.forEach((st: any) => {
      statusRows.push([
        st.label || st.statusKey,
        st.count.toString(),
        `${st.pctOfTotal || 0}%`,
        formatBs(st.costCents || 0),
        formatBs(st.saleValueCents || 0),
      ]);
    });
  } else {
    const statusLabels: Record<string, string> = {
      available: "Disponible para Venta",
      in_repair: "En Taller (Reparacion)",
      in_diagnosis: "En Diagnostico",
      sold: "Vendido",
      reserved: "Reservado",
      returned: "Devuelto / Garantia",
      scrapped: "Baja / Desecho",
    };
    Object.entries(stats.byStatus || {}).forEach(([st, cnt]) => {
      statusRows.push([
        statusLabels[st] || st,
        (cnt as number).toString(),
        `${(((cnt as number) / (stats.total || 1)) * 100).toFixed(1)}%`,
        "—",
        "—",
      ]);
    });
  }

  if (statusRows.length > 0) {
    (autoTable as any)(doc, {
      ...getTableOptions(y),
      head: [["Estado del Inventario", "Cantidad", "% Total", "Inversion al Costo", "Valor Venta Estimado"]],
      body: statusRows,
      theme: "grid",
      headStyles: { fillColor: [30, 58, 138], fontSize: 8.5, halign: "left" },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 24, halign: "center" },
        2: { cellWidth: 24, halign: "center" },
        3: { cellWidth: 40, halign: "right" },
        4: { cellWidth: 40, halign: "right" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ═══════════════════════════════════════════════════════════
  // SECCIÓN 3: DETALLE DE EQUIPOS EN TALLER / SERVICIO TÉCNICO
  // ═══════════════════════════════════════════════════════════
  const workshopItems = stats.workshopDetail || [];
  const checkHeight = y + (workshopItems.length > 0 ? 45 : 25);
  if (checkHeight > pageHeight - 25) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("3. INVENTARIO EN TALLER Y SERVICIO TECNICO", 14, y);
  doc.setTextColor(40, 40, 40);
  y += 4;

  if (workshopItems.length > 0) {
    const workshopTableRows = workshopItems.map((item: any) => [
      item.code || "—",
      `${item.brand} ${item.model}`.trim() || "—",
      item.status === "in_repair" ? "En Reparacion" : "En Diagnostico",
      item.otNumber || "—",
      `${item.daysInWorkshop || 0} d`,
      formatBs(item.purchasePrice || 0),
      formatBs(item.repairCost || 0),
      formatBs(item.totalTiedCapital || 0),
    ]);

    (autoTable as any)(doc, {
      ...getTableOptions(y),
      head: [["Codigo", "Equipo / Modelo", "Estado Taller", "OT / Ref.", "Dias", "P. Compra", "Gastos Taller", "Total Inmovilizado"]],
      body: workshopTableRows,
      theme: "grid",
      headStyles: { fillColor: [217, 119, 6], fontSize: 8, halign: "left" },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 42 },
        2: { cellWidth: 26 },
        3: { cellWidth: 20 },
        4: { cellWidth: 14, halign: "center" },
        5: { cellWidth: 20, halign: "right" },
        6: { cellWidth: 20, halign: "right" },
        7: { cellWidth: 20, halign: "right" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFillColor(254, 243, 199); // amber-100
    doc.rect(14, y, pageWidth - 28, 12, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(146, 64, 14);
    doc.text("Actualmente no hay unidades en taller ni en diagnostico. Todo el stock operativo esta al dia.", 18, y + 7.5);
    doc.setTextColor(40, 40, 40);
    y += 18;
  }

  // ═══════════════════════════════════════════════════════════
  // SECCIÓN 4: VALUACIÓN POR CATEGORÍA / TIPO DE EQUIPO
  // ═══════════════════════════════════════════════════════════
  if (y + 50 > pageHeight - 25) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("4. VALUACION POR CATEGORIA / TIPO DE EQUIPO", 14, y);
  doc.setTextColor(40, 40, 40);
  y += 4;

  const typeRows: any[] = [];
  if (Array.isArray(stats.byType)) {
    stats.byType.forEach((tp: any) => {
      typeRows.push([
        tp.label || tp.typeKey,
        tp.totalCount.toString(),
        tp.availableCount.toString(),
        tp.workshopCount.toString(),
        formatBs(tp.costCents || 0),
        formatBs(tp.saleValueCents || 0),
        formatBs(tp.potentialProfitCents || 0),
        `${tp.marginPct || 0}%`,
      ]);
    });
  } else {
    const typeLabels: Record<string, string> = {
      laptop: "Laptops",
      tablet: "Tablets",
      phone: "Celulares",
      monitor: "Monitores",
      charger: "Cargadores",
      accessory: "Accesorios",
      other: "Otros",
    };
    Object.entries(stats.byType || {}).forEach(([tp, cnt]) => {
      typeRows.push([typeLabels[tp] || tp, (cnt as number).toString(), "—", "—", "—", "—", "—", "—"]);
    });
  }

  if (typeRows.length > 0) {
    (autoTable as any)(doc, {
      ...getTableOptions(y),
      head: [["Categoria", "Total", "Disp.", "Taller", "Inversion Costo", "Valor Venta", "Ganancia Pot.", "% Margen"]],
      body: typeRows,
      theme: "grid",
      headStyles: { fillColor: [30, 58, 138], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 14, halign: "center" },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 14, halign: "center" },
        4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 26, halign: "right" },
        6: { cellWidth: 26, halign: "right" },
        7: { cellWidth: 20, halign: "center" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ═══════════════════════════════════════════════════════════
  // SECCIÓN 5: VALUACIÓN POR MARCA Y ANTIGÜEDAD (AGING)
  // ═══════════════════════════════════════════════════════════
  if (y + 50 > pageHeight - 25) {
    doc.addPage();
    y = 20;
  }

  // Marcas
  if (Array.isArray(stats.byBrand) && stats.byBrand.length > 0) {
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text("5. DISTRIBUCION Y VALUACION POR MARCA (STOCK DISPONIBLE)", 14, y);
    doc.setTextColor(40, 40, 40);
    y += 4;

    const brandRows = stats.byBrand.slice(0, 15).map((b: any) => [
      b.brand || "Sin marca",
      b.availableCount.toString(),
      formatBs(b.costCents || 0),
      formatBs(b.saleValueCents || 0),
      formatBs(b.potentialProfitCents || 0),
      `${b.marginPct || 0}%`,
    ]);

    (autoTable as any)(doc, {
      ...getTableOptions(y),
      head: [["Marca", "Unidades Disponibles", "Inversion Costo", "Valor Venta Estimado", "Ganancia Proyectada", "% Margen"]],
      body: brandRows,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { cellWidth: 26, halign: "center" },
        2: { cellWidth: 28, halign: "right" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: 26, halign: "center" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Antigüedad (Aging)
  if (stats.agingBuckets) {
    if (y + 40 > pageHeight - 25) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text("6. ANALISIS DE ANTIGUEDAD Y ROTACION DE STOCK (AGING)", 14, y);
    doc.setTextColor(40, 40, 40);
    y += 4;

    const agingRows = Object.values(stats.agingBuckets).map((bucket: any) => [
      bucket.label,
      bucket.count.toString(),
      formatBs(bucket.costCents || 0),
      formatBs(bucket.saleValueCents || 0),
      availableCost > 0
        ? `${((bucket.costCents / availableCost) * 100).toFixed(1)}%`
        : "0%",
    ]);

    (autoTable as any)(doc, {
      ...getTableOptions(y),
      head: [["Rango de Permanencia", "Cantidad", "Inversion al Costo", "Valor Venta Estimado", "% del Capital"]],
      body: agingRows,
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 62 },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 34, halign: "right" },
        3: { cellWidth: 34, halign: "right" },
        4: { cellWidth: 30, halign: "center" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ═══════════════════════════════════════════════════════════
  // SECCIÓN 7: DETALLE DE EQUIPOS EN STOCK (PÁGINA NUEVA)
  // ═══════════════════════════════════════════════════════════
  doc.addPage();
  y = 20;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("7. INVENTARIO DETALLADO DE EQUIPOS DISPONIBLES", 14, y);
  doc.setTextColor(40, 40, 40);
  y += 4;

  const STATUS_TEXT: Record<string, string> = {
    available: "Disponible",
    in_repair: "En Taller",
    in_diagnosis: "Diagnostico",
    sold: "Vendido",
    reserved: "Reservado",
    returned: "Garantia",
    scrapped: "Baja",
  };

  const TYPE_SHORT: Record<string, string> = {
    laptop: "Laptop",
    tablet: "Tablet",
    phone: "Celular",
    monitor: "Monitor",
    charger: "Cargador",
    accessory: "Accesorio",
    other: "Otro",
  };

  const tableData = units.slice(0, 300).map((u: any) => {
    const pCost = Number(u.purchasePrice || 0);
    const sPrice = Number(u.salePrice || 0);
    const margin = sPrice - pCost;
    const marginPct = pCost > 0 ? Math.round((margin / pCost) * 100) : 0;
    const purchaseDate = u.purchaseDate ? new Date(u.purchaseDate) : (u.createdAt ? new Date(u.createdAt) : null);
    const purchaseDateStr = purchaseDate ? format(purchaseDate, "dd/MM/yyyy") : "—";
    const days = purchaseDate ? Math.max(0, Math.floor((Date.now() - purchaseDate.getTime()) / 86400000)) : 0;

    return [
      u.code || `UNI-${u.id}`,
      `${u.brand || ""} ${u.model || ""}`.trim() || "—",
      TYPE_SHORT[u.type] || u.type || "—",
      STATUS_TEXT[u.status] || u.status || "—",
      purchaseDateStr,
      `${days} d`,
      formatBs(pCost),
      formatBs(sPrice),
      `${formatBs(margin)} (${marginPct}%)`,
    ];
  });

  (autoTable as any)(doc, {
    ...getTableOptions(y),
    head: [["Codigo", "Marca / Modelo", "Tipo", "Estado", "Fecha Compra", "Dias", "P. Compra", "P. Venta", "Margen Est."]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [30, 58, 138], fontSize: 7.2 },
    styles: { fontSize: 6.8, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 40 },
      2: { cellWidth: 16 },
      3: { cellWidth: 20 },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 12, halign: "center" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 20, halign: "right" },
      8: { cellWidth: 22, halign: "right" },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  if (units.length > 300) {
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`Nota: Se muestran los primeros 300 registros de un total de ${units.length} equipos.`, 14, finalY);
  }

  // ═══════════════════════════════════════════════════════════
  // PIE DE PÁGINA PROFESIONAL EN TODAS LAS PÁGINAS
  // ═══════════════════════════════════════════════════════════
  const totalPages = (doc.internal as any).getNumberOfPages();
  const printDateStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es });
  const companyTitle = companyConfig?.name || "MP SHOP";

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`${companyTitle} · Reporte Oficial de Inventario y Valuacion`, 14, pageHeight - 7);
    doc.text(`Emitido: ${printDateStr} | Pagina ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: "right" });
  }

  return doc;
};

// 4. REPORTE FINANCIERO
export const generateFinancePDF = (transactions: any[], cashClosures: any[], companyConfig?: any) => {
  const doc = createPDF("Reporte Financiero", companyConfig);

  let y = 45;

  // Resumen general
  const ingresos = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const gastos = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const balance = ingresos - gastos;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN GENERAL", 20, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total Ingresos: ${formatBs(ingresos)}`, 20, y + 7);
  doc.text(`Total Gastos: ${formatBs(gastos)}`, 20, y + 14);
  doc.setFont("helvetica", "bold");
  if (balance >= 0) {
    doc.setTextColor(76, 175, 80);
  } else {
    doc.setTextColor(220, 53, 69);
  }
  doc.text(`Balance: ${formatBs(balance)}`, 20, y + 21);
  doc.setTextColor(40, 40, 40);

  y += 30;

  // Tabla de transacciones
  const tableData = transactions.map((t) => [
    format(new Date(t.createdAt), "dd/MM/yyyy", { locale: es }),
    t.category,
    t.type === "income" ? "Ingreso" : "Gasto",
    t.paymentMethod === "cash" ? "Efectivo"
      : t.paymentMethod === "qr" ? "QR"
      : "Transferencia",
    formatBs(t.amount),
    t.notes || "-",
  ]);

  (autoTable as any)(doc, {
    ...getTableOptions(y),
    head: [["Fecha", "Categoría", "Tipo", "Método", "Monto", "Notas"]],
    body: tableData,
    didParseCell: (data: any) => {
      if (data.column.index === 2 && data.cell.text[0] === "Gasto") {
        data.cell.styles.textColor = [220, 53, 69];
      }
    },
  });

  // Cierres de caja
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("CIERRES DE CAJA", 20, finalY);

  const closureTable = cashClosures.map((c) => [
    c.date,
    formatBs(c.initialCash),
    formatBs(c.reportedCash),
    formatBs(c.reportedQr + c.reportedTransfer),
    c.status,
  ]);

  (autoTable as any)(doc, {
    startY: finalY + 5,
    head: [["Fecha", "Inicial", "Efectivo", "Digital", "Estado"]],
    body: closureTable,
    headStyles: { fillColor: [33, 150, 243] },
  });

  return doc;
};

// 5. REPORTE DE CLIENTES
export const generateCustomersPDF = (customers: any[], companyConfig?: any) => {
  const doc = createPDF("Reporte de Clientes", companyConfig);

  let y = 45;

  // Estadísticas
  const total = customers.length;
  const conWhatsApp = customers.filter((c) => c.whatsapp).length;
  const conZona = customers.filter((c) => c.zona).length;

  doc.setFontSize(10);
  doc.text(`Total de Clientes: ${total}`, 20, y);
  doc.text(`Con WhatsApp: ${conWhatsApp}`, 100, y);
  doc.text(`Con Zona Asignada: ${conZona}`, 20, y + 7);

  y += 15;

  // Tabla
  const tableData = customers.map((c) => [
    c.clientNumber,
    c.name,
    c.phone || c.whatsapp || c.clientNumber || "-",
    c.zona || "Sin zona",
    c.address ? c.address.substring(0, 30) + (c.address.length > 30 ? "..." : "") : "-",
  ]);

  (autoTable as any)(doc, {
    ...getTableOptions(y),
    head: [["Código", "Nombre", "Celular", "Zona", "Dirección"]],
    body: tableData,
    styles: { fontSize: 8 },
  });

  return doc;
};

// 6. REPORTE DE MOVIMIENTOS DE INVENTARIO
export const generateInventoryMovementsPDF = (movements: any[], products: any[], companyConfig?: any) => {
  const doc = createPDF("Reporte de Movimientos de Inventario", companyConfig);

  let y = 45;

  const entradas = movements
    .filter((m) => m.type === "entry")
    .reduce((sum, m) => sum + m.quantity, 0);
  const salidas = movements
    .filter((m) => m.type === "exit")
    .reduce((sum, m) => sum + m.quantity, 0);
  const ajustes = movements
    .filter((m) => m.type === "adjustment")
    .reduce((sum, m) => sum + m.quantity, 0);

  doc.setFontSize(10);
  doc.text(`Total Movimientos: ${movements.length}`, 20, y);
  doc.text(`Entradas: ${entradas}`, 80, y);
  doc.text(`Salidas: ${salidas}`, 140, y);
  doc.text(`Ajustes: ${ajustes}`, 20, y + 7);

  y += 15;

  const tableData = movements.map((m) => {
    const product = products.find((p) => p.id === m.productId);
    return [
      format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
      product?.name || "N/A",
      m.type === "entry" ? "ENTRADA"
        : m.type === "exit" ? "SALIDA"
        : "AJUSTE",
      m.quantity > 0 ? `+${m.quantity}` : m.quantity.toString(),
      m.reason || "-",
    ];
  });

  (autoTable as any)(doc, {
    ...getTableOptions(y),
    head: [["Fecha", "Producto", "Tipo", "Cantidad", "Razón"]],
    body: tableData,
    didParseCell: (data: any) => {
      if (data.column.index === 2) {
        const text = data.cell.text[0];
        if (text === "ENTRADA") data.cell.styles.textColor = [76, 175, 80];
        else if (text === "SALIDA") data.cell.styles.textColor = [220, 53, 69];
      }
    },
  });

  return doc;
};

// 7. REPORTE DE AUDITORÍA / HISTORIAL DE CAMBIOS
export const generateAuditPDF = (logs: any[], companyConfig?: any) => {
  const doc = createPDF("Historial de Cambios (Auditoría)", companyConfig);

  let y = 45;

  const totalLogs = logs.length;
  const creates = logs.filter((l) => l.action === "CREATE").length;
  const updates = logs.filter((l) => l.action === "UPDATE").length;
  const deletes = logs.filter((l) => l.action === "DELETE").length;

  doc.setFontSize(10);
  doc.text(`Total Registros: ${totalLogs}`, 20, y);
  doc.text(`Creaciones: ${creates}`, 80, y);
  doc.text(`Actualizaciones: ${updates}`, 130, y);
  doc.text(`Eliminaciones: ${deletes}`, 20, y + 7);

  y += 15;

  const tableData = logs.map((l) => [
    format(new Date(l.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
    l.entityType,
    l.action,
    l.entityId.toString(),
    l.user?.name || l.userId || "Sistema",
    l.description || "-",
  ]);

  (autoTable as any)(doc, {
    ...getTableOptions(y),
    head: [["Fecha", "Entidad", "Acción", "ID", "Usuario", "Descripción"]],
    body: tableData,
    styles: { fontSize: 8 },
    didParseCell: (data: any) => {
      if (data.column.index === 2) {
        const text = data.cell.text[0];
        if (text === "CREATE") data.cell.styles.textColor = [76, 175, 80];
        else if (text === "DELETE") data.cell.styles.textColor = [220, 53, 69];
        else if (text === "UPDATE") data.cell.styles.textColor = [33, 150, 243];
      }
    },
  });

  return doc;
};

// 8. REPORTE DE ARQUEO DE CAJA (Formato Oficial)
export const generateArqueoPDF = (data: {
  date: string;
  userName: string;
  branchName?: string;
  arqueoNumber?: string;
  openingDate?: string;
  openingTime?: string;
  closingDate?: string;
  closingTime?: string;
  // Ingresos
  openingAmount?: number;
  cashSales?: number;
  creditCollections?: number;
  otherIncome?: number;
  // Egresos
  cashPurchases?: number;
  creditPayments?: number;
  otherExpenses?: number;
  // Medios de pago ventas
  totalCash?: number;
  totalCard?: number;
  totalCheque?: number;
  totalDeposit?: number;
  totalQr?: number;
  totalInvoice?: number;
  totalReceipt?: number;
  // Cuadre
  expectedCash?: number;
  reportedCash?: number;
  expectedQr?: number;
  reportedQr?: number;
  expectedTransfer?: number;
  reportedTransfer?: number;
  // Observación
  observation?: string;
}, companyConfig?: any) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = pageWidth - 14;

  const companyName = companyConfig?.name || "HK EQUIPOS TECNOLÓGICOS";
  const companyCity = companyConfig?.city || "La Paz - Bolivia";
  const companyLogo = companyConfig?.logo;

  if (companyLogo) {
    try {
      const fmt = companyLogo.startsWith("data:image/jpeg") || companyLogo.startsWith("data:image/jpg") ? "JPEG" : "PNG";
      doc.addImage(companyLogo, fmt, marginL, 8, 28, 28);
    } catch (_) {
      try { doc.addImage("/logo.png", "PNG", marginL, 8, 28, 28); } catch (_2) {}
    }
  } else {
    try { doc.addImage("/logo.png", "PNG", marginL, 8, 28, 28); } catch (_) {}
  }

  // ── CABECERA ─────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text("ARQUEO DE CAJA", pageWidth / 2, 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const branchName = data.branchName || "Principal";
  doc.text(`(Almacén: ${branchName} - Al ${data.date})`, pageWidth / 2, 21, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(companyName.toUpperCase(), marginR, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(companyCity, marginR, 18, { align: "right" });

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.7);
  doc.line(marginL, 30, marginR, 30);

  // ── DATOS GENERALES ──────────────────────────────────────────────────────
  let y = 36;
  const midCol = pageWidth / 2 + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("ALMACÉN / TIENDA:", marginL, y);
  doc.setFont("helvetica", "normal");
  doc.text(branchName, marginL + 42, y);

  doc.setFont("helvetica", "bold");
  doc.text("Nº ARQUEO:", midCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.arqueoNumber || "—", midCol + 26, y);

  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.text("RESPONSABLE:", marginL, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.userName, marginL + 42, y);

  doc.setFont("helvetica", "bold");
  doc.text("FECHA APERTURA:", midCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.openingDate || data.date}  ${data.openingTime || "—"}`, midCol + 38, y);

  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.text("FECHA CIERRE:", marginL, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.closingDate || data.date}  ${data.closingTime || new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}`, marginL + 42, y);

  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, marginR, y);
  y += 4;

  // ── CALCULAR TOTALES ─────────────────────────────────────────────────────
  const openingAmount  = data.openingAmount    ?? 0;
  const cashSales      = data.cashSales        ?? 0;
  const creditColl     = data.creditCollections ?? 0;
  const otherIncome    = data.otherIncome      ?? 0;
  const totalIngresos  = openingAmount + cashSales + creditColl + otherIncome;

  const cashPurchases  = data.cashPurchases    ?? 0;
  const creditPayments = data.creditPayments   ?? 0;
  const otherExpenses  = data.otherExpenses    ?? 0;
  const totalEgresos   = cashPurchases + creditPayments + otherExpenses;

  // ── HELPERS ──────────────────────────────────────────────────────────────
  const drawSectionHeader = (title: string, yPos: number, rgb: [number, number, number]) => {
    doc.setFillColor(...rgb);
    doc.rect(marginL, yPos - 4, marginR - marginL, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(title, pageWidth / 2, yPos, { align: "center" });
    doc.setTextColor(15, 23, 42);
    return yPos + 5;
  };

  const drawRow = (label: string, amount: number, yPos: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(label, marginL + 3, yPos);
    doc.text(formatBs(amount), marginR - 2, yPos, { align: "right" });
    return yPos + 5;
  };

  // ── INGRESOS ─────────────────────────────────────────────────────────────
  y = drawSectionHeader("INGRESOS", y + 2, [22, 101, 52]);
  y += 2;
  y = drawRow("Saldo inicial en apertura de caja:", openingAmount, y);
  y = drawRow("Ventas al contado (efectivo):", cashSales, y);
  y = drawRow("Cobro de cuotas de ventas al credito:", creditColl, y);
  y = drawRow("Otros ingresos:", otherIncome, y);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.3);
  doc.line(marginL + 3, y, marginR - 3, y);
  y += 4;
  y = drawRow("TOTAL INGRESOS:", totalIngresos, y, true);
  y += 4;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, marginR, y);
  y += 3;

  // ── EGRESOS ──────────────────────────────────────────────────────────────
  y = drawSectionHeader("EGRESOS", y + 2, [185, 28, 28]);
  y += 2;
  y = drawRow("Compras al contado:", cashPurchases, y);
  y = drawRow("Pago de cuotas de compras al credito:", creditPayments, y);
  y = drawRow("Otros egresos (gastos operativos):", otherExpenses, y);
  doc.setDrawColor(239, 68, 68);
  doc.setLineWidth(0.3);
  doc.line(marginL + 3, y, marginR - 3, y);
  y += 4;
  y = drawRow("TOTAL EGRESOS:", totalEgresos, y, true);
  y += 5;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginL, y, marginR, y);
  y += 5;

  // ── TABLA DOBLE: VENTAS | CUADRE ─────────────────────────────────────────
  const totalW = marginR - marginL;
  const halfW  = (totalW - 4) / 2;   // 4 mm de separación entre columnas
  const leftBox  = marginL;
  const rightBox = marginL + halfW + 4;

  // Cabeceras de tabla
  doc.setFillColor(37, 99, 235);
  doc.rect(leftBox,  y, halfW, 7, "F");
  doc.rect(rightBox, y, halfW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("VENTAS / MEDIOS DE PAGO", leftBox  + halfW / 2, y + 4.5, { align: "center" });
  doc.text("CUADRE DE CAJA",          rightBox + halfW / 2, y + 4.5, { align: "center" });
  doc.setTextColor(15, 23, 42);

  const totalCash    = data.totalCash    ?? data.expectedCash ?? 0;
  const totalCard    = data.totalCard    ?? 0;
  const totalCheque  = data.totalCheque  ?? 0;
  const totalDeposit = data.totalDeposit ?? 0;
  const totalQr      = data.totalQr      ?? data.expectedQr ?? 0;
  const totalInvoice = data.totalInvoice ?? 0;
  const totalReceipt = data.totalReceipt ?? (data.cashSales ?? 0);

  const expectedCash = data.expectedCash ?? 0;
  const reportedCash = data.reportedCash ?? 0;
  const cashDiff     = reportedCash - expectedCash;

  const rowH   = 5.5;
  const startY = y + 9;
  let lyLeft   = startY;
  let lyRight  = startY;

  const leftRows: [string, string][] = [
    ["Tot. Efectivo:",  formatBs(totalCash)],
    ["Tot. Tarjeta:",   formatBs(totalCard)],
    ["Tot. Cheque:",    formatBs(totalCheque)],
    ["Tot. Deposito:",  formatBs(totalDeposit)],
    ["Tot. Pago QR:",   formatBs(totalQr)],
    ["Tot. Factura:",   formatBs(totalInvoice)],
    ["Tot. Recibo:",    formatBs(totalReceipt)],
  ];

  leftRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(label,  leftBox + 3, lyLeft);
    doc.text(value,  leftBox + halfW - 3, lyLeft, { align: "right" });
    lyLeft += rowH;
  });

  // Cuadre derecho
  const cuadreRows: Array<[string, string, string]> = [
    ["Total Efectivo Registrado:", formatBs(expectedCash), "normal"],
    ["Total Efectivo Contado:",    formatBs(reportedCash), "normal"],
    ["", "", "normal"],
    ["FALTANTE:", cashDiff < 0  ? formatBs(Math.abs(cashDiff)) : "Bs. 0.00", "faltante"],
    ["SOBRANTE:", cashDiff >= 0 ? formatBs(cashDiff)           : "Bs. 0.00", "sobrante"],
    ["", "", "normal"],
    ["", "", "normal"],
  ];

  cuadreRows.forEach(([label, value, style]) => {
    if (!label) { lyRight += rowH; return; }
    const isBold = style === "faltante" || style === "sobrante";
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(8);
    if (style === "faltante")       doc.setTextColor(185, 28, 28);
    else if (style === "sobrante")  doc.setTextColor(37, 99, 235);
    else                            doc.setTextColor(15, 23, 42);
    doc.text(label,  rightBox + 3, lyRight);
    doc.text(value,  rightBox + halfW - 3, lyRight, { align: "right" });
    doc.setTextColor(15, 23, 42);
    lyRight += rowH;
  });

  const tableHeight = Math.max(lyLeft, lyRight) - y;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.rect(leftBox,  y, halfW, tableHeight);
  doc.rect(rightBox, y, halfW, tableHeight);
  y = Math.max(lyLeft, lyRight) + 6;

  // ── OBSERVACIÓN ──────────────────────────────────────────────────────────
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, marginR, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Observación:", marginL, y);
  doc.setFont("helvetica", "normal");
  const obs = data.observation || "Sin observaciones.";
  const obsLines = doc.splitTextToSize(obs, marginR - marginL - 36);
  doc.text(obsLines, marginL + 36, y);
  y += Math.max(obsLines.length * 4, 8) + 6;

  // ── FIRMAS ────────────────────────────────────────────────────────────────
  const sigY  = Math.min(y + 10, pageHeight - 25);
  const sig1X = marginL + 25;
  const sig2X = marginR - 25;

  doc.setLineWidth(0.5);
  doc.setDrawColor(100, 116, 139);
  doc.line(sig1X - 22, sigY, sig1X + 22, sigY);
  doc.line(sig2X - 22, sigY, sig2X + 22, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("CAJERO", sig1X, sigY + 5, { align: "center" });
  doc.text("SUPERVISOR / ADMIN", sig2X, sigY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(data.userName, sig1X, sigY + 9, { align: "center" });

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const nowFmt = format(new Date(), "dd 'de' MMMM 'de' yyyy HH:mm", { locale: es });
  doc.text(`${companyName} · Generado: ${nowFmt}`, pageWidth / 2, pageHeight - 8, { align: "center" });

  return doc;
};

// Descargar PDF
export const downloadPDF = (doc: jsPDF, filename: string) => {
  doc.save(filename);
};

// Obtener PDF como blob
export const getPDFBlob = (doc: jsPDF) => {
  return doc.output("blob");
};

// Obtener PDF como base64
export const getPDFBase64 = (doc: jsPDF) => {
  return doc.output("datauristring");
};