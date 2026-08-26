import { Router, type Router as ExpressRouter } from "express";
import { generateCacheConfig } from "../ai/cache-generator";
import { generateBusinessLogicCode } from "../ai/code-generator";

export const generatorsRouter: ExpressRouter = Router();

generatorsRouter.post("/generate-cache-config", async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) {
      res.status(400).json({ error: "Missing description" });
      return;
    }
    const config = await generateCacheConfig(description);
    res.json(config);
  } catch (error) {
    console.error("Generate cache config error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

generatorsRouter.post("/generate-code", async (req, res) => {
  try {
    const code = await generateBusinessLogicCode(req.body);
    res.json({ code });
  } catch (error) {
    console.error("Generate code error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate business logic code";
    res.status(500).json({ error: message });
  }
});
