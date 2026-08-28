/**
 * Prompts for the UI Editor LangGraph Agent
 */

function formatChatHistory(history?: Array<{ role: string; content: string }>): string {
  if (!history || history.length === 0) return "";
  const lines = history
    .slice(-8)
    .map((m) => `- **${m.role.toUpperCase()}**: ${m.content}`)
    .join("\n");
  return `### Recent Conversation History (Iterative Context):\n${lines}\n\n`;
}

export const uiPlannerPrompt = (
  pageName: string,
  pageRoute: string,
  userPrompt: string,
  currentCode: string,
  componentCatalog: string,
  canvasEndpoints: string,
  chatHistory?: Array<{ role: string; content: string }>
) => {
  const historySection = formatChatHistory(chatHistory);
  return `You are a Principal Frontend Architect and UI Designer planning a Next.js page implementation.

### Task
Analyze the user's requirements and create a concise architectural plan for the Next.js page component.

Page Name: "${pageName}"
Page Route: "${pageRoute}"
User Instruction: "${userPrompt}"

${historySection}${currentCode && currentCode.trim().length > 0 ? `### Existing Page Code:\n\`\`\`tsx\n${currentCode.slice(0, 12000)}\n\`\`\`\n**IMPORTANT**: Carefully analyze the existing components, state variables, tabs, metrics, dialogs, and styling above. You must iterate on and enhance this existing code according to the user instruction, preserving all working functionality unless explicitly requested to change.\n` : "### No Existing Code: Creating new page scaffold from scratch.\n"}

${canvasEndpoints ? `### Connected Canvas Backend Endpoints:\n${canvasEndpoints}\n` : ""}

${componentCatalog}

### Output Instructions
Produce a structured, concise bullet-point plan covering:
1. **Layout & Hierarchy**: Header, main container grid/flex, responsive breakpoints (mobile/tablet/desktop).
2. **Components to Import**: Specific @workspace/ui components and Lucide icons needed.
3. **State & Interactions**: React state (search, filters, pagination, dialog open/close, active tabs) and handlers.
4. **Data Model & Backend Integration**: TypeScript types, realistic mock data or fetch calls matching connected endpoints.

Keep your response concise and focused on the technical architecture.`;
};

export const uiCodeGeneratorPrompt = (
  pageName: string,
  pageRoute: string,
  userPrompt: string,
  currentCode: string,
  plan: string,
  componentCatalog: string,
  canvasEndpoints: string,
  chatHistory?: Array<{ role: string; content: string }>
) => {
  const historySection = formatChatHistory(chatHistory);
  return `You are an expert Next.js (App Router), React 19, TypeScript, and Tailwind CSS v4 UI engineer.

### Task
Generate the COMPLETE, production-ready TSX page component based on the architectural plan and user instructions.

Page Route: "${pageRoute}" (${pageName})
User Instruction: "${userPrompt}"

${historySection}### Architectural Plan:
${plan}

${currentCode && currentCode.trim().length > 0 ? `### Existing Code to Modify & Enhance:
\`\`\`tsx
${currentCode}
\`\`\`

**CRITICAL INSTRUCTION**:
- The code above is the CURRENT WORKING IMPLEMENTATION of the page.
- Preserve all existing state, handlers, data structures, UI sections, tabs, metrics, and styling unless the user explicitly requested to remove or modify them.
- Apply the user's requested changes, additions, and enhancements directly on top of this existing code.
` : ""}

${canvasEndpoints ? `### Canvas Backend Endpoints & Data Contracts:\n${canvasEndpoints}\n` : ""}

${componentCatalog}

### Strict Implementation Rules:
1. **Output Format**: Output ONLY the complete, executable TSX code. Do NOT wrap in markdown fences (\`\`\`tsx). Do NOT include conversational preamble or explanation.
2. **Directives**: Include \`"use client";\` at the very top of the file if using React hooks (\`useState\`, \`useEffect\`, etc.) or event handlers.
3. **Imports**:
   - Import UI components from \`@workspace/ui/components/<component-name>\` (e.g. \`import { Button } from "@workspace/ui/components/button";\`).
   - Import \`cn\` from \`@workspace/ui/lib/utils\`.
   - Import icons from \`lucide-react\` (e.g. \`import { Search, Plus, Trash, ArrowUpRight, TrendingUp, Sparkles, Filter } from "lucide-react";\`).
4. **Design Quality & Aesthetics**:
   - Modern, sleek, state-of-the-art UI with responsive flex/grid layouts, clean spacing (\`p-6\`, \`gap-4\`, \`space-y-6\`).
   - Use semantic Tailwind tokens (\`bg-background\`, \`text-foreground\`, \`bg-card\`, \`border-border\`, \`text-muted-foreground\`, \`bg-primary\`, \`text-primary-foreground\`).
   - Include delightful micro-interactions, hover effects (\`transition-all hover:shadow-md\`), and realistic mock data.
5. **Robustness**:
   - Full TypeScript types for all data objects, props, and states.
   - Self-contained and error-free: all sub-components, helper functions, and states must be defined.
   - The default export must be a valid React page component.`;
};

export const uiRepairPrompt = (
  originalCode: string,
  validationErrors: string[],
  componentCatalog: string
) => {
  return `You are an expert TypeScript & Next.js code repair agent.

The following TSX code was generated but contains syntax, import, or JSX validation errors:

### Validation Errors:
${validationErrors.map((e) => `- ${e}`).join("\n")}

${componentCatalog}

### Broken Code:
${originalCode}

### Task:
Fix all reported errors while preserving the complete UI layout, functionality, and styling.
Output ONLY the repaired, valid TSX file content with NO markdown fences and NO commentary.`;
};
