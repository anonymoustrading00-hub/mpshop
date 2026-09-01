import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QrCode, Printer, Plus, Settings, Info } from "lucide-react";
import QRCode from "qrcode";
import bwipjs from "bwip-js";
import jsPDF from "jspdf";

// ─── Tipos de código soportados ────────────────────────────────────────────────
type BarcodeSubtype = "code128" | "code39" | "ean13" | "upca";
type CodeType = "qr" | "barcode";

const BARCODE_SUBTYPES: { value: BarcodeSubtype; label: string; description: string }[] = [
  { value: "code128", label: "Code 128", description: "Letras + números. Envíos y logística." },
  { value: "code39", label: "Code 39", description: "Letras mayúsculas + números. Industria e inventarios." },
  { value: "ean13", label: "EAN-13", description: "13 dígitos. El más usado en supermercados del mundo." },
  { value: "upca", label: "UPC-A", description: "12 dígitos. Tiendas de América del Norte." },
];

const BWIP_BCID: Record<BarcodeSubtype, string> = {
  code128: "code128",
  code39: "code39",
  ean13: "ean13",
  upca: "upca",
};

function renderBarcodeToCanvas(canvas: HTMLCanvasElement, code: string, subtype: BarcodeSubtype) {
  bwipjs.toCanvas(canvas, {
    bcid: BWIP_BCID[subtype],
    text: code,
    scale: 3,
    height: 12,
    includetext: false,
    textxalign: "center",
  });
}

function generateBarcodeDataUrl(code: string, subtype: BarcodeSubtype): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement("canvas");
      renderBarcodeToCanvas(canvas, code, subtype);
      resolve(canvas.toDataURL("image/png"));
    } catch (err) {
      reject(err);
    }
  });
}

