import { describe, it, expect, afterEach } from "vitest";
import { POST as testLivePost } from "@/app/api/operations/test-live/route";
import { POST as checkConnectionPost } from "@/app/api/operations/check-connection/route";
import { resolveSqlitePath } from "../sqliteRunner";
import { NextRequest } from "next/server";
import fs from "fs";

const TEST_DB = "test-studio-dev.db";

describe("SQLite Live and Sandbox Test Studio Execution", () => {
  afterEach(() => {
    const resolved = resolveSqlitePath(TEST_DB);
    if (fs.existsSync(resolved)) {
      try {
        fs.unlinkSync(resolved);
      } catch {}
    }
    try {
      fs.unlinkSync(`${resolved}-wal`);
    } catch {}
    try {
      fs.unlinkSync(`${resolved}-shm`);
    } catch {}
  });

  it("executes SQLite operation in Live mode against real SQLite dev.db", async () => {
    // 1. Create a real record first
    const createReq = new NextRequest("http://localhost:3000/api/operations/test-live", {
      method: "POST",
      body: JSON.stringify({
        engine: "sqlite",
        connection: { dbFilePath: TEST_DB },
        operation: {
          id: "auto-create-conversations",
          name: "createConversation",
          kind: "create",
        },
        args: {
          id: "conv-101",
          data: { title: "Live SQLite Conversation" },
        },
        mode: "live",
      }),
    });
    const createRes = await testLivePost(createReq);
    expect(createRes.status).toBe(200);
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    expect(createJson.output).toMatchObject({ id: "conv-101", title: "Live SQLite Conversation" });

    // 2. Query all records - fetches real record from dev.db
    const req = new NextRequest("http://localhost:3000/api/operations/test-live", {
      method: "POST",
      body: JSON.stringify({
        engine: "sqlite",
        connection: {
          dbFilePath: TEST_DB,
        },
        operation: {
          id: "auto-find-all-conversations",
          name: "findAllConversations",
          kind: "findAll",
          params: [
            { name: "limit", type: "number", defaultValue: "20" },
            { name: "offset", type: "number", defaultValue: "0" },
          ],
        },
        args: {
          limit: 20,
          offset: 0,
        },
        mode: "live",
      }),
    });

    const res = await testLivePost(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.serverActive).toBe(true);
    expect(json.mode).toBe("live");
    expect(json.connection).toBe(`sqlite:${TEST_DB}`);
    expect(json.rawCommand).toContain("SELECT * FROM conversations LIMIT 20 OFFSET 0");
    expect(Array.isArray(json.output)).toBe(true);
    expect(json.output.length).toBe(1);
    expect(json.output[0]).toMatchObject({ id: "conv-101" });
  });

  it("executes SQLite operation in Sandbox mode with relational mock data", async () => {
    const req = new NextRequest("http://localhost:3000/api/operations/test-live", {
      method: "POST",
      body: JSON.stringify({
        engine: "sqlite",
        connection: {
          dbFilePath: "custom.db",
        },
        operation: {
          id: "auto-find-by-id-conversations",
          name: "findConversationById",
          kind: "findById",
          params: [{ name: "id", type: "string" }],
        },
        args: {
          id: "conv_123",
        },
        mode: "sandbox",
      }),
    });

    const res = await testLivePost(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.mode).toBe("sandbox");
    expect(json.rawCommand).toContain("SELECT * FROM conversations WHERE id = 'conv_123'");
    expect(json.output).toHaveProperty("id", "conv_123");
  });

  it("checks SQLite connection without requiring a TCP port", async () => {
    const req = new NextRequest("http://localhost:3000/api/operations/check-connection", {
      method: "POST",
      body: JSON.stringify({
        engine: "sqlite",
        connection: {
          dbFilePath: TEST_DB,
        },
      }),
    });

    const res = await checkConnectionPost(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.engine).toBe("sqlite");
    expect(json.connectionUri).toBe(`sqlite:${TEST_DB}`);
    expect(json.info).toHaveProperty("version");
    expect(json.info).toHaveProperty("status");
  });
});
