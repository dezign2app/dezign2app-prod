export interface SecurityHttpTrace {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  requestHeaders: Record<string, string>;
  requestPayload?: string;
  responseStatus: number;
  responseStatusText: string;
  responseHeaders: Record<string, string>;
  responseBody: string;
  latencyMs: number;
}

export interface SecurityDiffPreview {
  filename: string;
  additions: number;
  deletions: number;
  lines: { type: "add" | "remove" | "normal"; text: string }[];
}

export interface CvssAdvisory {
  score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  vectorString: string;
  cwe: string;
  cweTitle: string;
  owasp: string;
  owaspTitle: string;
  impactDescription: string;
  remediationRecommendation: string;
}

export interface SecurityStep {
  id: number;
  title: string;
  phase: "Recon" | "Fuzzing" | "Vulnerability" | "Auto-Patch" | "Mitigated";
  badge: string;
  desc: string;
  agentTarget: { x: number; y: number };
  targetNodeCenter: { x: number; y: number };
  activeNodeId: string;
  droneMsg: string;
  subAction: string;
  terminalLogs: string[];
  httpTrace: SecurityHttpTrace;
  diffPreview?: SecurityDiffPreview;
  advisory?: CvssAdvisory;
}

export interface SecurityVectorDef {
  id: string;
  displayNumber: string;
  title: string;
  summary: string;
  cwe: string;
  owasp: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  cvssScore: number;
  targetNodeTitle: string;
  endpointPath: string;
  attackType: string;
  steps: SecurityStep[];
}

