import { RunnableConfig } from "@langchain/core/runnables";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { UiEditorState } from "./state";
import { formatComponentCatalog } from "./componentRegistry";
import { uiPlannerPrompt, uiCodeGeneratorPrompt, uiRepairPrompt } from "./prompts";
import { validateTsxCode } from "./validator";
import { SupportedChatModel } from "../llmFactory";

export function createUiEditorNodes(llm: SupportedChatModel) {
  /**
   * 1. Planner Node: Formulates the UI component hierarchy, layout, and state requirements.
   */
  const uiPlanner = async (state: UiEditorState, config?: RunnableConfig) => {
    console.log("[ui-agent:uiPlanner] Starting UI planning for prompt:", state.prompt);
    const start = Date.now();
    const catalog = state.componentCatalog || formatComponentCatalog();
    const promptText = uiPlannerPrompt(
      state.pageName || "Page",
      state.pageRoute || "/",
      state.prompt,
      state.currentCode || "",
      catalog,
      state.canvasEndpoints || "",
      state.chatHistory
    );

    const messages = [
      new SystemMessage(promptText),
      new HumanMessage(`User Request: ${state.prompt}`),
    ];

    try {
      const response = await llm.invoke(messages, config);
      const planContent = typeof response.content === "string" ? response.content : "";
      console.log(`[ui-agent:uiPlanner] Planning completed in ${Date.now() - start}ms. Plan length: ${planContent.length} chars`);

      return {
        plan: planContent,
        componentCatalog: catalog,
        messages: [new AIMessage({ content: `[UI Plan]\n${planContent}` })],
      };
    } catch (err) {
      const isAbort = (err instanceof Error && err.name === "AbortError") || config?.signal?.aborted;
      if (isAbort) {
        console.log("🛑 [ui-agent:uiPlanner] Aborted LLM invocation on user stop request.");
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ui-agent:uiPlanner] Error during LLM planning:", message);
      if (err instanceof Error && err.stack) console.error("[ui-agent:uiPlanner] Stack:", err.stack);
      throw err;
    }
  };

  /**
   * 2. Code Generator Node: Generates the full TSX Next.js page component.
   */
  const uiCodeGenerator = async (state: UiEditorState, config?: RunnableConfig) => {
    console.log("[ui-agent:uiCodeGenerator] Starting TSX code generation...");
    const start = Date.now();
    const catalog = state.componentCatalog || formatComponentCatalog();
    const promptText = uiCodeGeneratorPrompt(
      state.pageName || "Page",
      state.pageRoute || "/",
      state.prompt,
      state.currentCode || "",
      state.plan || "",
      catalog,
      state.canvasEndpoints || "",
      state.chatHistory
    );

    const messages = [
      new SystemMessage(promptText),
      new HumanMessage(`Generate the TSX code for: ${state.prompt}`),
    ];

    try {
      const response = await llm.invoke(messages, config);
      const rawContent = typeof response.content === "string" ? response.content : "";

      const cleanCode = rawContent
        .replace(/^```(tsx?|typescript|jsx?)?[\r\n]*/gi, "")
        .replace(/[\r\n]*```\s*$/g, "")
        .trim();

      console.log(`[ui-agent:uiCodeGenerator] Code generation completed in ${Date.now() - start}ms. Code length: ${cleanCode.length} chars`);

      return {
        generatedCode: rawContent,
        cleanCode,
        messages: [new AIMessage({ content: cleanCode })],
      };
    } catch (err) {
      const isAbort = (err instanceof Error && err.name === "AbortError") || config?.signal?.aborted;
      if (isAbort) {
        console.log("🛑 [ui-agent:uiCodeGenerator] Aborted TSX generation on user stop request.");
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ui-agent:uiCodeGenerator] Error during TSX generation:", message);
      if (err instanceof Error && err.stack) console.error("[ui-agent:uiCodeGenerator] Stack:", err.stack);
      throw err;
    }
  };

  /**
   * 3. Validator Node: Static syntax and import validation.
   */
  const uiValidator = async (state: UiEditorState) => {
    const codeToValidate = state.cleanCode || state.generatedCode || "";
    console.log(`[ui-agent:uiValidator] Validating TSX structure (length: ${codeToValidate.length} chars)...`);
    const result = validateTsxCode(codeToValidate);
    console.log(`[ui-agent:uiValidator] Validation result: isValid=${result.isValid}, errorsCount=${result.errors.length}`);
    if (!result.isValid) {
      console.warn("[ui-agent:uiValidator] Errors to repair:", result.errors);
    }

    return {
      validationStatus: result.isValid ? ("valid" as const) : ("invalid" as const),
      validationErrors: result.errors,
    };
  };

  /**
   * 4. Repair Node: Self-correction loop if code has syntax/import errors.
   */
  const uiRepair = async (state: UiEditorState, config?: RunnableConfig) => {
    console.log("[ui-agent:uiRepair] Attempting self-correction for validation errors:", state.validationErrors);
    const start = Date.now();
    const catalog = state.componentCatalog || formatComponentCatalog();
    const promptText = uiRepairPrompt(
      state.cleanCode || state.generatedCode || "",
      state.validationErrors,
      catalog
    );

    const messages = [
      new SystemMessage(promptText),
      new HumanMessage("Fix the validation errors in the code above and return the corrected TSX."),
    ];

    try {
      const response = await llm.invoke(messages, config);
      const rawContent = typeof response.content === "string" ? response.content : "";

      const cleanCode = rawContent
        .replace(/^```(tsx?|typescript|jsx?)?[\r\n]*/gi, "")
        .replace(/[\r\n]*```\s*$/g, "")
        .trim();

      console.log(`[ui-agent:uiRepair] Repair completed in ${Date.now() - start}ms. Clean code length: ${cleanCode.length} chars`);

      return {
        generatedCode: rawContent,
        cleanCode,
        retryCount: 1, // incremented via reducer (x, y) => x + y
        messages: [new AIMessage({ content: cleanCode })],
      };
    } catch (err) {
      const isAbort = (err instanceof Error && err.name === "AbortError") || config?.signal?.aborted;
      if (isAbort) {
        console.log("🛑 [ui-agent:uiRepair] Aborted TSX repair on user stop request.");
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ui-agent:uiRepair] Error during TSX repair:", message);
      if (err instanceof Error && err.stack) console.error("[ui-agent:uiRepair] Stack:", err.stack);
      throw err;
    }
  };

  return {
    uiPlanner,
    uiCodeGenerator,
    uiValidator,
    uiRepair,
  };
}
