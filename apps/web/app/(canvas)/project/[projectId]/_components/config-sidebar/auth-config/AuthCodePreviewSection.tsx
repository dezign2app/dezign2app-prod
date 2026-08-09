import React from "react";
import { Label } from "@workspace/ui/components/label";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Code2 } from "lucide-react";
import { AuthConfigSectionProps } from "./types";
import { AuthHookConfig } from "@workspace/canvas";

export const AuthCodePreviewSection: React.FC<AuthConfigSectionProps> = ({
  data,
  allNodes,
  edges,
  nodeId,
}) => {
  const enabledPlugins = data.plugins || ["bearer", "admin", "organization", "jwt"];
  const providers = data.providers || {};
  const emailPassword = providers.emailPassword || { enabled: true, requireVerification: true, minLength: 8 };
  const accountLinking = providers.accountLinking || { policy: "prompt" };
  const session = data.session || {};
  const redirects = data.redirects || {};
  const trustedOrigins = data.trustedOrigins || ["http://localhost:3000"];
  const org = data.organization || { enabled: true };
  const hooks = data.hooks || [];

  const schemaEntities = allNodes.filter((n) => n.type === "entity");
  const selectedOrgSchemaId = org.schemaId || org.entityId;
  const selectedOrgEntity = schemaEntities.find((n) => n.id === selectedOrgSchemaId);

  const selectedUserSchemaId = data.userEntityId || data.userSchemaId;
  const selectedUserEntity = schemaEntities.find((n) => n.id === selectedUserSchemaId);

  const isPaymentsInjected = edges.some(
    (e) => e.target === nodeId && e.targetHandle === "payments-plugin-in",
  );

  // --- Hook code generation ---
  type EndpointHookItem = AuthHookConfig & { event: string };
  type DbHookItem = AuthHookConfig & { model: string; operation: "create" | "update" | "delete" };

  const activeEndpointHooks = hooks.filter(
    (h): h is EndpointHookItem =>
      (h.hookType === "endpoint" || (!h.hookType && !("model" in h))) &&
      h.enabled !== false &&
      typeof h.event === "string" &&
      h.event.length > 0
  );
  const activeDbHooks = hooks.filter(
    (h): h is DbHookItem =>
      (h.hookType === "db" || (!h.hookType && "model" in h)) &&
      h.enabled !== false &&
      typeof h.model === "string" &&
      Boolean(h.operation)
  );

  const hasEndpointHooks = activeEndpointHooks.length > 0;
  const hasDbHooks = activeDbHooks.length > 0;

  // Group endpoint hooks by phase → else-if chains per phase
  const endpointBefore = activeEndpointHooks.filter((h) => (h.phase || "after") === "before");
  const endpointAfter = activeEndpointHooks.filter((h) => (h.phase || "after") === "after");

  const buildEndpointChain = (phaseHooks: EndpointHookItem[], phase: "before" | "after"): string => {
    return phaseHooks
      .map((h, i) => {
        const event = h.event;
        const pathCheck = event.includes("*") || event.endsWith("/")
          ? `if (ctx.path.startsWith("${event.replace(/\*$/, "")}"))`
          : `if (ctx.path === "${event}")`;
        const condition = i === 0 ? pathCheck : pathCheck.replace(/^if/, "else if");

        let body = "";
        if (h.mode === "code" && h.code) {
          body = h.code.trim();
        } else if (phase === "before") {
          body = `if (!ctx.body) {\n  throw new APIError("BAD_REQUEST", { message: "Missing request body" });\n}\n// ${h.prompt || "Validate request parameters"}`;
        } else {
          // after phase
          if (event.startsWith("/sign-up")) {
            body = `const newSession = ctx.context.newSession;\nif (newSession) {\n  ctx.context.runInBackground(async () => {\n    // ${h.prompt || "Send welcome email & track analytics"}\n  });\n}`;
          } else {
            body = `// ${h.prompt || "Run post-request side effects"}`;
          }
        }

        const indentedBody = body.split("\n").map((line) => `      ${line}`).join("\n");
        return `    ${condition} {\n${indentedBody}\n    }`;
      })
      .join("\n");
  };

  const hooksBlock = hasEndpointHooks
    ? `hooks: {\n${[
        endpointBefore.length > 0
          ? `    before: createAuthMiddleware(async (ctx) => {\n${buildEndpointChain(endpointBefore, "before")}\n    }),`
          : null,
        endpointAfter.length > 0
          ? `    after: createAuthMiddleware(async (ctx) => {\n${buildEndpointChain(endpointAfter, "after")}\n    }),`
          : null,
      ]
        .filter(Boolean)
        .join("\n")}\n  },\n  `
    : "";

  // Group DB hooks by model → operation → phase
  const dbHooksByModel: Record<string, Record<string, { phase: string; prompt?: string; code?: string }>> = {};
  for (const h of activeDbHooks) {
    const modelHooks = (dbHooksByModel[h.model] ||= {});
    modelHooks[h.operation] = { phase: h.phase || "after", prompt: h.prompt, code: h.code };
  }


  const databaseHooksBlock = hasDbHooks
    ? `databaseHooks: {\n  ${Object.entries(dbHooksByModel)
        .map(([model, ops]) => {
          const opLines = Object.entries(ops)
            .map(([op, { phase, prompt }]) => {
              const body = prompt ? `// ${prompt}` : "// custom logic";
              const returnHint = phase === "before" ? `\n          return { data: ${model} };` : "";
              return `      ${op}: {\n        ${phase}: async (${model}, ctx) => {\n          ${body}${returnHint}\n        },\n      }`;
            })
            .join(",\n");
          return `  ${model}: {\n${opLines}\n  }`;
        })
        .join(",\n")}\n},\n  `
    : "";

  const policy = accountLinking.policy || (accountLinking.enabled === false ? "block" : "merge");
  const isAccountLinkingEnabled = policy !== "block";
  const disableImplicitLinking = policy === "prompt";
  const trustedProviders = accountLinking.trustedProviders || [];
  const allowDifferentEmails = Boolean(accountLinking.allowDifferentEmails);

  const accountLinkingCode = isAccountLinkingEnabled
    ? `account: {
    accountLinking: {
      enabled: true,${disableImplicitLinking ? '\n      disableImplicitLinking: true,' : ''}${allowDifferentEmails ? '\n      allowDifferentEmails: true,' : ''}${trustedProviders.length > 0 ? `\n      trustedProviders: ${JSON.stringify(trustedProviders)},` : ''}
    },
  },`
    : `account: {
    accountLinking: {
      enabled: false,
    },
  },`;

  const sessionClaims = session.claims || [];
  const sessionCookieClaims = sessionClaims.filter(
    (c) => c.destination === "session" || c.deliveryMode === "session" || c.deliveryMode === "cookie",
  );
  const jwtClaims = sessionClaims.filter(
    (c) => c.destination === "jwt" || c.deliveryMode === "jwt",
  );
  const cookieCache = session.cookieCache || { enabled: true, maxAgeSeconds: 300 };

  const sessionBlock = `session: {
    expiresIn: ${session.expiresInSeconds ?? 604800},
    updateAge: ${session.updateAgeSeconds ?? 86400},${cookieCache.enabled !== false ? `\n    cookieCache: {\n      enabled: true,\n      maxAge: ${cookieCache.maxAgeSeconds ?? 300},\n    },` : ''}
  },`;

  const customSessionBlock = sessionCookieClaims.length > 0
    ? `\n  customSession: async (session, user, ctx) => {\n    return {\n      ...session,\n      user: {\n        ...user,\n${sessionCookieClaims.map((c) => `        ${c.key}: ${c.source === 'userColumn' ? `user.${c.targetValue || c.key}` : `await resolveClaim("${c.key}", { user, session })`},`).join("\n")}\n      },\n    };\n  },`
    : "";

  const generatedCode = `import { betterAuth } from "better-auth";
