import { TRPCError } from "@trpc/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { systemSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Default company config (fallback cuando no hay BD o no hay config guardada) ───
export const DEFAULT_COMPANY_CONFIG = {
  name: "HK EQUIPOS TECNOLÓGICOS",
  subName: "VITALIA - CONTROL & VENTAS",
  slogan: "Tecnología que conecta contigo · Equipos Garantizados",
  phone: "+591 70000000",
  whatsapp: "+591 70000000",
  email: "ventas@vitaliapro.com",
  address: "Centro Comercial Tecnológico, La Paz - Bolivia",
  city: "La Paz, Bolivia",
  taxId: "1234567890",
  logo: null as string | null,
  tiktokUrl: "",
  warrantyBadge: "Garantía Real & Soporte Especializado",
  shippingBadge: "Envíos asegurados a todo el país",
  qualityBadge: "Equipos 100% probados y verificados",
  receiptFooterNotes: "Gracias por su preferencia. Este comprobante es válido como garantía de compra.",
};

export type CompanyConfig = typeof DEFAULT_COMPANY_CONFIG;

const SETTINGS_KEY = "company_config";
const LOCAL_CONFIG_FILE = path.join(process.cwd(), "server", "company_config.json");

// Memoria local
let inMemoryConfig: CompanyConfig | null = null;

// ─── Helper: leer configuración (compatible con BD MySQL y Modo Local / Demo) ───
export async function readCompanyConfig(): Promise<CompanyConfig> {
  try {
    const db = await getDb();
    if (db) {
      const [row] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, SETTINGS_KEY))
        .limit(1);

      if (row?.value) {
        const parsed = JSON.parse(row.value);
        return { ...DEFAULT_COMPANY_CONFIG, ...parsed };
      }
    }
  } catch (err) {
    console.error("[Settings] Error leyendo de BD, usando fallback local:", err);
  }

  // Fallback 1: memoria
  if (inMemoryConfig) {
    return inMemoryConfig;
  }

  // Fallback 2: archivo local en disco
  try {
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      const content = fs.readFileSync(LOCAL_CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(content);
      inMemoryConfig = { ...DEFAULT_COMPANY_CONFIG, ...parsed };
      return inMemoryConfig!;
    }
  } catch (err) {
    console.error("[Settings] Error leyendo archivo de configuración local:", err);
  }

  return DEFAULT_COMPANY_CONFIG;
}

// ─── Helper: escribir configuración (compatible con BD MySQL y Modo Local / Demo) ───
export async function writeCompanyConfig(config: CompanyConfig): Promise<void> {
  // 1. Guardar en memoria
  inMemoryConfig = config;

  // 2. Guardar en archivo local de disco (Modo Local / Demo)
  try {
    fs.writeFileSync(LOCAL_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[Settings] Error guardando archivo local de configuración:", err);
  }

  // 3. Si hay BD MySQL conectada, guardar también en la tabla systemSettings
  try {
    const db = await getDb();
    if (db) {
      const value = JSON.stringify(config);
      const existing = await db
        .select({ id: systemSettings.id })
        .from(systemSettings)
        .where(eq(systemSettings.key, SETTINGS_KEY))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(systemSettings)
          .set({ value })
          .where(eq(systemSettings.key, SETTINGS_KEY));
      } else {
        await db
          .insert(systemSettings)
          .values({ key: SETTINGS_KEY, value });
      }
    }
  } catch (err) {
    console.error("[Settings] Nota: BD no conectada, guardado persistido en disco local:", err);
  }
}

// ─── Router ───
export const settingsRouter = router({
  // Lectura pública (para fichas comerciales, catálogos, recibos)
  getCompanyConfig: publicProcedure.query(async () => {
    return readCompanyConfig();
  }),

  // Escritura solo para admin (funciona tanto con MySQL como en modo local)
  updateCompanyConfig: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        subName: z.string().optional(),
        slogan: z.string().optional(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        taxId: z.string().optional(),
        logo: z.string().nullable().optional(),   // base64 o URL
        tiktokUrl: z.string().optional(),
        warrantyBadge: z.string().optional(),
        shippingBadge: z.string().optional(),
        qualityBadge: z.string().optional(),
        receiptFooterNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo los administradores pueden modificar la configuración de empresa." });
      }

      const current = await readCompanyConfig();
      const updated: CompanyConfig = {
        ...current,
        ...Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== undefined)
        ) as Partial<CompanyConfig>,
      };

      await writeCompanyConfig(updated);
      return { success: true, config: updated };
    }),
});
