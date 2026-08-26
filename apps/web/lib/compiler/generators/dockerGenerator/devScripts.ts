export function generateDevSetupSh(
  projectName: string,
  hasInfra: boolean,
  services: { name: string; folderName: string }[],
  webApps: { name: string; folderName: string }[],
): string {
  const infraCheck = hasInfra
    ? '\nif ! command -v docker &> /dev/null; then\n  echo "Docker not found: https://www.docker.com/products/docker-desktop"\n  exit 1\nfi\n'
    : "";
  const infraUp = hasInfra
    ? '\necho "Starting infrastructure containers..."\ndocker compose -f docker-compose.infra.yml up -d\nsleep 4\n'
    : "";
  const portLines = [
    ...services.map((s) => `echo "  ${s.name}: http://localhost:8080"`),
    ...webApps.map(
      (w, i) =>
        `echo "  ${w.name}: http://localhost:${i === 0 ? 3000 : 3000 + i}"`,
    ),
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

export function generateDevSetupBat(
  projectName: string,
  hasInfra: boolean,
  services: { name: string; folderName: string }[],
  webApps: { name: string; folderName: string }[],
): string {
  const infraCheck = hasInfra
    ? "\nwhere docker >nul 2>nul\nif %errorlevel% neq 0 ( echo Docker not found & pause & exit /b 1 )\n"
    : "";
  const infraUp = hasInfra
    ? "\necho Starting infrastructure containers...\ndocker compose -f docker-compose.infra.yml up -d\ntimeout /t 5 /nobreak > nul\necho.\n"
    : "";
  const portLines = [
    ...services.map((s) => `echo   ${s.name}: http://localhost:8080`),
    ...webApps.map(
      (w, i) =>
        `echo   ${w.name}: http://localhost:${i === 0 ? 3000 : 3000 + i}`,
    ),
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

export function generateProdStartSh(projectName: string): string {
  return `#!/usr/bin/env bash
# ${projectName} - Production Start (full Docker stack)
set -e
if ! command -v docker &> /dev/null; then echo "Docker not found"; exit 1; fi
echo "Starting ${projectName} production stack..."
docker compose up --build "$@"
`;
}

export function generateProdStartBat(projectName: string): string {
  return `@echo off
REM ${projectName} - Production Start (Windows)
where docker >nul 2>nul
if %errorlevel% neq 0 ( echo Docker not found & pause & exit /b 1 )
echo Starting ${projectName} production stack...
docker compose up --build %*
`;
}
