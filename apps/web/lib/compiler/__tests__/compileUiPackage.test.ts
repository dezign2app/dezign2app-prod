import { describe, it, expect } from "vitest";
import {
  compileUiPackage,
  compileUiManifests,
  compileUiStyles,
  compileUiHooks,
  compileFormComponents,
  compileDisplayComponents,
  compileOverlayComponents,
  compileChatComponents,
  compileAllUiComponents,
} from "../compileUiPackage";

describe("compileUiPackage (modular)", () => {
  it("compiles manifests correctly", () => {
    const manifests = compileUiManifests();
    expect(manifests.length).toBeGreaterThan(0);
    const filenames = manifests.map((f) => f.filename);
    expect(filenames).toContain("package.json");
    expect(filenames).toContain("postcss.config.mjs");
    expect(filenames).toContain("components.json");
  });

  it("compiles styles correctly", () => {
    const styles = compileUiStyles();
    expect(styles.length).toBeGreaterThan(0);
    const filenames = styles.map((f) => f.filename);
    expect(filenames).toContain("src/styles/globals.css");
    expect(filenames).toContain("src/lib/utils.ts");
  });

  it("compiles hooks correctly", () => {
    const hooks = compileUiHooks();
    expect(hooks.length).toBeGreaterThan(0);
    const filenames = hooks.map((f) => f.filename);
    expect(filenames).toContain("src/hooks/use-mobile.ts");
    expect(filenames).toContain("src/hooks/index.ts");
  });

  it("compiles form components correctly", () => {
    const forms = compileFormComponents();
    expect(forms.length).toBeGreaterThan(0);
    const filenames = forms.map((f) => f.filename);
    expect(filenames).toContain("src/components/button.tsx");
    expect(filenames).toContain("src/components/input.tsx");
    expect(filenames).toContain("src/components/textarea.tsx");
    expect(filenames).toContain("src/components/select.tsx");
    expect(filenames).toContain("src/components/checkbox.tsx");
    expect(filenames).toContain("src/components/switch.tsx");
    expect(filenames).toContain("src/components/label.tsx");
    expect(filenames).toContain("src/components/radio-group.tsx");
  });

  it("compiles display components correctly", () => {
    const displays = compileDisplayComponents();
    expect(displays.length).toBeGreaterThan(0);
    const filenames = displays.map((f) => f.filename);
    expect(filenames).toContain("src/components/card.tsx");
    expect(filenames).toContain("src/components/badge.tsx");
    expect(filenames).toContain("src/components/avatar.tsx");
    expect(filenames).toContain("src/components/skeleton.tsx");
    expect(filenames).toContain("src/components/table.tsx");
    expect(filenames).toContain("src/components/progress.tsx");
    expect(filenames).toContain("src/components/alert.tsx");
  });

  it("compiles overlay components correctly", () => {
    const overlays = compileOverlayComponents();
    expect(overlays.length).toBeGreaterThan(0);
    const filenames = overlays.map((f) => f.filename);
    expect(filenames).toContain("src/components/dialog.tsx");
    expect(filenames).toContain("src/components/popover.tsx");
    expect(filenames).toContain("src/components/tooltip.tsx");
    expect(filenames).toContain("src/components/sheet.tsx");
    expect(filenames).toContain("src/components/dropdown-menu.tsx");
    expect(filenames).toContain("src/components/scroll-area.tsx");
    expect(filenames).toContain("src/components/accordion.tsx");
    expect(filenames).toContain("src/components/sidebar.tsx");
  });

  it("compiles chat components correctly", () => {
    const chats = compileChatComponents();
    expect(chats.length).toBe(5);
    const filenames = chats.map((f) => f.filename);
    expect(filenames).toContain("src/components/chat.tsx");
    expect(filenames).toContain("src/components/message.tsx");
    expect(filenames).toContain("src/components/message-scroller.tsx");
    expect(filenames).toContain("src/components/bubble.tsx");
    expect(filenames).toContain("src/components/ai-elements/chat.tsx");
  });

  it("compiles all UI components via aggregator", () => {
    const allComponents = compileAllUiComponents();
    expect(allComponents.length).toBe(
      compileFormComponents().length +
      compileDisplayComponents().length +
      compileOverlayComponents().length +
      compileChatComponents().length
    );
  });

  it("generates @workspace/ui matching the monorepo packages/ui configuration", () => {
    const { files } = compileUiPackage();
    expect(files.length).toBeGreaterThan(25);

    // 1. package.json verification
    const pkgJsonFile = files.find((f) => f.filename === "package.json");
    expect(pkgJsonFile).toBeDefined();
    const pkg = JSON.parse(pkgJsonFile!.content);
    expect(pkg.name).toBe("@workspace/ui");
    expect(pkg.exports["./components/*"]).toBe("./src/components/*.tsx");
    expect(pkg.exports["./components/ai-elements/*"]).toBe("./src/components/ai-elements/*.tsx");
    expect(pkg.dependencies["use-stick-to-bottom"]).toBeDefined();

    // 2. Chat components presence
    const filenames = files.map((f) => f.filename);
    expect(filenames).toContain("src/components/chat.tsx");
    expect(filenames).toContain("src/components/message.tsx");
    expect(filenames).toContain("src/components/message-scroller.tsx");
    expect(filenames).toContain("src/components/bubble.tsx");
    expect(filenames).toContain("src/components/ai-elements/chat.tsx");
  });
});
