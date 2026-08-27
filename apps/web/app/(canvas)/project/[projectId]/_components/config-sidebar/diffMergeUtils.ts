/**
 * Line-based diff and selective merge utilities for comparing Server (Original)
 * vs Local Disk (Modified) page source code.
 */

export interface DiffHunk {
  id: string;
  type: "add" | "delete" | "modify";
  originalStartLine: number; // 1-based line number in original
  originalLineCount: number;
  originalLines: string[];
  modifiedStartLine: number; // 1-based line number in modified
  modifiedLineCount: number;
  modifiedLines: string[];
  summary: string;
}

export interface DiffSummary {
  hasMismatch: boolean;
  totalHunks: number;
  addedLines: number;
  deletedLines: number;
  modifiedLines: number;
  hunks: DiffHunk[];
}

/**
 * Standard Longest Common Subsequence (LCS) matrix computation for arrays of lines.
 */
function computeLcsMatrix(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  return dp;
}

interface RawDiffOp {
  type: "equal" | "delete" | "add";
  originalIndex?: number;
  modifiedIndex?: number;
  line: string;
}

/**
 * Backtrack through the LCS matrix to produce a sequence of diff operations.
 */
function backtrackLcs(a: string[], b: string[], dp: number[][]): RawDiffOp[] {
  let i = a.length;
  let j = b.length;
  const ops: RawDiffOp[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({
        type: "equal",
        originalIndex: i - 1,
        modifiedIndex: j - 1,
        line: a[i - 1]!,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.unshift({
        type: "add",
        modifiedIndex: j - 1,
        line: b[j - 1]!,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i]![j - 1]! < dp[i - 1]![j]!)) {
      ops.unshift({
        type: "delete",
        originalIndex: i - 1,
        line: a[i - 1]!,
      });
      i--;
    }
  }

  return ops;
}

/**
 * Parses differences between original (Server) and modified (Local disk) code
 * into structured, independent change hunks.
 */
export function computeDiffHunks(originalCode: string, modifiedCode: string): DiffSummary {
  const origLines = originalCode.replace(/\r\n/g, "\n").split("\n");
  const modLines = modifiedCode.replace(/\r\n/g, "\n").split("\n");

  // Fast path for identical content
  if (originalCode.trim() === modifiedCode.trim() && origLines.join("\n") === modLines.join("\n")) {
    return {
      hasMismatch: false,
      totalHunks: 0,
      addedLines: 0,
      deletedLines: 0,
      modifiedLines: 0,
      hunks: [],
    };
  }

  const dp = computeLcsMatrix(origLines, modLines);
  const rawOps = backtrackLcs(origLines, modLines, dp);

  const hunks: DiffHunk[] = [];
  let hunkCounter = 1;

  let k = 0;
  let origLineNum = 1;
  let modLineNum = 1;

  let totalAdded = 0;
  let totalDeleted = 0;
  let totalModified = 0;

  while (k < rawOps.length) {
    const op = rawOps[k]!;

    if (op.type === "equal") {
      origLineNum++;
      modLineNum++;
      k++;
      continue;
    }

    // Collect contiguous group of adds and deletes
    const chunkOrigLines: string[] = [];
    const chunkModLines: string[] = [];
    const hunkOrigStart = origLineNum;
    const hunkModStart = modLineNum;

    while (k < rawOps.length && rawOps[k]!.type !== "equal") {
      const current = rawOps[k]!;
      if (current.type === "delete") {
        chunkOrigLines.push(current.line);
        origLineNum++;
      } else if (current.type === "add") {
        chunkModLines.push(current.line);
        modLineNum++;
      }
      k++;
    }

    let hunkType: "add" | "delete" | "modify" = "modify";
    if (chunkOrigLines.length === 0 && chunkModLines.length > 0) {
      hunkType = "add";
      totalAdded += chunkModLines.length;
    } else if (chunkModLines.length === 0 && chunkOrigLines.length > 0) {
      hunkType = "delete";
      totalDeleted += chunkOrigLines.length;
    } else {
      hunkType = "modify";
      totalModified += Math.max(chunkOrigLines.length, chunkModLines.length);
    }

    let summary = "";
    if (hunkType === "add") {
      summary = `Added ${chunkModLines.length} line${chunkModLines.length === 1 ? "" : "s"} at line ${hunkOrigStart}`;
    } else if (hunkType === "delete") {
      summary = `Deleted ${chunkOrigLines.length} line${chunkOrigLines.length === 1 ? "" : "s"} at line ${hunkOrigStart}`;
    } else {
      summary = `Modified lines ${hunkOrigStart}–${hunkOrigStart + Math.max(0, chunkOrigLines.length - 1)} (${chunkOrigLines.length} deleted, ${chunkModLines.length} added)`;
    }

    hunks.push({
      id: `hunk-${hunkCounter++}`,
      type: hunkType,
      originalStartLine: hunkOrigStart,
      originalLineCount: chunkOrigLines.length,
      originalLines: chunkOrigLines,
      modifiedStartLine: hunkModStart,
      modifiedLineCount: chunkModLines.length,
      modifiedLines: chunkModLines,
      summary,
    });
  }

  return {
    hasMismatch: hunks.length > 0,
    totalHunks: hunks.length,
    addedLines: totalAdded,
    deletedLines: totalDeleted,
    modifiedLines: totalModified,
    hunks,
  };
}

/**
 * Selectively applies a set of chosen hunk IDs from `hunks` onto the `originalCode`.
 * Any hunk whose ID is NOT in `selectedHunkIds` will retain its original content.
 * Any hunk whose ID IS in `selectedHunkIds` will take the modified content.
 *
 * Returns the merged source code.
 */
export function applySelectedHunks(
  originalCode: string,
  hunks: DiffHunk[],
  selectedHunkIds: Set<string> | string[],
): string {
  const origLines = originalCode.replace(/\r\n/g, "\n").split("\n");
  const selectedSet = selectedHunkIds instanceof Set ? selectedHunkIds : new Set(selectedHunkIds);

  if (selectedSet.size === 0) {
    return originalCode;
  }

  const resultLines: string[] = [];
  let currentOrigIndex = 0; // 0-based

  for (const hunk of hunks) {
    const hunkOrigStartIndex = hunk.originalStartLine - 1; // 0-based

    // Add unchanged lines prior to this hunk
    while (currentOrigIndex < hunkOrigStartIndex && currentOrigIndex < origLines.length) {
      resultLines.push(origLines[currentOrigIndex]!);
      currentOrigIndex++;
    }

    if (selectedSet.has(hunk.id)) {
      // Apply the modified lines for this hunk
      resultLines.push(...hunk.modifiedLines);
      // Skip the original lines that were replaced/deleted
      currentOrigIndex += hunk.originalLineCount;
    } else {
      // Keep original lines
      for (let i = 0; i < hunk.originalLineCount && currentOrigIndex < origLines.length; i++) {
        resultLines.push(origLines[currentOrigIndex]!);
        currentOrigIndex++;
      }
    }
  }

  // Append any remaining lines after the last hunk
  while (currentOrigIndex < origLines.length) {
    resultLines.push(origLines[currentOrigIndex]!);
    currentOrigIndex++;
  }

  return resultLines.join("\n");
}
