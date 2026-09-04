import { describe, it, expect } from "vitest";
import {
  parseRelaxedJson,
  compileTemplateString,
  compileJsonExpression,
} from "../generators/routeGenerator/jsonInterpolation";
import { renderPipeline } from "../generators/routeGenerator/pipelineRenderer";
import { PipelineStep } from "@workspace/canvas/types";

describe("Inline Template Bindings & Relaxed JSON Compilation", () => {
  describe("parseRelaxedJson", () => {
    it("parses valid standard JSON", () => {
      const input = '{"name": "hello", "count": 42, "active": true}';
      const { data, error } = parseRelaxedJson(input);
      expect(error).toBeNull();
      expect(data).toEqual({ name: "hello", count: 42, active: true });
    });

    it("parses relaxed JSON with unquoted keys and single quotes", () => {
      const input = `{
        name: 'test-user',
        role: 'admin',
        enabled: true
      }`;
      const { data, error } = parseRelaxedJson(input);
      expect(error).toBeNull();
      expect(data).toEqual({ name: "test-user", role: "admin", enabled: true });
    });

    it("parses relaxed JSON with template backticks and dynamic variables", () => {
      const input = `{
        name: \`demo \${body.query}\`,
        prompt: \`Instructions: Answer accurately.\\nQuery: \${body.question}\`
      }`;
      const { data, error } = parseRelaxedJson(input);
      expect(error).toBeNull();
      expect(data).toEqual({
        name: "demo ${body.query}",
        prompt: "Instructions: Answer accurately.\\nQuery: ${body.question}",
      });
    });

    it("handles trailing commas in relaxed JSON", () => {
      const input = `{
        id: 1,
        items: [10, 20, 30,],
      }`;
      const { data, error } = parseRelaxedJson(input);
      expect(error).toBeNull();
      expect(data).toEqual({ id: 1, items: [10, 20, 30] });
    });
  });

  describe("compileTemplateString", () => {
    it("compiles AI prompt with predefined instructions and dynamic query", () => {
      const prompt = "You are a helpful assistant.\nUser Query: ${body.query}";
      const compiled = compileTemplateString(prompt);
      expect(compiled).toBe("`You are a helpful assistant.\nUser Query: ${body.query}`");
    });

    it("compiles headers with template values (e.g. Bearer token)", () => {
      const authHeader = "Bearer ${headers.token}";
      const compiled = compileTemplateString(authHeader);
      expect(compiled).toBe("`Bearer ${(req.headers[\"token\"] as string)}`");
    });

    it("handles step outputs and request params in templates", () => {
      const template = "User ${params.userId} generated doc: ${generateDocResult.docId}";
      const compiled = compileTemplateString(template);
      expect(compiled).toBe("`User ${req.params.userId} generated doc: ${generateDocResult.docId}`");
    });
  });

  describe("compileJsonExpression", () => {
    it("compiles relaxed JSON with backtick variable interpolation into JS object string", () => {
      const input = `{
        name: \`demo \${body.query}\`,
        age: 25
      }`;
      const compiled = compileJsonExpression(input);
      expect(compiled).toContain("name: `demo ${body.query}`");
      expect(compiled).toContain("age: 25");
    });

    it("compiles nested objects with dynamic template values", () => {
      const input = `{
        config: {
          model: "gpt-4o",
          systemPrompt: \`You are an assistant for \${body.company}\`
        }
      }`;
      const compiled = compileJsonExpression(input);
      expect(compiled).toContain('model: "gpt-4o"');
      expect(compiled).toContain("systemPrompt: `You are an assistant for ${body.company}`");
    });
  });

  describe("renderPipeline with inline bindings", () => {
    it("renders pipeline steps with pure inline literals and inline template strings", () => {
      const steps: PipelineStep[] = [
        {
          id: "step-ai",
          name: "Call OpenAI Service",
          type: "service_call",
          enabled: true,
          functionRef: {
            name: "generateCompletion",
            importPath: "@workspace/ai/openai",
          },
          inputBindings: [
            {
              argName: "model",
              source: {
                kind: "inline",
                value: "gpt-4o",
              },
            },
            {
              argName: "prompt",
              source: {
                kind: "inline",
                value: "You are a customer support AI.\\nAnswer the following question: ${body.query}",
              },
            },
            {
              argName: "apiKey",
              source: {
                kind: "inline",
                value: "Bearer ${headers.authorization}",
              },
            },
          ],
          outputVariable: "aiResponse",
        },
      ];

      const lines = renderPipeline(steps, "body");
      const code = lines.join("\n");

      // Pure literal model
      expect(code).toContain('"gpt-4o"');
      // AI prompt template with dynamic body.query
      expect(code).toContain("`You are a customer support AI.\\\\nAnswer the following question: ${body.query}`");
      // Header template with Bearer token
      expect(code).toContain("`Bearer ${(req.headers[\"authorization\"] as string)}`");
      // Step function call
      expect(code).toContain("const aiResponse = await generateCompletion(");
    });

    it("renders pipeline steps with inline JSON tab object containing backticks and dynamic variables", () => {
      const steps: PipelineStep[] = [
        {
          id: "step-external",
          name: "Send Webhook",
          type: "external_call",
          enabled: true,
          functionRef: {
            name: "postWebhook",
            importPath: "@workspace/integrations/webhook",
          },
          inputBindings: [
            {
              argName: "payload",
              source: {
                kind: "inline",
                value: "{\n  name: `demo ${body.query}`,\n  status: \"queued\"\n}",
              },
            },
          ],
          outputVariable: "webhookResult",
        },
      ];

      const lines = renderPipeline(steps, "body");
      const code = lines.join("\n");

      expect(code).toContain("const webhookResult = await postWebhook(");
      expect(code).toContain("name: `demo ${body.query}`");
      expect(code).toContain('status: "queued"');
    });
  });
});
