import { CompiledFile } from "@workspace/canvas/types";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { toEnvVarName } from "../utils";

export interface ServiceInfo {
  id: string;
  name: string;
  folderName: string;
}

export interface WebClientInfo {
  id: string;
  name: string;
  folderName: string;
}

export interface DockerGeneratorOptions {
  nodes: BackendNode[];
  edges: BackendEdge[];
  services: ServiceInfo[];
  webClients: WebClientInfo[];
  projectName: string;
  hasKafka?: boolean;
  hasRedis?: boolean;
}

/**
 * Generates all Docker-related manifests for the monorepo:
 * 1. Dockerfile & .dockerignore for each Express, FastAPI, LangGraph microservice
 * 2. Dockerfile & .dockerignore for each Next.js Web application
 * 3. Root docker-compose.yml (orchestrating all apps, DB, Redis, Kafka)
 * 4. docker-compose.infra.yml (orchestrating Postgres/Redis/Kafka for dev mode if needed)
 * 5. Root .dockerignore
 * 6. Root & per-service .env.example files
 * 7. scripts/sync-env.mjs smart environment merge script
 * 8. dev-setup.sh / dev-setup.bat & start-prod.sh / start-prod.bat
 */
export function generateDockerFiles(options: DockerGeneratorOptions): CompiledFile[] {
  const {
    nodes,
    edges,
    services,
    webClients,
    projectName,
    hasKafka = false,
    hasRedis = false,
  } = options;

  const files: CompiledFile[] = [];
  const projectSlug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "blueprint";

  // Check database configuration
  const dbNodes = nodes.filter((n) => n.type === "database");
  const hasPostgres = dbNodes.some((n) => {
    const engine = (
      n.data?.dbEngine ||
      n.data?.provider ||
      n.data?.dbType ||
      ""
    ).toLowerCase();
    return engine.includes("postgres") || engine.includes("pg");
  });

  const hasEntityOrDb = nodes.some(
    (n) => n.type === "entity" || n.type === "db_ref" || n.type === "database",
  );

  const hasSqlite = hasEntityOrDb && !hasPostgres;
  const hasInfra = hasPostgres || hasRedis || hasKafka;

  // 1. Generate Per-Service Dockerfiles
  services.forEach((srv) => {
    const srvNode = nodes.find((n) => n.id === srv.id);
    const techStack = srvNode?.data?.techStack || (srvNode?.type === "langgraph" ? "langgraph" : "express");
    const port = srvNode?.data?.port || "8080";

    const dockerfileContent = generateServiceDockerfile(techStack, srv.folderName, port);
    files.push({
      filename: `apps/${srv.folderName}/Dockerfile`,
      language: "dockerfile",
      content: dockerfileContent,
    });

    files.push({
      filename: `apps/${srv.folderName}/.dockerignore`,
      language: "gitignore",
      content: generateAppDockerignore(techStack),
    });

    // Per-service .env.example
    files.push({
      filename: `apps/${srv.folderName}/.env.example`,
      language: "dotenv",
      content: generateServiceEnvExample(port, hasPostgres, hasSqlite, hasRedis, hasKafka, projectSlug, techStack),
    });
  });

  // 2. Generate Per-WebClient Dockerfiles
  webClients.forEach((client, idx) => {
    const webPort = idx === 0 ? "3000" : `${3000 + idx}`;
    // Dockerfile always exposes 3000 - Next.js internal container port.
    // docker-compose maps webPort:3000 on the host. Dev mode uses webPort natively.
    const dockerfileContent = generateNextjsDockerfile(client.folderName, "3000");
    files.push({
      filename: `apps/${client.folderName}/Dockerfile`,
      language: "dockerfile",
      content: dockerfileContent,
    });

    files.push({
      filename: `apps/${client.folderName}/.dockerignore`,
      language: "gitignore",
      content: generateAppDockerignore("nextjs"),
    });

    // Per-web-client .env.example uses webPort for native dev mode
    files.push({
      filename: `apps/${client.folderName}/.env.example`,
      language: "dotenv",
      content: generateWebClientEnvExample(webPort, hasPostgres, hasSqlite, projectSlug, services, nodes),
    });
  });

  // 3. Generate Root docker-compose.yml (production - all containers)
  const dockerComposeContent = generateRootDockerCompose({
    nodes,
    edges,
    services,
    webClients,
    projectSlug,
    hasPostgres,
    hasSqlite,
    hasKafka,
    hasRedis,
  });

  files.push({
    filename: "docker-compose.yml",
    language: "yaml",
    content: dockerComposeContent,
  });

  // 4. Generate docker-compose.infra.yml (dev - infra services only)
  if (hasInfra) {
    files.push({
      filename: "docker-compose.infra.yml",
      language: "yaml",
      content: generateInfraDockerCompose({ projectSlug, hasPostgres, hasKafka, hasRedis }),
    });
  }

  // 5. Root .env.example (shared infra URLs)
  files.push({
    filename: ".env.example",
    language: "dotenv",
    content: generateRootEnvExample(hasPostgres, hasSqlite, hasRedis, hasKafka, projectSlug),
  });

  // 6. scripts/sync-env.mjs - smart env merge (add new keys, keep existing values, remove deleted keys)
  files.push({
    filename: "scripts/sync-env.mjs",
    language: "javascript",
    content: generateSyncEnvScript(),
  });

  // 7. Root .dockerignore
  files.push({
    filename: ".dockerignore",
    language: "gitignore",
    content: `node_modules
dist
.next
.turbo
.git
.env*.local
*.log
*.sqlite
*.sqlite3
*.db
*.db-journal
*.db-wal
*.db-shm
.DS_Store
`,
  });

  // 8. dev-setup scripts (infra only + native apps)
  files.push({
    filename: "dev-setup.sh",
    language: "shell",
    content: generateDevSetupSh(projectName, hasInfra, services, webClients),
  });

  files.push({
    filename: "dev-setup.bat",
    language: "bat",
    content: generateDevSetupBat(projectName, hasInfra, services, webClients),
  });

  // 9. Production start scripts (full docker stack)
  files.push({
    filename: "start-prod.sh",
    language: "shell",
    content: generateProdStartSh(projectName),
  });

  files.push({
    filename: "start-prod.bat",
    language: "bat",
    content: generateProdStartBat(projectName),
  });

  return files;
}

