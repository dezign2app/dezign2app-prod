import { CompiledFile } from "@workspace/canvas/types";

export function generateAuthTypesModule(): { file: CompiledFile; exportStatement: string } {
  const content = `/**
 * Shared Authentication & User Identity Types
 */
export interface AuthUser {
  id: string;
  userId: string;
  username: string;
  role: string;
  email?: string;
  name?: string;
  sessionToken?: string;
  expiresAt?: number;
  [key: string]: string | number | boolean | null | undefined;
}
`;

  return {
    file: {
      filename: "src/auth.ts",
      language: "typescript",
      content,
    },
    exportStatement: `export * from "./auth";`,
  };
}
