import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Edit2, X } from "lucide-react";

interface EditProductDialogProps {
  product: any;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onProductUpdated?: () => void;
}

export function EditProductDialog({ product, isOpen: externalIsOpen, onOpenChange: externalOnOpenChange, onProductUpdated }: EditProductDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnOpenChange || setInternalIsOpen;
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "finished_product",
    price: "",
    salePrice: "",
    wholesalePrice: "",
    discountPrice: "",
    imageUrl: "",
    status: "active",
    unit: "unidad",
    presentationQuantity: "1",
    presentationUnit: "unidad",
    presentationVolumeMl: "",
    presentationWeightGr: "",
    productionRole: "none",
    storageLocation: "",
    supplierName: "",
    productionNotes: "",
  });
  const [imagePreview, setImagePreview] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (product && isOpen) {
      setFormData({
        code: product.code || "",
        name: product.name || "",
        category: product.category || "finished_product",
        price: product.price ? (product.price / 100).toString() : "",
        salePrice: product.salePrice ? (product.salePrice / 100).toString() : "",
        wholesalePrice: product.wholesalePrice ? (product.wholesalePrice / 100).toString() : "",
        discountPrice: product.discountPrice ? (product.discountPrice / 100).toString() : "",
        imageUrl: product.imageUrl || "",
        status: product.status || "active",
        unit: product.unit || "unidad",
        presentationQuantity: product.presentationQuantity ? product.presentationQuantity.toString() : "1",
        presentationUnit: product.presentationUnit || "unidad",
        presentationVolumeMl: product.presentationVolumeMl ? product.presentationVolumeMl.toString() : "",
        presentationWeightGr: product.presentationWeightGr ? product.presentationWeightGr.toString() : "",
        productionRole: product.productionRole || "none",
        storageLocation: product.storageLocation || "",
        supplierName: product.supplierName || "",
        productionNotes: product.productionNotes || "",
      });
      setImagePreview(product.imageUrl || "");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [product, isOpen]);

  const updateProductMutation = (trpc.inventory as any).updateProduct.useMutation({
    onSuccess: () => {
      toast.success("Producto actualizado exitosamente");
      setIsOpen(false);
      onProductUpdated?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar el producto");
    },
  });

  const handleImageUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData((prev) => ({ ...prev, imageUrl: url }));
    setSelectedFile(null);
    setImagePreview(url);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("file", file);

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) {
        throw new Error("Error al subir la imagen");
      }

      const data = await response.json();
      setFormData((prev) => ({ ...prev, imageUrl: data.url }));
      setImagePreview(data.url);
      toast.success("Imagen subida exitosamente");
    } catch (error) {
      console.error("Error uploading image:", error);
      setSelectedFile(null);
      setFormData((prev) => ({ ...prev, imageUrl: product.imageUrl || "" }));
      setImagePreview(product.imageUrl || "");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast.error("Error al subir la imagen");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen valido");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar 5MB");
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
      setFormData((prev) => ({ ...prev, imageUrl: "" }));
    };
    reader.readAsDataURL(file);

    await uploadFile(file);
  };

  const handleRemoveImage = () => {
    setImagePreview("");
    setSelectedFile(null);
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.price || !formData.code.trim()) {
      toast.error("Por favor completa todos los campos requeridos (Nombre, SKU y Precio)");
      return;
    }

    if (selectedFile && !formData.imageUrl) {
      toast.error("Primero termina de subir la imagen antes de guardar el producto");
      return;
    }

    updateProductMutation.mutate({
      id: product.id,
      code: formData.code,
      name: formData.name,
      category: formData.category as "finished_product" | "raw_material" | "supplies" | "insumo",
      price: parseFloat(formData.price),
      salePrice: formData.salePrice ? parseFloat(formData.salePrice) : 0,
      wholesalePrice: formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : 0,
      discountPrice: formData.discountPrice ? parseFloat(formData.discountPrice) : 0,
      imageUrl: formData.imageUrl || "",
      status: formData.status as "active" | "inactive",
      unit: formData.unit,
      presentationQuantity: formData.presentationQuantity ? parseInt(formData.presentationQuantity, 10) : 1,
      presentationUnit: formData.presentationUnit,
      presentationVolumeMl: formData.presentationVolumeMl ? parseInt(formData.presentationVolumeMl, 10) : 0,
      presentationWeightGr: formData.presentationWeightGr ? parseInt(formData.presentationWeightGr, 10) : 0,
      productionRole: formData.productionRole as any,
      storageLocation: formData.storageLocation || null,
      supplierName: formData.supplierName || null,
      productionNotes: formData.productionNotes || null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => setIsOpen(v)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Edit2 className="h-4 w-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border-white/40 shadow-2xl rounded-[1.8rem]">
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Modifica los detalles del producto seleccionado.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label htmlFor={`name-${product.id}`}>Nombre del Producto</Label>
            <Input
              id={`name-${product.id}`}
              placeholder="Ej: Camiseta Algodon Premium"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`code-${product.id}`} className="text-sm font-semibold text-slate-700">SKU (Codigo)</Label>
              <Input
                id={`code-${product.id}`}
                placeholder="Ej: COCO-001"
                value={formData.code}
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, code: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`category-${product.id}`} className="text-sm font-semibold text-slate-700">Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger id={`category-${product.id}`} className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finished_product">Producto Terminado</SelectItem>
                  <SelectItem value="raw_material">Materia Prima</SelectItem>
                  <SelectItem value="supplies">Suministro</SelectItem>
                  <SelectItem value="insumo">Insumo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`price-${product.id}`} className="text-sm font-semibold text-slate-700">Precio de Compra (Bs.)</Label>
              <Input
                id={`price-${product.id}`}
                type="number"
                step="any"
                inputMode="decimal"
                onFocus={(e) => e.target.select()}
                placeholder="0"
                value={formData.price}
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, price: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`salePrice-${product.id}`} className="text-sm font-semibold text-slate-700">Precio de Venta (Bs.)</Label>
              <Input
                id={`salePrice-${product.id}`}
                type="number"
                step="any"
                inputMode="decimal"
                onFocus={(e) => e.target.select()}
                placeholder="0"
                value={formData.salePrice}
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, salePrice: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`wholesalePrice-${product.id}`} className="text-sm font-semibold text-slate-700">Precio Mayorista (Bs.)</Label>
              <Input
                id={`wholesalePrice-${product.id}`}
                type="number"
                step="any"
                inputMode="decimal"
                onFocus={(e) => e.target.select()}
                placeholder="0"
                value={formData.wholesalePrice}
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, wholesalePrice: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`discountPrice-${product.id}`} className="text-sm font-semibold text-slate-700">Precio Descuento (Bs.)</Label>
              <Input
                id={`discountPrice-${product.id}`}
                type="number"
                step="any"
                inputMode="decimal"
                onFocus={(e) => e.target.select()}
                placeholder="0"
                value={formData.discountPrice}
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, discountPrice: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor={`status-${product.id}`}>Estado del Producto</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger id={`status-${product.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo (Disponible para venta)</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(formData.category === "raw_material" || formData.category === "insumo") && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <Label className="text-base font-semibold text-slate-800">Datos tecnicos para produccion</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Estos campos conectan compras, inventario y produccion con la misma ficha de insumo.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`unit-${product.id}`}>Unidad operativa</Label>
                  <Select value={formData.unit} onValueChange={(value) => setFormData((prev) => ({ ...prev, unit: value }))}>
                    <SelectTrigger id={`unit-${product.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unidad">Unidad</SelectItem>
                      <SelectItem value="L">Litro</SelectItem>
                      <SelectItem value="ml">Mililitro</SelectItem>
                      <SelectItem value="kg">Kilogramo</SelectItem>
                      <SelectItem value="g">Gramo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`presentationQuantity-${product.id}`}>Cantidad por presentacion</Label>
                  <Input
                    id={`presentationQuantity-${product.id}`}
                    type="number"
                    min="1"
                    value={formData.presentationQuantity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, presentationQuantity: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`presentationUnit-${product.id}`}>Unidad de compra</Label>
                  <Input
                    id={`presentationUnit-${product.id}`}
                    placeholder="Ej: bolsa, botella, paquete"
                    value={formData.presentationUnit}
                    onChange={(e) => setFormData((prev) => ({ ...prev, presentationUnit: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`productionRole-${product.id}`}>Rol en produccion</Label>
                  <Select value={formData.productionRole} onValueChange={(value) => setFormData((prev) => ({ ...prev, productionRole: value }))}>
                    <SelectTrigger id={`productionRole-${product.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin rol productivo</SelectItem>
                      <SelectItem value="milk">Leche / base liquida</SelectItem>
                      <SelectItem value="sugar">Azucar / endulzante</SelectItem>
                      <SelectItem value="culture">Nodulo / cultivo</SelectItem>
                      <SelectItem value="bottle">Envase / botella</SelectItem>
                      <SelectItem value="cap">Tapa</SelectItem>
                      <SelectItem value="label">Etiqueta</SelectItem>
                      <SelectItem value="packaging">Empaque</SelectItem>
                      <SelectItem value="finished_good">Producto terminado</SelectItem>
                      <SelectItem value="other">Otro insumo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`presentationVolumeMl-${product.id}`}>Volumen por presentacion (ml)</Label>
                  <Input
                    id={`presentationVolumeMl-${product.id}`}
                    type="number"
                    placeholder="Ej: 800"
                    value={formData.presentationVolumeMl}
                    onChange={(e) => setFormData((prev) => ({ ...prev, presentationVolumeMl: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`presentationWeightGr-${product.id}`}>Peso por presentacion (g)</Label>
                  <Input
                    id={`presentationWeightGr-${product.id}`}
                    type="number"
                    placeholder="Ej: 1000"
                    value={formData.presentationWeightGr}
                    onChange={(e) => setFormData((prev) => ({ ...prev, presentationWeightGr: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`storageLocation-${product.id}`}>Ubicacion / almacenamiento</Label>
                  <Input
                    id={`storageLocation-${product.id}`}
                    placeholder="Ej: Camara fria, estante A"
                    value={formData.storageLocation}
                    onChange={(e) => setFormData((prev) => ({ ...prev, storageLocation: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`supplierName-${product.id}`}>Proveedor habitual</Label>
                  <Input
                    id={`supplierName-${product.id}`}
                    placeholder="Ej: Proveedor leche"
                    value={formData.supplierName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, supplierName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`productionNotes-${product.id}`}>Notas de uso en produccion</Label>
                <Input
                  id={`productionNotes-${product.id}`}
                  placeholder="Ej: usar primero lotes abiertos, mantener refrigerado"
                  value={formData.productionNotes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, productionNotes: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
            <Label className="text-base font-semibold">Imagen del Producto (Opcional)</Label>

            <div>
              <Label htmlFor={`fileInput-${product.id}`} className="text-sm">
                Subir imagen desde archivo
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  ref={fileInputRef}
                  id={`fileInput-${product.id}`}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Maximo 5MB. Formatos: JPG, PNG, GIF, WebP. La carga empieza
                automaticamente al seleccionar el archivo.
              </p>
            </div>

            <div>
              <Label htmlFor={`imageUrl-${product.id}`} className="text-sm">
                O ingresa URL de imagen
              </Label>
              <Input
                id={`imageUrl-${product.id}`}
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={handleImageUrlChange}
                disabled={selectedFile !== null || isUploading}
              />
            </div>
          </div>

          {imagePreview && (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Vista previa de imagen:</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRemoveImage}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <img
                src={imagePreview}
                alt="Preview"
                className="max-w-full h-40 object-cover rounded"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isUploading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateProductMutation.isPending || isUploading}
              className="flex-1"
            >
              {isUploading
                ? "Subiendo imagen..."
                : updateProductMutation.isPending
                  ? "Guardando..."
                  : "Guardar Cambios"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
