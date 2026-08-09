import { BetterAuthV16NodeData } from "../types";

/**
 * Generates `src/app/api/auth/[...all]/route.ts` for Next.js App Router integration
 */
export function generateNextJsRouteHandler(data: BetterAuthV16NodeData): string {
  return `import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
`;
}
