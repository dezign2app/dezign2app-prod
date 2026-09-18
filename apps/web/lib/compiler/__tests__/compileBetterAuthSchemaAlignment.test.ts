import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { compileDatabaseNodes } from "../compileDatabaseNodes";
import { compileRawSqliteDatabase } from "../databases/sqlite/raw";

describe("Better Auth Database Schema Alignment", () => {
  it("synthesizes all required Better Auth plugin columns when auth & payments nodes are present", () => {
    const authNode: BackendNode = {
      id: "auth-1",
      type: "auth",
      data: {
        label: "Better Auth",
        framework: "better_auth",
        version: "1.6",
        plugins: ["bearer", "admin", "organization", "jwt"],
        paymentsPlugin: {
          provider: "creem",
          apiKeyEnv: "CREEM_API_KEY",
        },
      },
      position: { x: 0, y: 0 },
    };

    const paymentsNode: BackendNode = {
      id: "payments-1",
      type: "payments",
      data: {
        label: "Payments",
        provider: "creem",
      },
      position: { x: 100, y: 0 },
    };

    const edges: BackendEdge[] = [
      { id: "e1", source: "auth-1", target: "payments-1" },
    ];

    const result = compileDatabaseNodes([authNode, paymentsNode], edges);
    const connectionFile = result.files.find((f) => f.filename === "connection.ts");
    expect(connectionFile).toBeDefined();

    // Verify DDL / connection has all 8 required columns
    const content = connectionFile!.content;
    expect(content).toContain('"plan"');
    expect(content).toContain('"creemCustomerId"');
    expect(content).toContain('"impersonatedBy"');
    expect(content).toContain('"activeOrganizationId"');
    expect(content).toContain('"expiresAt"');
    expect(content).toContain('"alg"');
    expect(content).toContain('"crv"');
    expect(content).toContain('"createdAt"');
  });

  it("backfills pre-existing user & session canvas entities with missing auth and payments columns", () => {
    const customUserEntity: BackendNode = {
      id: "entity-user",
      type: "entity",
      data: {
        label: "user",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "email", type: "string" },
          { name: "customBio", type: "string" },
        ],
      },
      position: { x: 0, y: 0 },
    };

    const customSessionEntity: BackendNode = {
      id: "entity-session",
      type: "entity",
      data: {
        label: "session",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "token", type: "string" },
        ],
      },
      position: { x: 50, y: 0 },
    };

    const authNode: BackendNode = {
      id: "auth-1",
      type: "auth",
      data: {
        label: "Better Auth",
        plugins: ["bearer", "admin", "organization", "jwt"],
        paymentsPlugin: {
          provider: "creem",
        },
      },
      position: { x: 100, y: 0 },
    };

    const paymentsNode: BackendNode = {
      id: "payments-1",
      type: "payments",
      data: { label: "Payments" },
      position: { x: 150, y: 0 },
    };

    const edges: BackendEdge[] = [
      { id: "e1", source: "auth-1", target: "entity-user" },
    ];

    const result = compileDatabaseNodes(
      [customUserEntity, customSessionEntity, authNode, paymentsNode],
      edges,
    );

    // Verify helper files exist
    const userHelper = result.files.find((f) => f.filename === "helpers/user.ts");
    expect(userHelper).toBeDefined();

    // Verify custom column was preserved
    expect(userHelper!.content).toContain("customBio");
    // Verify plan and creemCustomerId were backfilled
    expect(userHelper!.content).toContain("plan");
    expect(userHelper!.content).toContain("creemCustomerId");

    const sessionHelper = result.files.find((f) => f.filename === "helpers/session.ts");
    expect(sessionHelper).toBeDefined();
    // Verify impersonatedBy and activeOrganizationId were backfilled
    expect(sessionHelper!.content).toContain("impersonatedBy");
    expect(sessionHelper!.content).toContain("activeOrganizationId");
  });

  it("compileRawSqliteDatabase generates complete DDL fallbacks and tableSchemas for Better Auth", () => {
    const result = compileRawSqliteDatabase([], []);
    const connectionFile = result.files.find((f) => f.filename === "connection.ts");
    expect(connectionFile).toBeDefined();

    const code = connectionFile!.content;

    // Verify user table has payment and admin fields in DDL and tableSchemas
    expect(code).toContain('\\"plan\\" TEXT');
    expect(code).toContain('\\"creemCustomerId\\" TEXT');
    expect(code).toContain('\\"role\\" TEXT');
    expect(code).toContain('\\"banned\\" INTEGER');

    // Verify session table has impersonatedBy and activeOrganizationId
    expect(code).toContain('\\"impersonatedBy\\" TEXT');
    expect(code).toContain('\\"activeOrganizationId\\" TEXT');

    // Verify invitation has createdAt
    expect(code).toContain('\\"invitation\\"');
    expect(code).toContain('\\"createdAt\\" TEXT');

    // Verify jwks has expiresAt, alg, crv
    expect(code).toContain('\\"jwks\\"');
    expect(code).toContain('\\"expiresAt\\" TEXT');
    expect(code).toContain('\\"alg\\" TEXT');
    expect(code).toContain('\\"crv\\" TEXT');

    // Also verify tableSchemas contains them for auto-migration
    expect(code).toContain('"name": "plan"');
    expect(code).toContain('"name": "creemCustomerId"');
    expect(code).toContain('"name": "impersonatedBy"');
    expect(code).toContain('"name": "activeOrganizationId"');
  });
});
