import { CompiledFile } from "@workspace/canvas/types";

export function generateProjectConfigFiles(appSlug: string = "web-app"): CompiledFile[] {
  const packageJson = JSON.stringify(
    {
      name: `@workspace/${appSlug}`,
      version: "0.0.1",
      type: "module",
      private: true,
      scripts: {
        "db:migrate": "npx @better-auth/cli migrate -y",
        predev: "pnpm db:migrate",
        dev: "next dev",
        build: "next build",
        prestart: "pnpm db:migrate",
        start: "next start",
        lint: "next lint",
        typecheck: "tsc --noEmit",
        test: "vitest run",
        postinstall: "prebuild-install || node -e \"try { const p = require('path').dirname(require.resolve('better-sqlite3/package.json')); require('child_process').execSync('npx prebuild-install', {cwd: p, stdio: 'inherit'}); } catch (e) {}\"",
      },
      dependencies: {
        "@libsql/client": "^0.14.0",
        "@workspace/db": "workspace:*",
        "@workspace/logger": "workspace:*",
        "@workspace/ui": "workspace:*",
        "better-auth": "^1.4.21",
        "better-sqlite3": "^12.0.0",
        "lucide-react": "^0.475.0",
        next: "^16.0.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        zod: "^3.24.2",
      },
      devDependencies: {
        "@better-auth/cli": "^1.4.21",
        "@tailwindcss/postcss": "^4.0.0",
        "@types/better-sqlite3": "^7.6.12",
        "@types/node": "^20.19.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "@workspace/typescript-config": "workspace:*",
        "prebuild-install": "^7.1.3",
        tailwindcss: "^4.0.0",
        typescript: "^5.7.3",
        vitest: "^1.6.0",
      },
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

  const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@workspace/ui", "@workspace/logger"],
  serverExternalPackages: ["better-sqlite3", "better-auth", "@workspace/db"],
};

export default nextConfig;
`;

  return [
    {
      filename: "package.json",
      language: "json",
      content: packageJson,
    },
    {
      filename: ".env",
      language: "dotenv",
      content: `DATABASE_PATH=../../packages/db/sqlite.db
DATABASE_URL=../../packages/db/sqlite.db
NEXT_PUBLIC_LOG_LEVEL=info
`,
    },
    {
      filename: ".env.example",
      language: "dotenv",
      content: `DATABASE_PATH=../../packages/db/sqlite.db
DATABASE_URL=../../packages/db/sqlite.db
NEXT_PUBLIC_LOG_LEVEL=info
`,
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
