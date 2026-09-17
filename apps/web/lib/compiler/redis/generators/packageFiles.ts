import { CompiledFile } from "@workspace/canvas/types";

export function generatePackageJson(
  packageName: string,
  instLabel: string,
  options?: {
    hasStreams?: boolean;
    hasPubSub?: boolean;
    hasSchemas?: boolean;
  },
): CompiledFile {
  const exportsMap: Record<string, string> = {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./config": "./src/config.ts",
    "./cache": "./src/cache.ts",
  };

  if (options?.hasPubSub ?? true) {
    exportsMap["./pubsub"] = "./src/pubsub.ts";
  }
  if (options?.hasStreams ?? true) {
    exportsMap["./streams"] = "./src/streams.ts";
  }
  if (options?.hasSchemas ?? true) {
    exportsMap["./schemas"] = "./src/schemas/index.ts";
    exportsMap["./schemas/*"] = "./src/schemas/*.ts";
    exportsMap["./helpers"] = "./src/helpers/index.ts";
    exportsMap["./helpers/*"] = "./src/helpers/*";
  }

  const packageJson = JSON.stringify(
    {
      name: packageName,
      version: "0.0.0",
      private: true,
      description: `Redis client, caching schemas, pub/sub, streams, and data structure helpers for ${instLabel}`,
      main: "src/index.ts",
      types: "src/index.ts",
      exports: exportsMap,
      scripts: {
        build: "tsc",
        "check-types": "tsc --noEmit",
      },
      dependencies: {
        ioredis: "^5.4.1",
        "@workspace/logger": "workspace:*",
        "@workspace/types": "workspace:*",
      },
      devDependencies: {
        "@types/node": "^20.11.0",
        "@workspace/typescript-config": "workspace:*",
        typescript: "^5.3.3",
      },
    },
    null,
    2,
  );

  return {
    filename: "package.json",
    language: "json",
    content: packageJson,
  };
}

export function generateTsConfig(): CompiledFile {
  const tsConfig = JSON.stringify(
    {
      extends: "@workspace/typescript-config/base.json",
      compilerOptions: {
        outDir: "./dist",
        rootDir: "./src",
      },
      include: ["src/**/*"],
    },
    null,
    2,
  );

  return {
    filename: "tsconfig.json",
    language: "json",
    content: tsConfig,
  };
}

export function generateDockerCompose(
  packageFolder: string,
  instPort: number,
  maxmemory: string,
  maxmemoryPolicy: string,
  persistenceMode: string,
): CompiledFile {
  const pFlag =
    persistenceMode === "None"
      ? '--save "" --appendonly no'
      : persistenceMode === "RDB"
        ? "--save 60 1 --appendonly no"
        : persistenceMode === "AOF"
          ? '--save "" --appendonly yes'
          : "--save 60 1 --appendonly yes";

  const dockerComposeContent = `version: "3.8"

services:
  ${packageFolder}:
    image: redis:7-alpine
    container_name: ${packageFolder}
    ports:
      - "${instPort}:6379"
    volumes:
      - ${packageFolder.replace(/-/g, "_")}_data:/data
    command: redis-server --maxmemory ${maxmemory} --maxmemory-policy ${maxmemoryPolicy} ${pFlag}

volumes:
  ${packageFolder.replace(/-/g, "_")}_data:
`;

  return {
    filename: "docker-compose.yml",
    language: "yaml",
    content: dockerComposeContent,
  };
}
