export type DbProviderId = "neon" | "supabase" | "aws_rds" | "local" | "custom";

export interface ParsedPostgresConnection {
  directUrl?: string;
  pooledUrl?: string;
  provider?: DbProviderId;
  parsed?: {
    user?: string;
    password?: string;
    host?: string;
    port?: string;
    database?: string;
    sslMode?: string;
  };
}

/**
 * Intelligent parser for PostgreSQL connection strings, direct URIs,
 * and multi-line .env blocks containing DATABASE_URL and DATABASE_URL_POOLED.
 */
export function parsePostgresConnectionString(input: string): ParsedPostgresConnection {
  let directUrl: string | undefined;
  let pooledUrl: string | undefined;

  const lines = input.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // Match DATABASE_URL="..." or export DATABASE_URL="..."
    const directMatch = line.match(/^(?:export\s+)?DATABASE_URL\s*=\s*["']?([^"']+)["']?/i);
    const pooledMatch = line.match(
      /^(?:export\s+)?(?:DATABASE_URL_POOLED|DIRECT_URL|POOLED_URL)\s*=\s*["']?([^"']+)["']?/i,
    );

    if (pooledMatch && pooledMatch[1]) {
      pooledUrl = pooledMatch[1].trim();
    } else if (directMatch && directMatch[1]) {
      directUrl = directMatch[1].trim();
    } else if (line.startsWith("postgresql://") || line.startsWith("postgres://")) {
      const cleanUri = line.replace(/^["']|["']$/g, "");
      if (cleanUri.includes("-pooler") || cleanUri.includes(":6543")) {
        if (!pooledUrl) pooledUrl = cleanUri;
      } else {
        if (!directUrl) directUrl = cleanUri;
      }
    }
  }

  // Fallback for single naked URI string
  if (!directUrl && input.trim().startsWith("postgres")) {
    directUrl = input.trim().replace(/^["']|["']$/g, "");
  }

  const urlToParse = directUrl || pooledUrl;
  let parsed: any;
  let provider: DbProviderId | undefined;

  if (urlToParse) {
    try {
      const url = new URL(urlToParse);
      parsed = {
        user: url.username ? decodeURIComponent(url.username) : undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        host: url.hostname,
        port: url.port || "5432",
        database: url.pathname ? url.pathname.replace(/^\//, "") : undefined,
        sslMode: url.searchParams.get("sslmode") || "require",
      };

      if (url.hostname.includes("neon.tech")) {
        provider = "neon";
      } else if (
        url.hostname.includes("supabase.co") ||
        url.hostname.includes("pooler.supabase.com")
      ) {
        provider = "supabase";
      } else if (url.hostname.includes("rds.amazonaws.com")) {
        provider = "aws_rds";
      } else if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        provider = "local";
      } else {
        provider = "custom";
      }
    } catch {}
  }

  return { directUrl, pooledUrl, provider, parsed };
}

/**
 * Generates Neon pooled URL by appending -pooler to host
 */
export function deriveNeonPooledUrl(directUrl: string): string | null {
  try {
    const url = new URL(directUrl);
    if (!url.hostname.includes("neon.tech") || url.hostname.includes("-pooler")) {
      return null;
    }
    // Transform "ep-xxxx.c-7.us-east-2.aws.neon.tech" -> "ep-xxxx-pooler.c-7.us-east-2.aws.neon.tech"
    const parts = url.hostname.split(".");
    if (parts[0]) {
      parts[0] = `${parts[0]}-pooler`;
      url.hostname = parts.join(".");
      return url.toString();
    }
  } catch {}
  return null;
}
