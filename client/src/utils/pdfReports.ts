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

// 3. REPORTE DE INVENTARIO
export const generateInventoryPDF = (products: any[], inventory: any[], companyConfig?: any) => {
  const doc = createPDF("Reporte de Inventario", companyConfig);

  let y = 45;

  // Tabla de productos con stock
  const tableData = products.map((product, idx) => {
    const inv = inventory.find((i) => i.productId === product.id) || {};
    return [
      product.code,
      product.name,
      product.category === "finished_product" ? "Producto Terminado"
        : product.category === "raw_material" ? "Materia Prima"
        : "Suministro",
      (inv.quantity || 0).toString(),
      (inv.minStock || 0).toString(),
      (inv.quantity || 0) <= (inv.minStock || 0) ? "BAJO" : "OK",
      formatBs(product.salePrice),
    ];
  });

  (autoTable as any)(doc, {
    ...getTableOptions(y),
    head: [["Código", "Producto", "Categoría", "Stock", "Mín.", "Estado", "Precio"]],
    body: tableData,
    didParseCell: (data: any) => {
      if (data.column.index === 5 && data.cell.text[0] === "BAJO") {
        data.cell.styles.textColor = [220, 53, 69];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Resumen
  const totalProducts = products.length;
  const lowStock = products.filter((p, idx) => {
    const inv = inventory.find((i) => i.productId === p.id) || {};
    return (inv.quantity || 0) <= (inv.minStock || 0);
  }).length;
  const totalValue = products.reduce((sum, p, idx) => {
    const inv = inventory.find((i) => i.productId === p.id) || {};
    return sum + (p.salePrice || 0) * (inv.quantity || 0);
  }, 0);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN", 20, finalY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total de Productos: ${totalProducts}`, 20, finalY + 7);
  doc.setTextColor(220, 53, 69);
  doc.text(`Stock Bajo: ${lowStock}`, 20, finalY + 14);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text(`Valor Total en Inventario: ${formatBs(totalValue)}`, 20, finalY + 21);

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
    doc.rect(marginL, yPos - 4, marginR - marginL, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(title, pageWidth / 2, yPos, { align: "center" });
    doc.setTextColor(15, 23, 42);
    return yPos + 4;
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
  y = drawSectionHeader("═══  INGRESOS  ═══", y + 2, [22, 101, 52]);
  y += 2;
  y = drawRow("Saldo inicial en apertura de caja:", openingAmount, y);
  y = drawRow("Ventas al contado (efectivo):", cashSales, y);
  y = drawRow("Cobro de cuotas de ventas al crédito:", creditColl, y);
  y = drawRow("Otros ingresos:", otherIncome, y);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.3);
  doc.line(marginL + 3, y, marginR - 3, y);
  y += 4;
  y = drawRow("TOTAL INGRESOS:", totalIngresos, y, true);
  y += 2;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, marginR, y);
  y += 3;

  // ── EGRESOS ──────────────────────────────────────────────────────────────
  y = drawSectionHeader("═══  EGRESOS  ═══", y + 2, [185, 28, 28]);
  y += 2;
  y = drawRow("Compras al contado:", cashPurchases, y);
  y = drawRow("Pago de cuotas de compras al crédito:", creditPayments, y);
  y = drawRow("Otros egresos (gastos operativos):", otherExpenses, y);
  doc.setDrawColor(239, 68, 68);
  doc.setLineWidth(0.3);
  doc.line(marginL + 3, y, marginR - 3, y);
  y += 4;
  y = drawRow("TOTAL EGRESOS:", totalEgresos, y, true);
  y += 3;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginL, y, marginR, y);
  y += 4;

  // ── TABLA DOBLE: VENTAS | CUADRE ─────────────────────────────────────────
  const halfW = (marginR - marginL) / 2 - 2;
  const leftBox  = marginL;
  const rightBox = marginL + halfW + 4;

  doc.setFillColor(37, 99, 235);
  doc.rect(leftBox, y, halfW, 6, "F");
  doc.rect(rightBox, y, halfW, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("VENTAS / MEDIOS DE PAGO", leftBox + halfW / 2, y + 4, { align: "center" });
  doc.text("CUADRE DE CAJA", rightBox + halfW / 2, y + 4, { align: "center" });
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

  const rowH = 5.5;
  const startY = y + 8;
  let lyLeft  = startY;
  let lyRight = startY;

  const leftRows: [string, string][] = [
    ["Tot. Efectivo:",   formatBs(totalCash)],
    ["Tot. Tarjeta:",    formatBs(totalCard)],
    ["Tot. Cheque:",     formatBs(totalCheque)],
    ["Tot. Depósito:",   formatBs(totalDeposit)],
    ["Tot. Pago QR:",    formatBs(totalQr)],
    ["Tot. Factura:",    formatBs(totalInvoice)],
    ["Tot. Recibo:",     formatBs(totalReceipt)],
  ];

  leftRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(label, leftBox + 2, lyLeft);
    doc.text(value, leftBox + halfW - 2, lyLeft, { align: "right" });
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
    if (style === "faltante") doc.setTextColor(185, 28, 28);
    else if (style === "sobrante") doc.setTextColor(37, 99, 235);
    else doc.setTextColor(15, 23, 42);
    doc.text(label, rightBox + 2, lyRight);
    doc.text(value, rightBox + halfW - 2, lyRight, { align: "right" });
    doc.setTextColor(15, 23, 42);
    lyRight += rowH;
  });

  const tableHeight = Math.max(lyLeft, lyRight) - y;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(leftBox, y, halfW, tableHeight);
  doc.rect(rightBox, y, halfW, tableHeight);
  y = Math.max(lyLeft, lyRight) + 4;

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