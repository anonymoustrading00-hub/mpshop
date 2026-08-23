import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Barcode, CheckCircle2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import bwipjs from "bwip-js";
import jsPDF from "jspdf";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";

interface BatchLabelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: string;
  model: string;
  type: string;
  salePrice?: number;
  codes: string[];
}

export function BatchLabelsModal({
  open,
  onOpenChange,
  brand,
  model,
  type,
  salePrice,
  codes,
}: BatchLabelsModalProps) {
  const [format, setFormat] = useState<"qr" | "barcode">("qr");
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: companyConfig } = trpc.settings.getCompanyConfig.useQuery();

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(codes.join("\n"));
    toast.success(`${codes.length} códigos copiados al portapapeles`);
  };

  const generateBarcodeDataUrl = (code: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        bwipjs.toCanvas(canvas, {
          bcid: "code128",
          text: code,
          scale: 3,
          height: 10,
          includetext: false,
          textxalign: "center",
        });
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleDownloadPDF = async () => {
    if (!codes || codes.length === 0) return;
    setIsGenerating(true);

    try {
      const isBarcode = format === "barcode";
      const companyDisplayName = (companyConfig?.name || "MP SHOP").toUpperCase();
      const productTitle = `${brand} ${model}`.trim();
      const priceText = salePrice && salePrice > 0 ? formatCurrency(salePrice) : "";

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const cols = isBarcode ? 4 : 4;
      const rows = isBarcode ? 10 : 8;
      const labelWidth = isBarcode ? 45 : 46;
      const labelHeight = isBarcode ? 26 : 33;
      const marginX = 8;
      const marginY = 10;
      const spacingX = 4;
      const spacingY = 4;
      const itemsPerPage = cols * rows;

      for (let i = 0; i < codes.length; i++) {
        if (i > 0 && i % itemsPerPage === 0) {
          pdf.addPage();
        }

        const pageIndex = i % itemsPerPage;
        const col = pageIndex % cols;
        const row = Math.floor(pageIndex / cols);

        const x = marginX + col * (labelWidth + spacingX);
        const y = marginY + row * (labelHeight + spacingY);
        const code = codes[i];

        // Marco punteado / borde de corte
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, y, labelWidth, labelHeight, 2, 2);

        // Header: Nombre Empresa
        pdf.setFontSize(6.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(20, 20, 20);
        pdf.text(companyDisplayName, x + labelWidth / 2, y + 3.5, { align: "center" });

        // Subheader: Producto (Marca y Modelo)
        pdf.setFontSize(6);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(60, 60, 60);
        const truncatedTitle = productTitle.length > 25 ? productTitle.slice(0, 23) + "..." : productTitle;
        pdf.text(truncatedTitle, x + labelWidth / 2, y + 6.5, { align: "center" });

        if (isBarcode) {
          // Código de Barras
          try {
            const barcodeUrl = await generateBarcodeDataUrl(code);
            pdf.addImage(barcodeUrl, "PNG", x + 3, y + 8, labelWidth - 6, 9);
          } catch (e) {
            console.error(e);
          }

          // Código en texto
          pdf.setFontSize(7.5);
          pdf.setFont("courier", "bold");
          pdf.setTextColor(0, 0, 0);
          pdf.text(code, x + labelWidth / 2, y + 20, { align: "center" });

          // Precio si aplica
          if (priceText) {
            pdf.setFontSize(7);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(16, 130, 60);
            pdf.text(priceText, x + labelWidth / 2, y + 24, { align: "center" });
          }
        } else {
          // QR Code
          try {
            const qrDataUrl = await QRCode.toDataURL(code, {
              width: 120,
              margin: 0,
              errorCorrectionLevel: "M",
            });
            pdf.addImage(qrDataUrl, "PNG", x + (labelWidth - 16) / 2, y + 8, 16, 16);
          } catch (e) {
            console.error(e);
          }

          // Código en texto
          pdf.setFontSize(7.5);
          pdf.setFont("courier", "bold");
          pdf.setTextColor(0, 0, 0);
          pdf.text(code, x + labelWidth / 2, y + 27, { align: "center" });

          // Precio si aplica
          if (priceText) {
            pdf.setFontSize(7);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(16, 130, 60);
            pdf.text(priceText, x + labelWidth / 2, y + 31, { align: "center" });
          }
        }
      }

      const fileName = `Etiquetas_${brand}_${model}_${codes.length}_uds.pdf`.replace(/\s+/g, "_");
      pdf.save(fileName);
      toast.success("PDF de etiquetas generado exitosamente");
    } catch (err: any) {
      toast.error(`Error al generar PDF: ${err?.message || "Error desconocido"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700 font-bold">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            ¡Lote Registrado con Éxito!
          </DialogTitle>
          <DialogDescription>
            Se han creado <strong>{codes.length} unidades</strong> en el inventario listas para venta y control.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tarjeta de Resumen */}
          <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Producto:</span>
              <span className="font-bold text-foreground">{brand} {model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cantidad registrada:</span>
              <Badge className="bg-emerald-600 text-white font-bold">{codes.length} unidades</Badge>
            </div>
            {salePrice && salePrice > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio de Venta Unitario:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(salePrice)}</span>
              </div>
            ) : null}
          </div>

          {/* Formato de Etiqueta */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Formato de Etiqueta para Impresión:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={format === "qr" ? "default" : "outline"}
                className={`gap-2 ${format === "qr" ? "bg-primary text-white" : ""}`}
                onClick={() => setFormat("qr")}
              >
                <QrCode className="h-4 w-4" />
                Código QR
              </Button>
              <Button
                type="button"
                variant={format === "barcode" ? "default" : "outline"}
                className={`gap-2 ${format === "barcode" ? "bg-primary text-white" : ""}`}
                onClick={() => setFormat("barcode")}
              >
                <Barcode className="h-4 w-4" />
                Código de Barras
              </Button>
            </div>
          </div>

          {/* Lista de Códigos Creados */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Códigos Asignados ({codes.length}):
              </label>
              <Button variant="ghost" size="sm" onClick={handleCopyCodes} className="h-7 text-xs gap-1">
                <Copy className="h-3.5 w-3.5" />
                Copiar lista
              </Button>
            </div>
            <div className="max-h-32 overflow-y-auto bg-muted/40 p-2 rounded-lg border text-xs font-mono grid grid-cols-2 sm:grid-cols-3 gap-1">
              {codes.map((c, i) => (
                <div key={i} className="bg-background px-2 py-0.5 rounded border text-center font-medium">
                  {c}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="bg-primary hover:bg-primary/90 text-white font-bold gap-2"
          >
            <Download className="h-4 w-4" />
            {isGenerating ? "Generando PDF..." : `Imprimir ${codes.length} Etiquetas PDF`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
