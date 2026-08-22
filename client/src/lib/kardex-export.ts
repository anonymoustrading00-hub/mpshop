import * as XLSX from "xlsx";
import { formatCurrency } from "./currency";

export const exportKardexToExcel = (data: any) => {
  const { product, timeline, summary } = data;
  
  // 1. Preparar datos de movimientos
  const timelineData = [...timeline].reverse().map((event: any) => ({
    "Fecha": new Date(event.createdAt).toLocaleDateString("es-BO"),
    "Hora": new Date(event.createdAt).toLocaleTimeString("es-BO"),
    "Concepto": event.title,
    "Descripción": event.description,
    "Referencia": event.orderNumber ? `Pedido #${event.orderNumber}` : (event.saleNumber ? `Venta #${event.saleNumber}` : "N/A"),
    "Usuario": event.userName || "N/A",
    "Entrada (+)": event.entry || 0,
    "Salida (-)": event.exit || 0,
    "Saldo Acumulado": event.balance || 0,
  }));

  // 2. Preparar resumen
  const summaryData = [
    { "Campo": "Producto", "Valor": product.name },
    { "Campo": "Código", "Valor": product.code },
    { "Campo": "Saldo Inicial (Periodo)", "Valor": summary.initialBalance },
    { "Campo": "Total Entradas", "Valor": summary.totalPurchasedUnits },
    { "Campo": "Total Salidas", "Valor": summary.totalSoldUnits },
    { "Campo": "Saldo Final", "Valor": summary.finalBalance },
    { "Campo": "Precio Compra Act.", "Valor": formatCurrency(product.price) },
    { "Campo": "Generado el", "Valor": new Date().toLocaleString("es-BO") },
  ];

  // 3. Crear Workbook
  const workbook = XLSX.utils.book_new();
  
  // Hoja de Movimientos
  const wsTimeline = XLSX.utils.json_to_sheet(timelineData);
  XLSX.utils.book_append_sheet(workbook, wsTimeline, "Historial Kardex");

  // Hoja de Resumen
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, wsSummary, "Resumen");

  // 4. Descargar
  const filename = `Kardex_${String(product?.name || "Producto").replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
