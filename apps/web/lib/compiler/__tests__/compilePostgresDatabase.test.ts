import { describe, it, expect } from "vitest";
import { compilePostgresDatabase } from "../databases/postgres";
import type { BackendNode } from "@/types/canvas";
import type { CanvasEntityColumn } from "@workspace/canvas/types";

type ColumnInput = { name: string; type: string; [key: string]: unknown };

const makeEntityNode = (
  id: string,
  label: string,
  columns: ColumnInput[],
): BackendNode => ({
  id,
  type: "entity",
  position: { x: 0, y: 0 },
  fractionalIndex: "a0",
  data: { label, columns: columns as unknown as CanvasEntityColumn[] },
});

describe("compilePostgresDatabase", () => {
  const orderEntity = makeEntityNode("ent-order", "Order", [
    { name: "id", type: "string", isPrimaryKey: true },
    { name: "userId", type: "string", isNotNull: true },
    { name: "totalAmount", type: "number" },
    { name: "status", type: "string" },
    { name: "createdAt", type: "timestamp" },
  ]);

  it("should generate all required files", () => {
    const result = compilePostgresDatabase([orderEntity], []);
    const filenames = result.files.map((f) => f.filename);
    expect(filenames).toContain("connection.ts");
    expect(filenames).toContain("schema.sql");
    expect(filenames).toContain("helpers/order.ts");
    expect(filenames).toContain("helpers/index.ts");
    expect(filenames).toContain("index.ts");
    expect(filenames).toContain("package.json");
    expect(filenames).toContain("tsconfig.json");
  });

  it("should generate async helper functions with $N params", () => {
    const result = compilePostgresDatabase([orderEntity], []);
    const helper = result.files.find((f) => f.filename === "helpers/order.ts");
    expect(helper).toBeDefined();
    const code = helper!.content;
    expect(code).toContain("async function findAllOrders");
    expect(code).toContain("async function findOrderById");
    expect(code).toContain("async function createOrder");
    expect(code).toContain("async function updateOrder");
    expect(code).toContain("async function deleteOrderById");
    expect(code).toContain("$1");
    expect(code).toContain("await query");
    expect(code).not.toContain("db.prepare");
    expect(code).not.toContain(".all(");
    expect(code).not.toContain(".get(");
  });

  it("should use RETURNING * in INSERT and UPDATE", () => {
    const result = compilePostgresDatabase([orderEntity], []);
    const helper = result.files.find((f) => f.filename === "helpers/order.ts");
    expect(helper!.content).toContain("RETURNING *");
  });

  it("should generate schema.sql with BetterAuth and payment tables", () => {
    const result = compilePostgresDatabase([orderEntity], []);
    const schema = result.files.find((f) => f.filename === "schema.sql");
    const sql = schema!.content;
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "order"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "user"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "session"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "subscription"');
    expect(sql).toContain("ON CONFLICT");
  });

  it("should generate connection.ts with Pool and withTransaction", () => {
    const result = compilePostgresDatabase([orderEntity], []);
    const conn = result.files.find((f) => f.filename === "connection.ts");
    const code = conn!.content;
    expect(code).toContain("new Pool(");
    expect(code).toContain("export async function query");
    expect(code).toContain("export async function withTransaction");
    expect(code).toContain("export async function checkPostgresHealth");
    expect(code).toContain("ADD COLUMN IF NOT EXISTS");
  });

  it("should generate package.json with pg dependency", () => {
    const result = compilePostgresDatabase([orderEntity], []);
    const pkg = result.files.find((f) => f.filename === "package.json");
    const parsed = JSON.parse(pkg!.content);
    expect(parsed.dependencies).toHaveProperty("pg");
    expect(parsed.devDependencies).toHaveProperty("@types/pg");
  });

  it("should generate reusableFunctions with correct metadata", () => {
    const result = compilePostgresDatabase([orderEntity], []);
    const fns = result.reusableFunctions;
    expect(fns.length).toBeGreaterThanOrEqual(5);
    const findAll = fns.find((f) => f.kind === "findAll");
    expect(findAll?.name).toBe("findAllOrders");
    expect(findAll?.targetName).toBe("order");
    const create = fns.find((f) => f.kind === "create");
    expect(create?.name).toBe("createOrder");
  });

  it("should use randomUUID for string PK", () => {
    const result = compilePostgresDatabase([orderEntity], []);
    const helper = result.files.find((f) => f.filename === "helpers/order.ts");
    expect(helper!.content).toContain("randomUUID");
    expect(helper!.content).toContain('import { randomUUID } from "node:crypto"');
  });

  it("should NOT use randomUUID for numeric PK", () => {
    const numericPkEntity = makeEntityNode("ent-product", "Product", [
      { name: "id", type: "number", isPrimaryKey: true },
      { name: "name", type: "string", isNotNull: true },
    ]);
    const result = compilePostgresDatabase([numericPkEntity], []);
    const helper = result.files.find((f) => f.filename === "helpers/product.ts");
    expect(helper!.content).not.toContain("randomUUID");
  });

  it("should handle multiple entity tables", () => {
    const productEntity = makeEntityNode("ent-product", "Product", [
      { name: "id", type: "string", isPrimaryKey: true },
      { name: "name", type: "string", isNotNull: true },
      { name: "price", type: "number" },
    ]);
    const result = compilePostgresDatabase([orderEntity, productEntity], []);
    const filenames = result.files.map((f) => f.filename);
    expect(filenames).toContain("helpers/order.ts");
    expect(filenames).toContain("helpers/product.ts");
    const barrel = result.files.find((f) => f.filename === "helpers/index.ts");
    expect(barrel!.content).toContain('from "./order"');
    expect(barrel!.content).toContain('from "./product"');
  });

  it("should avoid any, unknown, or as xyz type assertions in generated helpers", () => {
    const result = compilePostgresDatabase([orderEntity], []);
    const helper = result.files.find((f) => f.filename === "helpers/order.ts");
    expect(helper).toBeDefined();
    const code = helper!.content;
    expect(code).not.toContain("as unknown as");
    expect(code).not.toContain("as Order");
    expect(code).not.toContain("as any");
    expect(code).not.toContain("unknown");
    expect(code).toContain("return res.rows[0];");
    expect(code).toContain("return res.rows[0] || null;");
  });
});
