/**
 * Regeneration helper - runs in dezign2app, writes the fixed store to the test repo.
 * pnpm --filter web test regenerateTestConversationStore
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { generateZustandStore } from "../webClients/nextjs/v16/storeGenerators";
import type { GlobalStoreDefinition } from "@workspace/canvas/types";

const TARGET_PATH = path.resolve("H:/subhash/test/apps/web/lib/stores/useConversationStore.ts");

describe("regenerateTestConversationStore", () => {
  it("generates a type-safe useConversationStore.ts and writes it to the test repo", () => {
    const storeDef: GlobalStoreDefinition = {
      id: "store-conversations",
      name: "Conversation",
      storage: "memory",
      scope: "global",
      fields: [
        { id: "f-messages", name: "messages", type: "Message[]", defaultValue: [] },
        { id: "f-conversations", name: "conversations", type: "Conversation[]", defaultValue: [] },
      ],
      actions: [
        {
          id: "a-append",
          name: "appendConversations",
          targetFieldId: "f-conversations",
          actionType: "append",
          code: '// Direct state merge\nset((s) => ({ ...s, ...(payload && typeof payload === "object" ? payload : {}) }));',
        },
        {
          id: "a-update",
          name: "updateConversations",
          targetFieldId: "f-conversations",
          actionType: "increment",
          code: "// Map array item by id\nset((s) => ({\n  items: (s.items || []).map((item) => item.id === payload.id ? { ...item, ...payload } : item)\n}));",
        },
      ],
    };

    const compiled = generateZustandStore(storeDef);
    if (fs.existsSync(path.dirname(TARGET_PATH))) {
      fs.writeFileSync(TARGET_PATH, compiled.content, "utf-8");
      console.log("Wrote:", TARGET_PATH);
    }

    expect(compiled.content).toContain("updateConversations: (payload)");
    expect(compiled.content).toContain("s.conversations");
    expect(compiled.content).not.toContain("s.items");
    expect(compiled.content).toContain("payload?.id");
    expect(compiled.content).toContain("payload ?? {}");
    expect(compiled.content).not.toContain("const payload = amount");
  });
});