export const SECURITY_VECTORS: SecurityVectorDef[] = [
  {
    id: "VECT-701",
    displayNumber: "#701",
    title: "Broken Object Level Authorization (BOLA / IDOR)",
    summary:
      "Attacker substitutes conversationId to access other tenants' private chat streams and post messages into unauthorized enterprise rooms without permission validation.",
    cwe: "CWE-639",
    owasp: "API1:2023",
    severity: "CRITICAL",
    cvssScore: 9.1,
    targetNodeTitle: "/chat ➔ chat-service",
    endpointPath: "POST /send-message & GET /chat/:id",
    attackType: "Horizontal Privilege Escalation (IDOR)",
    steps: [
      {
        id: 0,
        title: "Recon & Endpoint Discovery",
        phase: "Recon",
        badge: "PHASE 1/5",
        desc: "Automated crawler disassembles route contracts and OpenAPI manifests, cataloging parameter schema for /chat and POST /send-message.",
        agentTarget: { x: 700, y: 35 },
        targetNodeCenter: { x: 750, y: 190 },
        activeNodeId: "chat-page",
        droneMsg:
          "Fingerprinting endpoint schemas on /chat/[id] ... discovered POST /send-message handler accepting JSON parameter `conversationId` without tenant scoping header.",
        subAction: "Extracting endpoint parameters from client bundle",
        terminalLogs: [
          "[RECON] Initiating endpoint surface discovery on :3000...",
          "[RECON] Parsed Next.js route: /chat/[id]/page.tsx",
          "[RECON] Identified client POST trigger -> http://chat-service:3002/send-message",
          "[RECON] Target parameter discovered: `conversationId: string` (UUID v4 format)",
          "[RECON] Auth mechanism identified: Bearer JWT in Authorization header",
          "[STATUS] Recon complete. Target endpoint queued for IDOR parameter fuzzing.",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/chat/conv_alpha_4420",
          requestHeaders: {
            "Host": "api.dezign2app.internal",
            "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.tenant_alice...",
            "User-Agent": "Dezign2App-Security-Scanner/2.4 (Ethical Fuzzer)",
          },
          responseStatus: 200,
          responseStatusText: "OK",
          responseHeaders: {
            "Content-Type": "application/json",
            "Server": "Express/4.19",
          },
          responseBody: JSON.stringify(
            { id: "conv_alpha_4420", title: "Alice Private Chat", tenantId: "tenant_alice", messages: 14 },
            null,
            2
          ),
          latencyMs: 18,
        },
        advisory: {
          score: 9.1,
          severity: "CRITICAL",
          vectorString: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N",
          cwe: "CWE-639",
          cweTitle: "Authorization Bypass Through User-Controlled Key",
          owasp: "API1:2023",
          owaspTitle: "Broken Object Level Authorization (BOLA)",
          impactDescription:
            "Attacker can read, modify, and exfiltrate private messages across all organization tenants by manipulating IDs.",
          remediationRecommendation:
            "Validate that the authenticated session user belongs to the requested object tenant at the service query boundary.",
        },
      },
      {
        id: 1,
        title: "Fuzzing Parameter Manipulation",
        phase: "Fuzzing",
        badge: "PHASE 2/5",
        desc: "Injecting cross-tenant UUID keys into POST /send-message using Tenant-A auth token against Tenant-B conversation channels.",
        agentTarget: { x: 1250, y: 35 },
        targetNodeCenter: { x: 1300, y: 202 },
        activeNodeId: "chat-service",
        droneMsg:
          "Injecting forged tenant ID: Sending Alice's token with Bob's enterprise channel UUID (`conv_enterprise_victim_991`). Monitoring response diff.",
        subAction: "Injecting cross-tenant payloads into chat-service:3002",
        terminalLogs: [
          "[FUZZ] Generating 64 cross-tenant permutation vectors...",
          "[FUZZ] Sending payload with Subject: tenant_alice_user -> conversationId: conv_enterprise_victim_991",
          "[FUZZ] POST http://chat-service:3002/send-message HTTP/1.1",
          "[PROBE] Payload: { conversationId: 'conv_enterprise_victim_991', content: 'EXPLOIT_TEST_PROBE' }",
          "[PROBE] Response status received: 200 OK (Unchecked Object Access!)",
          "[ALERT] Anomaly: Service processed request without verifying resource ownership against session context!",
        ],
        httpTrace: {
          method: "POST",
          url: "https://api.dezign2app.internal/send-message",
          requestHeaders: {
            "Host": "api.dezign2app.internal",
            "Authorization": "Bearer eyJhbGciOiJSUzI1NiJ9.tenant_alice...",
            "Content-Type": "application/json",
            "X-Security-Audit": "true",
          },
          requestPayload: JSON.stringify(
            {
              conversationId: "conv_enterprise_victim_991",
              content: "EXPLOIT_VERIFY_CROSS_TENANT_INJECTION",
            },
            null,
            2
          ),
          responseStatus: 200,
          responseStatusText: "OK (Vulnerable)",
          responseHeaders: {
            "Content-Type": "application/json",
            "X-Vulnerability-Warning": "Unverified Object ID",
          },
          responseBody: JSON.stringify(
            {
              status: "delivered",
              messageId: "msg_exploit_994",
              broadcastTarget: "topic:message.sent",
              warning: "Zero tenancy verification executed",
            },
            null,
            2
          ),
          latencyMs: 24,
        },
        advisory: {
          score: 9.1,
          severity: "CRITICAL",
          vectorString: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N",
          cwe: "CWE-639",
          cweTitle: "Authorization Bypass Through User-Controlled Key",
          owasp: "API1:2023",
          owaspTitle: "Broken Object Level Authorization (BOLA)",
          impactDescription:
            "Attacker can read, modify, and exfiltrate private messages across all organization tenants by manipulating IDs.",
          remediationRecommendation:
            "Validate that the authenticated session user belongs to the requested object tenant at the service query boundary.",
        },
      },
      {
        id: 2,
        title: "Vulnerability Confirmed (BOLA)",
        phase: "Vulnerability",
        badge: "CRITICAL EXPLOIT",
        desc: "Exploit confirmed: Tenant A successfully published arbitrary messages into Tenant B's private queue. Root cause: Missing tenancy WHERE clause.",
        agentTarget: { x: 1250, y: 35 },
        targetNodeCenter: { x: 1300, y: 202 },
        activeNodeId: "chat-service",
        droneMsg:
          "Vulnerability Verified: chat-service accepted foreign tenant write! Root cause in `handleSendMessage`: Missing `where(eq(conversations.tenantId, session.tenantId))` guard.",
        subAction: "Flagging CWE-639 High-Severity Finding in Audit Log",
        terminalLogs: [
          "[CRITICAL] EXPLOIT CONFIRMED: Broken Object Level Authorization (CWE-639)",
          "[ANALYSIS] chat-service accepted foreign tenant write without verifying database ownership.",
          "[METRICS] Exploit success rate: 100% (42/42 fuzzed IDs accepted)",
          "[AUDIT LOG] Recorded finding: CVE-DEZIGN-2026-042 (CVSS 9.1 Critical)",
          "[SYNTHESIS] Initiating automated TypeScript guard synthesis to patch endpoint...",
        ],
        httpTrace: {
          method: "POST",
          url: "https://api.dezign2app.internal/send-message",
          requestHeaders: {
            "Host": "api.dezign2app.internal",
            "Authorization": "Bearer tenant_alice_token",
            "Content-Type": "application/json",
          },
          requestPayload: JSON.stringify(
            { conversationId: "conv_enterprise_victim_991", content: "[INJECTED_UNAUTHORIZED_PAYLOAD]" },
            null,
            2
          ),
          responseStatus: 200,
          responseStatusText: "OK (Data Leaked)",
          responseHeaders: {
            "Content-Type": "application/json",
            "X-Tenant-Isolation": "FAIL",
          },
          responseBody: JSON.stringify(
            { success: true, leakedChannel: "enterprise-boardroom", broadcastSent: true },
            null,
            2
          ),
          latencyMs: 21,
        },
        advisory: {
          score: 9.1,
          severity: "CRITICAL",
          vectorString: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N",
          cwe: "CWE-639",
          cweTitle: "Authorization Bypass Through User-Controlled Key",
          owasp: "API1:2023",
          owaspTitle: "Broken Object Level Authorization (BOLA)",
          impactDescription:
            "Attacker can read, modify, and exfiltrate private messages across all organization tenants by manipulating IDs.",
          remediationRecommendation:
            "Validate that the authenticated session user belongs to the requested object tenant at the service query boundary.",
        },
      },
      {
        id: 3,
        title: "Automated Shield Patch Synthesized",
        phase: "Auto-Patch",
        badge: "CODE REMEDIATION",
        desc: "Synthesizing Zod schema validation and a tenant-scoped database guard middleware with cryptographic session validation.",
        agentTarget: { x: 990, y: 220 },
        targetNodeCenter: { x: 1030, y: 367 },
        activeNodeId: "table-ref",
        droneMsg:
          "Synthesizing patch: Injecting `verifyTenantMembership()` middleware and compounding SQL query with `and(eq(conv.id, id), eq(conv.tenantId, auth.tenantId))`.",
        subAction: "Applying patch diff to chat-service/src/guards/tenantGuard.ts",
        terminalLogs: [
          "[PATCH] Formulating remediation diff for chat-service handler...",
          "[PATCH] Adding Zod payload schema: `SendMessageSchema.refine(...)`",
          "[PATCH] Compounding DB query with tenant ownership predicate:",
          "[PATCH] + const record = await db.query.conversations.findFirst({",
          "[PATCH] +   where: and(eq(c.id, input.conversationId), eq(c.tenantId, session.tenantId))",
          "[PATCH] + });",
          "[PATCH] + if (!record) throw new ForbiddenError('BOLA Violation: Tenancy mismatch');",
          "[COMPILE] Hot-reloading chat-service with compiled security middleware...",
          "[COMPILE] TypeScript check passed. Zero runtime errors.",
        ],
        httpTrace: {
          method: "POST",
          url: "https://api.dezign2app.internal/send-message",
          requestHeaders: {
            "Host": "api.dezign2app.internal",
            "Authorization": "Bearer tenant_alice_token",
            "Content-Type": "application/json",
          },
          requestPayload: JSON.stringify(
            { conversationId: "conv_enterprise_victim_991", content: "TEST_RECHECK" },
            null,
            2
          ),
          responseStatus: 403,
          responseStatusText: "Forbidden",
          responseHeaders: {
            "Content-Type": "application/json",
            "X-Security-Enforced": "TenantGuard/1.0",
          },
          responseBody: JSON.stringify(
            { error: "ForbiddenError", message: "Resource not owned by authenticated tenant", code: "TENANT_MISMATCH" },
            null,
            2
          ),
          latencyMs: 12,
        },
        diffPreview: {
          filename: "services/chat/src/routes/sendMessage.ts",
          additions: 11,
          deletions: 3,
          lines: [
            { type: "normal", text: " export async function handleSendMessage(req: Request, res: Response) {" },
            { type: "normal", text: "   const { conversationId, content } = req.body;" },
            { type: "remove", text: "-  // VULNERABLE: Direct lookup without tenant verification" },
            { type: "remove", text: "-  const conv = await db.select().from(conversations)" },
            { type: "remove", text: "-    .where(eq(conversations.id, conversationId));" },
            { type: "add", text: "+  // HARDENED: Strict tenant membership verification" },
            { type: "add", text: "+  const session = await requireAuth(req);" },
            { type: "add", text: "+  const conv = await db.select().from(conversations)" },
            { type: "add", text: "+    .where(and(" },
            { type: "add", text: "+      eq(conversations.id, conversationId)," },
            { type: "add", text: "+      eq(conversations.tenantId, session.tenantId)" },
            { type: "add", text: "+    ));" },
            { type: "add", text: "+  if (!conv || conv.length === 0) {" },
            { type: "add", text: "+    return res.status(403).json({ error: 'CWE-639 BOLA: Tenancy Access Denied' });" },
            { type: "add", text: "+  }" },
            { type: "normal", text: "   await kafkaProducer.publish('message.sent', { conversationId, content });" },
          ],
        },
      },
      {
        id: 4,
        title: "Retest Verified: Exploit Mitigated",
        phase: "Mitigated",
        badge: "VERIFIED SECURE (100%)",
        desc: "Automated regression fuzzer retested all 64 vectors against the patched endpoint. Result: 100% blocked with HTTP 403 Forbidden.",
        agentTarget: { x: 1250, y: 35 },
        targetNodeCenter: { x: 1300, y: 202 },
        activeNodeId: "chat-service",
        droneMsg:
          "Penetration Retest: 100% Passed! All 64 malicious cross-tenant payloads blocked with HTTP 403 Forbidden. Zero data leakage. Security posture verified.",
        subAction: "Audit complete: Endpoint certified against OWASP API1:2023",
        terminalLogs: [
          "[RETEST] Executing regression pentest with 64 IDOR attack vectors...",
          "[RETEST] Vector 1/64: POST /send-message (victim_tenant_991) -> 403 Forbidden [BLOCKED]",
          "[RETEST] Vector 16/64: POST /send-message (admin_org_root) -> 403 Forbidden [BLOCKED]",
          "[RETEST] Vector 64/64: POST /send-message (wildcard_inject) -> 403 Forbidden [BLOCKED]",
          "[SUCCESS] Exploit mitigation verified. Defense-in-depth barrier active.",
          "[CERTIFIED] Endpoint /chat/[id] is fortified against OWASP API1:2023 (BOLA / IDOR).",
        ],
        httpTrace: {
          method: "POST",
          url: "https://api.dezign2app.internal/send-message",
          requestHeaders: {
            "Host": "api.dezign2app.internal",
            "Authorization": "Bearer tenant_alice_token",
            "Content-Type": "application/json",
          },
          requestPayload: JSON.stringify(
            { conversationId: "conv_enterprise_victim_991", content: "ATTACK_AFTER_PATCH" },
            null,
            2
          ),
          responseStatus: 403,
          responseStatusText: "Forbidden (Exploit Blocked)",
          responseHeaders: {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
            "X-Security-Audit": "BLOCKED_BOLA_ATTACK",
          },
          responseBody: JSON.stringify(
            {
              error: "Forbidden",
              message: "Access to conversation denied for current tenant context",
              remediation: "Passed OWASP API1 Verification",
            },
            null,
            2
          ),
          latencyMs: 8,
        },
        diffPreview: {
          filename: "services/chat/src/routes/sendMessage.ts",
          additions: 11,
          deletions: 3,
          lines: [
            { type: "normal", text: " export async function handleSendMessage(req: Request, res: Response) {" },
            { type: "normal", text: "   const { conversationId, content } = req.body;" },
            { type: "add", text: "+  // HARDENED: Strict tenant membership verification" },
            { type: "add", text: "+  const session = await requireAuth(req);" },
            { type: "add", text: "+  const conv = await db.select().from(conversations)" },
            { type: "add", text: "+    .where(and(" },
            { type: "add", text: "+      eq(conversations.id, conversationId)," },
            { type: "add", text: "+      eq(conversations.tenantId, session.tenantId)" },
            { type: "add", text: "+    ));" },
            { type: "add", text: "+  if (!conv || conv.length === 0) {" },
            { type: "add", text: "+    return res.status(403).json({ error: 'CWE-639 BOLA: Tenancy Access Denied' });" },
            { type: "add", text: "+  }" },
            { type: "normal", text: "   await kafkaProducer.publish('message.sent', { conversationId, content });" },
          ],
        },
        advisory: {
          score: 0.0,
          severity: "LOW",
          vectorString: "MITIGATED (Zero Risk)",
          cwe: "CWE-639",
          cweTitle: "Authorization Bypass - Mitigated",
          owasp: "API1:2023",
          owaspTitle: "Broken Object Level Authorization (PASSED)",
          impactDescription:
            "Vulnerability successfully eliminated. Tenancy guard cryptographically enforces isolation.",
          remediationRecommendation:
            "Automated CI/CD security regression test added to pre-commit hook.",
        },
      },
    ],
  },
  {
    id: "VECT-702",
    displayNumber: "#702",
    title: "SQL Injection & Parameter Escaping Bypass",
    summary:
      "Attacker injects unescaped SQL fragments via search query parameters (?filter=' OR 1=1;--) targeting PostgreSQL conversations table to dump customer chat records.",
    cwe: "CWE-89",
    owasp: "API8:2023",
    severity: "HIGH",
    cvssScore: 8.6,
    targetNodeTitle: "chat-service ➔ table-ref",
    endpointPath: "GET /chat/search?q=",
    attackType: "SQL Injection / AST Escape",
    steps: [
      {
        id: 0,
        title: "Recon & SQL Query Surface",
        phase: "Recon",
        badge: "PHASE 1/5",
        desc: "Scanning search parameters on GET /chat/search. Detected raw template literal string concatenation inside database repository.",
        agentTarget: { x: 1250, y: 35 },
        targetNodeCenter: { x: 1300, y: 202 },
        activeNodeId: "chat-service",
        droneMsg:
          "Probing GET /chat/search?q= parameter ... detected unescaped template literal string interpolation in SQL query constructor.",
        subAction: "Inspecting query builder AST in database repository",
        terminalLogs: [
          "[RECON] Analyzing query parameter parsing on chat-service:3002...",
          "[RECON] Found route: GET /chat/search?query=:string",
          "[RECON] Examining repository layer: conversationsRepository.search()",
          "[WARN] Detected raw query construction: `SELECT * FROM conversations WHERE title ILIKE '%${query}%'`",
          "[ALERT] Untrusted user input is directly concatenated without parameter binding!",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/chat/search?query=design",
          requestHeaders: {
            "Host": "api.dezign2app.internal",
            "Authorization": "Bearer session_token_normal",
          },
          responseStatus: 200,
          responseStatusText: "OK",
          responseHeaders: { "Content-Type": "application/json" },
          responseBody: JSON.stringify([{ id: "conv_1", title: "App Design System" }], null, 2),
          latencyMs: 14,
        },
        advisory: {
          score: 8.6,
          severity: "HIGH",
          vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
          cwe: "CWE-89",
          cweTitle: "Improper Neutralization of Special Elements used in an SQL Command",
          owasp: "API8:2023",
          owaspTitle: "Security Misconfiguration / Injection",
          impactDescription:
            "Attacker can extract confidential database tables, modify state, or execute arbitrary database commands.",
          remediationRecommendation:
            "Use strictly parameterized SQL queries via Drizzle ORM / prepared statements.",
        },
      },
      {
        id: 1,
        title: "SQLi Exploit Payload Injection",
        phase: "Fuzzing",
        badge: "PHASE 2/5",
        desc: "Injecting tautological SQL expressions (' OR 1=1;--) and schema extraction probes into query string.",
        agentTarget: { x: 990, y: 220 },
        targetNodeCenter: { x: 1030, y: 367 },
        activeNodeId: "table-ref",
        droneMsg:
          "Executing SQL injection probe: `?query=' UNION SELECT id, password_hash, email FROM users--`. Evaluating PostgreSQL execution plan.",
        subAction: "Transmitting injection payload to database node",
        terminalLogs: [
          "[FUZZ] Injecting SQL syntax boundary breakers...",
          "[FUZZ] Testing payload: ' OR '1'='1' --",
          "[FUZZ] Testing payload: ' UNION SELECT NULL, version(), NULL --",
          "[PROBE] SQL query dispatched to PostgreSQL primary :5432",
          "[ALERT] Syntax breakout successful! PostgreSQL executed unparameterized query fragment.",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/chat/search?query='%20OR%201=1;--",
          requestHeaders: {
            "Host": "api.dezign2app.internal",
            "Authorization": "Bearer session_token_test",
          },
          responseStatus: 200,
          responseStatusText: "OK (Exploit Leaking)",
          responseHeaders: { "Content-Type": "application/json" },
          responseBody: JSON.stringify(
            { recordsDumped: 1420, sample: "Dumped all 1,420 tenant records due to tautology" },
            null,
            2
          ),
          latencyMs: 38,
        },
      },
      {
        id: 2,
        title: "Vulnerability Confirmed (CWE-89)",
        phase: "Vulnerability",
        badge: "SQL INJECTION DETECTED",
        desc: "PostgreSQL returned full table dump. Raw SQL concatenation bypassed authorization filters and dumped 1,420 conversations.",
        agentTarget: { x: 990, y: 220 },
        targetNodeCenter: { x: 1030, y: 367 },
        activeNodeId: "table-ref",
        droneMsg:
          "High Severity SQLi Confirmed! Untrusted input altered query logic. Full conversations table exfiltrated. Generating AST parameterization patch.",
        subAction: "Flagging CWE-89 High Severity finding in security ledger",
        terminalLogs: [
          "[CRITICAL] Vulnerability confirmed: SQL Injection (CWE-89)",
          "[ANALYSIS] Raw string interpolation allowed query structure manipulation.",
          "[METRICS] Table dump rate: 100% of rows returned without tenant scoping.",
          "[SYNTHESIS] Synthesizing Drizzle ORM parameterized query patch...",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/chat/search?query='%20OR%201=1;--",
          requestHeaders: { "Host": "api.dezign2app.internal" },
          responseStatus: 200,
          responseStatusText: "OK (Data Leaked)",
          responseHeaders: { "Content-Type": "application/json" },
          responseBody: JSON.stringify({ error: null, count: 1420, leaked: true }, null, 2),
          latencyMs: 35,
        },
      },
      {
        id: 3,
        title: "Parameterized Query Patch Applied",
        phase: "Auto-Patch",
        badge: "CODE REMEDIATION",
        desc: "Replacing raw string concatenation with Drizzle ORM ilike(conversations.title, sql.param(`%${query}%`)) and input sanitization.",
        agentTarget: { x: 990, y: 220 },
        targetNodeCenter: { x: 1030, y: 367 },
        activeNodeId: "table-ref",
        droneMsg:
          "Patch synthesized: Converted query to prepared statement with parameter binding. Special characters escaped automatically by DB driver.",
        subAction: "Replacing raw SQL with Drizzle parameterized query",
        terminalLogs: [
          "[PATCH] Refactoring search query builder in repository:",
          "[PATCH] - const sqlQuery = `SELECT * FROM conversations WHERE title ILIKE '%${query}%'`;",
          "[PATCH] + const queryPattern = `%${sanitizeSearchQuery(query)}%`;",
          "[PATCH] + return await db.select().from(conversations)",
          "[PATCH] +   .where(ilike(conversations.title, sql.param(queryPattern)));",
          "[COMPILE] Typecheck and schema validation: 0 errors.",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/chat/search?query='%20OR%201=1;--",
          requestHeaders: { "Host": "api.dezign2app.internal" },
          responseStatus: 200,
          responseStatusText: "OK (Sanitized Empty)",
          responseHeaders: { "Content-Type": "application/json" },
          responseBody: JSON.stringify([], null, 2),
          latencyMs: 11,
        },
        diffPreview: {
          filename: "services/chat/src/db/conversations.ts",
          additions: 5,
          deletions: 2,
          lines: [
            { type: "normal", text: " export async function searchConversations(query: string) {" },
            { type: "remove", text: "-  // VULNERABLE: Raw SQL interpolation" },
            { type: "remove", text: "-  return await db.execute(sql`SELECT * FROM conversations WHERE title ILIKE '%${query}%'`);" },
            { type: "add", text: "+  // HARDENED: Parameterized prepared statement via Drizzle ORM" },
            { type: "add", text: "+  const cleanPattern = `%${query.replace(/[%_\\]/g, '\\\\$&')}%`;" },
            { type: "add", text: "+  return await db.select().from(conversations)" },
            { type: "add", text: "+    .where(ilike(conversations.title, sql.param(cleanPattern)));" },
            { type: "normal", text: " }" },
          ],
        },
      },
      {
        id: 4,
        title: "Retest Verified: SQLi Neutralized",
        phase: "Mitigated",
        badge: "VERIFIED SECURE (100%)",
        desc: "All injection probes treated as literal strings. Zero syntax execution. Prepared statements prevent command tampering.",
        agentTarget: { x: 990, y: 220 },
        targetNodeCenter: { x: 1030, y: 367 },
        activeNodeId: "table-ref",
        droneMsg:
          "Retest Succeeded! Injected query executed safely as literal parameter. Zero SQL commands triggered. Database fortified.",
        subAction: "Closing finding: CWE-89 marked Remediated",
        terminalLogs: [
          "[RETEST] Fuzzing with 48 SQL injection vectors...",
          "[RETEST] Tautology probes: Treated as literal string ' OR 1=1;-- [0 matches]",
          "[RETEST] UNION SELECT probes: Parameter escaped safely [0 matches]",
          "[SUCCESS] SQL Injection vector neutralized. Prepared statement compiler verified.",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/chat/search?query='%20OR%201=1;--",
          requestHeaders: { "Host": "api.dezign2app.internal" },
          responseStatus: 200,
          responseStatusText: "OK (0 Results Safe)",
          responseHeaders: {
            "Content-Type": "application/json",
            "X-Parameterized-Query": "true",
          },
          responseBody: JSON.stringify([], null, 2),
          latencyMs: 9,
        },
      },
    ],
  },
  {
    id: "VECT-703",
    displayNumber: "#703",
    title: "JWT Algorithm Confusion & Signature Bypass",
    summary:
      "Attacker crafts unauthorized JWT token with alg: none and forged superadmin role claim to bypass Better Auth session guards without a private key.",
    cwe: "CWE-327",
    owasp: "API2:2023",
    severity: "CRITICAL",
    cvssScore: 9.8,
    targetNodeTitle: "auth ➔ webapp",
    endpointPath: "POST /api/auth/session & Middleware",
    attackType: "Cryptographic Alg Confusion (alg: none)",
    steps: [
      {
        id: 0,
        title: "Recon & JWKS Public Keys",
        phase: "Recon",
        badge: "PHASE 1/5",
        desc: "Auditing JWT token verification configuration in Better Auth middleware. Checking allowed algorithms and signature enforcement.",
        agentTarget: { x: 120, y: 210 },
        targetNodeCenter: { x: 165, y: 380 },
        activeNodeId: "auth",
        droneMsg:
          "Auditing Better Auth JWT verification: Inspecting header validation logic. Checking whether `alg: none` or symmetric HMAC fallback is permitted.",
        subAction: "Auditing auth token parser configuration",
        terminalLogs: [
          "[RECON] Auditing auth server on :3000 / Better Auth module...",
          "[RECON] Checking JWT verification options in auth.config.ts",
          "[WARN] jwt.verify() called without explicit `algorithms: ['RS256']` whitelist!",
          "[ALERT] Token decoder relies on `header.alg` directly supplied by the client!",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/api/auth/session",
          requestHeaders: { "Host": "api.dezign2app.internal" },
          responseStatus: 401,
          responseStatusText: "Unauthorized",
          responseHeaders: { "Content-Type": "application/json" },
          responseBody: JSON.stringify({ error: "Session required" }, null, 2),
          latencyMs: 12,
        },
      },
      {
        id: 1,
        title: "Forged alg: none Token Injection",
        phase: "Fuzzing",
        badge: "PHASE 2/5",
        desc: "Transmitting crafted unsigned JWT with alg: none and elevated claims: { role: 'superadmin', tenantId: '*' }.",
        agentTarget: { x: 400, y: 190 },
        targetNodeCenter: { x: 455, y: 380 },
        activeNodeId: "webapp",
        droneMsg:
          "Injecting unsigned JWT: Header `{\"alg\": \"none\"}` with payload `{\"role\": \"superadmin\"}`. Testing Next.js middleware guard.",
        subAction: "Submitting unsigned forged token to webapp:3000",
        terminalLogs: [
          "[FUZZ] Generating forged token with alg: none...",
          "[FUZZ] Header: eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0",
          "[FUZZ] Claims: { sub: 'attacker_root', role: 'superadmin', exp: 1893456000 }",
          "[FUZZ] Signature: [EMPTY]",
          "[PROBE] Sending to Next.js middleware guard on /dashboard/admin...",
          "[ALERT] Middleware accepted token! Root session granted without cryptographic proof!",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/dashboard/admin",
          requestHeaders: {
            "Host": "api.dezign2app.internal",
            "Authorization": "Bearer eyJhbGciOiJub25lIn0.eyJyb2xlIjoic3VwZXJhZG1pbiJ9.",
          },
          responseStatus: 200,
          responseStatusText: "OK (Admin Access Granted)",
          responseHeaders: { "Content-Type": "application/json" },
          responseBody: JSON.stringify({ user: "attacker_root", role: "superadmin", granted: true }, null, 2),
          latencyMs: 16,
        },
      },
      {
        id: 2,
        title: "Vulnerability Confirmed (CWE-327)",
        phase: "Vulnerability",
        badge: "CRITICAL AUTH BYPASS",
        desc: "Attacker achieved superadmin privileges without credentials. Middleware verified token header blindly without algorithm constraint.",
        agentTarget: { x: 120, y: 210 },
        targetNodeCenter: { x: 165, y: 380 },
        activeNodeId: "auth",
        droneMsg:
          "Critical Auth Failure Confirmed! `alg: none` bypass gave root access. Synthesizing strict RS256 JWKS asymmetric signature validator.",
        subAction: "Flagging CWE-327 Critical in Security Ledger",
        terminalLogs: [
          "[CRITICAL] Authentication Bypass via Cryptographic Confusion (CWE-327)",
          "[ANALYSIS] Parser evaluated `alg: none` and skipped signature verification.",
          "[IMPACT] Complete account takeover and administrative privilege escalation.",
          "[SYNTHESIS] Synthesizing strict asymmetric RS256 verification middleware...",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/dashboard/admin",
          requestHeaders: { "Host": "api.dezign2app.internal" },
          responseStatus: 200,
          responseStatusText: "OK (Superadmin Hijack)",
          responseHeaders: { "Content-Type": "application/json" },
          responseBody: JSON.stringify({ privileged: true, access: "ALL_RESOURCES" }, null, 2),
          latencyMs: 18,
        },
      },
      {
        id: 3,
        title: "Strict RS256 Asymmetric Patch Applied",
        phase: "Auto-Patch",
        badge: "CODE REMEDIATION",
        desc: "Enforcing algorithms: ['RS256'] with JWKS key rotation, reject alg: none, and validating issuer/audience claims strictly.",
        agentTarget: { x: 120, y: 210 },
        targetNodeCenter: { x: 165, y: 380 },
        activeNodeId: "auth",
        droneMsg:
          "Applying cryptographic patch: Hardening Better Auth config to explicitly enforce `algorithms: ['RS256']` and reject unsigned tokens.",
        subAction: "Patching auth.config.ts with strict JWT verification rules",
        terminalLogs: [
          "[PATCH] Updating Better Auth token verification config:",
          "[PATCH] + jwtVerifyOptions: {",
          "[PATCH] +   algorithms: ['RS256'], // Reject 'none' & HMAC confusion",
          "[PATCH] +   issuer: 'https://auth.dezign2app.internal',",
          "[PATCH] +   audience: 'dezign2app-api',",
          "[PATCH] +   clockTolerance: 10 // max 10s drift",
          "[PATCH] + }",
          "[COMPILE] TypeScript check passed. Auth guard recompiled.",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/dashboard/admin",
          requestHeaders: {
            "Host": "api.dezign2app.internal",
            "Authorization": "Bearer eyJhbGciOiJub25lIn0.eyJyb2xlIjoic3VwZXJhZG1pbiJ9.",
          },
          responseStatus: 401,
          responseStatusText: "Unauthorized",
          responseHeaders: {
            "Content-Type": "application/json",
            "WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"Algorithm not allowed\"",
          },
          responseBody: JSON.stringify(
            { error: "InvalidToken", message: "Algorithm 'none' rejected. Strict RS256 required." },
            null,
            2
          ),
          latencyMs: 7,
        },
        diffPreview: {
          filename: "packages/auth/src/jwtGuard.ts",
          additions: 6,
          deletions: 2,
          lines: [
            { type: "normal", text: " export async function verifyAuthToken(token: string) {" },
            { type: "remove", text: "-  // VULNERABLE: Direct decode without algorithm constraint" },
            { type: "remove", text: "-  return jwt.verify(token, getPublicKey());" },
            { type: "add", text: "+  // HARDENED: Explicit asymmetric algorithm enforcement" },
            { type: "add", text: "+  return jwt.verify(token, getPublicKey(), {" },
            { type: "add", text: "+    algorithms: ['RS256'], // Explicit whitelist; rejects 'none' & HMAC" },
            { type: "add", text: "+    issuer: 'https://auth.dezign2app.internal'," },
            { type: "add", text: "+    maxAge: '2h'" },
            { type: "add", text: "+  });" },
            { type: "normal", text: " }" },
          ],
        },
      },
      {
        id: 4,
        title: "Retest Verified: Auth Guard Fortified",
        phase: "Mitigated",
        badge: "VERIFIED SECURE (100%)",
        desc: "All unsigned, altered, or HMAC-confused tokens rejected with HTTP 401 Unauthorized. Asymmetric cryptography verified.",
        agentTarget: { x: 120, y: 210 },
        targetNodeCenter: { x: 165, y: 380 },
        activeNodeId: "auth",
        droneMsg:
          "Retest Succeeded! All forged tokens rejected with HTTP 401. Only genuine RS256 private key signed tokens accepted.",
        subAction: "Auth verification certified against OWASP API2:2023",
        terminalLogs: [
          "[RETEST] Injecting 32 forged algorithm tokens...",
          "[RETEST] Token with alg: none -> 401 Unauthorized [BLOCKED]",
          "[RETEST] Token with alg: HS256 key confusion -> 401 Unauthorized [BLOCKED]",
          "[RETEST] Token with expired claim -> 401 Unauthorized [BLOCKED]",
          "[SUCCESS] Better Auth guard cryptographically impenetrable.",
        ],
        httpTrace: {
          method: "GET",
          url: "https://api.dezign2app.internal/dashboard/admin",
          requestHeaders: { "Host": "api.dezign2app.internal" },
          responseStatus: 401,
          responseStatusText: "Unauthorized (Attack Blocked)",
          responseHeaders: {
            "Content-Type": "application/json",
            "X-Security-Policy": "Strict-RS256",
          },
          responseBody: JSON.stringify({ error: "Unauthorized", code: "ALGORITHM_MISMATCH" }, null, 2),
          latencyMs: 6,
        },
      },
    ],
  },
];
