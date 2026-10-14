import { describe, it, expect } from "vitest";
import {
  parsePostgresConnectionString,
  deriveNeonPooledUrl,
} from "../DatabaseProviderSection";

describe("DatabaseProviderSection — parsePostgresConnectionString", () => {
  it("correctly parses single naked PostgreSQL connection URI", () => {
    const uri =
      "postgresql://neondb_owner:npg_BvIW3kOhAg0G@ep-falling-hill-b526vknt.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

    const result = parsePostgresConnectionString(uri);

    expect(result.directUrl).toBe(uri);
    expect(result.provider).toBe("neon");
    expect(result.parsed).toBeDefined();
    expect(result.parsed?.user).toBe("neondb_owner");
    expect(result.parsed?.password).toBe("npg_BvIW3kOhAg0G");
    expect(result.parsed?.host).toBe("ep-falling-hill-b526vknt.c-7.us-east-2.aws.neon.tech");
    expect(result.parsed?.port).toBe("5432");
    expect(result.parsed?.database).toBe("neondb");
    expect(result.parsed?.sslMode).toBe("require");
  });

  it("correctly parses multiline .env format with DATABASE_URL and DATABASE_URL_POOLED", () => {
    const input = `
# Postgres — your database connection
DATABASE_URL="postgresql://neondb_owner:npg_BvIW3kOhAg0G@ep-falling-hill-b526vknt.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DATABASE_URL_POOLED="postgresql://neondb_owner:npg_BvIW3kOhAg0G@ep-falling-hill-b526vknt-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    `;

    const result = parsePostgresConnectionString(input);

    expect(result.directUrl).toBe(
      "postgresql://neondb_owner:npg_BvIW3kOhAg0G@ep-falling-hill-b526vknt.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    );
    expect(result.pooledUrl).toBe(
      "postgresql://neondb_owner:npg_BvIW3kOhAg0G@ep-falling-hill-b526vknt-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    );
    expect(result.provider).toBe("neon");
    expect(result.parsed?.host).toBe("ep-falling-hill-b526vknt.c-7.us-east-2.aws.neon.tech");
    expect(result.parsed?.user).toBe("neondb_owner");
  });

  it("identifies Supabase provider from host", () => {
    const input =
      "postgresql://postgres:mysecretpassword@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=require";
    const result = parsePostgresConnectionString(input);

    expect(result.provider).toBe("supabase");
    expect(result.parsed?.host).toBe("db.abcdefghijklmnopqrst.supabase.co");
    expect(result.parsed?.port).toBe("5432");
    expect(result.parsed?.database).toBe("postgres");
  });

  it("correctly derives Neon pooled URL", () => {
    const direct =
      "postgresql://neondb_owner:npg_BvIW3kOhAg0G@ep-falling-hill-b526vknt.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
    const pooled = deriveNeonPooledUrl(direct);

    expect(pooled).toBe(
      "postgresql://neondb_owner:npg_BvIW3kOhAg0G@ep-falling-hill-b526vknt-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    );
  });
});