/**
 * Dockerfile generator for Node.js/Express, Python/FastAPI, and LangGraph
 */
function generateServiceDockerfile(techStack: string, folderName: string, port: string): string {
  if (techStack === "fastapi") {
    return `# ==============================================================================
# FastAPI Microservice Dockerfile
# ==============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PORT=${port}

RUN apt-get update && apt-get install -y --no-install-recommends curl gcc && rm -rf /var/lib/apt/lists/*

COPY apps/${folderName}/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/${folderName} .

EXPOSE ${port}

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${port}/health || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port \${PORT}"]
`;
  }

  // Node.js / Express or LangGraph (Turborepo Multi-Stage)
  return `# ==============================================================================
# Express / Node.js Microservice Dockerfile (Turborepo Multi-Stage)
# ==============================================================================
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

FROM base AS builder
WORKDIR /app
RUN apk update && apk add --no-cache libc6-compat python3 make g++ curl

# Copy entire monorepo workspace definition & packages
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @workspace/${folderName}... build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=${port}

COPY --from=builder /app /app

EXPOSE ${port}

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${port}/health || exit 1

CMD ["pnpm", "--filter", "@workspace/${folderName}", "start"]
`;
}

/**
 * Dockerfile generator for Next.js Web Client Applications
 */
function generateNextjsDockerfile(folderName: string, port: string = "3000"): string {
  return `# ==============================================================================
# Next.js Web Client Dockerfile (Turborepo Multi-Stage)
# ==============================================================================
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

FROM base AS builder
WORKDIR /app
RUN apk update && apk add --no-cache libc6-compat curl

COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @workspace/${folderName}... build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=${port}

COPY --from=builder /app /app

EXPOSE ${port}

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:${port} || exit 1

CMD ["pnpm", "--filter", "@workspace/${folderName}", "start"]
`;
}

/**
 * .dockerignore generator for apps
 */
function generateAppDockerignore(techStack: string): string {
  if (techStack === "fastapi") {
    return `__pycache__/
*.py[cod]
*$py.class
.pytest_cache/
.env
venv/
.venv/
`;
  }

  return `node_modules
dist
.next
.turbo
.env
.env*.local
*.log
`;
}