import { sqliteAdapter } from "better-auth/adapters/sqlite";${hasEndpointHooks ? '\nimport { createAuthMiddleware, APIError } from "better-auth/api";' : ""}
${enabledPlugins.includes("jwt") ? 'import { jwt } from "better-auth/plugins";\n' : ""}${enabledPlugins.includes("organization") ? 'import { organization } from "better-auth/plugins";\n' : ""}${isPaymentsInjected ? 'import { creem } from "@creem_io/better-auth";\n' : ""}
export const auth = betterAuth({
  database: sqliteAdapter(db, { provider: "sqlite" }),
  ${selectedUserEntity ? `user: { modelName: "${selectedUserEntity.data.label}" },\n  ` : ""}emailAndPassword: {
    enabled: ${emailPassword.enabled ?? true},
    requireEmailVerification: ${emailPassword.requireVerification ?? true},
    minPasswordLength: ${emailPassword.minLength ?? 8},
  },
  ${accountLinkingCode}
  ${sessionBlock}${customSessionBlock}
  trustedOrigins: ${JSON.stringify(trustedOrigins)},
  ${hooksBlock}${databaseHooksBlock}plugins: [
    ${enabledPlugins.map((p) => (p === "organization" && selectedOrgEntity ? `organization({ schema: "${selectedOrgEntity.data.label || "organization"}" })` : `${p}()`)).join(",\n    ")}${isPaymentsInjected ? ',\n    creem({ apiKey: process.env.CREEM_API_KEY!, webhookSecret: process.env.CREEM_WEBHOOK_SECRET! })' : ""}
  ]
});`;

  return (
    <AccordionItem
      value="preview"
      className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden"
    >
      <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 text-left flex-1">
          <Code2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Generated Code Preview
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-medium">
            auth.ts
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1">
        <div className="flex flex-col gap-3 pt-2">
          <Label className="text-xs font-semibold">Generated <code className="font-mono">auth.ts</code></Label>
          <pre className="p-3 bg-muted/80 rounded-lg text-[11px] font-mono border border-border/60 overflow-x-auto text-foreground whitespace-pre">
            {generatedCode}
          </pre>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
