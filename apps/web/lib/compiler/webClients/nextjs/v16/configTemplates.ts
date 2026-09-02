import { CompiledFile, NodeDependencyItem } from "@workspace/canvas/types";

export function generateProjectConfigFiles(
  appSlug: string = "web-app",
  customDependencies?: NodeDependencyItem[],
  hasDb: boolean = false,
  dbPackageName: string = "@workspace/db",
): CompiledFile[] {
  const dependencies: Record<string, string> = {
    ...(hasDb ? { [dbPackageName]: "workspace:*" } : {}),
    "@workspace/logger": "workspace:*",
    "@workspace/types": "workspace:*",
    "@workspace/ui": "workspace:*",
    "lucide-react": "^0.475.0",
    next: "^16.0.0",
    react: "^19.0.0",
    "react-dom": "^19.0.0",
    zod: "^3.24.2",
  };

  const devDependencies: Record<string, string> = {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^20.19.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@workspace/typescript-config": "workspace:*",
    tailwindcss: "^4.0.0",
    typescript: "^5.7.3",
    vitest: "^1.6.0",
  };

  if (Array.isArray(customDependencies)) {
    customDependencies.forEach((dep) => {
      if (!dep || !dep.name) return;
      const ver = dep.version || "latest";
      if (dep.isDev) {
        devDependencies[dep.name] = ver;
      } else {
        dependencies[dep.name] = ver;
      }
    });
  }

  const packageJson = JSON.stringify(
    {
      name: `@workspace/${appSlug}`,
      version: "0.0.1",
      type: "module",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
        typecheck: "tsc --noEmit",
        test: "vitest run",
      },
      dependencies,
      devDependencies,
    },
    null,
    2,
  );

  const tsconfig = JSON.stringify(
    {
      extends: "@workspace/typescript-config/nextjs.json",
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["./*"],
        },
        declaration: false,
        declarationMap: false,
      },
      include: [
        "next-env.d.ts",
        "next.config.mjs",
        "**/*.ts",
        "**/*.tsx",
        ".next/types/**/*.ts",
      ],
      exclude: ["node_modules"],
    },
    null,
    2,
  );

  const transpilePackages = [
    "@workspace/ui",
    "@workspace/logger",
    ...(hasDb ? [dbPackageName] : []),
    "@workspace/types",
  ];

  const serverExternalPackages = [
    ...(hasDb ? ["better-sqlite3"] : []),
    "better-auth",
  ];

  const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ${JSON.stringify(transpilePackages)},
  serverExternalPackages: ${JSON.stringify(serverExternalPackages)},
};

export default nextConfig;
`;

  const envLines: string[] = [];
  if (hasDb) {
    envLines.push("DATABASE_PATH=../../packages/db/sqlite.db");
    envLines.push("DATABASE_URL=../../packages/db/sqlite.db");
  }
  envLines.push("NEXT_PUBLIC_LOG_LEVEL=info\n");
  const envContent = envLines.join("\n");

  return [
    {
      filename: "package.json",
      language: "json",
      content: packageJson,
    },
    {
      filename: ".env",
      language: "dotenv",
      content: envContent,
    },
    {
      filename: ".env.example",
      language: "dotenv",
      content: envContent,
    },
    {
      filename: "postcss.config.mjs",
      language: "javascript",
      content: `export { default } from "@workspace/ui/postcss.config";\n`,
    },
    {
      filename: "tsconfig.json",
      language: "json",
      content: tsconfig,
    },
    {
      filename: "next.config.mjs",
      language: "javascript",
      content: nextConfig,
    },
    {
      filename: "app/globals.css",
      language: "css",
      content: `@import "@workspace/ui/globals.css";\n`,
    },
  ];
}
