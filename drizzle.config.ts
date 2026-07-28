import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL || "mysql://user:pass@localhost:3306/db";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