/**
 * Generates the master root docker-compose.yml wiring all services, frontends, and infrastructure
 */
interface ComposeGeneratorContext {
  nodes: BackendNode[];
  edges: BackendEdge[];
  services: ServiceInfo[];
  webClients: WebClientInfo[];
  projectSlug: string;
  hasPostgres: boolean;
  hasSqlite: boolean;
  hasKafka: boolean;
  hasRedis: boolean;
}

function generateRootDockerCompose(ctx: ComposeGeneratorContext): string {
  const {
    nodes,
    edges,
    services,
    webClients,
    projectSlug,
    hasPostgres,
    hasSqlite,
    hasKafka,
    hasRedis,
  } = ctx;

  const composeLines: string[] = [
    `# ==============================================================================`,
    `# ${ctx.projectSlug.toUpperCase()} - Complete Local Docker Compose Stack`,
    `# Run: docker compose up --build`,
    `# ==============================================================================`,
    `version: "3.8"`,
    ``,
    `services:`,
  ];

  // Dependencies that apps may rely on
  const commonDependsOn: string[] = [];
  if (hasPostgres) commonDependsOn.push("postgres");
  if (hasRedis) commonDependsOn.push("redis");
  if (hasKafka) commonDependsOn.push("kafka");

  // 1. Backend Microservices
  services.forEach((srv) => {
    const srvNode = nodes.find((n) => n.id === srv.id);
    const port = srvNode?.data?.port || "8080";

    composeLines.push(`  ${srv.folderName}:`);
    composeLines.push(`    build:`);
    composeLines.push(`      context: .`);
    composeLines.push(`      dockerfile: apps/${srv.folderName}/Dockerfile`);
    composeLines.push(`    container_name: ${projectSlug}-${srv.folderName}`);
    composeLines.push(`    restart: unless-stopped`);
    composeLines.push(`    ports:`);
    composeLines.push(`      - "${port}:${port}"`);

    // Environment variables
    composeLines.push(`    environment:`);
    composeLines.push(`      - PORT=${port}`);
    composeLines.push(`      - NODE_ENV=production`);

    if (hasPostgres) {
      composeLines.push(`      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/${projectSlug.replace(/-/g, "_")}_db`);
    } else if (hasSqlite) {
      composeLines.push(`      - DATABASE_PATH=/app/packages/db/sqlite.db`);
      composeLines.push(`      - DATABASE_URL=/app/packages/db/sqlite.db`);
    }

    if (hasRedis) {
      composeLines.push(`      - REDIS_URL=redis://redis:6379`);
      composeLines.push(`      - REDIS_HOST=redis`);
      composeLines.push(`      - REDIS_PORT=6379`);
    }

    if (hasKafka) {
      composeLines.push(`      - KAFKA_BROKERS=kafka:9092`);
    }

    // Inter-service endpoints
    edges.forEach((edge) => {
      if (edge.source === srv.id) {
        const targetNode = nodes.find((n) => n.id === edge.target && n.type === "service");
        if (targetNode) {
          const tgtSrv = services.find((s) => s.id === targetNode.id);
          if (tgtSrv) {
            const tgtLabel = targetNode.data?.label || targetNode.id;
            const tgtPort = targetNode.data?.port || "8080";
            const envVarName = `${toEnvVarName(tgtLabel)}_BASE_URL`;
            composeLines.push(`      - ${envVarName}=http://${tgtSrv.folderName}:${tgtPort}`);
          }
        }
      }
    });

    if (commonDependsOn.length > 0) {
      composeLines.push(`    depends_on:`);
      commonDependsOn.forEach((dep) => {
        composeLines.push(`      ${dep}:`);
        composeLines.push(`        condition: service_healthy`);
      });
    }

    composeLines.push(`    networks:`);
    composeLines.push(`      - blueprint-network`);
    composeLines.push(``);
  });

  // 2. Web Client Applications
  webClients.forEach((client, idx) => {
    const webPort = idx === 0 ? "3000" : `${3000 + idx}`;
    composeLines.push(`  ${client.folderName}:`);
    composeLines.push(`    build:`);
    composeLines.push(`      context: .`);
    composeLines.push(`      dockerfile: apps/${client.folderName}/Dockerfile`);
    composeLines.push(`    container_name: ${projectSlug}-${client.folderName}`);
    composeLines.push(`    restart: unless-stopped`);
    composeLines.push(`    ports:`);
    composeLines.push(`      - "${webPort}:3000"`);
    composeLines.push(`    environment:`);
    composeLines.push(`      - PORT=3000`);
    composeLines.push(`      - NODE_ENV=production`);

    if (hasPostgres) {
      composeLines.push(`      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/${projectSlug.replace(/-/g, "_")}_db`);
    } else if (hasSqlite) {
      composeLines.push(`      - DATABASE_PATH=/app/packages/db/sqlite.db`);
      composeLines.push(`      - DATABASE_URL=/app/packages/db/sqlite.db`);
    }

    // Connect to first service by default for Next.js public API proxy
    if (services.length > 0) {
      const firstSrv = services[0]!;
      const srvNode = nodes.find((n) => n.id === firstSrv.id);
      const srvPort = srvNode?.data?.port || "8080";
      composeLines.push(`      - NEXT_PUBLIC_API_URL=http://localhost:${srvPort}`);
    }

    if (commonDependsOn.length > 0) {
      composeLines.push(`    depends_on:`);
      commonDependsOn.forEach((dep) => {
        composeLines.push(`      ${dep}:`);
        composeLines.push(`        condition: service_healthy`);
      });
    }

    composeLines.push(`    networks:`);
    composeLines.push(`      - blueprint-network`);
    composeLines.push(``);
  });

  // 3. Infrastructure: PostgreSQL (Only if Postgres is explicitly requested)
  if (hasPostgres) {
    const dbName = `${projectSlug.replace(/-/g, "_")}_db`;
    composeLines.push(`  postgres:`);
    composeLines.push(`    image: postgres:16-alpine`);
    composeLines.push(`    container_name: ${projectSlug}-postgres`);
    composeLines.push(`    restart: unless-stopped`);
    composeLines.push(`    environment:`);
    composeLines.push(`      POSTGRES_USER: postgres`);
    composeLines.push(`      POSTGRES_PASSWORD: postgres`);
    composeLines.push(`      POSTGRES_DB: ${dbName}`);
    composeLines.push(`    ports:`);
    composeLines.push(`      - "5432:5432"`);
    composeLines.push(`    volumes:`);
    composeLines.push(`      - postgres_data:/var/lib/postgresql/data`);
    composeLines.push(`    healthcheck:`);
    composeLines.push(`      test: ["CMD-SHELL", "pg_isready -U postgres -d ${dbName}"]`);
    composeLines.push(`      interval: 5s`);
    composeLines.push(`      timeout: 5s`);
    composeLines.push(`      retries: 5`);
    composeLines.push(`    networks:`);
    composeLines.push(`      - blueprint-network`);
    composeLines.push(``);
  }

  // 4. Infrastructure: Redis
  if (hasRedis) {
    composeLines.push(`  redis:`);
    composeLines.push(`    image: redis:7-alpine`);
    composeLines.push(`    container_name: ${projectSlug}-redis`);
    composeLines.push(`    restart: unless-stopped`);
    composeLines.push(`    ports:`);
    composeLines.push(`      - "6379:6379"`);
    composeLines.push(`    volumes:`);
    composeLines.push(`      - redis_data:/data`);
    composeLines.push(`    command: redis-server --appendonly yes`);
    composeLines.push(`    healthcheck:`);
    composeLines.push(`      test: ["CMD", "redis-cli", "ping"]`);
    composeLines.push(`      interval: 5s`);
    composeLines.push(`      timeout: 3s`);
    composeLines.push(`      retries: 5`);
    composeLines.push(`    networks:`);
    composeLines.push(`      - blueprint-network`);
    composeLines.push(``);
  }

  // 5. Infrastructure: Kafka
  if (hasKafka) {
    composeLines.push(`  kafka:`);
    composeLines.push(`    image: apache/kafka:latest`);
    composeLines.push(`    container_name: ${projectSlug}-kafka`);
    composeLines.push(`    restart: unless-stopped`);
    composeLines.push(`    ports:`);
    composeLines.push(`      - "9092:9092"`);
    composeLines.push(`    environment:`);
    composeLines.push(`      KAFKA_NODE_ID: 1`);
    composeLines.push(`      KAFKA_PROCESS_ROLES: broker,controller`);
    composeLines.push(`      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093`);
    composeLines.push(`      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092`);
    composeLines.push(`      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER`);
    composeLines.push(`      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT`);
    composeLines.push(`      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093`);
    composeLines.push(`      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1`);
    composeLines.push(`      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1`);
    composeLines.push(`      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1`);
    composeLines.push(`      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0`);
    composeLines.push(`      KAFKA_NUM_PARTITIONS: 3`);
    composeLines.push(`    volumes:`);
    composeLines.push(`      - kafka_data:/var/lib/kafka/data`);
    composeLines.push(`    healthcheck:`);
    composeLines.push(`      test: ["CMD-SHELL", "opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 0"]`);
    composeLines.push(`      interval: 10s`);
    composeLines.push(`      timeout: 5s`);
    composeLines.push(`      retries: 5`);
    composeLines.push(`    networks:`);
    composeLines.push(`      - blueprint-network`);
    composeLines.push(``);
  }

  // 6. Networks & Volumes
  composeLines.push(`networks:`);
  composeLines.push(`  blueprint-network:`);
  composeLines.push(`    driver: bridge`);
  composeLines.push(``);

  const volumes: string[] = [];
  if (hasPostgres) volumes.push("postgres_data:");
  if (hasRedis) volumes.push("redis_data:");
  if (hasKafka) volumes.push("kafka_data:");

  if (volumes.length > 0) {
    composeLines.push(`volumes:`);
    volumes.forEach((v) => composeLines.push(`  ${v}`));
  }

  return composeLines.join("\n") + "\n";
}

