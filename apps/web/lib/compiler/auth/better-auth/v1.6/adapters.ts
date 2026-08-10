import { AdapterConfig } from "./types";

export const DEFAULT_SQLITE_CONFIG: AdapterConfig = {
  importStatement: `import Database from "better-sqlite3";\n`,
  adapterCall: `new Database(process.env.DATABASE_URL || "sqlite.db") as any`,
};

export const ADAPTER_REGISTRY: Record<string, Record<string, AdapterConfig>> = {
  default: {
    "sqlite-raw": DEFAULT_SQLITE_CONFIG,
    drizzle: {
      importStatement: `import { drizzleAdapter } from "better-auth/adapters/drizzle";\nimport { db } from "./db";`,
      adapterCall: `drizzleAdapter(db, {\n    provider: "pg",\n  })`,
    },
    prisma: {
      importStatement: `import { prismaAdapter } from "better-auth/adapters/prisma";\nimport { PrismaClient } from "@prisma/client";\nconst prisma = new PrismaClient();`,
      adapterCall: `prismaAdapter(prisma, {\n    provider: "postgresql",\n  })`,
    },
    custom: {
      importStatement: `// Custom database adapter configuration`,
      adapterCall: `/* custom DB adapter */`,
    },
  },
};

export function getAdapterConfig(version: string, adapterKey: string): AdapterConfig {
  const majorVersion = version.split(".")[0] + ".x";
  const versionRegistry = ADAPTER_REGISTRY[majorVersion] || ADAPTER_REGISTRY.default;
  const config = (versionRegistry && versionRegistry[adapterKey]) || DEFAULT_SQLITE_CONFIG;
  return config;
}
