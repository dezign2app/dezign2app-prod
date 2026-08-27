import { describe, it, expect } from "vitest";
import {
  computeDiffHunks,
  applySelectedHunks,
} from "../../../app/(canvas)/project/[projectId]/_components/config-sidebar/diffMergeUtils";

describe("diffMergeUtils", () => {
  it("detects no mismatch when strings are identical", () => {
    const code = `import React from "react";\n\nexport default function Page() {\n  return <div>Hello World</div>;\n}`;
    const diff = computeDiffHunks(code, code);
    expect(diff.hasMismatch).toBe(false);
    expect(diff.totalHunks).toBe(0);
    expect(diff.hunks).toHaveLength(0);
  });

  it("detects addition hunks correctly", () => {
    const original = `import React from "react";\n\nexport default function Page() {\n  return <div>Hello</div>;\n}`;
    const modified = `import React from "react";\nimport { Button } from "@/components/ui/button";\n\nexport default function Page() {\n  return <div>Hello</div>;\n}`;

    const diff = computeDiffHunks(original, modified);
    expect(diff.hasMismatch).toBe(true);
    expect(diff.totalHunks).toBe(1);
    expect(diff.hunks[0]!.type).toBe("add");
    expect(diff.hunks[0]!.modifiedLines).toContain('import { Button } from "@/components/ui/button";');
  });

  it("detects deletion hunks correctly", () => {
    const original = `import React from "react";\nimport { Button } from "@/components/ui/button";\n\nexport default function Page() {\n  return <div>Hello</div>;\n}`;
    const modified = `import React from "react";\n\nexport default function Page() {\n  return <div>Hello</div>;\n}`;

    const diff = computeDiffHunks(original, modified);
    expect(diff.hasMismatch).toBe(true);
    expect(diff.totalHunks).toBe(1);
    expect(diff.hunks[0]!.type).toBe("delete");
    expect(diff.hunks[0]!.originalLines).toContain('import { Button } from "@/components/ui/button";');
  });

  it("detects modification hunks correctly", () => {
    const original = `export function computeTotal() {\n  return 10;\n}`;
    const modified = `export function computeTotal() {\n  const tax = 0.05;\n  return 10 * (1 + tax);\n}`;

    const diff = computeDiffHunks(original, modified);
    expect(diff.hasMismatch).toBe(true);
    expect(diff.totalHunks).toBe(1);
    expect(diff.hunks[0]!.type).toBe("modify");
  });

  it("supports selective merging of specific hunks", () => {
    const original = [
      'import React from "react";',
      "",
      "export default function Page() {",
      "  const title = 'Old Title';",
      "  const count = 0;",
      "  return (",
      "    <div>",
      "      <h1>{title}</h1>",
      "      <p>Count: {count}</p>",
      "    </div>",
      "  );",
      "}",
    ].join("\n");

    const modified = [
      'import React from "react";',
      'import { useState } from "react";', // Hunk 1: added import
      "",
      "export default function Page() {",
      "  const title = 'New Dynamic Title';", // Hunk 2: modified title
      "  const [count, setCount] = useState(0);", // Hunk 3: modified count
      "  return (",
      "    <div>",
      "      <h1>{title}</h1>",
      "      <p>Count: {count}</p>",
      "      <button onClick={() => setCount(c => c + 1)}>Increment</button>", // Hunk 4: added button
      "    </div>",
      "  );",
      "}",
    ].join("\n");

    const diff = computeDiffHunks(original, modified);
    expect(diff.totalHunks).toBeGreaterThanOrEqual(3);

    // Apply only Hunk 1 (the import)
    const hunk1 = diff.hunks[0]!;
    const mergedPartial = applySelectedHunks(original, diff.hunks, [hunk1.id]);
    expect(mergedPartial).toContain('import { useState } from "react";');
    expect(mergedPartial).toContain("const title = 'Old Title';");

    // Apply all hunks
    const allHunkIds = diff.hunks.map((h) => h.id);
    const mergedAll = applySelectedHunks(original, diff.hunks, allHunkIds);
    expect(mergedAll.trim()).toEqual(modified.trim());
  });
});