// ─────────────────────────────────────────────────────────────────────────────
//  Infra-only docker-compose (dev mode)
// ─────────────────────────────────────────────────────────────────────────────

interface InfraComposeContext {
  projectSlug: string;
  hasPostgres: boolean;
  hasKafka: boolean;
  hasRedis: boolean;
}

function generateInfraDockerCompose(ctx: InfraComposeContext): string {
  const { projectSlug, hasPostgres, hasKafka, hasRedis } = ctx;
  const lines: string[] = [
    `# ==============================================================================`,
    `# ${projectSlug.toUpperCase()} - Infrastructure Only (Dev Mode)`,
    `# Starts Postgres / Redis / Kafka in Docker — apps run natively with hot reload`,
    `# Usage: docker compose -f docker-compose.infra.yml up -d`,
    `# ==============================================================================`,
    `version: "3.8"`,
    ``,
    `services:`,
  ];

  if (hasPostgres) {
    const dbName = `${projectSlug.replace(/-/g, "_")}_db`;
    lines.push(`  postgres:`);
    lines.push(`    image: postgres:16-alpine`);
    lines.push(`    container_name: ${projectSlug}-postgres-dev`);
    lines.push(`    restart: unless-stopped`);
    lines.push(`    environment:`);
    lines.push(`      POSTGRES_USER: postgres`);
    lines.push(`      POSTGRES_PASSWORD: postgres`);
    lines.push(`      POSTGRES_DB: ${dbName}`);
    lines.push(`    ports:`);
    lines.push(`      - "5432:5432"`);
    lines.push(`    volumes:`);
    lines.push(`      - postgres_dev_data:/var/lib/postgresql/data`);
    lines.push(`    healthcheck:`);
    lines.push(`      test: ["CMD-SHELL", "pg_isready -U postgres -d ${dbName}"]`);
    lines.push(`      interval: 5s`);
    lines.push(`      timeout: 5s`);
    lines.push(`      retries: 5`);
    lines.push(``);
  }

  if (hasRedis) {
    lines.push(`  redis:`);
    lines.push(`    image: redis:7-alpine`);
    lines.push(`    container_name: ${projectSlug}-redis-dev`);
    lines.push(`    restart: unless-stopped`);
    lines.push(`    ports:`);
    lines.push(`      - "6379:6379"`);
    lines.push(`    volumes:`);
    lines.push(`      - redis_dev_data:/data`);
    lines.push(`    command: redis-server --appendonly yes`);
    lines.push(`    healthcheck:`);
    lines.push(`      test: ["CMD", "redis-cli", "ping"]`);
    lines.push(`      interval: 5s`);
    lines.push(`      timeout: 3s`);
    lines.push(`      retries: 5`);
    lines.push(``);
  }

  if (hasKafka) {
    lines.push(`  kafka:`);
    lines.push(`    image: apache/kafka:latest`);
    lines.push(`    container_name: ${projectSlug}-kafka-dev`);
    lines.push(`    restart: unless-stopped`);
    lines.push(`    ports:`);
    lines.push(`      - "9092:9092"`);
    lines.push(`    environment:`);
    lines.push(`      KAFKA_NODE_ID: 1`);
    lines.push(`      KAFKA_PROCESS_ROLES: broker,controller`);
    lines.push(`      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093`);
    lines.push(`      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092`);
    lines.push(`      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER`);
    lines.push(`      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT`);
    lines.push(`      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093`);
    lines.push(`      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1`);
    lines.push(`      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1`);
    lines.push(`      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1`);
    lines.push(`      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0`);
    lines.push(`      KAFKA_NUM_PARTITIONS: 3`);
    lines.push(`    volumes:`);
    lines.push(`      - kafka_dev_data:/var/lib/kafka/data`);
    lines.push(`    healthcheck:`);
    lines.push(`      test: ["CMD-SHELL", "opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 0"]`);
    lines.push(`      interval: 10s`);
    lines.push(`      timeout: 5s`);
    lines.push(`      retries: 5`);
    lines.push(``);
  }

  const volumes: string[] = [];
  if (hasPostgres) volumes.push("postgres_dev_data:");
  if (hasRedis) volumes.push("redis_dev_data:");
  if (hasKafka) volumes.push("kafka_dev_data:");

  if (volumes.length > 0) {
    lines.push(`volumes:`);
    volumes.forEach((v) => lines.push(`  ${v}`));
  }

  return lines.join("\n") + "\n";
}

