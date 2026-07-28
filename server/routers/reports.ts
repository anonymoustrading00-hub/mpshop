import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc.js";
import {
  getDb,
  MOCK_CUSTOMERS,
  MOCK_OPERATIONAL_EXPENSES,
  MOCK_ORDERS,
  MOCK_ORDER_ITEMS,
  MOCK_PRODUCTS,
  MOCK_PURCHASES,
  MOCK_SALES,
  MOCK_SALE_ITEMS,
} from "../db.js";
import {
  orders,
  customers,
  products,
  inventory,
  inventoryMovements,
  sales,
  financialTransactions,
  cashClosures,
  users,
  operationalExpenses,
  purchases,
  orderItems,
  saleItems,
} from "../../drizzle/schema";
import { desc, eq, and, gte, lte, lt, sql, ne } from "drizzle-orm";

export const reportsRouter = router({
  // Reporte de Pedidos
  ordersReport: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.string().optional(),
      customerId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let conditions: any[] = [];

      if (input?.startDate) {
        conditions.push(gte(orders.createdAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        conditions.push(lte(orders.createdAt, new Date(input.endDate + " 23:59:59")));
      }
      if (input?.status) {
        conditions.push(eq(orders.status, input.status as any));
      }
      if (input?.customerId) {
        conditions.push(eq(orders.customerId, input.customerId));
      }

      const result = await db.query.orders.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          customer: true,
          deliveryPerson: true,
          items: {
            with: {
              product: true,
            },
          },
          payments: true,
        },
        orderBy: [desc(orders.createdAt)],
      });

      return result;
    }),

  // Reporte de Ventas
  salesReport: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      paymentMethod: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let conditions: any[] = [];

      if (input?.startDate) {
        conditions.push(gte(sales.createdAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        conditions.push(lte(sales.createdAt, new Date(input.endDate + " 23:59:59")));
      }
      if (input?.paymentMethod) {
        conditions.push(eq(sales.paymentMethod, input.paymentMethod as any));
      }

      const result = await db.query.sales.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          customer: true,
          items: {
            with: {
              product: true,
            },
          },
        },
        orderBy: [desc(sales.createdAt)],
      });

      return result;
    }),

  // Reporte de Inventario (productos con stock)
  inventoryReport: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { products: [], inventory: [] };

      let productConditions: any[] = [];
      if (input?.category) {
        productConditions.push(eq(products.category, input.category as any));
      }

      const allProducts = await db.query.products.findMany({
        where: productConditions.length > 0 ? and(...productConditions) : undefined,
      });

      const allInventory = await db.query.inventory.findMany();

      return {
        products: allProducts,
        inventory: allInventory,
      };
    }),

  // Reporte de Movimientos de Inventario
  inventoryMovementsReport: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      productId: z.number().optional(),
      type: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { movements: [], products: [] };

      let conditions: any[] = [];

      if (input?.startDate) {
        conditions.push(gte(inventoryMovements.createdAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        conditions.push(lte(inventoryMovements.createdAt, new Date(input.endDate + " 23:59:59")));
      }
      if (input?.productId) {
        conditions.push(eq(inventoryMovements.productId, input.productId));
      }
      if (input?.type) {
        conditions.push(eq(inventoryMovements.type, input.type as any));
      }

      const result = await db.query.inventoryMovements.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          user: true,
        },
        orderBy: [desc(inventoryMovements.createdAt)],
      });

      const allProducts = await db.query.products.findMany();

      return {
        movements: result,
        products: allProducts,
      };
    }),

  // Reporte Financiero
  financeReport: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      type: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { transactions: [], closures: [] };

      let conditions: any[] = [];

      if (input?.startDate) {
        conditions.push(gte(financialTransactions.createdAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        conditions.push(lte(financialTransactions.createdAt, new Date(input.endDate + " 23:59:59")));
      }
      if (input?.type) {
        conditions.push(eq(financialTransactions.type, input.type as any));
      }

      const transactions = await db.query.financialTransactions.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          user: true,
        },
        orderBy: [desc(financialTransactions.createdAt)],
      });

      const closures = await db.query.cashClosures.findMany({
        orderBy: [desc(cashClosures.createdAt)],
        limit: 30,
      });

      return {
        transactions,
        closures,
      };
    }),

  // Reporte de Clientes
  customersReport: protectedProcedure
    .input(z.object({
      zone: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let conditions: any[] = [];

      if (input?.zone) {
        conditions.push(eq(customers.zone, input.zone));
      }

      const result = await db.query.customers.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(customers.createdAt)],
      });

      return result;
    }),

  // Resumen para dashboard
  summary: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return {
          totalOrders: 0,
          ordersByStatus: [],
          salesTotal: 0,
          salesCount: 0,
          salesByPayment: [],
          lowStockProducts: 0,
          newCustomers: 0,
        };
      }

      let dateFilter: any = undefined;
      if (input?.startDate && input?.endDate) {
        dateFilter = and(
          gte(orders.createdAt, new Date(input.startDate)),
          lte(orders.createdAt, new Date(input.endDate + " 23:59:59"))
        );
      }

      // Total pedidos
      const totalOrdersResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(dateFilter);
      const totalOrders = totalOrdersResult[0]?.count || 0;

      // Pedidos por estado
      const ordersByStatus = await db
        .select({
          status: orders.status,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(orders)
        .where(dateFilter)
        .groupBy(orders.status);

      // Ventas del período
      const salesStartDate = input?.startDate || new Date(new Date().setDate(1)).toISOString();
      const salesEndDate = input?.endDate || new Date().toISOString();
      const dateFilterSales = and(
        gte(sales.createdAt, new Date(salesStartDate)),
        lte(sales.createdAt, new Date(salesEndDate + " 23:59:59"))
      );

      const totalSales = await db
        .select({
          total: sql<number>`coalesce(sum(${sales.total}), 0)`.mapWith(Number),
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(sales)
        .where(and(eq(sales.status, "completed"), dateFilterSales));

      // Ventas por método de pago
      const salesByPayment = await db
        .select({
          method: sales.paymentMethod,
          total: sql<number>`coalesce(sum(${sales.total}), 0)`.mapWith(Number),
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(sales)
        .where(and(eq(sales.status, "completed"), dateFilterSales))
        .groupBy(sales.paymentMethod);

      // Productos con stock bajo
      const lowStockProducts = await db
        .select({
          product: products,
          inventory: inventory,
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .where(sql`${inventory.quantity} <= ${inventory.minStock}`);

      // Nuevos clientes
      const newCustomersResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(dateFilter);
      const newCustomers = newCustomersResult[0]?.count || 0;

      return {
        totalOrders,
        ordersByStatus,
        salesTotal: totalSales[0]?.total || 0,
        salesCount: totalSales[0]?.count || 0,
        salesByPayment,
        lowStockProducts: lowStockProducts.length,
        newCustomers,
      };
    }),

  // Análisis de Negocio
  getBusinessAnalysis: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();

      let dateFilterOrders = undefined;
      let dateFilterSales = undefined;
      let dateFilterPurchases = undefined;
      
      let start: Date;
      let end: Date;

      if (input?.startDate && input?.endDate) {
        start = new Date(input.startDate);
        end = new Date(input.endDate + " 23:59:59");
      } else {
        // Default to last 30 days if no dates provided
        end = new Date();
        start = new Date();
        start.setDate(end.getDate() - 30);
      }

      dateFilterOrders = and(gte(orders.createdAt, start), lte(orders.createdAt, end));
      dateFilterSales = and(gte(sales.createdAt, start), lte(sales.createdAt, end));
      dateFilterPurchases = and(gte(purchases.orderDate, start), lte(purchases.orderDate, end));

      // 0. Calcular periodo previo para tendencias
      const duration = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(start.getTime() - duration);

      const prevDateFilterOrders = and(gte(orders.createdAt, prevStart), lte(orders.createdAt, prevEnd));
      const prevDateFilterSales = and(gte(sales.createdAt, prevStart), lte(sales.createdAt, prevEnd));

      const inRange = (value: any, from: Date, to: Date) => {
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date >= from && date <= to;
      };

      const attachOrderRelations = (order: any) => ({
        ...order,
        customer: MOCK_CUSTOMERS.find((customer: any) => customer.id === order.customerId) || null,
        items: MOCK_ORDER_ITEMS
          .filter((item: any) => item.orderId === order.id)
          .map((item: any) => ({
            ...item,
            product: MOCK_PRODUCTS.find((product: any) => product.id === item.productId) || { id: item.productId, name: "Producto sin ficha", price: 0 },
          })),
      });

      const attachSaleRelations = (sale: any) => ({
        ...sale,
        customer: MOCK_CUSTOMERS.find((customer: any) => customer.id === sale.customerId) || null,
        items: MOCK_SALE_ITEMS
          .filter((item: any) => item.saleId === sale.id)
          .map((item: any) => ({
            ...item,
            product: MOCK_PRODUCTS.find((product: any) => product.id === item.productId) || { id: item.productId, name: "Producto sin ficha", price: 0 },
          })),
      });

      let deliveredOrders: any[] = [];
      let completedSales: any[] = [];
      let purchasesData: any[] = [];
      let prevDeliveredOrders: any[] = [];
      let prevCompletedSales: any[] = [];
      let expensesData: any[] = [];

      if (db) {
        // 1. Obtener datos del periodo actual
        deliveredOrders = await db.query.orders.findMany({
          where: and(eq(orders.status, "delivered"), dateFilterOrders),
          with: { items: { with: { product: true } }, customer: true }
        });

        completedSales = await db.query.sales.findMany({
          where: and(eq(sales.status, "completed"), dateFilterSales),
          with: { items: { with: { product: true } }, customer: true }
        });

        purchasesData = await db
          .select()
          .from(purchases)
          .where(and(ne(purchases.status, "cancelled"), dateFilterPurchases));

        // 2. Obtener datos del periodo previo para tendencias
        prevDeliveredOrders = await db.query.orders.findMany({
          where: and(eq(orders.status, "delivered"), prevDateFilterOrders),
          with: { items: { with: { product: true } } }
        });

        prevCompletedSales = await db.query.sales.findMany({
          where: and(eq(sales.status, "completed"), prevDateFilterSales),
          with: { items: { with: { product: true } } }
        });

        const dateFilterExpenses = and(gte(operationalExpenses.expenseDate, start), lte(operationalExpenses.expenseDate, end));
        expensesData = await db.query.operationalExpenses.findMany({
          where: and(eq(operationalExpenses.status, "paid"), dateFilterExpenses)
        });
      } else {
        deliveredOrders = MOCK_ORDERS
          .filter((order: any) => order.status === "delivered" && inRange(order.createdAt, start, end))
          .map(attachOrderRelations);

        completedSales = MOCK_SALES
          .filter((sale: any) => sale.status !== "cancelled" && inRange(sale.createdAt, start, end))
          .map(attachSaleRelations);

        purchasesData = MOCK_PURCHASES
          .filter((purchase: any) => purchase.status !== "cancelled" && inRange(purchase.orderDate || purchase.createdAt, start, end));

        prevDeliveredOrders = MOCK_ORDERS
          .filter((order: any) => order.status === "delivered" && inRange(order.createdAt, prevStart, prevEnd))
          .map(attachOrderRelations);

        prevCompletedSales = MOCK_SALES
          .filter((sale: any) => sale.status !== "cancelled" && inRange(sale.createdAt, prevStart, prevEnd))
          .map(attachSaleRelations);

        expensesData = MOCK_OPERATIONAL_EXPENSES
          .filter((expense: any) => expense.status === "paid" && inRange(expense.expenseDate || expense.createdAt, start, end));
      }

      // Evitar duplicados de IDs de órdenes procesadas en ventas
      const processedOrderIds = new Set(completedSales.map((s: any) => s.orderId).filter(Boolean));
      const prevProcessedOrderIds = new Set(prevCompletedSales.map((s: any) => s.orderId).filter(Boolean));
      
      // Métricas y Contadores
      const deliveriesByDay: Record<string, number> = {};
      const productStats: Record<number, { 
        name: string, 
        units: number, 
        revenue: number, 
        cost: number, 
        prevUnits: number,
        prevRevenue: number 
      }> = {};
      const retailStats: any = {};
      const wholesaleStats: any = {};
      
      const channelCounts: Record<string, number> = { facebook: 0, tiktok: 0, marketplace: 0, referral: 0, other: 0, local: 0 };
      const segmentedChannels: Record<string, Record<string, number>> = {
        retail: { facebook: 0, tiktok: 0, marketplace: 0, referral: 0, other: 0, local: 0 },
        wholesale: { facebook: 0, tiktok: 0, marketplace: 0, referral: 0, other: 0, local: 0 }
      };

      const zoneCounts: Record<string, number> = {};
      const genderCounts: Record<string, number> = { male: 0, female: 0, other: 0 };
      const paymentCounts: Record<string, number> = { cash: 0, qr: 0, transfer: 0 };
      const customerSales: Record<string, { name: string, value: number, count: number, type: string }> = {};
      const expenseCounts: Record<string, number> = {};
      
      const segmentMetrics = {
        retail: { revenue: 0, transactions: 0, units: 0 },
        wholesale: { revenue: 0, transactions: 0, units: 0 }
      };

      let totalExpenses = 0;
      let totalPurchases = 0;
      let purchaseCount = 0;
      let totalRevenue = 0;
      let totalTransactions = 0;

      // Gastos
      expensesData.forEach((exp: any) => {
        totalExpenses += exp.amount;
        expenseCounts[exp.category] = (expenseCounts[exp.category] || 0) + exp.amount;
      });

      purchasesData.forEach((purchase: any) => {
        const amount = Number(purchase.totalAmount || 0);
        totalPurchases += amount;
        totalExpenses += amount;
        purchaseCount++;
      });

      if (totalPurchases > 0) {
        expenseCounts.purchases = (expenseCounts.purchases || 0) + totalPurchases;
      }

      // Función helper para procesar productos
      const processItems = (items: any[], isCurrent: boolean, segment?: string) => {
        items.forEach(item => {
          const pId = item.product.id;
          if (!productStats[pId]) {
            productStats[pId] = { 
              name: item.product.name, 
              units: 0, 
              revenue: 0, 
              cost: 0, 
              prevUnits: 0, 
              prevRevenue: 0 
            };
          }
          const qty = item.quantity;
          const rev = (item.price || item.finalUnitPrice || 0) * qty;
          const cost = (item.product.price || 0) * qty;

          if (isCurrent) {
            productStats[pId].units += qty;
            productStats[pId].revenue += rev;
            productStats[pId].cost += cost;
            if (segment) {
              (segmentMetrics as any)[segment].units += qty;
              const segStats = segment === "retail" ? retailStats : wholesaleStats;
              if (!segStats[pId]) {
                segStats[pId] = { name: item.product.name, units: 0, revenue: 0, cost: 0, prevUnits: 0, prevRevenue: 0 };
              }
              segStats[pId].units += qty;
              segStats[pId].revenue += rev;
              segStats[pId].cost += cost;
            }
          } else {
            productStats[pId].prevUnits += qty;
            productStats[pId].prevRevenue += rev;
          }
        });
      };

      // Procesar Periodo Actual
      completedSales.forEach((sale: any) => {
        const segment = sale.customer?.customerType || "retail";
        totalRevenue += sale.total;
        totalTransactions++;
        segmentMetrics[segment as "retail" | "wholesale"].revenue += sale.total;
        segmentMetrics[segment as "retail" | "wholesale"].transactions++;

        const date = new Date(sale.createdAt).toISOString().split('T')[0];
        deliveriesByDay[date] = (deliveriesByDay[date] || 0) + 1;
        paymentCounts[sale.paymentMethod || "cash"] = (paymentCounts[sale.paymentMethod || "cash"] || 0) + sale.total;
        processItems(sale.items, true, segment);

        if (sale.customer) {
          const cId = sale.customer.id.toString();
          if (!customerSales[cId]) customerSales[cId] = { name: sale.customer.name, value: 0, count: 0, type: segment };
          customerSales[cId].value += sale.total;
          customerSales[cId].count += 1;
          
          const channel = sale.customer.sourceChannel || "other";
          channelCounts[channel]++;
          segmentedChannels[segment as "retail" | "wholesale"][channel]++;
          
          if (sale.customer.zone) zoneCounts[sale.customer.zone] = (zoneCounts[sale.customer.zone] || 0) + 1;
          const g = (sale.customer.gender || "").toLowerCase();
          if (g.includes("m") || g.includes("v") || g.includes("h")) genderCounts.male++;
          else if (g.includes("f") || g.includes("w")) genderCounts.female++;
          else genderCounts.other++;
        } else {
          channelCounts.local++;
          segmentedChannels.retail.local++;
        }
      });

      deliveredOrders.forEach((order: any) => {
        if (processedOrderIds.has(order.id)) return;
        const segment = order.customer?.customerType || "retail";
        totalTransactions++;
        segmentMetrics[segment as "retail" | "wholesale"].transactions++;

        const amount = order.items.reduce((sum: any, i: any) => sum + (i.price * i.quantity), 0);
        totalRevenue += amount;
        segmentMetrics[segment as "retail" | "wholesale"].revenue += amount;

        const date = new Date(order.createdAt).toISOString().split('T')[0];
        deliveriesByDay[date] = (deliveriesByDay[date] || 0) + 1;
        processItems(order.items, true, segment);
        
        if (order.customer) {
          const cId = order.customer.id.toString();
          if (!customerSales[cId]) customerSales[cId] = { name: order.customer.name, value: 0, count: 0, type: segment };
          customerSales[cId].value += amount;
          customerSales[cId].count += 1;
          
          const channel = order.customer.sourceChannel || "other";
          channelCounts[channel]++;
          segmentedChannels[segment as "retail" | "wholesale"][channel]++;

          if (order.customer.zone) zoneCounts[order.customer.zone] = (zoneCounts[order.customer.zone] || 0) + 1;
          const g = (order.customer.gender || "").toLowerCase();
          if (g.includes("m") || g.includes("v") || g.includes("h")) genderCounts.male++;
          else if (g.includes("f") || g.includes("w")) genderCounts.female++;
          else genderCounts.other++;
        }
      });

      // Procesar Periodo Previo (solo para tendencias de productos)
      prevCompletedSales.forEach((sale: any) => processItems(sale.items, false));
      prevDeliveredOrders.forEach((order: any) => {
        if (!prevProcessedOrderIds.has(order.id)) processItems(order.items, false);
      });

      // Retención
      const customerTransactionCount: Record<number, number> = {};
      completedSales.forEach((s: any) => s.customer?.id && (customerTransactionCount[s.customer.id] = (customerTransactionCount[s.customer.id] || 0) + 1));
      deliveredOrders.forEach((o: any) => o.customer?.id && (customerTransactionCount[o.customer.id] = (customerTransactionCount[o.customer.id] || 0) + 1));
      const customerIdsInPeriod = new Set<number>(Object.keys(customerTransactionCount).map(Number));
      let newCustomers = 0;
      let returningCustomers = 0;

      for (const customerId of Array.from(customerIdsInPeriod)) {
        if (customerTransactionCount[customerId] >= 2) {
          returningCustomers++;
          continue;
        }
        const priorOrder = await db.query.orders.findFirst({
          where: and(eq(orders.customerId, customerId), lt(orders.createdAt, start))
        });
        const priorSale = !priorOrder ? await db.query.sales.findFirst({
          where: and(eq(sales.customerId, customerId), lt(sales.createdAt, start))
        }) : null;
        if (priorOrder || priorSale) returningCustomers++;
        else newCustomers++;
      }

      // Ranking de Productos Mejorado (Segmentado)
      const getRankingFromStats = (stats: any) => {
        return Object.entries(stats)
          .map(([id, s]: [any, any]) => {
            const revenue = s.revenue / 100;
            const prevRevenue = s.prevRevenue / 100;
            const cost = s.cost / 100;
            const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
            const trend = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : revenue > 0 ? 100 : 0;

            return {
              id: Number(id),
              name: s.name,
              units: s.units,
              revenue,
              margin: Math.round(margin),
              trend: Math.round(trend),
              prevUnits: s.prevUnits
            };
          })
          .sort((a: any, b: any) => b.revenue - a.revenue);
      };

      const productRanking = getRankingFromStats(productStats);
      const retailRanking = getRankingFromStats(retailStats);
      const wholesaleRanking = getRankingFromStats(wholesaleStats);

      // Formatear para Recharts
      const deliveriesData = Object.entries(deliveriesByDay)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const topFlavors = productRanking.slice(0, 10).map(p => ({ name: p.name, quantity: p.units }));

      const customerDemographics = [
        { name: "Varones", value: genderCounts.male },
        { name: "Mujeres", value: genderCounts.female },
        { name: "Otros", value: genderCounts.other },
      ].filter(v => v.value > 0);

      const channelsData = Object.entries(channelCounts)
        .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
        .filter(v => v.value > 0);

      const zonesData = Object.entries(zoneCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      const paymentMethods = Object.entries(paymentCounts)
        .map(([name, value]) => ({ 
          name: name === "cash" ? "Efectivo" : name === "qr" ? "QR" : "Transferencia", 
          value: value / 100 
        }))
        .filter(v => v.value > 0);

      const topCustomers = Object.values(customerSales)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
        .map(c => ({ name: c.name, value: c.value / 100, count: c.count, type: c.type }));

      const expensesByCategory = Object.entries(expenseCounts)
        .map(([name, value]) => ({ 
          name: name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
          value: value / 100 
        }))
        .sort((a, b) => b.value - a.value);

      const customerRetention = [
        { name: "Clientes Nuevos", value: newCustomers },
        { name: "Clientes Recurrentes", value: returningCustomers },
      ].filter(v => v.value > 0);

      // Datos para la Matriz BCG
      const bcgMatrix = productRanking.map(p => ({
        name: p.name,
        units: p.units,
        trend: p.trend,
        revenue: p.revenue,
        quadrant: p.units > (productRanking[0]?.units / 3) 
          ? (p.trend > 0 ? "Estrella" : "Vaca")
          : (p.trend > 0 ? "Interrogante" : "Perro")
      }));

      // Comparativa por Segmento
      const segmentComparison = [
        { segment: "Minoristas", revenue: segmentMetrics.retail.revenue / 100, transactions: segmentMetrics.retail.transactions, units: segmentMetrics.retail.units },
        { segment: "Mayoristas", revenue: segmentMetrics.wholesale.revenue / 100, transactions: segmentMetrics.wholesale.transactions, units: segmentMetrics.wholesale.units }
      ];

      return {
        deliveriesData,
        topFlavors,
        productRanking,
        retailRanking,
        wholesaleRanking,
        bcgMatrix,
        customerDemographics,
        channelsData,
        segmentedChannels,
        zonesData,
        paymentMethods,
        topCustomers,
        expensesByCategory,
        customerRetention,
        segmentComparison,
        summary: {
          totalTransactions,
          totalDeliveries: deliveredOrders.length,
          totalSales: completedSales.length,
          totalRevenue, 
          totalExpenses,
          totalPurchases,
          purchaseCount,
          netIncome: totalRevenue - totalExpenses,
          avgOrderValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
          activeZones: zonesData.length,
          totalCustomers: customerIdsInPeriod.size,
          newCustomers,
          returningCustomers,
          retentionRate: customerIdsInPeriod.size > 0 ? Math.round((returningCustomers / customerIdsInPeriod.size) * 100) : 0,
          retailRevenue: segmentMetrics.retail.revenue,
          wholesaleRevenue: segmentMetrics.wholesale.revenue,
        }
      };
    }),
});
