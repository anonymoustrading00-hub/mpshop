import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCurrency } from "./currency";

export const exportInventoryToPDF = (items: any[], title: string) => {
  const doc = new jsPDF() as any;
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-BO");
  const timeStr = now.toLocaleTimeString("es-BO");

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("Reporte de Inventario", 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Categoría: ${title}`, 14, 30);
  doc.text(`Generado el: ${dateStr} a las ${timeStr}`, 14, 35);

  // Table Data
  const tableData = items.map((item) => [
    item.product?.code || "N/A",
    item.product?.name || "Sin nombre",
    item.quantity || 0,
    item.onOrder || 0,
    item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("es-BO") : "N/A",
    formatCurrency(item.product?.price || 0),
    formatCurrency((item.quantity || 0) * (item.product?.price || 0)),
  ]);

  doc.autoTable({
    startY: 45,
    head: [["Código", "Producto", "Disp.", "Res.", "Vencimiento", "Costo Unit.", "Total Costo"]],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 45 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "center" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;
  
  // Totals
  const totalCost = items.reduce((sum, item) => sum + (item.quantity * (item.product?.price || 0)), 0);
  const totalUnits = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Unidades Disponibles: ${totalUnits}`, 14, finalY + 15);
  doc.setFontSize(12);
  doc.text(`VALUACIÓN TOTAL (COSTO): ${formatCurrency(totalCost)}`, 14, finalY + 22);

  doc.save(`Inventario_${String(title || "General").replace(/\s+/g, '_')}_${now.getTime()}.pdf`);
};

export const exportInventoryToExcel = (items: any[], title: string) => {
  const data = items.map((item) => ({
    Código: item.product?.code || "N/A",
    Producto: item.product?.name || "Sin nombre",
    Categoría: item.product?.category || "N/A",
    "Stock Disponible": item.quantity || 0,
    "Stock Reservado": item.onOrder || 0,
    "Stock Total": (item.quantity || 0) + (item.onOrder || 0),
    "Precio Compra (Bs.)": (item.product?.price || 0) / 100,
    "Precio Venta (Bs.)": (item.product?.salePrice || 0) / 100,
    "Valuación Costo (Bs.)": ((item.quantity || 0) * (item.product?.price || 0)) / 100,
    "Vencimiento": item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("es-BO") : "N/A",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");

  // Add formatting hint (optional but nice)
  const filename = `Inventario_${String(title || "General").replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
