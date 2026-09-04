import { describe, it, expect } from "vitest";
import { BackendNode } from "@/types/canvas";
import { compileExternalNodes, generateExternalFunctionFile } from "../compileExternalNodes";

describe("compileExternalNodes", () => {
  it("returns empty result when no external nodes exist", () => {
    const nodes: BackendNode[] = [
      {
        id: "service-1",
        type: "service",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: { label: "Main Service" },
      },
    ];
    const result = compileExternalNodes(nodes);
    expect(result.files).toHaveLength(0);
    expect(result.reusableFunctions).toHaveLength(0);
  });

  it("compiles an external calling tool into a typed TypeScript function and package", () => {
    const nodes: BackendNode[] = [
      {
        id: "ext-1",
        type: "external",
        position: { x: 100, y: 100 },
        fractionalIndex: "a0",
        data: {
          label: "Create Stripe Charge",
          functionName: "callStripeCharge",
          description: "Calls Stripe API to create a charge",
          method: "POST",
          url: "https://api.stripe.com/v1/charges/{{chargeId}}",
          authType: "bearer",
          apiKey: "process.env.STRIPE_SECRET_KEY",
          inputVariables: [
            { id: "v1", name: "chargeId", type: "string", required: true },
            { id: "v2", name: "amount", type: "number", required: true },
            { id: "v3", name: "currency", type: "string", required: false },
          ],
          queryParams: [
            { id: "q1", name: "expand", key: "expand", value: "customer", type: "string", required: false, enabled: true },
          ],
          headers: [
            { id: "h1", name: "Idempotency-Key", key: "Idempotency-Key", value: "{{chargeId}}", type: "string", required: false, enabled: true },
          ],
          bodyType: "json",
          bodyContent: '{\n  "amount": {{amount}},\n  "currency": "{{currency}}"\n}',
          timeout: 45,
        },
      },
    ];

    const result = compileExternalNodes(nodes);

    expect(result.globalPackageName).toBe("@workspace/external-apis");
    expect(result.reusableFunctions).toHaveLength(1);
    const fn = result.reusableFunctions[0]!;
    expect(fn.name).toBe("callStripeCharge");
    expect(fn.importPath).toBe("@workspace/external-apis");
    expect(fn.signature).toContain("callStripeCharge(input: CallStripeChargeInput): Promise<CallStripeChargeOutput>");

    // Check package.json
    const pkgJson = result.files.find((f) => f.filename === "packages/external-apis/package.json");
    expect(pkgJson).toBeDefined();
    const parsedPkg = JSON.parse(pkgJson!.content);
    expect(parsedPkg.name).toBe("@workspace/external-apis");

    // Check barrel index.ts
    const indexFile = result.files.find((f) => f.filename === "packages/external-apis/src/index.ts");
    expect(indexFile).toBeDefined();
    expect(indexFile!.content).toContain('export * from "./callStripeCharge";');

    // Check function file
    const fnFile = result.files.find((f) => f.filename === "packages/external-apis/src/callStripeCharge.ts");
    expect(fnFile).toBeDefined();
    const content = fnFile!.content;

    // Verify Input interface
    expect(content).toContain("export interface CallStripeChargeInput {");
    expect(content).toContain("chargeId: string;");
    expect(content).toContain("amount: number;");
    expect(content).toContain("currency?: string;");

    // Verify Dual Output interfaces (Success & Error)
    expect(content).toContain("export interface CallStripeChargeSuccessOutput {");
    expect(content).toContain("export interface CallStripeChargeErrorOutput {");
    expect(content).toContain("export interface CallStripeChargeOutput {");
    expect(content).toContain("success: boolean;");
    expect(content).toContain("data?: CallStripeChargeSuccessOutput;");
    expect(content).toContain("error?: CallStripeChargeErrorOutput;");

    // Verify Function signature & implementation
    expect(content).toContain("export async function callStripeCharge(");
    expect(content).toContain("input: CallStripeChargeInput");
    expect(content).toContain('method: "POST"');
    expect(content).toContain('encodeURIComponent(String(input["chargeId"] ?? ""))');
    expect(content).toContain('queryParams.set("expand", `customer`);');
    expect(content).toContain('"Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY || ""}`,');
    expect(content).toContain('"Idempotency-Key": String(input["chargeId"] ?? ""),');
    expect(content).toContain("const response = await fetch(targetUrl");
    expect(content).toContain("if (!response.ok)");
    expect(content).toContain("data: dataPayload as CallStripeChargeSuccessOutput");
    expect(content).toContain("error: (typeof errPayload === \"object\"");
  });

  it("handles GET request with query param authentication", () => {
    const node: BackendNode = {
      id: "ext-weather",
      type: "external",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Fetch Weather",
        functionName: "fetchWeather",
        method: "GET",
        url: "https://api.weather.com/v1/current",
        authType: "apiKey",
        authQueryParam: "appid",
        apiKey: "process.env.WEATHER_API_KEY",
        inputVariables: [
          { id: "v1", name: "city", type: "string", required: true },
        ],
        queryParams: [
          { id: "q1", name: "q", key: "q", value: "{{city}}", type: "string", required: false, enabled: true },
        ],
      },
    };

    const file = generateExternalFunctionFile(node);
    expect(file.filename).toBe("src/fetchWeather.ts");
    expect(file.content).toContain('method: "GET"');
    expect(file.content).toContain('queryParams.set("appid", `${process.env.WEATHER_API_KEY || ""}`);');
    expect(file.content).toContain('queryParams.set("q", String(input["city"]));');
  });

  it("generates JSON.stringify object literal for request body and deduplicates headers", () => {
    const node: BackendNode = {
      id: "ext-groq",
      type: "external",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Groq Chat",
        functionName: "demo",
        method: "POST",
        url: "https://api.groq.com/openai/v1/chat/completions",
        bodyType: "json",
        bodyContent: JSON.stringify({
          messages: [{ role: "user", content: "hi" }],
          model: "openai/gpt-oss-120b",
          temperature: 1,
          max_completion_tokens: 2048,
          top_p: 1,
          stream: true,
          reasoning_effort: "medium",
          stop: null,
        }),
        headers: [
          { id: "h1", name: "Content-Type", key: "Content-Type", value: "application/json", type: "string", required: false, enabled: true },
          { id: "h2", name: "Authorization", key: "Authorization", value: "Bearer gsk_12345", type: "string", required: false, enabled: true },
        ],
      },
    };

    const file = generateExternalFunctionFile(node);
    expect(file.content).toContain("const requestBody = JSON.stringify({");
    expect(file.content).toContain('model: "openai/gpt-oss-120b",');
    expect(file.content).toContain('role: "user",');
    expect(file.content).toContain('content: "hi",');
    expect(file.content).toContain("temperature: 1,");
    expect(file.content).toContain("stream: true,");
    expect(file.content).toContain("stop: null,");

    // Verify headers only appear once
    const authMatches = file.content.match(/"Authorization":/g) || [];
    expect(authMatches.length).toBe(1);
    const contentTypeMatches = file.content.match(/"Content-Type":/g) || [];
    expect(contentTypeMatches.length).toBe(1);
  });
});

