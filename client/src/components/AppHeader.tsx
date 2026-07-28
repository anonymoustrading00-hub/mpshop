import { useAuth } from "@/_core/hooks/useAuth";
import MobileMenu from "./MobileMenu";
import { Link, useLocation } from "wouter";
import {
  ChevronRight,
  LayoutDashboard,
  ShoppingBag,
  Package,
  TrendingUp,
  ShoppingCart,
  Users,
  DollarSign,
  Receipt,
  Tag,
  Truck,
  BarChart3,
  LogOut,
  Sparkles,
  Search,
  CreditCard,
  Landmark,
} from "lucide-react";

/* ─── nav item type ─────────────────────────────────────────────── */
type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

import { useBranch } from "@/contexts/BranchContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Store } from "lucide-react";

/* ─── shared nav data ───────────────────────────────────────────── */
export const ADMIN_NAV: NavItem[] = [
  { href: "/orders",           label: "Pedidos",      icon: ShoppingCart },
  { href: "/sales",            label: "Ventas",       icon: ShoppingBag },
  { href: "/dashboard",        label: "Dashboard",    icon: LayoutDashboard },
  { href: "/analysis",         label: "Análisis",     icon: TrendingUp },
  { href: "/inventory",        label: "Inventario",   icon: Package },
  { href: "/branches",         label: "Sucursales",   icon: Store },
  { href: "/production",       label: "Producción",   icon: Package },
  { href: "/products",         label: "Catálogo",     icon: Tag },
  { href: "/customers",        label: "Clientes",     icon: Users },
  { href: "/suppliers",        label: "Proveedores",  icon: Users },
  { href: "/purchases",        label: "Compras",      icon: ShoppingCart },
  { href: "/finance",          label: "Finanzas",     icon: DollarSign },
  { href: "/accounts-receivable", label: "C. por Cobrar", icon: CreditCard },
  { href: "/accounts-payable", label: "C. por Pagar", icon: Landmark },
  { href: "/expenses",         label: "Gastos",       icon: Receipt },
  { href: "/delivery-persons", label: "Repartidores", icon: Truck },
  { href: "/reports",          label: "Reportes",     icon: BarChart3 },
];

export const DELIVERY_NAV: NavItem[] = [
  { href: "/orders",             label: "Mis Pedidos", icon: ShoppingCart },
  { href: "/delivery-load",      label: "Mi Carga",    icon: Package },
  { href: "/sales",              label: "Ventas",      icon: ShoppingBag },
  { href: "/repartidor/finance", label: "Caja",        icon: DollarSign },
];

/* ─── Tab Link Component ────────────────────────────────────────── */
function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`
        group relative flex shrink-0 items-center gap-2
        h-11 px-1
        text-[13px] font-semibold tracking-wide whitespace-nowrap
        transition-colors duration-200 select-none
        ${active
          ? "text-primary"
          : "text-slate-500 hover:text-slate-900"
        }
      `}
    >
      <Icon className={`shrink-0 h-4 w-4 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}`} />
      {item.label}
      {/* Animated Bottom Border */}
      <span 
        className={`absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full transition-all duration-300 ${
          active ? "bg-primary scale-x-100 opacity-100" : "bg-slate-300 scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100"
        }`}
      />
    </Link>
  );
}

/* ─── main header ───────────────────────────────────────────────── */
export default function AppHeader() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { activeBranchId, setActiveBranchId, branches } = useBranch();

  const navItems = user?.role === "admin" ? ADMIN_NAV : DELIVERY_NAV;
  const initial = user?.name?.charAt(0).toUpperCase() ?? "U";

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-2xl border-b border-slate-200/80 shadow-[0_4px_20px_-10px_rgba(15,23,42,0.1)]">

      {/* ══ TOP TIER: Brand & Profile (Desktop) ════════════════════ */}
      <div className="hidden md:flex w-full items-center justify-between px-6 py-3">
        {/* Logo & Brand */}
        <Link href="/">
          <div className="group flex shrink-0 cursor-pointer items-center gap-3">
            <img
              src="/logo.png"
              alt="Vitalia"
              className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/60 leading-none mb-1">
                Operación Diaria
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-slate-900 tracking-tight leading-none">Vitalia</span>
                <span className="bg-slate-100 text-[10px] px-1.5 py-0.5 rounded-md text-slate-600 font-mono border border-slate-200 leading-none">
                  v1.5.0
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Right side: User Profile & Logout */}
        {user && (
          <div className="flex items-center gap-4">
            {/* Branch Selector */}
            <div className="flex items-center mr-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2 border-slate-200 font-semibold bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                    <Store className="h-4 w-4 text-primary" />
                    {activeBranch?.name || "Seleccionar Sucursal"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {branches.map(branch => (
                    <DropdownMenuItem 
                      key={branch.id} 
                      onClick={() => setActiveBranchId(branch.id)}
                      className={activeBranchId === branch.id ? "bg-slate-100 font-bold" : ""}
                    >
                      {branch.name}
                      {branch.isWarehouse && <span className="ml-auto text-[10px] text-muted-foreground uppercase">Bodega</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Ctrl+K Search Trigger */}
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}
              className="hidden lg:flex items-center gap-2 h-9 px-4 rounded-full border border-slate-200 bg-slate-50 hover:bg-white hover:border-primary/40 hover:shadow-sm transition-all text-sm text-slate-400 hover:text-slate-700 group"
              title="Búsqueda global (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
              <span>Buscar...</span>
              <kbd className="ml-2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400">Ctrl+K</kbd>
            </button>
            {/* User Badge */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-4 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-white text-xs font-bold shadow-sm">
                {initial}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800 leading-none">{user.name}</span>
                <span className="text-[10px] font-medium text-slate-500 mt-0.5 leading-none">
                  {user.role === "admin" ? "Administrador" : "Repartidor"}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <button
              onClick={logout}
              title="Cerrar sesión"
              className="
                flex items-center gap-2 h-9 px-3 rounded-xl
                text-sm font-semibold text-slate-500
                transition-all duration-200
                hover:bg-red-50 hover:text-red-600 active:scale-95
              "
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        )}
      </div>

      {/* ══ BOTTOM TIER: Navigation Tabs (Desktop) ═════════════════ */}
      {user && (
        <div className="hidden md:flex w-full px-6 pt-1 pb-1">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 w-full justify-center lg:justify-start">
            {navItems.map((item) => (
              <TabLink key={item.href} item={item} active={location === item.href} />
            ))}
          </div>
        </div>
      )}

      {/* ══ MOBILE (< md) ═══════════════════════════════════════════ */}
      <div className="flex md:hidden items-center justify-between w-full px-4 py-3">
        <Link href="/">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Vitalia" className="h-9 w-auto object-contain" />
            <div className="flex flex-col">
              <span className="text-[14px] font-extrabold text-slate-900 leading-tight tracking-tight">Vitalia</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60 leading-none">
                Op. diaria
              </span>
            </div>
            <span className="bg-slate-100 text-[9px] px-1.5 py-0.5 rounded-md text-slate-600 font-mono border border-slate-200 leading-none self-center">
              v1.5.0
            </span>
          </div>
        </Link>
        <MobileMenu />
      </div>

    </header>
  );
}
