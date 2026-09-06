/**
 * Panel de Administración — Backup & Restauración
 * Ruta oculta: /admin-backup-9x7k2p
 * Solo accesible para administradores
 */
import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Download, Upload, Database, ShieldCheck, AlertTriangle,
  CheckCircle2, Clock, FileJson, RefreshCw, Trash2,
  Building2, Users, ShoppingCart, Package, Wrench,
  Wallet, BarChart3, Lock, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";

const SECRET = "mpshop-reset-2024";

// Módulos que contiene el backup con íconos y colores
const MODULO_INFO: Record<string, { label: string; icon: any; color: string }> = {
  inventario:          { label: "Inventario / Equipos",       icon: Package,     color: "blue" },
  ventas:              { label: "Ventas",                      icon: ShoppingCart, color: "emerald" },
  items_ventas:        { label: "Detalle de Ventas",           icon: ShoppingCart, color: "emerald" },
  cotizaciones:        { label: "Cotizaciones",                icon: FileJson,    color: "cyan" },
  items_cotizaciones:  { label: "Detalle de Cotizaciones",     icon: FileJson,    color: "cyan" },
  compras:             { label: "Compras",                     icon: Package,     color: "violet" },
  items_compras:       { label: "Detalle de Compras",          icon: Package,     color: "violet" },
  proveedores:         { label: "Proveedores",                 icon: Building2,   color: "orange" },
  clientes:            { label: "Clientes",                    icon: Users,       color: "pink" },
  reparaciones:        { label: "Reparaciones",                icon: Wrench,      color: "amber" },
  garantias:           { label: "Garantías",                   icon: ShieldCheck, color: "green" },
  devoluciones:        { label: "Devoluciones",                icon: RefreshCw,   color: "red" },
  caja_transacciones:  { label: "Transacciones de Caja",       icon: Wallet,      color: "teal" },
  caja_cierres:        { label: "Cierres de Caja",             icon: Wallet,      color: "teal" },
  caja_aperturas:      { label: "Aperturas de Caja",           icon: Wallet,      color: "teal" },
  gastos_operativos:   { label: "Gastos Operativos",           icon: BarChart3,   color: "rose" },
  cuentas_por_pagar:   { label: "Cuentas por Pagar",           icon: Wallet,      color: "red" },
  cuentas_por_cobrar:  { label: "Cuentas por Cobrar",          icon: Wallet,      color: "blue" },
  pagos_credito:       { label: "Pagos de Crédito",            icon: Wallet,      color: "green" },
  eventos_equipos:     { label: "Historial de Equipos",        icon: Clock,       color: "slate" },
  sucursales:          { label: "Sucursales",                  icon: Building2,   color: "indigo" },
  usuarios:            { label: "Usuarios del Sistema",        icon: Users,       color: "slate" },
};

const COLOR_MAP: Record<string, string> = {
  blue:    "bg-blue-50 text-blue-700 border-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cyan:    "bg-cyan-50 text-cyan-700 border-cyan-200",
  violet:  "bg-violet-50 text-violet-700 border-violet-200",
  orange:  "bg-orange-50 text-orange-700 border-orange-200",
  pink:    "bg-pink-50 text-pink-700 border-pink-200",
  amber:   "bg-amber-50 text-amber-700 border-amber-200",
  green:   "bg-green-50 text-green-700 border-green-200",
  red:     "bg-red-50 text-red-700 border-red-200",
  teal:    "bg-teal-50 text-teal-700 border-teal-200",
  rose:    "bg-rose-50 text-rose-700 border-rose-200",
  indigo:  "bg-indigo-50 text-indigo-700 border-indigo-200",
  slate:   "bg-slate-50 text-slate-700 border-slate-200",
};

