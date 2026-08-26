import { describe, it, expect } from "vitest";
import { compileTransformerHelpers } from "../compileTransformerHelpers";
import { renderPipeline, collectPipelineImports } from "../generators/routeGenerator/pipelineRenderer";
import { generateEndpointRouteHandler } from "../generators/routeGenerator/endpointHandlerGenerator";
import { generateConsumers } from "../generators/consumerGenerator";
import { schemaToTsInterface, schemaToZodSchema } from "../generators/schemaToTypeScript";
import { compileMonorepo } from "../compileMonorepo";
import { BackendNode, BackendEdge, Endpoint, AnyMessagingResource } from "@workspace/canvas/types";

describe("Step Pipeline & Transformer Helpers", () => {
  describe("compileTransformerHelpers", () => {
    it("compiles global transformer helper to packages/transformers and local helper to apps/service/src/transformers", () => {
      const nodes: BackendNode[] = [
        {
          id: "service-1",
          type: "service",
          data: {
            label: "ProductsService",
            transformerHelpers: [
              {
                id: "h1",
                name: "slugifyProductInput",
                description: "Generates slug from product name",
                scope: "local",
                targetServiceId: "service-1",
                inputSchema: [
                  { name: "name", type: "string", required: true },
                  { name: "category", type: "string", required: false },
                ],
                logicMode: "code",
                code: "return {\n  slug: input.name.toLowerCase().replace(/\\s+/g, '-'),\n  category: input.category || 'default'\n};",
                returnSchema: [
                  { name: "slug", type: "string", required: true },
                  { name: "category", type: "string", required: true },
                ],
              },
              {
                id: "h2",
                name: "formatGlobalCurrency",
                description: "Shared currency formatter",
                scope: "global",
                inputSchema: [{ name: "amount", type: "number", required: true }],
                logicMode: "code",
                code: "return { formatted: `$${input.amount.toFixed(2)}` };",
                returnSchema: [{ name: "formatted", type: "string", required: true }],
              },
            ],
          },
          position: { x: 0, y: 0 },
          fractionalIndex: "a0",
        },
      ];

      const result = compileTransformerHelpers(nodes);

      // Global helper checks
      expect(result.globalPackageName).toBe("@workspace/transformers");
      const globalFile = result.files.find((f) => f.filename.includes("packages/transformers/src/formatGlobalCurrency.ts"));
      expect(globalFile).toBeDefined();
      expect(globalFile?.content).toContain("export interface FormatGlobalCurrencyInput");
      expect(globalFile?.content).toContain("amount: number;");
      expect(globalFile?.content).toContain("export interface FormatGlobalCurrencyOutput");
      expect(globalFile?.content).toContain("formatted: string;");
      expect(globalFile?.content).toContain("export function formatGlobalCurrency(input: FormatGlobalCurrencyInput): FormatGlobalCurrencyOutput");

      // Local helper checks
      const localFile = result.files.find((f) => f.filename.includes("apps/productsservice/src/transformers/slugifyProductInput.ts"));
      expect(localFile).toBeDefined();
      expect(localFile?.content).toContain("export interface SlugifyProductInputInput");
      expect(localFile?.content).toContain("name: string;");
      expect(localFile?.content).toContain("category?: string;");
      expect(localFile?.content).toContain("export function slugifyProductInput(input: SlugifyProductInputInput): SlugifyProductInputOutput");

      // Reusable functions
      expect(result.reusableFunctions.some((f) => f.name === "slugifyProductInput")).toBe(true);
      expect(result.reusableFunctions.some((f) => f.name === "formatGlobalCurrency")).toBe(true);
    });
  });

  describe("pipelineRenderer & endpointHandlerGenerator", () => {
    it("generates deterministic step-by-step pipeline code with explicit input bindings", () => {
      const ep: Endpoint & { nodeId: string } = {
        id: "ep-create-product",
        name: "/products",
        type: "POST",
        nodeId: "service-1",
        requestBody: {
          id: "req-1",
          fields: [
            { id: "f1", name: "name", type: "string", required: true },
            { id: "f2", name: "price", type: "number", required: true },
            { id: "f3", name: "category", type: "string", required: true },
          ],
        },
        pipelineSteps: [
          {
            id: "step-1",
            name: "Transform Product Input",
            type: "transform",
            enabled: true,
            functionRef: {
              name: "slugifyProductInput",
              importPath: "./transformers/slugifyProductInput",
            },
            inputBindings: [
              {
                argName: "name",
                source: { kind: "req_body", field: "name" },
              },
            ],
            outputVariable: "transformedInput",
          },
          {
            id: "step-2",
            name: "Insert into Database",
            type: "db_operation",
            enabled: true,
            functionRef: {
              name: "createProduct",
              importPath: "@workspace/db/helpers/products",
            },
            inputBindings: [
              {
                argName: "name",
                source: { kind: "req_body", field: "name" },
              },
              {
                argName: "slug",
                source: { kind: "step_output", stepId: "step-1", field: "slug" },
              },
              {
                argName: "price",
                source: { kind: "req_body", field: "price" },
              },
              {
                argName: "category",
                source: { kind: "req_body", field: "category" },
              },
            ],
            outputVariable: "createdProduct",
          },
          {
            id: "step-3",
            name: "Cache in Redis",
            type: "redis_operation",
            enabled: true,
            functionRef: {
              name: "setProductsCache",
              importPath: "@workspace/primary-redis-cache",
            },
            inputBindings: [
              {
                argName: "0",
                source: { kind: "step_output", stepId: "step-2", field: "id" },
              },
              {
                argName: "1",
                source: { kind: "step_output", stepId: "step-2" },
              },
            ],
            outputVariable: "cacheResult",
          },
          {
            id: "step-4",
            name: "Publish Kafka Event",
            type: "kafka_publish",
            enabled: true,
            functionRef: {
              name: "publishKafkaEvent",
              importPath: "@workspace/kafka/publishers",
            },
            inputBindings: [
              {
                argName: "topic",
                source: { kind: "literal", value: "product-created" },
              },
              {
                argName: "payload",
                source: { kind: "step_output", stepId: "step-2" },
              },
            ],
            outputVariable: "kafkaPublishResult",
          },
          {
            id: "step-5",
            name: "Return Response",
            type: "return_response",
            enabled: true,
            statusCode: 201,
            inputBindings: [
              {
                argName: "data",
                source: { kind: "step_output", stepId: "step-2" },
              },
            ],
            outputVariable: "",
          },
        ],
      };

      const result = generateEndpointRouteHandler({
        ep,
        index: 0,
        serviceName: "ProductsService",
        pascalServiceName: "ProductsService",
        serviceFolderName: "productsservice",
        allNodes: [],
        allEdges: [],
        allEndpoints: [ep],
        dbFunctions: [],
        kafkaFunctions: [],
        redisFunctions: [],
        nodePublishedEvents: [],
        usedFileNames: new Set(),
      });

      const content = result.file.content;

      // 1. Pipeline step 1: transform
      expect(content).toContain("const transformedInput = slugifyProductInput(");
      expect(content).toContain("name: body.name");

      // 2. Pipeline step 2: db_operation with prior step binding
      expect(content).toContain("const createdProduct = await createProduct(");
      expect(content).toContain("slug: transformedInput.slug");

      // 3. Pipeline step 3: redis positional call referencing createdProduct
      expect(content).toContain("const cacheResult = await setProductsCache(createdProduct.id, createdProduct);");

      // 4. Pipeline step 4: kafka publish
      expect(content).toContain("const kafkaPublishResult = await publishKafkaEvent(");
      expect(content).toContain('"product-created",');

      // 5. Pipeline step 5: return_response
      expect(content).toContain("return res.status(201).json(createdProduct);");

      // 6. Imports collected from steps
      expect(content).toContain('import { slugifyProductInput } from "./transformers/slugifyProductInput";');
      expect(content).toContain('import { createProduct } from "@workspace/db/helpers/products";');
      expect(content).toContain('import { setProductsCache } from "@workspace/primary-redis-cache";');
      expect(content).toContain('import { publishKafkaEvent } from "@workspace/kafka/publishers";');
    });
  });

  describe("compileMonorepo Integration", () => {
    it("compiles a complete monorepo including transformers package when configured", () => {
      const nodes: BackendNode[] = [
        {
          id: "service-1",
          type: "service",
          data: {
            label: "OrderService",
            transformerHelpers: [
              {
                id: "th1",
                name: "calculateDiscount",
                scope: "global",
                inputSchema: [{ name: "subtotal", type: "number" }],
                logicMode: "code",
                code: "return { total: input.subtotal * 0.9 };",
                returnSchema: [{ name: "total", type: "number" }],
              },
            ],
          },
          position: { x: 0, y: 0 },
          fractionalIndex: "a0",
        },
      ];

      const monorepo = compileMonorepo(nodes);
      const pkgJson = monorepo.files.find((f) => f.filename === "packages/transformers/package.json");
      expect(pkgJson).toBeDefined();

      const helperFile = monorepo.files.find((f) => f.filename === "packages/transformers/src/calculateDiscount.ts");
      expect(helperFile).toBeDefined();
      expect(helperFile?.content).toContain("export function calculateDiscount");
    });

    it("compiles standalone transformer nodes placed directly on the visual canvas", () => {
      const nodes: BackendNode[] = [
        {
          id: "trans-1",
          type: "transformer",
          data: {
            label: "formatPhoneNumber",
            functionName: "formatPhoneNumber",
            scope: "global",
            inputSchema: [{ id: "p1", name: "rawPhone", type: "string", required: true }],
            logicMode: "code",
            code: "return { formatted: input.rawPhone.replace(/\\D/g, '') };",
            returnSchema: [{ id: "r1", name: "formatted", type: "string", required: true }],
          },
          position: { x: 100, y: 100 },
          fractionalIndex: "a0",
        },
        {
          id: "service-1",
          type: "service",
          data: {
            label: "UserService",
          },
          position: { x: 300, y: 100 },
          fractionalIndex: "a1",
        },
        {
          id: "trans-local",
          type: "transformer",
          data: {
            label: "validateLocalPin",
            functionName: "validateLocalPin",
            scope: "local",
            targetServiceId: "service-1",
            inputSchema: [{ id: "p2", name: "pin", type: "string", required: true }],
            logicMode: "code",
            code: "return { isValid: input.pin.length === 6 };",
            returnSchema: [{ id: "r2", name: "isValid", type: "boolean", required: true }],
          },
          position: { x: 500, y: 100 },
          fractionalIndex: "a2",
        },
      ];

      const result = compileTransformerHelpers(nodes);

      // Global transformer from canvas node
      const globalFile = result.files.find((f) => f.filename === "packages/transformers/src/formatPhoneNumber.ts");
      expect(globalFile).toBeDefined();
      expect(globalFile?.content).toContain("export function formatPhoneNumber");

      // Local transformer attached to service
      const localFile = result.files.find((f) => f.filename.includes("apps/userservice/src/transformers/validateLocalPin.ts"));
      expect(localFile).toBeDefined();
      expect(localFile?.content).toContain("export function validateLocalPin");
    });
  });

  describe("schemaToTypeScript - nested object & array type tracking", () => {
    it("generates correctly indented recursive TypeScript interfaces and Zod schemas for deep nested payloads", () => {
      const complexSchema = {
        rawJson: JSON.stringify({
          product: {
            name: "Mechanical Keyboard",
            specs: {
              keys: 87,
              bluetooth: true,
              switches: {
                brand: "Cherry MX",
                type: "Brown",
              },
            },
          },
          tags: ["hardware", "keyboard"],
          price: 129.99,
        }),
      };

      const tsResult = schemaToTsInterface("CreateProductBody", complexSchema);
      expect(tsResult.hasContent).toBe(true);
      expect(tsResult.code).toContain("export interface CreateProductBody {");
      expect(tsResult.code).toContain("product: {");
      expect(tsResult.code).toContain("name: string;");
      expect(tsResult.code).toContain("specs: {");
      expect(tsResult.code).toContain("keys: number;");
      expect(tsResult.code).toContain("bluetooth: boolean;");
      expect(tsResult.code).toContain("switches: {");
      expect(tsResult.code).toContain("brand: string;");
      expect(tsResult.code).toContain("tags: string[];");
      expect(tsResult.code).toContain("price: number;");

      const zodResult = schemaToZodSchema("createProductBodySchema", complexSchema);
      expect(zodResult.hasContent).toBe(true);
      expect(zodResult.code).toContain("export const createProductBodySchema = z.object({");
      expect(zodResult.code).toContain("product: z.object({");
      expect(zodResult.code).toContain("specs: z.object({");
      expect(zodResult.code).toContain("switches: z.object({");
      expect(zodResult.code).toContain("tags: z.array(z.string())");
    });
  });

  describe("Transformer & Transformer Ref Connection Validation", () => {
    it("validates that transformer and transformer_ref nodes connect properly to endpoint-in handles", async () => {
      const { isValidConnection } = await import("@workspace/canvas");

      // 1. Transformer node -> Endpoint handle
      const res1 = isValidConnection("transformer", "transformer-out", "service", "endpoint-in-ep1");
      expect(res1.valid).toBe(true);
      if (res1.valid) {
        expect(res1.edgeType).toBe("connection");
      }

      // 2. Transformer Ref node -> Endpoint handle
      const res2 = isValidConnection("transformer_ref", "transformer-out", "service", "endpoint-in-ep1");
      expect(res2.valid).toBe(true);
      if (res2.valid) {
        expect(res2.edgeType).toBe("connection");
      }
    });

    it("compiles standalone local transformer with multiple target endpoint IDs", () => {
      const nodes: BackendNode[] = [
        {
          id: "service-1",
          type: "service",
          data: {
            label: "AuthService",
          },
          position: { x: 0, y: 0 },
          fractionalIndex: "a0",
        },
        {
          id: "trans-local-multi",
          type: "transformer",
          data: {
            label: "hashPassword",
            functionName: "hashPassword",
            scope: "local",
            targetServiceId: "service-1",
            targetEndpointIds: ["ep-register", "ep-reset-pw"],
            inputSchema: [{ id: "p3", name: "password", type: "string", required: true }],
            logicMode: "code",
            code: "return { hash: `hashed_${input.password}` };",
            returnSchema: [{ id: "r3", name: "hash", type: "string", required: true }],
          },
          position: { x: 400, y: 0 },
          fractionalIndex: "a1",
        },
      ];

      const result = compileTransformerHelpers(nodes);
      const localFile = result.files.find((f) => f.filename.includes("apps/authservice/src/transformers/hashPassword.ts"));
      expect(localFile).toBeDefined();
      expect(localFile?.content).toContain("export function hashPassword");
    });

    it("validates that transformer and transformer_ref nodes connect properly to consumedEvents-in handles", async () => {
      const { isValidConnection } = await import("@workspace/canvas");

      // 1. Transformer node -> Consumed Event handle
      const res1 = isValidConnection("transformer", "transformer-out", "service", "consumedEvents-in-ev1");
      expect(res1.valid).toBe(true);
      if (res1.valid) {
        expect(res1.edgeType).toBe("connection");
      }

      // 2. Transformer Ref node -> Consumed Event handle
      const res2 = isValidConnection("transformer_ref", "transformer-out", "service", "consumedEvents-in-ev1");
      expect(res2.valid).toBe(true);
      if (res2.valid) {
        expect(res2.edgeType).toBe("connection");
      }
    });

    it("compiles consumer handler with Step Pipeline and Transformer execution", () => {
      const consumedEvents: (AnyMessagingResource & {
        nodeId: string;
        variant: "publish" | "consume";
      })[] = [
        {
          id: "evt-order-created",
          name: "OrderCreated",
          nodeId: "service-1",
          variant: "consume",
          payloadSchema: {
            id: "ps1",
            rawJson: JSON.stringify({ orderId: "123", rawAmount: "100.50" }),
          },
          pipelineSteps: [
            {
              id: "step-1",
              name: "normalizeOrder",
              type: "transform" as const,
              enabled: true,
              functionRef: {
                name: "sanitizeOrderPayload",
                importPath: "../transformers/sanitizeOrderPayload",
                isGlobal: false,
              },
              inputBindings: [
                {
                  argName: "rawAmount",
                  source: {
                    kind: "req_body" as const,
                    field: "rawAmount",
                  },
                },
              ],
              outputVariable: "sanitizedOrder",
            },
          ],
        },
      ];

      const files = generateConsumers("OrderService", consumedEvents);
      const consumerFile = files.find((f) => f.filename === "src/consumer/orderCreated.ts");
      expect(consumerFile).toBeDefined();
      expect(consumerFile?.content).toContain("import { sanitizeOrderPayload } from \"../transformers/sanitizeOrderPayload\";");
      expect(consumerFile?.content).toContain("const sanitizedOrder = sanitizeOrderPayload(");
      expect(consumerFile?.content).toContain("rawAmount: validatedPayload.rawAmount");
    });
  });
});
