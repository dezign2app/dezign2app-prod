import { BackendNode, RedisHashField } from "@/types/canvas";

/**
 * Synchronizes columns to Redis hashConfig.fields when the redis structure is 'hash'
 */
export function syncHashColumns(
  changes: Partial<BackendNode>,
  redisStructure: string,
): Partial<BackendNode> {
  if (changes.data?.columns && redisStructure === "hash") {
    const newFields: RedisHashField[] = changes.data.columns.map((c) => ({
      name: c.name,
      type:
        c.type === "INTEGER" || c.type === "REAL" || c.type === "FLOAT" || c.type === "NUMERIC"
          ? "number"
          : c.type === "BOOLEAN" || c.type === "BOOL"
            ? "boolean"
            : c.type === "JSON" || c.type === "OBJECT"
              ? "json"
              : "string",
      required: Boolean(c.isPrimaryKey || c.isNotNull),
    }));

    return {
      ...changes,
      data: {
        ...changes.data,
        hashConfig: {
          ...changes.data.hashConfig,
          fields: newFields,
        },
      },
    };
  }

  return changes;
}
