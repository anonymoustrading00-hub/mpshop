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
  // Barra de navegación inferior deshabilitada - se usa solo el menú hamburguesa
  return null;
}
