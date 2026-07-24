import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // La CLI (migrate, studio...) usa esta URL. Usamos la conexión DIRECTA
  // (puerto 5432), no la del pooler, porque las migraciones lo necesitan.
  datasource: {
    url: env("DIRECT_URL"),
  },
});