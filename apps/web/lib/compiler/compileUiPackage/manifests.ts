import { CompiledFile } from "@workspace/canvas/types";

/**
 * Emits configuration manifests for `@workspace/ui`, strictly matching
 * the repository's packages/ui package.json, postcss, and components.json configs.
 */
export function compileUiManifests(): CompiledFile[] {
  const files: CompiledFile[] = [];

  // 1. package.json
  const packageJson = JSON.stringify(
    {
      name: "@workspace/ui",
      version: "0.0.0",
      type: "module",
      private: true,
      scripts: {
        lint: "eslint . --max-warnings 0",
        test: "vitest run --passWithNoTests",
      },
      dependencies: {
        "@base-ui/react": "^1.0.0",
        "@hugeicons/core-free-icons": "^3.0.0",
        "@hugeicons/react": "^1.1.2",
        "class-variance-authority": "^0.7.1",
        clsx: "^2.1.1",
        cmdk: "^1.1.1",
        "lucide-react": "^0.475.0",
        "next-themes": "^0.4.6",
        "radix-ui": "^1.4.3",
        react: "^19.1.1",
        "react-dom": "^19.1.1",
        "react-resizable-panels": "^3.0.6",
        recharts: "2.15.4",
        sonner: "^2.0.7",
        "tailwind-merge": "^3.3.1",
        "tw-animate-css": "^1.3.6",
        "use-stick-to-bottom": "^1.1.2",
      },
      devDependencies: {
        "@tailwindcss/postcss": "^4.1.11",
        "@tailwindcss/typography": "0.5.0-alpha.3",
        "@workspace/typescript-config": "workspace:*",
        "@types/node": "^20.19.9",
        "@types/react": "^19.1.9",
        "@types/react-dom": "^19.1.7",
        tailwindcss: "^4.1.11",
        typescript: "^5.9.2",
      },
      exports: {
        "./globals.css": "./src/styles/globals.css",
        "./postcss.config": "./postcss.config.mjs",
        "./lib/*": "./src/lib/*.ts",
        "./components/*": "./src/components/*.tsx",
        "./hooks/*": "./src/hooks/*.ts",
        "./components/ai-elements/*": "./src/components/ai-elements/*.tsx",
      },
    },
    null,
    2,
  );
  files.push({
    filename: "package.json",
    language: "json",
    content: packageJson,
  });

  // 2. postcss.config.mjs
  const postcssConfig = `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
`;
  files.push({
    filename: "postcss.config.mjs",
    language: "javascript",
    content: postcssConfig,
  });

  // 3. components.json (Shadcn UI config)
  const componentsJson = JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema.json",
      style: "new-york",
      rsc: true,
      tsx: true,
      tailwind: {
        config: "",
        css: "src/styles/globals.css",
        baseColor: "neutral",
        cssVariables: true,
      },
      iconLibrary: "lucide",
      aliases: {
        components: "@workspace/ui/components",
        utils: "@workspace/ui/lib/utils",
        ui: "@workspace/ui/components",
        lib: "@workspace/ui/lib",
        hooks: "@workspace/ui/hooks",
      },
      registries: {
        "@ai-elements": "https://ai-sdk.dev/elements/api/registry/{name}.json",
      },
    },
    null,
    2,
  );
  files.push({
    filename: "components.json",
    language: "json",
    content: componentsJson,
  });

  // 4. tsconfig.json
  const tsconfig = JSON.stringify(
    {
      extends: "@workspace/typescript-config/react-library.json",
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@workspace/ui/*": ["./src/*"],
        },
      },
      include: ["src"],
    },
    null,
    2,
  );
  files.push({
    filename: "tsconfig.json",
    language: "json",
    content: tsconfig,
  });

  return files;
}
