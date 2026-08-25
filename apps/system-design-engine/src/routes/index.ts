import { Router, type Router as ExpressRouter } from "express";
import { canvasAiRouter } from "./canvas-ai";
import { pageEditorRouter } from "./page-editor";
import { generatorsRouter } from "./generators";
import { mcpRouter } from "./mcp";

export const routes: ExpressRouter = Router();

routes.use("/canvas-ai", canvasAiRouter);
routes.use("/page-editor", pageEditorRouter);
routes.use("/mcp", mcpRouter);
routes.use(generatorsRouter);
