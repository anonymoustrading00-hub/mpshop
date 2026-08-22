import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { employees, users } from "../../drizzle/schema";
import { eq, and, desc, like, or, sql } from "drizzle-orm";

// ─── Mock data (demo mode) ───────────────────────────────────────────────────
export const MOCK_EMPLOYEES: any[] = [];

function syncEmployeesToDisk() {
  const { syncMocksToDisk } = require("../db");
  syncMocksToDisk();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  repartidor:     "Repartidor",
  ventas:         "Ventas",
  almacen:        "Almacén",
  tecnico:        "Técnico",
  administracion: "Administración",
  otro:           "Otro",
};

const employeeInput = z.object({
  fullName:        z.string().min(1, "Nombre requerido"),
  ci:              z.string().optional(),
  role:            z.enum(["repartidor","ventas","almacen","tecnico","administracion","otro"]).default("otro"),
  userId:          z.number().optional(),
  baseSalary:      z.number().min(0).default(0),
  fixedDeductions: z.array(z.object({ name: z.string(), amount: z.number() })).optional(),
  phone:           z.string().optional(),
  address:         z.string().optional(),
  startDate:       z.string().optional(),
  birthDate:       z.string().optional(),
  status:          z.enum(["active","inactive"]).default("active"),
  notes:           z.string().optional(),
  branchId:        z.number().default(1),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const employeesRouter = router({

  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      role:   z.string().optional(),
      status: z.enum(["active","inactive","all"]).default("all"),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();

      if (!db) {
        let list = [...MOCK_EMPLOYEES];
        if (input?.status && input.status !== "all")
          list = list.filter((e: any) => e.status === input.status);
        if (input?.role)
          list = list.filter((e: any) => e.role === input.role);
        if (input?.search) {
          const s = input.search.toLowerCase();
          list = list.filter((e: any) =>
            e.fullName?.toLowerCase().includes(s) ||
            e.ci?.toLowerCase().includes(s) ||
            e.phone?.toLowerCase().includes(s)
          );
        }
        return list.sort((a: any, b: any) => b.id - a.id).map((e: any) => ({
          ...e,
          fixedDeductions: e.fixedDeductions
            ? (typeof e.fixedDeductions === "string" ? JSON.parse(e.fixedDeductions) : e.fixedDeductions)
            : [],
          roleLabel: ROLE_LABELS[e.role] || e.role,
          linkedUserName: null,
        }));
      }

      const rows = await db
        .select({
          id: employees.id, fullName: employees.fullName, ci: employees.ci,
          role: employees.role, userId: employees.userId,
          baseSalary: employees.baseSalary, fixedDeductions: employees.fixedDeductions,
          phone: employees.phone, address: employees.address,
          startDate: employees.startDate, birthDate: employees.birthDate,
          status: employees.status, notes: employees.notes,
          branchId: employees.branchId, createdAt: employees.createdAt,
          linkedUserName: users.name,
        })
        .from(employees)
        .leftJoin(users, eq(employees.userId, users.id))
        .orderBy(desc(employees.id));

      return rows
        .filter((r: any) => !input?.status || input.status === "all" || r.status === input.status)
        .filter((r: any) => !input?.role || r.role === input.role)
        .filter((r: any) => {
          if (!input?.search) return true;
          const s = input.search.toLowerCase();
          return r.fullName?.toLowerCase().includes(s) || r.ci?.toLowerCase().includes(s);
        })
        .map((r: any) => ({
          ...r,
          fixedDeductions: r.fixedDeductions ? JSON.parse(r.fixedDeductions) : [],
          roleLabel: ROLE_LABELS[r.role] || r.role,
        }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();

      if (!db) {
        const emp = MOCK_EMPLOYEES.find((e: any) => e.id === input.id);
        if (!emp) throw new TRPCError({ code: "NOT_FOUND" });
        return { ...emp, fixedDeductions: emp.fixedDeductions ? JSON.parse(emp.fixedDeductions) : [] };
      }

      const [emp] = await db.select().from(employees).where(eq(employees.id, input.id)).limit(1);
      if (!emp) throw new TRPCError({ code: "NOT_FOUND", message: "Empleado no encontrado" });
      return { ...emp, fixedDeductions: emp.fixedDeductions ? JSON.parse(emp.fixedDeductions) : [] };
    }),

  create: protectedProcedure
    .input(employeeInput)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();

      const data = {
        ...input,
        fixedDeductions: input.fixedDeductions ? JSON.stringify(input.fixedDeductions) : JSON.stringify([]),
        userId: input.userId || null,
      };

      if (!db) {
        const newId = (MOCK_EMPLOYEES.length > 0 ? Math.max(...MOCK_EMPLOYEES.map((e: any) => e.id)) : 0) + 1;
        MOCK_EMPLOYEES.push({ ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        syncEmployeesToDisk();
        return { success: true, employeeId: newId };
      }

      const result: any = await db.insert(employees).values(data as any);
      return { success: true, employeeId: result.insertId };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number() }).merge(employeeInput.partial()))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();

      const { id, fixedDeductions, ...rest } = input;
      const data: any = { ...rest };
      if (fixedDeductions !== undefined) data.fixedDeductions = JSON.stringify(fixedDeductions);

      if (!db) {
        const idx = MOCK_EMPLOYEES.findIndex((e: any) => e.id === id);
        if (idx === -1) throw new TRPCError({ code: "NOT_FOUND" });
        MOCK_EMPLOYEES[idx] = { ...MOCK_EMPLOYEES[idx], ...data, updatedAt: new Date().toISOString() };
        syncEmployeesToDisk();
        return { success: true };
      }

      await db.update(employees).set(data).where(eq(employees.id, id));
      return { success: true };
    }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();

      if (!db) {
        const idx = MOCK_EMPLOYEES.findIndex((e: any) => e.id === input.id);
        if (idx !== -1) MOCK_EMPLOYEES[idx] = { ...MOCK_EMPLOYEES[idx], status: "inactive" };
        syncEmployeesToDisk();
        return { success: true };
      }

      await db.update(employees).set({ status: "inactive" }).where(eq(employees.id, input.id));
      return { success: true };
    }),

  /** Lista simplificada para selectores (ej. al registrar un gasto de sueldo) */
  listActive: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return MOCK_EMPLOYEES.filter((e: any) => e.status === "active")
        .map((e: any) => ({ id: e.id, fullName: e.fullName, role: e.role, baseSalary: e.baseSalary }));
    }
    return db.select({ id: employees.id, fullName: employees.fullName, role: employees.role, baseSalary: employees.baseSalary })
      .from(employees).where(eq(employees.status, "active")).orderBy(employees.fullName);
  }),
});
