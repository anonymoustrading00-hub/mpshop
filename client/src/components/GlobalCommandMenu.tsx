import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home,
  ShoppingBag,
  Package,
  Truck,
  Users,
  FileText,
  BarChart2,
  DollarSign,
  Receipt,
  Factory,
  Search,
  CreditCard,
  Landmark,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Inicio", href: "/", icon: Home, keywords: "home inicio" },
  { label: "Catálogo / Inventario", href: "/catalog", icon: Package, keywords: "catalogo inventario stock productos equipos laptops" },
  { label: "Unidades", href: "/units", icon: Package, keywords: "unidades laptops series equipos" },
  { label: "Taller & Servicio Técnico", href: "/repairs", icon: Factory, keywords: "taller tecnico reparaciones ordenes servicio repuestos" },
  { label: "Garantías", href: "/warranties", icon: FileText, keywords: "garantias garantia cobertura rma" },
  { label: "Devoluciones (RMA)", href: "/returns", icon: Package, keywords: "devoluciones rma devolucion cambios" },
  { label: "Códigos QR", href: "/generate-codes", icon: Package, keywords: "codigos qr etiquetas imprimir" },
  { label: "Ventas y Cotizaciones", href: "/sales", icon: ShoppingBag, keywords: "ventas cotizaciones venta pos caja" },
  { label: "Pedidos / Entregas", href: "/orders", icon: Truck, keywords: "pedidos entregas repartidor" },
  { label: "📊 KPIs Tiempo Real", href: "/dashboard-kpis", icon: BarChart2, keywords: "kpis indicadores metricas tiempo real" },
  { label: "📈 Reportes Ejecutivos", href: "/reports", icon: BarChart2, keywords: "reportes informes reporte pdf exportar" },
  { label: "Analítica Avanzada", href: "/analytics", icon: FileText, keywords: "analitica avanzada margen rotacion" },
  { label: "💰 Rentabilidad Real (P&L)", href: "/rentabilidad", icon: DollarSign, keywords: "rentabilidad margen real cogs utilidad pl estado resultados" },
  { label: "Clientes", href: "/customers", icon: Users, keywords: "clientes cliente" },
  { label: "Finanzas & Caja", href: "/finance", icon: DollarSign, keywords: "finanzas caja apertura cierre balance" },
  { label: "Cuentas por Cobrar (CXC)", href: "/accounts-receivable", icon: CreditCard, keywords: "cuentas por cobrar crédito cxc deudas cobros pagaré" },
  { label: "Cuentas por Pagar (CXP)", href: "/accounts-payable", icon: Landmark, keywords: "cuentas por pagar crédito cxp proveedores obligaciones" },
  { label: "Gastos", href: "/expenses", icon: Receipt, keywords: "gastos gasto egreso operativo" },
  { label: "👥 Gestión de Usuarios & Permisos", href: "/users", icon: Users, keywords: "usuarios permisos roles perfiles cuentas acceso seguridad" },
];

export default function GlobalCommandMenu() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  // Listen for Ctrl+K / Cmd+K globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNavigate = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar módulo, página o acción..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
            <Search className="h-8 w-8 opacity-30" />
            <span>Sin resultados. Prueba otro término.</span>
          </div>
        </CommandEmpty>

        <CommandGroup heading="Módulos de la aplicación">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={`${item.label} ${item.keywords}`}
              onSelect={() => handleNavigate(item.href)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Acciones rápidas">
          <CommandItem
            value="nueva venta crear venta"
            onSelect={() => {
              handleNavigate("/sales");
              // small delay so the page loads before we trigger the action
              setTimeout(() => {
                const btn = document.querySelector<HTMLButtonElement>("[data-action='nueva-venta']");
                btn?.click();
              }, 400);
            }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="font-medium">Nueva Venta</span>
          </CommandItem>
          <CommandItem
            value="nuevo pedido crear pedido"
            onSelect={() => handleNavigate("/create-order")}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <Truck className="h-4 w-4 text-indigo-600" />
            </div>
            <span className="font-medium">Nuevo Pedido</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      {/* Footer hint */}
      <div className="border-t bg-muted/30 px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">↑</kbd><kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">↵</kbd> abrir</span>
          <span className="flex items-center gap-1"><kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">Esc</kbd> cerrar</span>
        </div>
        <span className="opacity-60">Ctrl + K</span>
      </div>
    </CommandDialog>
  );
}
