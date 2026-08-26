/**
 * Analytics — KPIs secundarios con filtros de período
 * Pantalla de investigación/exploración.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from "recharts";
import { TrendingUp, Wrench, DollarSign, ShoppingBag, Package, Users, BarChart3, Clock } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

const PIE_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6","#ec4899","#06b6d4","#84cc16"];

function now(): string { return new Date().toISOString().split("T")[0]; }
function monthStart(): string {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}
function fmt(n: number): string { return formatCurrency(n); }
function pct(n: number): string { return `${n.toFixed(1)}%`; }

function SectionCard({ title, description, icon: Icon, children }: { title: string; description?: string; icon: any; children: React.ReactNode }) {
  return (
    <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-800 font-black text-base">
          <div className="p-2 bg-slate-100 rounded-xl"><Icon className="h-4 w-4" /></div>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(now());
  const [brand, setBrand] = useState("");
  const [tab, setTab] = useState("rentabilidad");

  const filters = { from, to, brand: brand || undefined };

  const marginUnit  = (trpc.analytics as any).marginByUnit.useQuery(filters, { enabled: user?.role==="admin" });
  const marginGrp   = (trpc.analytics as any).marginGrouped.useQuery(filters, { enabled: user?.role==="admin" && tab==="rentabilidad" });
  const agingDist   = (trpc.analytics as any).inventoryAgingDistribution.useQuery(filters, { enabled: user?.role==="admin" && tab==="rotacion" });
  const invValue    = (trpc.analytics as any).inventoryValue.useQuery(undefined, { enabled: user?.role==="admin" && tab==="rotacion" });
  const repairT     = (trpc.analytics as any).repairTimes.useQuery(filters, { enabled: user?.role==="admin" && tab==="taller" });
  const workshopS   = (trpc.analytics as any).workshopStats.useQuery(filters, { enabled: user?.role==="admin" && tab==="taller" });
  const financial   = (trpc.analytics as any).financialSummary.useQuery(filters, { enabled: user?.role==="admin" && tab==="financiero" });
  const commercial  = (trpc.analytics as any).commercialSummary.useQuery(filters, { enabled: user?.role==="admin" && tab==="comercial" });
  const supplier    = (trpc.analytics as any).supplierStats.useQuery(filters, { enabled: user?.role==="admin" && tab==="proveedores" });

  if (user?.role !== "admin") return <div className="p-8 text-center text-muted-foreground">Acceso restringido.</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto mb-20 md:mb-10">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          Análisis <span className="text-blue-600">KPIs</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1.5">Exploración con filtros — pantalla de investigación</p>
      </div>

      {/* Filtros globales */}
      <Card className="border-none shadow-sm rounded-2xl bg-white p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs font-bold">Desde</Label>
            <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold">Hasta</Label>
            <Input type="date" value={to}   onChange={e=>setTo(e.target.value)}   className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold">Marca (opcional)</Label>
            <Input placeholder="ej. Lenovo" value={brand} onChange={e=>setBrand(e.target.value)} className="h-9 w-36" />
          </div>
          <Badge variant="outline" className="text-[10px] font-black self-end h-9 px-3 flex items-center">
            Filtros aplicados automáticamente
          </Badge>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1 bg-slate-100/60 p-1.5 rounded-2xl">
          {[
            { id:"rentabilidad", label:"Rentabilidad", icon:TrendingUp },
            { id:"rotacion",     label:"Rotación",     icon:Package },
            { id:"taller",       label:"Taller",       icon:Wrench },
            { id:"financiero",   label:"Financiero",   icon:DollarSign },
            { id:"comercial",    label:"Comercial",    icon:ShoppingBag },
            { id:"proveedores",  label:"Proveedores",  icon:Users },
          ].map(t=>(
            <TabsTrigger key={t.id} value={t.id}
              className="rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm h-9 px-3 flex items-center gap-1.5">
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── RENTABILIDAD ── */}
        <TabsContent value="rentabilidad" className="mt-4 space-y-4">
          {/* Margen por unidad */}
          <SectionCard title="Margen Bruto por Unidad" description="Precio venta − Compra − Reparación" icon={TrendingUp}>
            {marginUnit.isLoading ? <div className="h-32 animate-pulse bg-slate-50 rounded-xl" /> :
            !(marginUnit.data as any[])?.length ? <p className="text-sm text-slate-400 italic">Sin datos para el período.</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-black">Código</TableHead>
                      <TableHead className="text-xs font-black">Marca / Modelo</TableHead>
                      <TableHead className="text-xs font-black">Cond.</TableHead>
                      <TableHead className="text-xs font-black text-right">Compra</TableHead>
                      <TableHead className="text-xs font-black text-right">Reparación</TableHead>
                      <TableHead className="text-xs font-black text-right">Venta</TableHead>
                      <TableHead className="text-xs font-black text-right">Margen Bruto</TableHead>
                      <TableHead className="text-xs font-black text-right">Margen Neto</TableHead>
                      <TableHead className="text-xs font-black text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(marginUnit.data as any[]).map((r: any) => (
                      <TableRow key={r.unitId} className="hover:bg-slate-50/60">
                        <TableCell className="font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="text-xs">{r.brand} {r.model}</TableCell>
                        <TableCell className="text-xs text-center">{r.condition ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.purchasePrice)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.repairCost)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.salePrice)}</TableCell>
                        <TableCell className={`text-right text-xs font-bold ${r.grossMarginCents>=0?"text-emerald-700":"text-red-600"}`}>
                          {fmt(r.grossMarginCents)}
                        </TableCell>
                        <TableCell className={`text-right text-xs font-bold ${r.netMarginCents>=0?"text-emerald-700":"text-red-600"}`}>
                          {fmt(r.netMarginCents)}
                        </TableCell>
                        <TableCell className={`text-right text-xs font-black ${r.grossMarginPct>=15?"text-emerald-700":r.grossMarginPct>=5?"text-amber-700":"text-red-600"}`}>
                          {pct(r.grossMarginPct)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>

          {/* Margen agrupado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Por Marca" icon={BarChart3}>
              {marginGrp.isLoading ? <div className="h-40 animate-pulse bg-slate-50 rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={(marginGrp.data as any)?.byBrand?.slice(0,8) ?? []}>
                    <XAxis dataKey="group" tick={{fontSize:10}} />
                    <YAxis tick={{fontSize:10}} />
                    <Tooltip formatter={(v:number)=>[`${v.toFixed(1)}%`,"Margen %"]} />
                    <Bar dataKey="avgMarginPct" radius={[4,4,0,0]}>
                      {((marginGrp.data as any)?.byBrand?.slice(0,8)??[]).map((_:any,i:number)=>(
                        <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
            <SectionCard title="Por Condición (1-10)" icon={BarChart3}>
              {marginGrp.isLoading ? <div className="h-40 animate-pulse bg-slate-50 rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={(marginGrp.data as any)?.byCondition ?? []}>
                    <XAxis dataKey="group" tick={{fontSize:10}} />
                    <YAxis tick={{fontSize:10}} />
                    <Tooltip formatter={(v:number)=>[`${v.toFixed(1)}%`,"Margen %"]} />
                    <Bar dataKey="avgMarginPct" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        {/* ── ROTACIÓN ── */}
        <TabsContent value="rotacion" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Distribución Días en Inventario" description="Unidades vendidas en el período" icon={Package}>
              {agingDist.isLoading ? <div className="h-40 animate-pulse bg-slate-50 rounded-xl" /> : (
                <>
                  <p className="text-sm text-slate-500 mb-3">
                    {(agingDist.data as any)?.count ?? 0} unidades · Promedio: <strong>{(agingDist.data as any)?.avgDays ?? 0} días</strong>
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={(agingDist.data as any)?.distribution ?? []}>
                      <XAxis dataKey="range" tick={{fontSize:11}} />
                      <YAxis tick={{fontSize:10}} />
                      <Tooltip formatter={(v:number)=>[`${v} unidades`,"Cantidad"]} />
                      <Bar dataKey="count" radius={[6,6,0,0]}>
                        {["#10b981","#f59e0b","#f97316","#ef4444"].map((c,i)=><Cell key={i} fill={c} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </SectionCard>
            <SectionCard title="Valor de Inventario Actual" description="Unidades no vendidas" icon={DollarSign}>
              {invValue.isLoading ? <div className="h-40 animate-pulse bg-slate-50 rounded-xl" /> : (
                <div className="space-y-3">
                  {[
                    { label:"Unidades activas",        value: `${(invValue.data as any)?.count ?? 0} equipos`, color:"text-slate-900" },
                    { label:"Costo de compra (stock)",  value: fmt((invValue.data as any)?.purchaseValueCents??0), color:"text-slate-700" },
                    { label:"Costo de reparación",      value: fmt((invValue.data as any)?.repairValueCents??0), color:"text-orange-700" },
                    { label:"Costo total invertido",    value: fmt((invValue.data as any)?.totalCostCents??0),   color:"text-red-700 font-black" },
                    { label:"Potencial de venta",       value: fmt((invValue.data as any)?.potentialRevenueCents??0), color:"text-emerald-700 font-black" },
                  ].map(({label,value,color})=>(
                    <div key={label} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                      <span className="text-slate-500">{label}</span>
                      <span className={`font-bold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        {/* ── TALLER ── */}
        <TabsContent value="taller" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Tiempo Promedio en Taller" description="Por técnico" icon={Wrench}>
              {repairT.isLoading ? <div className="h-40 animate-pulse bg-slate-50 rounded-xl" /> : (
                <>
                  <p className="text-2xl font-black text-slate-800 mb-4">
                    {(repairT.data as any)?.avgHours ?? 0} <span className="text-sm font-normal text-slate-400">horas promedio</span>
                  </p>
                  <Table>
                    <TableHeader><TableRow><TableHead>Técnico</TableHead><TableHead className="text-right">Órdenes</TableHead><TableHead className="text-right">Prom. horas</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {((repairT.data as any)?.byTechnician??[]).map((t: any) => (
                        <TableRow key={t.tech}><TableCell className="text-sm">{t.tech}</TableCell>
                        <TableCell className="text-right text-sm">{t.count}</TableCell>
                        <TableCell className="text-right font-bold text-sm">{t.avgHours}h</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </SectionCard>
            <SectionCard title="Calidad y Devoluciones" icon={Package}>
              {workshopS.isLoading ? <div className="h-40 animate-pulse bg-slate-50 rounded-xl" /> : (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm border-b pb-2">
                    <span className="text-slate-500">Equipos que pasaron por taller</span>
                    <span className="font-black text-orange-700">{pct((workshopS.data as any)?.workshopPct??0)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b pb-2">
                    <span className="text-slate-500">Total unidades</span>
                    <span className="font-bold">{(workshopS.data as any)?.totalUnits??0}</span>
                  </div>
                  <p className="text-xs font-black text-slate-500 uppercase mt-3 mb-1">Devoluciones por técnico</p>
                  {((workshopS.data as any)?.byTechnician??[]).map((t: any) => (
                    <div key={t.tech} className="flex justify-between text-sm">
                      <span>{t.tech}</span><span className="font-bold text-red-600">{t.returnCount} devoluciones</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* ── LISTADO DE TIEMPO DE REPARACIÓN POR CADA EQUIPO ── */}
          <SectionCard
            title="Horas de Reparación por Equipo (Detalle de Taller)"
            description="Historial detallado con las horas invertidas en cada orden de trabajo y laptop reparada"
            icon={Clock}
          >
            {repairT.isLoading ? (
              <div className="h-48 animate-pulse bg-slate-50 rounded-xl" />
            ) : !((repairT.data as any)?.repairsList?.length) ? (
              <div className="text-center py-10 text-slate-400">
                <Wrench className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-sm font-medium">No se encontraron reparaciones finalizadas en el período seleccionado</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700">Equipo / Laptop</TableHead>
                      <TableHead className="font-bold text-slate-700">OT / RMA</TableHead>
                      <TableHead className="font-bold text-slate-700">Técnico</TableHead>
                      <TableHead className="font-bold text-slate-700">Fecha Ingreso</TableHead>
                      <TableHead className="font-bold text-slate-700">Fecha Finalización</TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">Horas en Taller</TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">Costos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((repairT.data as any)?.repairsList || []).map((r: any) => {
                      const totalCost = ((r.laborCost || 0) + (r.partsCost || 0));
                      return (
                        <TableRow key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{r.unitBrand} {r.unitModel}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {r.unitCode && (
                                  <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 border-slate-200">
                                    {r.unitCode}
                                  </Badge>
                                )}
                                {r.unitSerialNumber && (
                                  <span className="text-[11px] text-slate-400">S/N: {r.unitSerialNumber}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className="font-mono text-[10px] bg-blue-50 text-blue-700 border-blue-200 w-fit">
                                {r.otNumber}
                              </Badge>
                              {r.rmaNumber && (
                                <Badge variant="outline" className="font-mono text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 w-fit">
                                  {r.rmaNumber}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-slate-700">{r.techName}</span>
                            {r.notes && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 max-w-[200px] mt-0.5">{r.notes}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                            {r.startDate ? new Date(r.startDate).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                            {r.endDate ? new Date(r.endDate).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex flex-col items-end">
                              <span className={`font-black text-xs px-2.5 py-1 rounded-lg ${r.hours > 48 ? 'bg-red-50 text-red-700 border border-red-200' : r.hours > 24 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                ⏱️ {r.hours} hrs
                              </span>
                              {r.days >= 1 && (
                                <span className="text-[10px] text-slate-400 font-medium mt-0.5">({r.days} días)</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {totalCost > 0 ? (
                              <div className="text-xs">
                                <span className="font-bold text-slate-800">{fmt(totalCost)}</span>
                                <div className="text-[10px] text-slate-400">M.O.: {fmt(r.laborCost || 0)} | Rep: {fmt(r.partsCost || 0)}</div>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── FINANCIERO ── */}
        <TabsContent value="financiero" className="mt-4">
          <SectionCard title="Resumen Financiero del Período" icon={DollarSign}>
            {financial.isLoading ? <div className="h-48 animate-pulse bg-slate-50 rounded-xl" /> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label:"Ingresos",                  value: fmt((financial.data as any)?.incomeCents??0),       color:"text-emerald-700" },
                  { label:"Egresos",                    value: fmt((financial.data as any)?.expenseCents??0),      color:"text-red-600" },
                  { label:"Flujo Neto",                 value: fmt((financial.data as any)?.netFlowCents??0),      color:(financial.data as any)?.netFlowCents>=0?"text-emerald-700":"text-red-600" },
                  { label:"Gastos Operativos",          value: fmt((financial.data as any)?.opExpenseCents??0),    color:"text-orange-700" },
                  { label:"Gastos Op. / Ventas",        value: pct((financial.data as any)?.opExpPct??0),          color:"text-slate-700" },
                  { label:"Ratio CXC / Ventas",         value: pct((financial.data as any)?.cxcSalesPct??0),       color:"text-amber-700" },
                  { label:"Utilidad Neta Estimada",     value: fmt((financial.data as any)?.netProfitCents??0),    color:(financial.data as any)?.netProfitCents>=0?"text-emerald-700 font-black":"text-red-600 font-black" },
                ].map(({label,value,color})=>(
                  <div key={label} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                    <p className={`text-lg font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── COMERCIAL ── */}
        <TabsContent value="comercial" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Ticket Promedio" description="Por tipo de equipo" icon={ShoppingBag}>
              {commercial.isLoading ? <div className="h-24 animate-pulse bg-slate-50 rounded-xl" /> : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Laptop</p>
                    <p className="text-xl font-black text-blue-700">{fmt((commercial.data as any)?.avgTicketCents?.laptop??0)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Accesorio</p>
                    <p className="text-xl font-black text-violet-700">{fmt((commercial.data as any)?.avgTicketCents?.accessory??0)}</p>
                  </div>
                </div>
              )}
            </SectionCard>
            <SectionCard title="Desempeño por Repartidor" icon={Users}>
              {commercial.isLoading ? <div className="h-24 animate-pulse bg-slate-50 rounded-xl" /> :
              !((commercial.data as any)?.byDelivery?.length) ? <p className="text-sm text-slate-400 italic">Sin datos de entregas.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Repartidor</TableHead><TableHead className="text-right">Entregas</TableHead><TableHead className="text-right">Prom. horas</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {((commercial.data as any)?.byDelivery??[]).map((d: any) => (
                      <TableRow key={d.person}><TableCell className="text-sm">{d.person}</TableCell>
                      <TableCell className="text-right text-sm">{d.deliveryCount}</TableCell>
                      <TableCell className="text-right font-bold text-sm">{d.avgHours}h</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          </div>
          <SectionCard title="Desempeño por Vendedor" icon={Users}>
            {commercial.isLoading ? <div className="h-32 animate-pulse bg-slate-50 rounded-xl" /> :
            !((commercial.data as any)?.bySeller?.length) ? <p className="text-sm text-slate-400 italic">Sin ventas en el período.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ticket Prom.</TableHead>
                  <TableHead className="text-right">Devoluciones</TableHead>
                  <TableHead className="text-right">Tasa Dev.</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {((commercial.data as any)?.bySeller??[]).map((s: any) => (
                    <TableRow key={s.seller}>
                      <TableCell className="text-sm font-semibold">{s.seller}</TableCell>
                      <TableCell className="text-right text-sm">{s.salesCount}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(s.totalCents)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(s.avgTicketCents)}</TableCell>
                      <TableCell className="text-right text-sm">{s.returnCount}</TableCell>
                      <TableCell className={`text-right text-sm font-bold ${s.returnRatePct<5?"text-emerald-700":s.returnRatePct<15?"text-amber-700":"text-red-600"}`}>
                        {pct(s.returnRatePct)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── PROVEEDORES ── */}
        <TabsContent value="proveedores" className="mt-4">
          <SectionCard title="Análisis por Proveedor" description="Margen y calidad al ingreso" icon={Users}>
            {supplier.isLoading ? <div className="h-40 animate-pulse bg-slate-50 rounded-xl" /> :
            !(supplier.data as any[])?.length ? <p className="text-sm text-slate-400 italic">Sin ventas registradas para proveedores en el período.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Margen Prom.</TableHead>
                  <TableHead className="text-right">Margen %</TableHead>
                  <TableHead className="text-right">% con daños</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(supplier.data as any[]).map((s: any) => (
                    <TableRow key={s.supplier}>
                      <TableCell className="text-sm">{s.supplier}</TableCell>
                      <TableCell className="text-right text-sm">{s.count}</TableCell>
                      <TableCell className={`text-right text-sm font-bold ${s.avgMarginCents>=0?"text-emerald-700":"text-red-600"}`}>{fmt(s.avgMarginCents)}</TableCell>
                      <TableCell className={`text-right text-sm font-black ${s.avgMarginPct>=15?"text-emerald-700":s.avgMarginPct>=5?"text-amber-700":"text-red-600"}`}>{pct(s.avgMarginPct)}</TableCell>
                      <TableCell className={`text-right text-sm ${s.damagedPct>20?"text-red-600 font-bold":"text-slate-600"}`}>{pct(s.damagedPct)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
