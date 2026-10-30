import { describe, it, expect } from "vitest";
import { compileWebPageNodes } from "../compileWebPageNode";
import { BackendNode } from "@/types/canvas";

describe("Chat component binding compilation (shadcn AI Elements)", () => {
  it("compiles a WebPageNode with chat component binding into Next.js 16 page with @workspace/ui Chat component", () => {
    const webPageNode: BackendNode = {
      id: "node-page-ai-chat",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/assistant",
        path: "/assistant",
        appSlug: "web",
        sections: [
          {
            id: "sec-chat",
            name: "Assistant Thread",
            renderMode: "client",
            loadStrategy: "eager",
            actions: [
              {
                id: "act-send",
                name: "onSendMessage",
                event: "submit",
                description: "Dispatches user query to LLM endpoint",
              },
            ],
            states: [
              {
                id: "st-messages",
                name: "messages",
                type: "array",
                defaultValue: [],
                description: "Active message history",
              },
            ],
            componentBindings: [
              {
                id: "comp-ai-chat",
                name: "AIChat",
                componentType: "chat",
                label: "AI Chat Thread",
                variant: "default",
                actionId: "act-send",
                actionName: "onSendMessage",
                triggerEvent: "submit",
                valueStateName: "messages",
                valueSourceType: "local",
                propMappings: {
                  chatTitle: "AI Support Agent",
                  chatPlaceholder: "Ask anything about your project...",
                  chatAutoScroll: true,
                  chatShowScrollButton: true,
                  chatEmptyTitle: "Welcome to AI Support",
                  chatEmptyDescription: "Type your query below to start.",
                  chatShowAvatars: true,
                },
              },
            ],
          },
        ],
      },
    };

    const result = compileWebPageNodes([webPageNode], [], [], [webPageNode], []);

    // Verify section component file is generated
    const sectionFile = result.files.find(
      (f) => f.filename.includes("Section.tsx") || f.filename.includes("Thread"),
    );
    expect(sectionFile).toBeDefined();

    const code = sectionFile!.content;

    // 1. Verify import of Chat from @workspace/ui/components/chat
    expect(code).toContain('import { Chat } from "@workspace/ui/components/chat";');

    // 2. Verify Chat element rendering with props
    expect(code).toContain('<Chat');
    expect(code).toContain('title="AI Support Agent"');
    expect(code).toContain('placeholder="Ask anything about your project..."');
    expect(code).toContain('emptyTitle="Welcome to AI Support"');
    expect(code).toContain('emptyDescription="Type your query below to start."');
    expect(code).toContain('autoScroll={true}');
    expect(code).toContain('showAvatars={true}');

    // 3. Verify messages binding to state
    expect(code).toContain('messages={Array.isArray(messages) ? messages : undefined}');

    // 4. Verify onSendMessage handler dispatching onTrigger
    expect(code).toContain('onSendMessage={async (text) => {');
    expect(code).toContain('await onTrigger("onSendMessage", "submit"');
    expect(code).toContain('{ message: text }');
  });
});

