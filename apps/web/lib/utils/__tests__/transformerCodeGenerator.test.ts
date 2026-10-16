import { describe, it, expect } from "vitest";
import {
  generateDefaultTransformerCode,
  isLegacyOrEmptyTransformerCode,
  isDefaultStarterTransformerCode,
} from "../transformerCodeGenerator";

describe("transformerCodeGenerator", () => {
  it("generates default code with no input fields", () => {
    const code = generateDefaultTransformerCode();
    expect(code).toContain("// Transform input parameters to match TransformerOutput");
    expect(code).toContain('result: "transformed"');
    expect(code).not.toContain("inputs");
    expect(code).not.toContain("any");
  });

  it("generates code using input parameter demo", () => {
    const code = generateDefaultTransformerCode({
      inputSchema: [{ name: "demo", type: "string", required: true }],
      outputTypeName: "TransformerOutput",
    });
    expect(code).toBe(
      "// Transform input parameters to match TransformerOutput\nreturn {\n  result: demo,\n};\n",
    );
    expect(code).not.toContain("inputs");
    expect(code).not.toContain("any");
  });

  it("generates code matching return schema fields", () => {
    const code = generateDefaultTransformerCode({
      inputSchema: [{ name: "demo", type: "string" }],
      returnSchema: [{ name: "demo", type: "string" }, { name: "extra", type: "string" }],
    });
    expect(code).toBe(
      "// Transform input parameters to match TransformerOutput\nreturn {\n  demo,\n  extra: demo,\n};\n",
    );
  });

  it("includes prompt in comment when provided", () => {
    const code = generateDefaultTransformerCode({
      prompt: "Uppercase input string",
      inputSchema: [{ name: "demo", type: "string" }],
    });
    expect(code).toContain("// Specification: Uppercase input string");
    expect(code).toContain("result: demo");
  });

  it("detects legacy flawed default templates", () => {
    const legacy1 = "// TypeScript transformer logic: (inputs, state, clone) => any\nreturn {\n  ...inputs\n};\n";
    const legacy2 = "return {\n  ...inputs\n};";
    const legacy3 = "...inputs";

    expect(isLegacyOrEmptyTransformerCode(legacy1)).toBe(true);
    expect(isLegacyOrEmptyTransformerCode(legacy2)).toBe(true);
    expect(isLegacyOrEmptyTransformerCode(legacy3)).toBe(true);
    expect(isLegacyOrEmptyTransformerCode("")).toBe(true);
    expect(isLegacyOrEmptyTransformerCode(null)).toBe(true);
    expect(isLegacyOrEmptyTransformerCode(undefined)).toBe(true);

    const validCode = "return { result: demo.trim() };";
    expect(isLegacyOrEmptyTransformerCode(validCode)).toBe(false);
  });

  it("identifies starter templates for auto-sync without overwriting custom logic", () => {
    const starter = "// Transform input parameters to match TransformerOutput\nreturn {\n  result: demo,\n};\n";
    expect(isDefaultStarterTransformerCode(starter)).toBe(true);

    const custom = "const trimmed = demo.trim();\nreturn { result: trimmed, length: trimmed.length };";
    expect(isDefaultStarterTransformerCode(custom)).toBe(false);
  });
});
