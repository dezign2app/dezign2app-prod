// ═══════════════════════════════════════════════════════════════
// MODULE: StorageEmitter
// LAYER:  generators / routeGenerator / handlers
// EMITS:  Presign-URL upload logic for endpoints connected to StorageRef nodes
// ═══════════════════════════════════════════════════════════════

import { Endpoint, EndpointTraceResult, ReusableFunction } from "@workspace/canvas/types";

export interface EmitStorageOperationsParams {
  trace: EndpointTraceResult;
  ep: Endpoint & { nodeId: string };
  payloadVar: string;
  storageFunctions?: ReusableFunction[];
}

const isStorageNodeType = (nodeType: string): boolean =>
  nodeType === "Storage Bucket" ||
  nodeType === "storage_operation_ref" ||
  nodeType === "storage_ref" ||
  nodeType === "storage_bucket_ref" ||
  nodeType === "bucket_ref" ||
  nodeType === "StorageBucketRefNode" ||
  nodeType === "StorageOperationRefNode" ||
  nodeType === "storage";

/**
 * Detects whether the endpoint trace involves a StorageRef node (incoming or outgoing),
 * and if so emits concrete presign-URL upload handler logic.
 *
 * The generated code:
 *   1. Imports getUploadPresignedUrl and STORAGE_BUCKETS from @workspace/storage/operations
 *   2. Validates fileName and fileType from request body
 *   3. Generates a unique object key
 *   4. Calls getUploadPresignedUrl and returns { signedUrl, key }
 *
 * The client is responsible for PUT-ing the file directly to the signedUrl.
 */
export function emitStorageOperations(params: EmitStorageOperationsParams): string {
  const { trace, storageFunctions = [], payloadVar } = params;

  const storageOutgoing = trace.outgoing.filter((out) =>
    isStorageNodeType(out.nodeType),
  );
  const storageIncoming = trace.incoming.filter((inc) =>
    isStorageNodeType(inc.nodeType),
  );

  if (storageOutgoing.length === 0 && storageIncoming.length === 0) {
    return "";
  }

  // Resolve bucket name from trace context if possible
  const storageNode = storageOutgoing[0] ?? storageIncoming[0];
  const bucketCtx = storageNode?.dataContext || "";
  const bucketNameFromCtx = bucketCtx.match(/Bucket: ([^\n]+)/)?.[1]?.trim();

  // Resolve import path from storageFunctions if available
  const presignFn = storageFunctions.find((f) => f.name === "getUploadPresignedUrl");
  const bucketsConst = storageFunctions.find((f) => f.name === "STORAGE_BUCKETS");
  const importPath = presignFn?.importPath || bucketsConst?.importPath || "@workspace/storage/operations";

  const bucketResolution =
    bucketNameFromCtx && bucketNameFromCtx !== "bucket"
      ? `bucketMap["${bucketNameFromCtx.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}"] || "${bucketNameFromCtx}"`
      : `bucketMap[Object.keys(bucketMap)[0] ?? ""] ?? ""`;

  let code = "";
  code += `    const { getUploadPresignedUrl, STORAGE_BUCKETS } = await import("${importPath}");\n`;
  code += `    const bucketMap: Record<string, string> = STORAGE_BUCKETS;\n`;
  code += `    const bodyRecord: Record<string, string | number | boolean | undefined> =\n`;
  code += `      typeof ${payloadVar} === "object" && ${payloadVar} !== null ? ${payloadVar} : {};\n`;
  code += `    const fileName = typeof bodyRecord.fileName === "string" ? bodyRecord.fileName : undefined;\n`;
  code += `    const fileType = typeof bodyRecord.fileType === "string" ? bodyRecord.fileType : undefined;\n`;
  code += `    const fileSize = typeof bodyRecord.fileSize === "number" ? bodyRecord.fileSize : undefined;\n`;
  code += `    if (!fileName || !fileType) {\n`;
  code += `      return res.status(400).json({ error: "Bad Request", details: "fileName and fileType are required" });\n`;
  code += `    }\n`;
  code += `    const objectKey = \`\${Date.now()}-\${String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_")}\`;\n`;
  code += `    const bucketName = ${bucketResolution};\n`;
  code += `    const signedUrl = await getUploadPresignedUrl(bucketName, objectKey, {\n`;
  code += `      expiresInSeconds: 300,\n`;
  code += `      contentType: fileType,\n`;
  code += `    });\n`;
  code += `    return res.status(200).json({ signedUrl, key: objectKey });\n`;

  return code;
}

/**
 * Returns true if the given trace touches a storage node (either direction).
 */
export function traceHasStorage(trace: EndpointTraceResult): boolean {
  return (
    trace.outgoing.some((out) => isStorageNodeType(out.nodeType)) ||
    trace.incoming.some((inc) => isStorageNodeType(inc.nodeType))
  );
}