export default function AdminBackup() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados backup
  const [isDownloading, setIsDownloading] = useState(false);
  const [backupData, setBackupData] = useState<any>(null);
  const [showModules, setShowModules] = useState(false);

  // Estados restore
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreStep, setRestoreStep] = useState<"idle" | "confirm" | "restoring" | "done">("idle");

  // Redirigir si no es admin
  if (!user) { navigate("/login"); return null; }
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <Lock className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-slate-500 text-sm">Esta sección es solo para administradores del sistema.</p>
        </div>
      </div>
    );
  }

  // ── DESCARGAR BACKUP ──
  const handleDownload = async () => {
    setIsDownloading(true);
    setBackupData(null);
    try {
      const res = await fetch(`/api/admin/backup?secret=${SECRET}`);
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setBackupData(data);

      // Descargar automáticamente el archivo
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mpshop-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Backup descargado correctamente");
    } catch (err: any) {
      toast.error("Error al generar backup: " + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // ── SELECCIONAR ARCHIVO ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast.error("El archivo debe ser un JSON generado por MP Shop");
      return;
    }
    setSelectedFile(file);
    setRestoreStep("confirm");
    setRestoreResult(null);
  };

  // ── RESTAURAR BACKUP ──
  const handleRestore = async () => {
    if (!selectedFile) return;
    setRestoreStep("restoring");
    setIsRestoring(true);

    try {
      const text = await selectedFile.text();
      const jsonData = JSON.parse(text);

      // Validar que sea un backup de MP Shop
      if (!jsonData.modulos || !jsonData.meta) {
        throw new Error("El archivo no es un backup válido de MP Shop.");
      }

      const res = await fetch(`/api/admin/restore?secret=${SECRET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonData),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error en el servidor");

      setRestoreResult(result);
      setRestoreStep("done");
      toast.success("Backup restaurado correctamente");
    } catch (err: any) {
      toast.error("Error al restaurar: " + err.message);
      setRestoreStep("confirm");
    } finally {
      setIsRestoring(false);
    }
  };

  const resetRestore = () => {
    setSelectedFile(null);
    setRestoreStep("idle");
    setRestoreResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Calcular totales del backup
  const totalRegistros = backupData
    ? Object.values(backupData.modulos || {}).reduce((s: number, m: any) => s + (m.total || 0), 0)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <Database className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Panel de Administración</h1>
              <p className="text-sm text-slate-400">Backup & Restauración de Datos · MP Shop</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">{user.name || user.username}</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Aviso de seguridad */}
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-300">Zona de Alta Sensibilidad</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Esta página contiene funciones críticas del sistema. El backup incluye todos los datos operativos de la empresa.
              Guarde el archivo en un lugar seguro. La restauración reemplaza todos los datos actuales.
            </p>
          </div>
        </div>

        {/* ═══ SECCIÓN BACKUP ═══ */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-blue-500/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Download className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">Descargar Backup Completo</h2>
                <p className="text-xs text-slate-400">Exporta todos los datos del sistema en formato JSON organizado</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Info de qué incluye */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Package,      label: "Inventario",  desc: "Equipos y unidades" },
                { icon: ShoppingCart, label: "Ventas",      desc: "Historial completo" },
                { icon: Wallet,       label: "Finanzas",    desc: "Caja y transacciones" },
                { icon: Users,        label: "Clientes",    desc: "Base de clientes" },
                { icon: Building2,    label: "Proveedores", desc: "Directorio" },
                { icon: Wrench,       label: "Reparaciones",desc: "Órdenes y costos" },
                { icon: BarChart3,    label: "Gastos",      desc: "Operativos" },
                { icon: Database,     label: "Sistema",     desc: "Sucursales y usuarios" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                  <Icon className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">{label}</p>
                    <p className="text-[10px] text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/20 text-base"
            >
              {isDownloading ? (
                <><RefreshCw className="h-5 w-5 animate-spin" /> Generando backup...</>
              ) : (
                <><Download className="h-5 w-5" /> Descargar Backup Completo</>
              )}
            </button>

            {/* Resultado del backup */}
            {backupData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="text-sm font-black text-white">Backup generado exitosamente</p>
                      <p className="text-xs text-slate-400">
                        {new Date(backupData.meta.generatedAt).toLocaleString("es-BO")} · v{backupData.meta.version}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-400">{totalRegistros.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">registros totales</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowModules(!showModules)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  {showModules ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showModules ? "Ocultar" : "Ver"} detalle por módulo
                </button>

                {showModules && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(backupData.modulos).map(([key, mod]: [string, any]) => {
                      const info = MODULO_INFO[key];
                      if (!info) return null;
                      const Icon = info.icon;
                      return (
                        <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs text-slate-300">{info.label}</span>
                          </div>
                          <span className="text-xs font-black text-white">{mod.total}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ SECCIÓN RESTAURAR ═══ */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-violet-500/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Upload className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">Restaurar Backup / Migración</h2>
                <p className="text-xs text-slate-400">Importa un backup generado por MP Shop para restaurar o migrar datos</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">

            {restoreStep === "idle" && (
              <>
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-300">
                    <strong>Atención:</strong> La restauración reemplaza TODOS los datos actuales del sistema con los datos del backup.
                    Esta acción no se puede deshacer. Asegúrese de tener un backup actualizado antes de continuar.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-300">¿Cómo se usa?</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { n: "1", title: "Descarga el backup", desc: "Usa el botón de arriba para exportar todos los datos" },
                      { n: "2", title: "Guarda el archivo", desc: "Guárdalo en tu computadora o almacenamiento seguro" },
                      { n: "3", title: "Restaura cuando necesites", desc: "Sube el archivo aquí para restaurar o migrar" },
                    ].map(({ n, title, desc }) => (
                      <div key={n} className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                        <div className="h-7 w-7 bg-blue-500 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0">{n}</div>
                        <div>
                          <p className="text-xs font-bold text-white">{title}</p>
                          <p className="text-xs text-slate-400">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-white/10 hover:bg-white/15 border-2 border-dashed border-white/20 hover:border-blue-400/50 text-white font-bold rounded-2xl transition-all text-sm"
                >
                  <Upload className="h-5 w-5 text-blue-400" />
                  Seleccionar archivo de backup (.json)
                </button>
              </>
            )}

            {restoreStep === "confirm" && selectedFile && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
                  <FileJson className="h-10 w-10 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={resetRestore} className="text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <p className="text-sm font-black text-red-300">¿Confirma la restauración?</p>
                  </div>
                  <p className="text-xs text-red-300/80">
                    Todos los datos actuales serán reemplazados por los datos del archivo seleccionado.
                    Se restaurarán: inventario, ventas, compras, clientes, reparaciones, finanzas y más.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={resetRestore}
                    className="py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-all text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRestore}
                    className="py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-black rounded-xl transition-all text-sm shadow-lg shadow-blue-500/20"
                  >
                    Sí, Restaurar Ahora
                  </button>
                </div>
              </div>
            )}

            {restoreStep === "restoring" && (
              <div className="text-center py-12">
                <RefreshCw className="h-12 w-12 text-blue-400 animate-spin mx-auto mb-4" />
                <p className="text-white font-black text-lg">Restaurando datos...</p>
                <p className="text-slate-400 text-sm mt-2">No cierre esta página. Puede tomar unos minutos.</p>
              </div>
            )}

            {restoreStep === "done" && restoreResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-base font-black text-white">Restauración completada</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Backup del {new Date(restoreResult.backupFecha).toLocaleString("es-BO")} · v{restoreResult.backupVersion}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(restoreResult.modulos || {}).map(([key, result]: [string, any]) => {
                    const info = MODULO_INFO[key];
                    if (!info) return null;
                    const Icon = info.icon;
                    const omitido = result.omitido || result.restaurados === 0;
                    return (
                      <div key={key} className={`flex items-center justify-between p-3 rounded-xl border ${omitido ? "bg-white/5 border-white/10" : "bg-emerald-500/10 border-emerald-500/20"}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${omitido ? "text-slate-500" : "text-emerald-400"}`} />
                          <span className="text-xs text-slate-300 truncate">{info.label}</span>
                        </div>
                        <span className={`text-xs font-black shrink-0 ml-2 ${omitido ? "text-slate-500" : "text-emerald-400"}`}>
                          {result.restaurados}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={resetRestore}
                  className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-all text-sm"
                >
                  Realizar otra restauración
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info técnica */}
        <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
          <Info className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-300 mb-1">Información técnica</p>
            <p className="text-xs text-slate-400">
              El archivo de backup contiene todos los datos operativos en formato JSON estructurado por módulos.
              Incluye: inventario, ventas, compras, clientes, proveedores, reparaciones, garantías, devoluciones,
              caja (transacciones, aperturas y cierres), gastos operativos, cuentas por cobrar/pagar,
              sucursales y usuarios (sin contraseñas). Compatible con migraciones entre servidores.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600">
          MP Shop v1.5.0 · Panel Administrativo · Acceso Restringido
        </p>
      </div>
    </div>
  );
}
