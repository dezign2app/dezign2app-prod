import { DEFAULT_BETTER_AUTH_VERSION } from "@workspace/canvas";
import { BetterAuthV16NodeData } from "../types";

/**
 * Generates `README.md`
 */
export function generateReadme(data: BetterAuthV16NodeData): string {
  const serviceName = data.label || "Auth Server";
  return `# ${serviceName} (Better Auth Standalone Service)

This service provides authentication endpoints for your system architecture canvas.

## Features
- Framework: Better Auth (v${data.version || DEFAULT_BETTER_AUTH_VERSION}) + Hono Server
- Native Cookie Sessions & Bearer Token Authentication
- Integrated with FastAPI Python backend via \`auth_middleware.py\`

## Quick Start

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Setup environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Run in development mode:
   \`\`\`bash
   npm run dev
   \`\`\`

The Better Auth server will start on \`http://localhost:3001\`.
Authentication endpoints are mounted at \`/api/auth/*\` (e.g. \`/api/auth/sign-in\`, \`/api/auth/get-session\`).
`;
}
