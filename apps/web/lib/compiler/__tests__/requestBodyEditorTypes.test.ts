import { describe, it, expect } from "vitest";
import {
  parametersToTsInterface,
  parametersToZodSchema,
  schemaToTsInterface,
  schemaToZodSchema,
  typeStrToTsAndZod,
} from "../generators/schemaToTypeScript";
import type { BackendNode } from "@/types/canvas";

describe("RequestBodyEditor Types & schemaToTypeScript", () => {
  it("converts primitives (any, unknown, Date, Record<string, string>, array) to valid TS and Zod", () => {
    expect(typeStrToTsAndZod("any")).toEqual({ ts: "any", zod: "z.any()" });
    expect(typeStrToTsAndZod("any[]")).toEqual({ ts: "any[]", zod: "z.array(z.any())" });

    expect(typeStrToTsAndZod("unknown")).toEqual({ ts: "unknown", zod: "z.unknown()" });
    expect(typeStrToTsAndZod("unknown[]")).toEqual({ ts: "unknown[]", zod: "z.array(z.unknown())" });

    expect(typeStrToTsAndZod("Record<string, string>")).toEqual({
      ts: "Record<string, string>",
      zod: "z.record(z.string())",
    });

    expect(typeStrToTsAndZod("string")).toEqual({ ts: "string", zod: "z.string()" });
    expect(typeStrToTsAndZod("number[]")).toEqual({ ts: "number[]", zod: "z.array(z.number())" });
  });

  it("converts custom types and package types preserving exact identifier casing", () => {
    expect(typeStrToTsAndZod("User")).toEqual({
      ts: "User",
      zod: "z.custom<User>()",
    });

    expect(typeStrToTsAndZod("User[]")).toEqual({
      ts: "User[]",
      zod: "z.array(z.custom<User>())",
    });

    expect(typeStrToTsAndZod("LucideProps")).toEqual({
      ts: "LucideProps",
      zod: "z.custom<LucideProps>()",
    });

    expect(typeStrToTsAndZod("CustomSVGElementType[]")).toEqual({
      ts: "CustomSVGElementType[]",
      zod: "z.array(z.custom<CustomSVGElementType>())",
    });
  });

  it("converts inline enum values to a union type in TS and z.enum in Zod", () => {
    const enumRes = typeStrToTsAndZod("enum", ["ACTIVE", "INACTIVE", "PENDING"]);
    expect(enumRes.ts).toBe('"ACTIVE" | "INACTIVE" | "PENDING"');
    expect(enumRes.zod).toBe('z.enum(["ACTIVE", "INACTIVE", "PENDING"])');

    const enumArrRes = typeStrToTsAndZod("enum[]", ["ADMIN", "USER"]);
    expect(enumArrRes.ts).toBe('("ADMIN" | "USER")[]');
    expect(enumArrRes.zod).toBe('z.array(z.enum(["ADMIN", "USER"]))');
  });

  it("generates full TS interface and Zod schema with mixed primitive, custom, and package types", () => {
    const schema = {
      mode: "field_builder" as const,
      fields: [
        { name: "id", type: "UUID", required: true },
        { name: "user", type: "User", required: true },
        { name: "tags", type: "string[]", required: false },
        {
          name: "status",
          type: "enum",
          required: true,
          enumValues: ["DRAFT", "PUBLISHED"],
        },
        { name: "icon", type: "LucideProps", required: false },
        { name: "meta", type: "any", required: false },
      ],
    };

    const ts = schemaToTsInterface("CreateArticleBody", schema);
    expect(ts.hasContent).toBe(true);
    expect(ts.code).toContain("export interface CreateArticleBody {");
    expect(ts.code).toContain("id: string;");
    expect(ts.code).toContain("user: User;");
    expect(ts.code).toContain("tags?: string[];");
    expect(ts.code).toContain('status: "DRAFT" | "PUBLISHED";');
    expect(ts.code).toContain("icon?: LucideProps;");
    expect(ts.code).toContain("meta?: any;");

    const zod = schemaToZodSchema("createArticleBodySchema", schema);
    expect(zod.hasContent).toBe(true);
    expect(zod.code).toContain("export const createArticleBodySchema = z.object({");
    expect(zod.code).toContain("id: z.string()");
    expect(zod.code).toContain("user: z.custom<User>()");
    expect(zod.code).toContain("tags: z.array(z.string()).optional()");
    expect(zod.code).toContain('status: z.enum(["DRAFT", "PUBLISHED"])');
    expect(zod.code).toContain("icon: z.custom<LucideProps>().optional()");
    expect(zod.code).toContain("meta: z.any().optional()");
  });
});
