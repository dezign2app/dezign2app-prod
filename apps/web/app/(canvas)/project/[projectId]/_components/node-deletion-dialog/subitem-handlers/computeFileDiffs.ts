import { CompiledFile } from "@workspace/canvas/types";
import { NodeDeletionDiffResult } from "@/lib/compiler/nodeDeletionDiff";
import { NodeArchitectureImpact } from "../types";

export function computeFileDiffs(
  filesBefore: CompiledFile[],
  filesAfter: CompiledFile[],
  targetNodes: NodeArchitectureImpact["targetNodes"],
): NodeDeletionDiffResult {
  const deletedFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const addedFiles: string[] = [];

  const beforeMap = new Map<string, string>();
  filesBefore.forEach((f) => beforeMap.set(f.filename, f.content));

  const afterMap = new Map<string, string>();
  filesAfter.forEach((f) => afterMap.set(f.filename, f.content));

  beforeMap.forEach((beforeContent, filename) => {
    if (!afterMap.has(filename)) {
      deletedFiles.push(filename);
    } else if (afterMap.get(filename) !== beforeContent) {
      modifiedFiles.push(filename);
    }
  });

  afterMap.forEach((_, filename) => {
    if (!beforeMap.has(filename)) {
      addedFiles.push(filename);
    }
  });

  return {
    deletedNodes: targetNodes.map((t) => ({
      id: t.id,
      label: t.label,
      type: t.type,
    })),
    deletedFiles,
    modifiedFiles,
    addedFiles,
    totalAffectedCount:
      deletedFiles.length + modifiedFiles.length + addedFiles.length,
    filesBefore,
    filesAfter,
  };
}
