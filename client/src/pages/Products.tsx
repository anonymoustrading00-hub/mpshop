import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Search, Tag, ShoppingCart, Edit2, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { AddProductDialog } from "@/components/AddProductDialog";
import { EditProductDialog } from "@/components/EditProductDialog";
import { formatCurrency } from "@/lib/currency";
import { motion, AnimatePresence } from "framer-motion";

const ITEMS_PER_PAGE = 12;

export default function Products() {
  const { user } = useAuth();
  const { data: products, isLoading, refetch } = trpc.inventory.listProducts.useQuery(undefined, {
    staleTime: 60_000,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProducts = useMemo(() => {
    setCurrentPage(1);
    if (!products) return [];
    return products.filter((p: any) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const categories = [
    { id: "all", label: "Todos" },
    { id: "finished_product", label: "Terminados" },
    { id: "raw_material", label: "Materia Prima" },
    { id: "supplies", label: "Suministros" },
    { id: "insumo", label: "Insumos" },
  ];

  const handleEditClick = useCallback((product: any) => {
    setSelectedProduct(product);
  }, []);

  const handleEditClose = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  const handleProductUpdated = useCallback(() => {
    setSelectedProduct(null);
    refetch();
  }, [refetch]);

  const productCounts = useMemo(() => {
    if (!products) return { total: 0, finished: 0, raw: 0, supplies: 0, insumo: 0 };
    return {
      total: products.length,
      finished: products.filter((p: any) => p.category === 'finished_product').length,
      raw: products.filter((p: any) => p.category === 'raw_material').length,
      supplies: products.filter((p: any) => p.category === 'supplies').length,
      insumo: products.filter((p: any) => p.category === 'insumo').length,
    };
  }, [products]);

  const categoryColorMap: Record<string, string> = {
    finished_product: "bg-blue-100 text-blue-700 border-blue-200",
    raw_material: "bg-emerald-100 text-emerald-700 border-emerald-200",
    supplies: "bg-violet-100 text-violet-700 border-violet-200",
    insumo: "bg-orange-100 text-orange-700 border-orange-200",
  };

  const categoryEmoji: Record<string, string> = {
    finished_product: "📦 Terminado",
    raw_material: "💧 Materia Prima",
    supplies: "🏷️ Suministro",
    insumo: "🧪 Insumo",
  };

  if (isLoading) {
    return (
      <div className="min-h-full bg-background p-4 md:p-6 mb-20 md:mb-0">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Catálogo de <span className="text-blue-600">Productos</span></h1>
              <p className="text-sm text-slate-500 mt-1.5">Define y categoriza tus tipos de productos e insumos.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-[1.5rem] bg-slate-100 animate-pulse h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background p-4 md:p-6 mb-20 md:mb-0">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Catálogo de <span className="text-blue-600">Productos</span></h1>
            <p className="text-sm text-slate-500 mt-1.5">Define y categoriza tus tipos de productos e insumos.</p>
          </div>
          {user?.role === "admin" && (
            <AddProductDialog onProductAdded={() => refetch()} />
          )}
        </div>

        {/* Barra de filtros */}
        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[1.5rem] bg-white/95 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <Input
                placeholder="Buscar por nombre o código..."
                className="pl-11 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 ${
                    categoryFilter === cat.id
                      ? "bg-slate-900 text-white shadow-md"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Contador de resultados */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-slate-500 font-medium">
            <span className="font-black text-slate-800">{filteredProducts.length}</span> productos encontrados
            {searchTerm && <> · búsqueda: "<span className="text-blue-600 font-bold">{searchTerm}</span>"</>}
          </p>
          {totalPages > 1 && (
            <p className="text-xs text-slate-400 font-medium">
              Página {currentPage} de {totalPages}
            </p>
          )}
        </div>

        {/* Grid de productos */}
        <AnimatePresence mode="wait">
          {paginatedProducts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-24 gap-5"
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-inner">
                  <LayoutGrid className="h-10 w-10 text-slate-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Search className="h-3 w-3 text-white" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-slate-800">Sin resultados</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-xs">
                  {searchTerm
                    ? `No encontramos productos que coincidan con "${searchTerm}". Intenta con otro término.`
                    : "No hay productos en esta categoría aún."}
                </p>
              </div>
              {user?.role === "admin" && (
                <AddProductDialog onProductAdded={() => refetch()} />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {paginatedProducts.map((product: any, idx: number) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Card className="group overflow-hidden border-none shadow-[0_4px_20px_rgb(0,0,0,0.05)] rounded-[1.5rem] bg-white hover:shadow-[0_12px_40px_rgb(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1">
                    <div className="aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 relative">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-12 w-12 text-slate-300" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${categoryColorMap[product.category] || "bg-slate-100 text-slate-600"}`}>
                          {categoryEmoji[product.category] || product.category}
                        </span>
                      </div>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-black text-slate-900 text-base leading-tight">{product.name}</h3>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">#{product.code}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-slate-50 pt-3">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">P. Compra</p>
                          <p className="text-sm font-black text-blue-600">{product.price ? formatCurrency(product.price) : "—"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">P. Venta</p>
                          <p className="text-sm font-black text-emerald-600">{product.salePrice ? formatCurrency(product.salePrice) : "—"}</p>
                        </div>
                      </div>

                      {user?.role === "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 rounded-xl border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all duration-200"
                          onClick={() => handleEditClick(product)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Editar Producto
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl h-10 w-10 border-slate-200"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-200 ${
                    currentPage === page
                      ? "bg-slate-900 text-white shadow-md"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="rounded-xl h-10 w-10 border-slate-200"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Info de catálogo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {[
            { label: "Terminados", count: productCounts.finished, color: "text-blue-600" },
            { label: "Materia Prima", count: productCounts.raw, color: "text-emerald-600" },
            { label: "Suministros", count: productCounts.supplies, color: "text-violet-600" },
            { label: "Insumos", count: productCounts.insumo, color: "text-orange-600" },
          ].map((item) => (
            <div key={item.label} className="text-center p-3 rounded-2xl bg-white border border-slate-100">
              <p className={`text-xl font-black ${item.color}`}>{item.count}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {selectedProduct && (
        <EditProductDialog
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onOpenChange={(open) => { if (!open) handleEditClose(); }}
          onProductUpdated={handleProductUpdated}
        />
      )}
    </div>
  );
}