export default function GenerateCodes() {
  const [quantity, setQuantity] = useState(50);
  const [codeType, setCodeType] = useState<CodeType>("qr");
  const [barcodeSubtype, setBarcodeSubtype] = useState<BarcodeSubtype>("code128");
  const [notes, setNotes] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  const { data: companyConfig } = trpc.settings.getCompanyConfig.useQuery();
  const { data: settingsData, refetch: refetchSettings } = trpc.codes.getSettings.useQuery();
  const { data: batchesData, refetch: refetchBatches } = trpc.codes.listBatches.useQuery();
  const { data: batchCodesData } = trpc.codes.getBatchCodes.useQuery(
    { batchId: selectedBatchId! },
    { enabled: !!selectedBatchId }
  );

  const updateSettingsMutation = trpc.codes.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Preferencia de etiquetas guardada");
      refetchSettings();
    },
  });

  const generateBatchMutation = trpc.codes.generateBatch.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Lote de ${data.quantity} códigos generado exitosamente`);
      setSelectedBatchId(data.batchId);
      setNotes("");
      refetchBatches();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity < 1 || quantity > 500) {
      toast.error("Ingresa una cantidad entre 1 y 500");
      return;
    }
    const batchNotes =
      codeType === "barcode"
        ? `[${barcodeSubtype.toUpperCase()}] ${notes}`.trim()
        : notes;

    generateBatchMutation.mutate({ quantity, type: codeType, notes: batchNotes });
  };

  /** Detecta el subtipo guardado en las notas del lote seleccionado */
  const detectedSubtype = (): BarcodeSubtype => {
    if (!batchCodesData) return "code128";
    const n = (batchCodesData.batch.notes || "").toUpperCase();
    if (n.startsWith("[CODE39]")) return "code39";
    if (n.startsWith("[EAN13]")) return "ean13";
    if (n.startsWith("[UPCA]")) return "upca";
    return "code128";
  };

  /** Obtiene el label del subtipo de un lote a partir de sus notas */
  const getSubtypeLabel = (batchNotes: string, batchType: string) => {
    if (batchType !== "barcode") return "QR";
    const n = (batchNotes || "").toUpperCase();
    if (n.startsWith("[CODE39]")) return "Code 39";
    if (n.startsWith("[EAN13]")) return "EAN-13";
    if (n.startsWith("[UPCA]")) return "UPC-A";
    return "Code 128";
  };

  // ── PDF de impresión ──────────────────────────────────────────────────────────
  const handlePrintPDF = async () => {
    if (!batchCodesData?.codes || batchCodesData.codes.length === 0) {
      toast.error("No hay códigos en este lote para imprimir");
      return;
    }

    const isBarcode = batchCodesData.batch.type === "barcode";
    const sub = detectedSubtype();
    const companyDisplayName = (companyConfig?.name || "MP SHOP TIENDA ONLINE").toUpperCase();
    const subtypeLabel = isBarcode
      ? BARCODE_SUBTYPES.find((s) => s.value === sub)?.label || "Code 128"
      : "QR";

    toast.info(`Generando PDF (${subtypeLabel})...`);

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const cols = isBarcode ? 5 : 4;
    const rows = isBarcode ? 12 : 10;
    const labelWidth = isBarcode ? 37 : 46;
    const labelHeight = isBarcode ? 21 : 26;
    const startX = isBarcode ? 6 : 7;
    const startY = isBarcode ? 8 : 8;
    const gapX = isBarcode ? 2.5 : 3;
    const gapY = isBarcode ? 2.5 : 2.5;

    let col = 0;
    let row = 0;

    for (let i = 0; i < batchCodesData.codes.length; i++) {
      const codeItem = batchCodesData.codes[i];
      if (i > 0 && i % (cols * rows) === 0) {
        pdf.addPage();
        col = 0;
        row = 0;
      }

      const x = startX + col * (labelWidth + gapX);
      const y = startY + row * (labelHeight + gapY);

      pdf.setDrawColor(210, 215, 220);
      pdf.roundedRect(x, y, labelWidth, labelHeight, 1.5, 1.5);

      pdf.setFontSize(isBarcode ? 4.8 : 5.2);
      pdf.setFont("helvetica", "bold");
      pdf.text(companyDisplayName, x + labelWidth / 2, y + 3.2, {
        align: "center",
        maxWidth: labelWidth - 3,
      });

      try {
        if (isBarcode) {
          const barcodeDataUrl = await generateBarcodeDataUrl(codeItem.code, sub);
          pdf.addImage(barcodeDataUrl, "PNG", x + 2, y + 4.2, labelWidth - 4, 9);

          pdf.setFontSize(6);
          pdf.setFont("courier", "bold");
          pdf.text(codeItem.code, x + labelWidth / 2, y + 15.8, {
            align: "center",
            maxWidth: labelWidth - 2,
          });

          pdf.setFontSize(3.8);
          pdf.setFont("helvetica", "normal");
          pdf.text(subtypeLabel, x + labelWidth / 2, y + 18.8, { align: "center" });
        } else {
          const qrDataUrl = await QRCode.toDataURL(codeItem.code, { margin: 0, width: 70 });
          pdf.addImage(qrDataUrl, "PNG", x + 2, y + 5.5, 15, 15);

          pdf.setFontSize(6.5);
          pdf.setFont("courier", "bold");
          pdf.text(codeItem.code, x + 18.5, y + 12, { maxWidth: labelWidth - 19.5 });

          pdf.setFontSize(4.5);
          pdf.setFont("helvetica", "normal");
          pdf.text("Escanear código", x + 18.5, y + 16.5, { maxWidth: labelWidth - 19.5 });
        }
      } catch (err) {
        console.error("Error al renderizar código en PDF", err);
        pdf.setFontSize(6.5);
        pdf.setFont("courier", "bold");
        pdf.text(codeItem.code, x + labelWidth / 2, y + 14, {
          align: "center",
          maxWidth: labelWidth - 3,
        });
      }

      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    }

    pdf.save(`Lote_${subtypeLabel.replace(" ", "")}_${batchCodesData.batch.id}.pdf`);
    toast.success("PDF descargado exitosamente");
  };

  const selectedSubtypeInfo = BARCODE_SUBTYPES.find((s) => s.value === barcodeSubtype);
  const batchSubtype = batchCodesData ? detectedSubtype() : null;
  const batchSubtypeInfo = batchSubtype ? BARCODE_SUBTYPES.find((s) => s.value === batchSubtype) : null;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <QrCode className="h-7 w-7 text-primary" />
            Generación Masiva de Códigos e Impresión
          </h1>
          <p className="text-sm text-muted-foreground">
            Crea lotes de códigos en blanco, imprime las etiquetas físicas y pégalas en los equipos.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-muted p-2 rounded-lg border">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Preferencia global:</span>
          <Select
            value={settingsData?.defaultCodeType || "qr"}
            onValueChange={(val) => updateSettingsMutation.mutate({ defaultCodeType: val as any })}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qr">Código QR</SelectItem>
              <SelectItem value="barcode">Código de Barras</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Formulario ── */}
        <Card className="lg:col-span-1 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Generar Nuevo Lote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Cantidad de etiquetas:</label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Tipo de Etiqueta:</label>
                <Select value={codeType} onValueChange={(v) => setCodeType(v as CodeType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qr">📱 Código QR</SelectItem>
                    <SelectItem value="barcode">🔲 Código de Barras</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Selector de formato de código de barras ── */}
              {codeType === "barcode" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold block">Formato de Código de Barras:</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {BARCODE_SUBTYPES.map((sub) => (
                      <button
                        key={sub.value}
                        type="button"
                        onClick={() => setBarcodeSubtype(sub.value)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                          barcodeSubtype === sub.value
                            ? "border-primary bg-primary/10"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            barcodeSubtype === sub.value
                              ? "border-primary"
                              : "border-slate-300"
                          }`}
                        >
                          {barcodeSubtype === sub.value && (
                            <span className="h-2 w-2 rounded-full bg-primary block" />
                          )}
                        </span>
                        <div>
                          <p className={`text-xs font-bold leading-tight ${barcodeSubtype === sub.value ? "text-primary" : ""}`}>
                            {sub.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                            {sub.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedSubtypeInfo && (
                    <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-blue-700">
                        <strong>{selectedSubtypeInfo.label}</strong> seleccionado. Se guardará en el PDF con este formato.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold block mb-1">Notas / Descripción del Lote:</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ej. Lote 50 etiquetas para compra del 28/07"
                />
              </div>

              <Button type="submit" className="w-full gap-2" disabled={generateBatchMutation.isPending}>
                <QrCode className="h-4 w-4" />
                {generateBatchMutation.isPending ? "Generando..." : "Generar Lote de Etiquetas"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ── Lotes Existentes ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold">Lotes de Códigos Generados</CardTitle>
            {selectedBatchId && (
              <Button onClick={handlePrintPDF} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Printer className="h-4 w-4" /> Descargar PDF para Imprimir
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
              {batchesData?.items.map((b: any) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBatchId(b.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedBatchId === b.id
                      ? "border-primary bg-primary/10"
                      : "bg-muted/40 hover:bg-muted"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm">Lote #{b.id}</span>
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {getSubtypeLabel(b.notes, b.type)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Cantidad: <span className="font-semibold text-foreground">{b.quantity} etiquetas</span>
                  </div>
                  {b.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic truncate">
                      {b.notes.replace(/^\[[\w\d]+\]\s*/, "")}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Vista Previa */}
            {batchCodesData && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm">
                    Vista Previa del Lote #{batchCodesData.batch.id} ({batchCodesData.codes.length} etiquetas)
                  </h4>
                  {batchCodesData.batch.type === "barcode" && batchSubtypeInfo && (
                    <Badge variant="secondary" className="text-[10px]">
                      {batchSubtypeInfo.label}
                    </Badge>
                  )}
                </div>
                <div
                  className={`grid gap-2 max-h-56 overflow-y-auto ${
                    batchCodesData.batch.type === "barcode"
                      ? "grid-cols-2 sm:grid-cols-5"
                      : "grid-cols-2 sm:grid-cols-4"
                  }`}
                >
                  {batchCodesData.codes.slice(0, 15).map((c: any) => (
                    <div key={c.id} className="p-2 border rounded text-center bg-background">
                      {batchCodesData.batch.type === "barcode" ? (
                        <canvas
                          ref={(canvas) => {
                            if (canvas && c.code) {
                              try { renderBarcodeToCanvas(canvas, c.code, detectedSubtype()); } catch {}
                            }
                          }}
                          className="w-full h-8 object-contain"
                        />
                      ) : (
                        <img
                          src=""
                          ref={(img) => {
                            if (img && c.code) {
                              QRCode.toDataURL(c.code, { margin: 0, width: 60 })
                                .then((url) => { if (img) img.src = url; })
                                .catch(() => {});
                            }
                          }}
                          alt={c.code}
                          className="w-12 h-12 mx-auto"
                        />
                      )}
                      <div className="font-mono text-[9px] font-bold truncate mt-1">{c.code}</div>
                      <Badge
                        variant={c.status === "assigned" ? "default" : "secondary"}
                        className="text-[9px] mt-1"
                      >
                        {c.status === "assigned" ? "Asignado" : "Libre"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