// ─────────────────────────────────────────────────────────────────────────────
//  .env.example generators
// ─────────────────────────────────────────────────────────────────────────────

function generateRootEnvExample(
  hasPostgres: boolean,
  hasSqlite: boolean,
  hasRedis: boolean,
  hasKafka: boolean,
  projectSlug: string,
): string {
  const lines: string[] = [
    "# ==============================================================================",
    "# Root .env.example - copy to .env and fill in your values",
    "# Run: node scripts/sync-env.mjs to sync without overwriting existing values",
    "# ==============================================================================",
    "",
    "NODE_ENV=development",
    "",
  ];

  if (hasPostgres) {
    const dbName = `${projectSlug.replace(/-/g, "_")}_db`;
    lines.push("# PostgreSQL (started by docker-compose.infra.yml)");
    lines.push(`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${dbName}`);
    lines.push("");
  } else if (hasSqlite) {
    lines.push("# SQLite Embedded Database");
    lines.push("DATABASE_PATH=packages/db/sqlite.db");
    lines.push("DATABASE_URL=packages/db/sqlite.db");
    lines.push("");
  }

  if (hasRedis) {
    lines.push("# Redis (started by docker-compose.infra.yml)");
    lines.push("REDIS_URL=redis://localhost:6379");
    lines.push("REDIS_HOST=localhost");
    lines.push("REDIS_PORT=6379");
    lines.push("");
  }

  if (hasKafka) {
    lines.push("# Kafka (started by docker-compose.infra.yml)");
    lines.push("KAFKA_BROKERS=localhost:9092");
    lines.push("");
  }

  return lines.join("\n");
}

