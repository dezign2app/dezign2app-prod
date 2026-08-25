import { Router, type Router as ExpressRouter } from "express";
import { ChatGroq } from "@langchain/groq";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/backend/_generated/api";

export const pageEditorRouter: ExpressRouter = Router();

/**
 * POST /page-editor
 *
 * Streams AI-generated TSX edits for a WebClient page node.
 * 1. Reads the current pageSourceCode + user prompt from the request body.
 * 2. Streams new TSX tokens back to the client (NDJSON).
 * 3. On completion, patches node.data.pageSourceCode in Convex and clears aiEditing.
 */
pageEditorRouter.post("/", async (req, res) => {
  try {
    const {
      nodeId,
      projectId,
      currentCode,
      prompt,
      pageName,
      convexUrl: bodyConvexUrl,
      token,
    } = req.body as {
      nodeId: string;
      projectId: string;
      currentCode?: string;
      prompt: string;
      pageName?: string;
      convexUrl?: string;
      token?: string;
    };

    if (!nodeId || !projectId || !prompt) {
      res.status(400).json({ error: "Missing required fields: nodeId, projectId, prompt" });
      return;
    }

    const convexUrl = bodyConvexUrl || process.env.CONVEX_URL;
    if (!convexUrl) {
      res.status(500).json({ error: "Missing CONVEX_URL" });
      return;
    }

    const client = new ConvexHttpClient(convexUrl);
    if (token && typeof token === "string" && token.includes(".") && !token.startsWith("sk_")) {
      client.setAuth(token);
    }

    const apiKeyStr = process.env.GROQ_API_KEY || "";
    const apiKeys = apiKeyStr.split(",").map((k) => k.trim()).filter(Boolean);
    const model = process.env.GROQ_LLM_MODEL || "openai/gpt-oss-120b";

    const systemPrompt = new SystemMessage(`You are an expert Next.js + Tailwind CSS UI developer.
Your task is to modify or generate a complete Next.js page component (TypeScript TSX) based on the user's instructions.

Rules:
- Output ONLY the complete, valid TSX file content — no markdown fences, no explanation.
- Preserve all existing imports, "use client" directive, state variables, useEffect hooks, and API call logic unless explicitly asked to change them.
- Only modify the JSX/UI layout and styling (className strings, component structure).
- Use Tailwind CSS classes for all styling.
- Keep the component name unchanged.
- The file must be a complete, valid Next.js page component that can run as-is.
${currentCode ? `\nCurrent page code:\n${currentCode}` : "\nNo existing code — generate a well-structured page scaffold."}`);

    const humanPrompt = new HumanMessage(
      `Page: ${pageName || nodeId}\n\nUser instruction: ${prompt}`
    );

    // Set streaming headers
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let generatedCode = "";
    let success = false;

    for (const apiKey of apiKeys) {
      if (success) break;
      try {
        const llm = new ChatGroq({ apiKey, model, temperature: 0.2, maxTokens: 4000, streaming: true });
        const stream = await llm.stream([systemPrompt, humanPrompt]);

        for await (const chunk of stream) {
          const text = typeof chunk.content === "string" ? chunk.content : "";
          if (text) {
            generatedCode += text;
            res.write(JSON.stringify({ type: "token", content: text }) + "\n");
          }
        }
        success = true;
      } catch (err) {
        console.warn(`[page-editor] Model ${model} failed:`, err);
      }
    }

    if (!success || !generatedCode.trim()) {
      res.write(JSON.stringify({ type: "error", message: "AI generation failed" }) + "\n");
      res.end();
      // Clear aiEditing flag even on failure
      try {
        await client.mutation(api.canvas.patchNodeData, {
          projectId: projectId as any,
          nodeId,
          patch: { aiEditing: false },
        });
      } catch (e) { /* best effort */ }
      return;
    }

    // Strip markdown fences if model wrapped output
    const cleanCode = generatedCode
      .replace(/^```(tsx?|typescript|jsx?)?[\r\n]*/gi, "")
      .replace(/[\r\n]*```\s*$/g, "")
      .trim();

    // Save to Convex — this syncs to all collaborators in real-time
    await client.mutation(api.canvas.patchNodeData, {
      projectId: projectId as any,
      nodeId,
      patch: {
        pageSourceCode: cleanCode,
        aiEditing: false,
      },
    });

    res.write(JSON.stringify({ type: "done", code: cleanCode }) + "\n");
    res.end();
  } catch (error: any) {
    console.error("[page-editor] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || "Internal Server Error" });
    } else {
      res.write(JSON.stringify({ type: "error", message: error?.message || "Internal Server Error" }) + "\n");
      res.end();
    }
  }
});
