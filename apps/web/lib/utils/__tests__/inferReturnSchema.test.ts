import { describe, it, expect } from "vitest";
import { inferReturnSchemaFromCode, stripComments, extractTopLevelReturns } from "../inferReturnSchema";
import { Parameter } from "@/types/canvas";

describe("inferReturnSchemaFromCode", () => {
  it("infers fields from user's exact screenshot single return statement", () => {
    const code = `return {
  key: conversation_id,
  value: { message, sender }
};`;
    const schema = inferReturnSchemaFromCode(code);

    expect(schema).toHaveLength(2);
    const keyField = schema.find((f) => f.name === "key");
    const valField = schema.find((f) => f.name === "value");

    expect(keyField).toBeDefined();
    expect(keyField?.type).toBe("string");
    expect(keyField?.required).toBe(true);

    expect(valField).toBeDefined();
    expect(valField?.type).toBe("object");
    expect(valField?.required).toBe(true);
  });

  it("handles multiple (N) return statements with branch-aware required fields", () => {
    const code = `
if (!input.userId) {
  return {
    success: false,
    error: "User ID is required"
  };
}

if (input.cached) {
  return {
    success: true,
    data: input.cachedData,
    fromCache: true
  };
}

return {
  success: true,
  data: result
};
`;
    const schema = inferReturnSchemaFromCode(code);

    // Should find 4 distinct fields: success, error, data, fromCache
    expect(schema).toHaveLength(4);

    const successField = schema.find((f) => f.name === "success");
    const errorField = schema.find((f) => f.name === "error");
    const dataField = schema.find((f) => f.name === "data");
    const fromCacheField = schema.find((f) => f.name === "fromCache");

    // success is in ALL 3 branches -> required: true
    expect(successField?.required).toBe(true);
    expect(successField?.type).toBe("boolean");

    // error is only in branch 1 -> required: false
    expect(errorField?.required).toBe(false);
    expect(errorField?.type).toBe("string");

    // data is in branch 2 & 3 (not 1) -> required: false
    expect(dataField?.required).toBe(false);

    // fromCache is only in branch 2 -> required: false
    expect(fromCacheField?.required).toBe(false);
    expect(fromCacheField?.type).toBe("boolean");
  });

  it("resolves types based on inputSchema", () => {
    const inputSchema: Parameter[] = [
      { id: "1", name: "orderId", type: "string", required: true },
      { id: "2", name: "totalAmount", type: "number", required: true },
      { id: "3", name: "isVip", type: "boolean", required: false },
    ];

    const code = `
return {
  id: input.orderId,
  price: input.totalAmount,
  vipStatus: input.isVip,
  timestamp: new Date()
};
`;
    const schema = inferReturnSchemaFromCode(code, inputSchema);

    expect(schema).toHaveLength(4);
    expect(schema.find((f) => f.name === "id")?.type).toBe("string");
    expect(schema.find((f) => f.name === "price")?.type).toBe("number");
    expect(schema.find((f) => f.name === "vipStatus")?.type).toBe("boolean");
    expect(schema.find((f) => f.name === "timestamp")?.type).toBe("Date");
  });

  it("handles spread operator ...input", () => {
    const inputSchema: Parameter[] = [
      { id: "1", name: "firstName", type: "string", required: true },
      { id: "2", name: "age", type: "number", required: true },
    ];

    const code = `
return {
  ...input,
  slug: input.firstName.toLowerCase()
};
`;
    const schema = inferReturnSchemaFromCode(code, inputSchema);

    expect(schema.find((f) => f.name === "firstName")?.type).toBe("string");
    expect(schema.find((f) => f.name === "age")?.type).toBe("number");
    expect(schema.find((f) => f.name === "slug")?.type).toBe("string");
  });

  it("resolves returned variable identifier declared earlier", () => {
    const code = `
const out = {
  token: generateToken(),
  expiresIn: 3600,
  active: true
};
return out;
`;
    const schema = inferReturnSchemaFromCode(code);

    expect(schema).toHaveLength(3);
    expect(schema.find((f) => f.name === "token")?.type).toBe("string");
    expect(schema.find((f) => f.name === "expiresIn")?.type).toBe("number");
    expect(schema.find((f) => f.name === "active")?.type).toBe("boolean");
  });

  it("ignores inner returns inside arrow functions and map callbacks", () => {
    const code = `
const filtered = input.items.map((x) => {
  return x.id;
});

return {
  ids: filtered,
  count: filtered.length
};
`;
    const schema = inferReturnSchemaFromCode(code);

    expect(schema).toHaveLength(2);
    expect(schema.find((f) => f.name === "ids")).toBeDefined();
    expect(schema.find((f) => f.name === "count")?.type).toBe("number");
  });

  it("works with full function declarations", () => {
    const code = `
export async function customTransform(input: CustomInput): Promise<CustomOutput> {
  if (!input.email) {
    return { ok: false, err: "Missing email" };
  }
  return { ok: true, email: input.email };
}
`;
    const schema = inferReturnSchemaFromCode(code);

    expect(schema).toHaveLength(3);
    expect(schema.find((f) => f.name === "ok")?.required).toBe(true);
    expect(schema.find((f) => f.name === "err")?.required).toBe(false);
    expect(schema.find((f) => f.name === "email")?.required).toBe(false);
  });

  it("handles array returns", () => {
    const code = `return [{ id: 1, name: "test" }];`;
    const schema = inferReturnSchemaFromCode(code);

    expect(schema).toHaveLength(1);
    expect(schema[0]?.name).toBe("items");
    expect(schema[0]?.isArray).toBe(true);
  });

  it("handles comments inside return object", () => {
    const code = `
return {
  // Unique conversation id
  key: conversation_id,
  /* Full payload */
  value: { message, sender },
};
`;
    const schema = inferReturnSchemaFromCode(code);

    expect(schema).toHaveLength(2);
    expect(schema.find((f) => f.name === "key")).toBeDefined();
    expect(schema.find((f) => f.name === "value")).toBeDefined();
  });

  it("handles variable identifier returns with nested objects and no semicolon", () => {
    const code = `
const payload = {
  key: conversation_id,
  value: { message, sender }
}
return payload
`;
    const schema = inferReturnSchemaFromCode(code);

    expect(schema).toHaveLength(2);
    expect(schema.find((f) => f.name === "key")?.type).toBe("string");
    expect(schema.find((f) => f.name === "value")?.type).toBe("object");
    expect(schema.find((f) => f.name === "value")?.nestedFields).toHaveLength(2);
    expect(schema.find((f) => f.name === "value")?.nestedFields?.map((f) => f.name)).toEqual(["message", "sender"]);
  });

  it("handles return input directly", () => {
    const inputSchema = [
      { id: "1", name: "foo", type: "string", required: true },
      { id: "2", name: "bar", type: "number", required: false },
    ];
    const code = `return input;`;
    const schema = inferReturnSchemaFromCode(code, inputSchema);

    expect(schema).toHaveLength(2);
    expect(schema.find((f) => f.name === "foo")?.type).toBe("string");
    expect(schema.find((f) => f.name === "bar")?.type).toBe("number");
    expect(schema.find((f) => f.name === "bar")?.required).toBe(false);
  });
});
