import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  inventoryTransfers,
  inventoryTransferItems,
  units,
  branches,
  users,
  unitEvents,
} from "../../drizzle/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export const transfersRouter = router({
  // ─── Listar Traspasos ────────────────────────────────────────────────────────
  list: protectedProcedure
    .input(
      z
        .object({
          branchId: z.number().optional(), // Origen o destino
          sourceBranchId: z.number().optional(),
          destinationBranchId: z.number().optional(),
          status: z.enum(["pending", "in_transit", "completed", "cancelled"]).optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const allTransfers = await db
        .select({
          id: inventoryTransfers.id,
          transferNumber: inventoryTransfers.transferNumber,
          direction: inventoryTransfers.direction,
          sourceBranchId: inventoryTransfers.sourceBranchId,
          destinationBranchId: inventoryTransfers.destinationBranchId,
          status: inventoryTransfers.status,
          userId: inventoryTransfers.userId,
          notes: inventoryTransfers.notes,
          createdAt: inventoryTransfers.createdAt,
        })
        .from(inventoryTransfers)
        .orderBy(desc(inventoryTransfers.createdAt))
        .limit(input?.limit || 50)
        .offset(input?.offset || 0);

      const allBranches = await db.select().from(branches);
      const allUsers = await db.select().from(users);

      // Traer conteo de items por traspaso
      const transferIds = allTransfers.map((t: any) => t.id);
      let itemsCountMap: Record<number, number> = {};

      if (transferIds.length > 0) {
        const transferItems = await db
          .select({
            transferId: inventoryTransferItems.transferId,
            unitId: inventoryTransferItems.unitId,
          })
          .from(inventoryTransferItems)
          .where(inArray(inventoryTransferItems.transferId, transferIds));

        for (const item of transferItems) {
          itemsCountMap[item.transferId] = (itemsCountMap[item.transferId] || 0) + 1;
        }
      }

      const items = allTransfers.map((t: any) => {
        const sourceBranch = allBranches.find((b: any) => b.id === t.sourceBranchId);
        const destinationBranch = allBranches.find((b: any) => b.id === t.destinationBranchId);
        const user = allUsers.find((u: any) => u.id === t.userId);

        return {
          ...t,
          sourceBranchName: sourceBranch?.name || `Sucursal #${t.sourceBranchId}`,
          destinationBranchName: destinationBranch?.name || `Sucursal #${t.destinationBranchId}`,
          userName: user?.name || `Usuario #${t.userId}`,
          itemsCount: itemsCountMap[t.id] || 0,
        };
      });

      // Filtrar por branchId si se requiere (origen o destino)
      let filtered = items;
      if (input?.branchId) {
        filtered = filtered.filter(
          (t: any) => t.sourceBranchId === input.branchId || t.destinationBranchId === input.branchId
        );
      }
      if (input?.sourceBranchId) {
        filtered = filtered.filter((t: any) => t.sourceBranchId === input.sourceBranchId);
      }
      if (input?.destinationBranchId) {
        filtered = filtered.filter((t: any) => t.destinationBranchId === input.destinationBranchId);
      }
      if (input?.status) {
        filtered = filtered.filter((t: any) => t.status === input.status);
      }

      return {
        items: filtered,
        total: filtered.length,
      };
    }),

  // ─── Obtener Detalle de Traspaso (para Nota de Traspaso) ─────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "NOT_FOUND", message: "Base de datos no disponible" });

      const [transfer] = await db
        .select()
        .from(inventoryTransfers)
        .where(eq(inventoryTransfers.id, input.id))
        .limit(1);

      if (!transfer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Traspaso no encontrado" });
      }

      const [sourceBranch] = await db
        .select()
        .from(branches)
        .where(eq(branches.id, transfer.sourceBranchId))
        .limit(1);

      const [destinationBranch] = await db
        .select()
        .from(branches)
        .where(eq(branches.id, transfer.destinationBranchId))
        .limit(1);

      const [user] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, transfer.userId))
        .limit(1);

      // Obtener los items del traspaso con datos completos de la unidad
      const transferItems = await db
        .select({
          id: inventoryTransferItems.id,
          unitId: inventoryTransferItems.unitId,
          unitCode: inventoryTransferItems.unitCode,
          quantity: inventoryTransferItems.quantity,
          createdAt: inventoryTransferItems.createdAt,
          // Datos de la unidad
          brand: units.brand,
          model: units.model,
          serialNumber: units.serialNumber,
          specs: units.specs,
          purchasePrice: units.purchasePrice,
          salePrice: units.salePrice,
          status: units.status,
        })
        .from(inventoryTransferItems)
        .leftJoin(units, eq(inventoryTransferItems.unitId, units.id))
        .where(eq(inventoryTransferItems.transferId, transfer.id));

      return {
        transfer: {
          ...transfer,
          sourceBranch,
          destinationBranch,
          user,
        },
        items: transferItems.map((item: any) => ({
          ...item,
          specs: typeof item.specs === "string" ? JSON.parse(item.specs || "{}") : (item.specs || {}),
        })),
      };
    }),

  // ─── Crear Nuevo Traspaso entre Sucursales ───────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        sourceBranchId: z.number(),
        destinationBranchId: z.number(),
        unitIds: z.array(z.number()).min(1, "Debe seleccionar al menos un equipo para traspasar"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });

      if (input.sourceBranchId === input.destinationBranchId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La sucursal de origen y destino no pueden ser la misma.",
        });
      }

      // Validar que las sucursales existan
      const [sourceBranch] = await db.select().from(branches).where(eq(branches.id, input.sourceBranchId)).limit(1);
      const [destBranch] = await db.select().from(branches).where(eq(branches.id, input.destinationBranchId)).limit(1);

      if (!sourceBranch || !destBranch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Una de las sucursales no existe." });
      }

      // Validar que las unidades existan y estén en la sucursal de origen
      const selectedUnits = await db
        .select()
        .from(units)
        .where(inArray(units.id, input.unitIds));

      if (selectedUnits.length !== input.unitIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Algunos de los equipos seleccionados no existen." });
      }

      for (const unit of selectedUnits) {
        if (unit.status === "sold") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El equipo ${unit.code || unit.brand + " " + unit.model} ya fue vendido y no puede ser traspasado.`,
          });
        }
        if (unit.branchId !== input.sourceBranchId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El equipo ${unit.code || unit.brand} no pertenece a la sucursal de origen ${sourceBranch.name}.`,
          });
        }
      }

      // Generar correlativo de traspaso: TRP-XXXX
      const [latest] = await db
        .select({ id: inventoryTransfers.id })
        .from(inventoryTransfers)
        .orderBy(desc(inventoryTransfers.id))
        .limit(1);

      const nextNum = (latest?.id || 0) + 1;
      const transferNumber = `TRP-${String(nextNum).padStart(4, "0")}`;

      // Insertar el traspaso en estado completed (traspaso directo)
      const [insertResult] = await db.insert(inventoryTransfers).values({
        transferNumber,
        direction: "branch_transfer",
        sourceBranchId: input.sourceBranchId,
        destinationBranchId: input.destinationBranchId,
        status: "completed",
        userId: ctx.user.id,
        notes: input.notes || null,
      });

      const transferId = (insertResult as any).insertId || nextNum;

      // Insertar items del traspaso y actualizar unidades
      for (const unit of selectedUnits) {
        await db.insert(inventoryTransferItems).values({
          transferId,
          unitId: unit.id,
          unitCode: unit.code || null,
          quantity: 1,
        });

        // Mover la unidad a la sucursal destino
        await db
          .update(units)
          .set({
            branchId: input.destinationBranchId,
            updatedAt: new Date(),
          })
          .where(eq(units.id, unit.id));

        // Registrar evento en el Kardex del equipo
        await db.insert(unitEvents).values({
          unitId: unit.id,
          eventType: "status_change",
          userId: ctx.user.id,
          notes: `Traspaso #${transferNumber}: Movido de ${sourceBranch.name} a ${destBranch.name}${input.notes ? ` (Obs: ${input.notes})` : ""}`,
        });
      }

      return {
        success: true,
        transferId,
        transferNumber,
        sourceBranchName: sourceBranch.name,
        destBranchName: destBranch.name,
        transferredCount: selectedUnits.length,
      };
    }),
});
