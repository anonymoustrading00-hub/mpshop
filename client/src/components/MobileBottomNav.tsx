import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Home,
  ShoppingBag,
  Tag,
  DollarSign,
  ShoppingCart,
  Menu,
  Package,
} from "lucide-react";
import { useState } from "react";
import MobileMenu from "./MobileMenu";

const ADMIN_ITEMS = [
  { href: "/", icon: Home, label: "Inicio" },
  { href: "/sales", icon: ShoppingBag, label: "Ventas" },
  { href: "/units", icon: Tag, label: "Unidades" },
  { href: "/finance", icon: DollarSign, label: "Finanzas" },
  { href: "/orders", icon: ShoppingCart, label: "Pedidos" },
];

const DELIVERY_ITEMS = [
  { href: "/", icon: Home, label: "Inicio" },
  { href: "/orders", icon: ShoppingCart, label: "Pedidos" },
  { href: "/delivery-load", icon: Package, label: "Mi carga" },
  { href: "/sales", icon: ShoppingBag, label: "Ventas" },
  { href: "/repartidor/finance", icon: DollarSign, label: "Caja" },
];

export default function MobileBottomNav() {
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const items = user.role === "admin" ? ADMIN_ITEMS : DELIVERY_ITEMS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_24px_-6px_rgba(15,23,42,0.12)]">
      {/* Safe area for iPhone home indicator */}
      <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-all duration-200 ${
                  isActive
                    ? "text-primary"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                <div
                  className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                    isActive ? "bg-primary/10 scale-110" : ""
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {isActive && (
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold leading-none tracking-tight ${
                    isActive ? "text-primary font-bold" : ""
                  }`}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}

        {/* More / Menu button at the end */}
        <div className="flex-1 flex items-center justify-center">
          <MobileMenu triggerClassName="flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 text-slate-400 hover:text-slate-700" />
        </div>
      </div>
    </nav>
  );
}
