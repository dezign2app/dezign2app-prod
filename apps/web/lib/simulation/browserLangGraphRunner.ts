/**
 * Browser LangGraph Runner
 *
 * Modularized into:
 * - ./browser-runner/types.ts: Browser runner execution, message, and stream interfaces
 * - ./browser-runner/state.ts: State cloning, prompt interpolation, reducers & built-in actions
 * - ./browser-runner/llm.ts: Multi-provider browser LLM calling (Groq, OpenAI, Anthropic, Custom) with streaming
 * - ./browser-runner/edgeResolver.ts: Edge filtering, loop proxy reference resolution, and router target determination
 * - ./browser-runner/agentExecutor.ts: Agent & component node execution with structured outputs and state updates
 * - ./browser-runner/stepExecutor.ts: Step node execution (LLM calls, tool invocation, custom code, router, human gate)
 * - ./browser-runner/index.ts: Main browser execution orchestration runtime
 */

export * from "./browser-runner";