function generateServiceEnvExample(
  port: string,
  hasPostgres: boolean,
  hasSqlite: boolean,
  hasRedis: boolean,
  hasKafka: boolean,
  projectSlug: string,
  techStack: string,
): string {
  const lines: string[] = [
    "# Service .env.example",
    "# Sync with: node ../../scripts/sync-env.mjs .env.example .env",
    "",
    "NODE_ENV=development",
    `PORT=${port}`,
    "",
  ];

  if (hasPostgres) {
    const dbName = `${projectSlug.replace(/-/g, "_")}_db`;
    lines.push(`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${dbName}`);
    lines.push("");
  } else if (hasSqlite) {
    lines.push("DATABASE_URL=../../packages/db/sqlite.db");
    if (techStack !== "fastapi") {
      lines.push("DATABASE_PATH=../../packages/db/sqlite.db");
    }
    lines.push("");
  }

  if (hasRedis) {
    lines.push("REDIS_URL=redis://localhost:6379");
    lines.push("REDIS_HOST=localhost");
    lines.push("REDIS_PORT=6379");
    lines.push("");
  }

  if (hasKafka) {
    lines.push("KAFKA_BROKERS=localhost:9092");
    lines.push("");
  }

  return lines.join("\n");
}

function generateWebClientEnvExample(
  port: string,
  hasPostgres: boolean,
  hasSqlite: boolean,
  projectSlug: string,
  services: { id: string; name: string; folderName: string }[],
  nodes: BackendNode[],
): string {
  const lines: string[] = [
    "# Web Client .env.example",
    "# Sync with: node ../../scripts/sync-env.mjs .env.example .env",
    "",
    "NODE_ENV=development",
    `PORT=${port}`,
    "",
  ];

  if (services.length > 0) {
    lines.push("# Backend API URLs (native dev ports)");
    services.forEach((srv) => {
      const srvNode = nodes.find((n) => n.id === srv.id);
      const srvPort = srvNode?.data?.port ?? "8080";
      lines.push(`NEXT_PUBLIC_API_URL=http://localhost:${srvPort}`);
    });
    lines.push("");
  }

  if (hasPostgres) {
    const dbName = `${projectSlug.replace(/-/g, "_")}_db`;
    lines.push(`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${dbName}`);
    lines.push("");
  } else if (hasSqlite) {
    lines.push("DATABASE_URL=../../packages/db/sqlite.db");
    lines.push("DATABASE_PATH=../../packages/db/sqlite.db");
    lines.push("");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
//  scripts/sync-env.mjs - smart env merge
// ─────────────────────────────────────────────────────────────────────────────

function generateSyncEnvScript(): string {
  return [
    '#!/usr/bin/env node',
    '// sync-env.mjs - Smart .env sync',
    '//',
    '// Rules:',
    '//   - Keys in .env.example not in .env       => ADDED with example value',
    '//   - Keys in .env with a non-empty value     => KEPT (never overwritten)',
    '//   - Keys in .env with an empty value        => REPLACED with example value',
    '//   - Keys in .env no longer in .env.example  => REMOVED',
    '//',
    '// Usage (single): node scripts/sync-env.mjs .env.example .env',
    '// Usage (all):    node scripts/sync-env.mjs',
    '',
    'import fs from "fs";',
    'import path from "path";',
    '',
    'function parseEnv(content) {',
    '  const values = new Map();',
    '  for (const line of content.split("\\n")) {',
    '    const t = line.trim();',
    '    if (!t || t.startsWith("#")) continue;',
    '    const eq = t.indexOf("=");',
    '    if (eq === -1) continue;',
    '    values.set(t.slice(0, eq).trim(), t.slice(eq + 1).trim());',
    '  }',
    '  return values;',
    '}',
    '',
    'function syncEnv(examplePath, targetPath) {',
    '  if (!fs.existsSync(examplePath)) { console.warn("  skipping: " + examplePath); return; }',
    '  const exContent = fs.readFileSync(examplePath, "utf-8");',
    '  const existing = fs.existsSync(targetPath) ? parseEnv(fs.readFileSync(targetPath, "utf-8")) : new Map();',
    '  const exKeys = new Set();',
    '  const out = [];',
    '  for (const line of exContent.split("\\n")) {',
    '    const t = line.trim();',
    '    if (!t || t.startsWith("#")) { out.push(line); continue; }',
    '    const eq = t.indexOf("=");',
    '    if (eq === -1) { out.push(line); continue; }',
    '    const key = t.slice(0, eq).trim();',
    '    const exVal = t.slice(eq + 1).trim();',
    '    exKeys.add(key);',
    '    const cur = existing.get(key);',
    '    out.push(key + "=" + (cur !== undefined && cur !== "" ? cur : exVal));',
    '  }',
    '  const removed = [...existing.keys()].filter(k => !exKeys.has(k));',
    '  if (removed.length) console.log("  removed: " + removed.join(", "));',
    '  fs.writeFileSync(targetPath, out.join("\\n") + "\\n", "utf-8");',
    '  console.log("  synced: " + path.relative(process.cwd(), targetPath));',
    '}',
    '',
    'if (process.argv[2] && process.argv[3]) {',
    '  syncEnv(process.argv[2], process.argv[3]);',
    '  process.exit(0);',
    '}',
    '',
    'console.log("Syncing .env files...\\n");',
    'const root = process.cwd();',
    'const appsDir = path.join(root, "apps");',
    'const dirs = [root];',
    'if (fs.existsSync(appsDir)) {',
    '  for (const d of fs.readdirSync(appsDir, { withFileTypes: true })) {',
    '    if (d.isDirectory()) dirs.push(path.join(appsDir, d.name));',
    '  }',
    '}',
    'for (const dir of dirs) {',
    '  const ex = path.join(dir, ".env.example");',
    '  if (fs.existsSync(ex)) syncEnv(ex, path.join(dir, ".env"));',
    '}',
    'console.log("\\nDone.");',
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
//  dev-setup scripts
// ─────────────────────────────────────────────────────────────────────────────

function generateDevSetupSh(
  projectName: string,
  hasInfra: boolean,
  services: { name: string; folderName: string }[],
  webClients: { name: string; folderName: string }[],
): string {
  const infraCheck = hasInfra
    ? "\nif ! command -v docker &> /dev/null; then\n  echo \"Docker not found: https://www.docker.com/products/docker-desktop\"\n  exit 1\nfi\n"
    : "";
  const infraUp = hasInfra
    ? "\necho \"Starting infrastructure containers...\"\ndocker compose -f docker-compose.infra.yml up -d\nsleep 4\n"
    : "";
  const portLines = [
    ...services.map((s) => `echo "  ${s.name}: http://localhost:8080"`),
    ...webClients.map((w, i) => `echo "  ${w.name}: http://localhost:${i === 0 ? 3000 : 3000 + i}"`),
  ].join("\n");

  return `#!/usr/bin/env bash
# ${projectName} - Dev Setup (infra in Docker, apps run natively)
set -e
echo "Starting ${projectName} in dev mode..."
if ! command -v node &> /dev/null; then echo "Node.js not found"; exit 1; fi
if ! command -v pnpm &> /dev/null; then npm install -g pnpm; fi
${infraCheck}
echo "Syncing .env files..."
node scripts/sync-env.mjs
${infraUp}
echo "Installing dependencies..."
pnpm install

echo "Starting apps (hot reload):"
${portLines}

pnpm dev
`;
}

function generateDevSetupBat(
  projectName: string,
  hasInfra: boolean,
  services: { name: string; folderName: string }[],
  webClients: { name: string; folderName: string }[],
): string {
  const infraCheck = hasInfra
    ? "\nwhere docker >nul 2>nul\nif %errorlevel% neq 0 ( echo Docker not found & pause & exit /b 1 )\n"
    : "";
  const infraUp = hasInfra
    ? "\necho Starting infrastructure containers...\ndocker compose -f docker-compose.infra.yml up -d\ntimeout /t 5 /nobreak > nul\necho.\n"
    : "";
  const portLines = [
    ...services.map((s) => `echo   ${s.name}: http://localhost:8080`),
    ...webClients.map((w, i) => `echo   ${w.name}: http://localhost:${i === 0 ? 3000 : 3000 + i}`),
  ].join("\n");

  return `@echo off
REM ${projectName} - Dev Setup (Windows)
echo Starting ${projectName} dev mode...
where node >nul 2>nul
if %errorlevel% neq 0 ( echo Node.js not found & pause & exit /b 1 )
where pnpm >nul 2>nul
if %errorlevel% neq 0 ( npm install -g pnpm )
${infraCheck}
echo Syncing .env files...
node scripts\\sync-env.mjs
${infraUp}
echo Installing dependencies...
pnpm install

echo Starting apps (hot reload):
${portLines}

pnpm dev
`;
}

function generateProdStartSh(projectName: string): string {
  return `#!/usr/bin/env bash
# ${projectName} - Production Start (full Docker stack)
set -e
if ! command -v docker &> /dev/null; then echo "Docker not found"; exit 1; fi
echo "Starting ${projectName} production stack..."
docker compose up --build "$@"
`;
}

function generateProdStartBat(projectName: string): string {
  return `@echo off
REM ${projectName} - Production Start (Windows)
where docker >nul 2>nul
if %errorlevel% neq 0 ( echo Docker not found & pause & exit /b 1 )
echo Starting ${projectName} production stack...
docker compose up --build %*
`;
}
