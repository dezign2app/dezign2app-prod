import type { Parameter } from "@/types/canvas";

export type SchemaFieldInput = {
  id?: string;
  name: string;
  type?: string;
  required?: boolean;
  isArray?: boolean;
  description?: string;
};

export interface InferredFieldDraft {
  name: string;
  type: string;
  isArray?: boolean;
  required?: boolean;
  nestedFields?: InferredFieldDraft[];
}

export interface AggregatedField {
  name: string;
  branchCount: number;
  types: Set<string>;
  isArray: boolean;
  hasExplicitOptional?: boolean;
  nestedBranches?: InferredFieldDraft[][];
}

export type { Parameter };
