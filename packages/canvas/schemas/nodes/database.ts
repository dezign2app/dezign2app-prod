import { z } from "zod";
import { baseNodeDataSchema } from "./base";

export const databaseDataSchema = baseNodeDataSchema.extend({
  description: z.string().optional(),
  dbEngine: z.string().optional(),
  dbType: z.enum(["relational", "document", "vector", "key-value"]).optional(),
  dbCategory: z.enum(["sql", "nosql", "vector", "key-value"]).optional(),
  provider: z.string().optional(),
  dbConnectionType: z.enum(["env_var", "connection_string"]).optional(),
  connectionStringEnv: z.string().optional(),
  dbFilePathEnv: z.string().optional(),
  hostEnv: z.string().optional(),
  portEnv: z.string().optional(),
  host: z.string().optional(),
  port: z.union([z.string(), z.number()]).optional(),
  databaseNameEnv: z.string().optional(),
  usernameEnv: z.string().optional(),
  passwordEnv: z.string().optional(),
  apiKeyEnv: z.string().optional(),
  isDefault: z.boolean().optional(),
  // Redis instance-wide server configurations
  maxmemoryPolicy: z
    .enum([
      "noeviction",
      "allkeys-lru",
      "volatile-lru",
      "allkeys-lfu",
      "volatile-lfu",
      "volatile-ttl",
      "allkeys-random",
      "volatile-random",
    ])
    .optional(),
  maxmemory: z.string().optional(),
  persistenceMode: z.enum(["RDB", "AOF", "RDB+AOF", "None"]).optional(),
  clustering: z.boolean().optional(),
});
