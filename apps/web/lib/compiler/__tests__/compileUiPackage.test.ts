import { describe, it, expect } from "vitest";
import {
  compileUiPackage,
  compileUiManifests,
  compileUiStyles,
  compileUiHooks,
  compileFormComponents,
  compileDisplayComponents,
  compileOverlayComponents,
  compileAllUiComponents,
} from "../compileUiPackage";

describe("compileUiPackage (modular)", () => {
  it("compiles manifests correctly", () => {
    const manifests = compileUiManifests();
    expect(manifests).toHaveLength(4);
    const filenames = manifests.map((f) => f.filename);
    expect(filenames).toContain("package.json");
    expect(filenames).toContain("postcss.config.mjs");
    expect(filenames).toContain("components.json");
    expect(filenames).toContain("tsconfig.json");
  });

  it("compiles styles correctly", () => {
    const styles = compileUiStyles();
    expect(styles).toHaveLength(2);
    const filenames = styles.map((f) => f.filename);
    expect(filenames).toContain("src/lib/utils.ts");
    expect(filenames).toContain("src/styles/globals.css");
  });

  it("compiles hooks correctly", () => {
    const hooks = compileUiHooks();
    expect(hooks).toHaveLength(1);
    const filenames = hooks.map((f) => f.filename);
    expect(filenames).toContain("src/hooks/use-mobile.ts");
    expect(hooks[0]!.content).toContain("export function useIsMobile()");
  });

  it("compiles form components correctly", () => {
    const forms = compileFormComponents();
    const filenames = forms.map((f) => f.filename);
    expect(filenames).toContain("src/components/button.tsx");
    expect(filenames).toContain("src/components/input.tsx");
    expect(filenames).toContain("src/components/label.tsx");
    expect(filenames).toContain("src/components/textarea.tsx");
    expect(filenames).toContain("src/components/checkbox.tsx");
    expect(filenames).toContain("src/components/switch.tsx");
    expect(filenames).toContain("src/components/select.tsx");
    expect(filenames).toContain("src/components/slider.tsx");
    expect(filenames).toContain("src/components/radio-group.tsx");
  });

  it("compiles display components correctly", () => {
    const display = compileDisplayComponents();
    const filenames = display.map((f) => f.filename);
    expect(filenames).toContain("src/components/card.tsx");
    expect(filenames).toContain("src/components/badge.tsx");
    expect(filenames).toContain("src/components/avatar.tsx");
    expect(filenames).toContain("src/components/skeleton.tsx");
    expect(filenames).toContain("src/components/separator.tsx");
    expect(filenames).toContain("src/components/table.tsx");
    expect(filenames).toContain("src/components/progress.tsx");
    expect(filenames).toContain("src/components/alert.tsx");
    expect(filenames).toContain("src/components/sonner.tsx");
  });

  it("compiles overlay components correctly", () => {
    const overlays = compileOverlayComponents();
    const filenames = overlays.map((f) => f.filename);
    expect(filenames).toContain("src/components/tabs.tsx");
    expect(filenames).toContain("src/components/dialog.tsx");
    expect(filenames).toContain("src/components/tooltip.tsx");
    expect(filenames).toContain("src/components/popover.tsx");
    expect(filenames).toContain("src/components/sheet.tsx");
    expect(filenames).toContain("src/components/dropdown-menu.tsx");
    expect(filenames).toContain("src/components/scroll-area.tsx");
    expect(filenames).toContain("src/components/accordion.tsx");
    expect(filenames).toContain("src/components/sidebar.tsx");
  });

  it("compiles all UI components via aggregator", () => {
    const allComponents = compileAllUiComponents();
    expect(allComponents.length).toBe(
      compileFormComponents().length +
      compileDisplayComponents().length +
      compileOverlayComponents().length
    );
  });

  it("generates @workspace/ui matching the monorepo packages/ui configuration", () => {
    const { files } = compileUiPackage();
    expect(files.length).toBeGreaterThan(25);

    // 1. package.json verification
    const pkgFile = files.find((f) => f.filename === "package.json");
    expect(pkgFile).toBeDefined();
    const pkgJson = JSON.parse(pkgFile!.content);
    expect(pkgJson.name).toBe("@workspace/ui");
    expect(pkgJson.dependencies["radix-ui"]).toBe("^1.4.3");
    expect(pkgJson.dependencies["@hugeicons/react"]).toBe("^1.1.2");
    expect(pkgJson.dependencies["class-variance-authority"]).toBe("^0.7.1");
    expect(pkgJson.dependencies["clsx"]).toBe("^2.1.1");
    expect(pkgJson.dependencies["tailwind-merge"]).toBe("^3.3.1");
    expect(pkgJson.exports["./components/*"]).toBe("./src/components/*.tsx");

    // 2. components.json verification
    const componentsJsonFile = files.find((f) => f.filename === "components.json");
    expect(componentsJsonFile).toBeDefined();
    const compJson = JSON.parse(componentsJsonFile!.content);
    expect(compJson.style).toBe("new-york");

    // 3. Essential Shadcn components
    const requiredComponents = [
      "src/components/checkbox.tsx",
      "src/components/switch.tsx",
      "src/components/button.tsx",
      "src/components/card.tsx",
      "src/components/badge.tsx",
      "src/components/input.tsx",
      "src/components/label.tsx",
      "src/components/textarea.tsx",
      "src/components/progress.tsx",
      "src/components/alert.tsx",
      "src/components/avatar.tsx",
      "src/components/skeleton.tsx",
      "src/components/separator.tsx",
      "src/components/table.tsx",
      "src/components/select.tsx",
      "src/components/tabs.tsx",
      "src/components/dialog.tsx",
      "src/components/sonner.tsx",
      "src/components/tooltip.tsx",
      "src/components/popover.tsx",
      "src/components/sheet.tsx",
      "src/components/radio-group.tsx",
      "src/components/dropdown-menu.tsx",
      "src/components/scroll-area.tsx",
      "src/components/slider.tsx",
      "src/components/accordion.tsx",
      "src/components/sidebar.tsx",
    ];

    for (const compPath of requiredComponents) {
      const file = files.find((f) => f.filename === compPath);
      expect(file, `Missing ${compPath}`).toBeDefined();
      expect(file!.content.length).toBeGreaterThan(100);
      expect(file!.content).toContain("export {");
    }

    // 4. Specifically verify checkbox component content
    const checkbox = files.find((f) => f.filename === "src/components/checkbox.tsx");
    expect(checkbox!.content).toContain('import { Checkbox as CheckboxPrimitive } from "radix-ui"');
    expect(checkbox!.content).toContain("export { Checkbox }");

    // 5. Verify hooks are included
    const useMobile = files.find((f) => f.filename === "src/hooks/use-mobile.ts");
    expect(useMobile, "Missing src/hooks/use-mobile.ts").toBeDefined();
    expect(useMobile!.content).toContain("export function useIsMobile()");
  });
});
