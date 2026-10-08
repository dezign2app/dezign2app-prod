import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { compileServiceNode } from "../compileServiceNode";

describe("compileServiceNode: server config section & ports handling", () => {
  it("honors custom HTTP port in Express service entry file, .env, and README", () => {
    const serviceNode: BackendNode = {
      id: "srv-orders",
      type: "service",
      position: { x: 0, y: 0 },
      data: {
        label: "OrdersService",
        techStack: "express",
        port: "8085",
      },
    };

    const result = compileServiceNode(serviceNode);

    const serverFile = result.files.find((f) => f.filename === "src/index.ts");
    expect(serverFile).toBeDefined();
    expect(serverFile?.content).toContain("const PORT = process.env.PORT || 8085;");

    const envFile = result.files.find((f) => f.filename === ".env");
    expect(envFile).toBeDefined();
    expect(envFile?.content).toContain("PORT=8085");

    const readmeFile = result.files.find((f) => f.filename === "README.md");
    expect(readmeFile).toBeDefined();
    expect(readmeFile?.content).toContain("Port: `8085`");
  });

  it("extracts port and server configs from nested node.data.server or serverConfig", () => {
    const serviceNodeWithServer: BackendNode = {
      id: "srv-nested",
      type: "service",
      position: { x: 0, y: 0 },
      data: {
        label: "NestedService",
        techStack: "express",
        server: {
          port: "9001",
          cors: false,
          rateLimit: "60/s",
        },
      } as any,
    };

    const result = compileServiceNode(serviceNodeWithServer);

    const serverFile = result.files.find((f) => f.filename === "src/index.ts");
    expect(serverFile?.content).toContain("const PORT = process.env.PORT || 9001;");
    // CORS disabled
    expect(serverFile?.content).not.toContain("app.use(\n  cors(");
    // Rate limit enabled
    expect(serverFile?.content).toContain("import rateLimit from \"express-rate-limit\";");
    expect(serverFile?.content).toContain("max: 60");
    expect(serverFile?.content).toContain("windowMs: 1000");

    const envFile = result.files.find((f) => f.filename === ".env");
    expect(envFile?.content).toContain("PORT=9001");

    const pkgFile = result.files.find((f) => f.filename === "package.json");
    expect(pkgFile?.content).toContain("\"express-rate-limit\": \"^7.5.0\"");
  });

  it("configures gRPC port and protocol when enabled in server config", () => {
    const serviceNode: BackendNode = {
      id: "srv-grpc",
      type: "service",
      position: { x: 0, y: 0 },
      data: {
        label: "GrpcService",
        techStack: "express",
        port: "8080",
        grpcPort: "50055",
        interServiceProtocol: "grpc",
      },
    };

    const result = compileServiceNode(serviceNode, [], [], [serviceNode]);

    const serverFile = result.files.find((f) => f.filename === "src/index.ts");
    expect(serverFile?.content).toContain("const GRPC_PORT = Number(process.env.GRPC_PORT || 50055);");

    const envFile = result.files.find((f) => f.filename === ".env");
    expect(envFile?.content).toContain("GRPC_PORT=50055");

    const pkgFile = result.files.find((f) => f.filename === "package.json");
    expect(pkgFile?.content).toContain("\"@grpc/grpc-js\"");
  });

  it("omits CORS middleware when cors is explicitly set to false", () => {
    const serviceNode: BackendNode = {
      id: "srv-no-cors",
      type: "service",
      position: { x: 0, y: 0 },
      data: {
        label: "PrivateService",
        techStack: "express",
        port: "8080",
        cors: false,
      },
    };

    const result = compileServiceNode(serviceNode);

    const serverFile = result.files.find((f) => f.filename === "src/index.ts");
    expect(serverFile?.content).not.toContain("app.use(\n  cors(");
  });

  it("includes rate limiting middleware and package dependency when rateLimit is configured", () => {
    const serviceNode: BackendNode = {
      id: "srv-limited",
      type: "service",
      position: { x: 0, y: 0 },
      data: {
        label: "LimitedService",
        techStack: "express",
        port: "8080",
        rateLimit: "120/m",
      },
    };

    const result = compileServiceNode(serviceNode);

    const serverFile = result.files.find((f) => f.filename === "src/index.ts");
    expect(serverFile?.content).toContain("import rateLimit from \"express-rate-limit\";");
    expect(serverFile?.content).toContain("max: 120");
    expect(serverFile?.content).toContain("windowMs: 60000");

    const pkgFile = result.files.find((f) => f.filename === "package.json");
    expect(pkgFile?.content).toContain("\"express-rate-limit\": \"^7.5.0\"");
  });

  it("populates target service URLs in .env using the target's configured port", () => {
    const serviceA: BackendNode = {
      id: "srv-a",
      type: "service",
      position: { x: 0, y: 0 },
      data: {
        label: "OrdersService",
        techStack: "express",
        port: "8081",
      },
    };

    const serviceB: BackendNode = {
      id: "srv-b",
      type: "service",
      position: { x: 200, y: 0 },
      data: {
        label: "PaymentsService",
        techStack: "express",
        port: "8082",
      },
    };

    const edge: BackendEdge = {
      id: "e-a-b",
      source: "srv-a",
      target: "srv-b",
    };

    const result = compileServiceNode(serviceA, [], [], [serviceA, serviceB], [edge]);

    const envFile = result.files.find((f) => f.filename === ".env");
    expect(envFile).toBeDefined();
    expect(envFile?.content).toContain("PORT=8081");
    expect(envFile?.content).toContain("PAYMENTS_SERVICE_BASE_URL=http://localhost:8082");
  });

  it("honors custom port in Next.js service compiler", () => {
    const serviceNode: BackendNode = {
      id: "srv-next",
      type: "service",
      position: { x: 0, y: 0 },
      data: {
        label: "NextService",
        techStack: "nextjs",
        port: "3005",
      },
    };

    const result = compileServiceNode(serviceNode);

    const pkgFile = result.files.find((f) => f.filename === "package.json");
    expect(pkgFile?.content).toContain("\"next dev -p 3005\"");
    expect(pkgFile?.content).toContain("\"next start -p 3005\"");

    const envFile = result.files.find((f) => f.filename === ".env");
    expect(envFile?.content).toContain("PORT=3005");
  });

  it("honors custom port in FastAPI service compiler", () => {
    const serviceNode: BackendNode = {
      id: "srv-fastapi",
      type: "service",
      position: { x: 0, y: 0 },
      data: {
        label: "FastApiService",
        techStack: "fastapi",
        port: "8005",
      },
    };

    const result = compileServiceNode(serviceNode);

    const configFile = result.files.find((f) => f.filename === "core/config.py");
    expect(configFile?.content).toContain("int(os.getenv(\"PORT\", \"8005\"))");

    const envFile = result.files.find((f) => f.filename === ".env");
    expect(envFile?.content).toContain("PORT=8005");
  });
});
