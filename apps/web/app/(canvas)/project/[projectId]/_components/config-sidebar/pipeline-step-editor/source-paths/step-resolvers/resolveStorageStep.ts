import { AvailablePath, AvailableSource, PipelineStepDraft } from "../../types";

export function resolveStorageStepPaths(
  step: PipelineStepDraft,
  stepPaths: AvailablePath[],
): void {
  const isStorageStep = step.type === "storage_operation" || Boolean(step.storageNodeId);
  if (!isStorageStep) return;

  const opName = (step.functionRef?.name || step.operationId || "").toLowerCase();
  const isPresignUpload =
    opName.includes("uploadpresigned") ||
    opName.includes("presign_upload") ||
    opName.includes("presignedupload") ||
    opName === "getuploadpresignedurl";
  const isPresignDownload =
    opName.includes("downloadpresigned") ||
    opName.includes("presign_download") ||
    opName.includes("presigneddownload") ||
    opName === "getdownloadpresignedurl";
  const isUpload = opName.includes("uploadobject") || opName === "upload";
  const isList = opName.includes("listobjects") || opName === "list";
  const isExists = opName.includes("objectexists") || opName === "exists";
  const isDelete = opName.includes("deleteobject") || opName.includes("delete");

  if (isPresignUpload) {
    if (!stepPaths.some((p) => p.path === "uploadUrl")) {
      stepPaths.push({
        path: "uploadUrl",
        type: "string",
        description: "Signed PUT URL for direct browser-to-cloud upload",
      });
    }
    if (!stepPaths.some((p) => p.path === "presignedUrl")) {
      stepPaths.push({
        path: "presignedUrl",
        type: "string",
        description: "Presigned upload URL (matching storage testing area output)",
      });
    }
    if (!stepPaths.some((p) => p.path === "signedUrl")) {
      stepPaths.push({
        path: "signedUrl",
        type: "string",
        description: "Signed URL (standard S3 presigned URL)",
      });
    }
    if (!stepPaths.some((p) => p.path === "url")) {
      stepPaths.push({
        path: "url",
        type: "string",
        description: "Direct upload URL (alias for uploadUrl)",
      });
    }
    if (!stepPaths.some((p) => p.path === "key")) {
      stepPaths.push({
        path: "key",
        type: "string",
        description: "Target object key in storage",
      });
    }
    if (!stepPaths.some((p) => p.path === "bucket")) {
      stepPaths.push({
        path: "bucket",
        type: "string",
        description: "Target bucket name",
      });
    }
    if (!stepPaths.some((p) => p.path === "method")) {
      stepPaths.push({
        path: "method",
        type: "string",
        description: "HTTP upload method (PUT)",
      });
    }
    if (!stepPaths.some((p) => p.path === "expiresInSeconds")) {
      stepPaths.push({
        path: "expiresInSeconds",
        type: "number",
        description: "Expiration time in seconds",
      });
    }
  } else if (isPresignDownload) {
    if (!stepPaths.some((p) => p.path === "downloadUrl")) {
      stepPaths.push({
        path: "downloadUrl",
        type: "string",
        description: "Signed GET URL for downloading private object",
      });
    }
    if (!stepPaths.some((p) => p.path === "presignedUrl")) {
      stepPaths.push({
        path: "presignedUrl",
        type: "string",
        description: "Presigned download URL (matching storage testing area output)",
      });
    }
    if (!stepPaths.some((p) => p.path === "signedUrl")) {
      stepPaths.push({
        path: "signedUrl",
        type: "string",
        description: "Signed URL (standard S3 presigned URL)",
      });
    }
    if (!stepPaths.some((p) => p.path === "url")) {
      stepPaths.push({
        path: "url",
        type: "string",
        description: "Download URL (alias for downloadUrl)",
      });
    }
    if (!stepPaths.some((p) => p.path === "key")) {
      stepPaths.push({
        path: "key",
        type: "string",
        description: "Target object key in storage",
      });
    }
    if (!stepPaths.some((p) => p.path === "bucket")) {
      stepPaths.push({
        path: "bucket",
        type: "string",
        description: "Target bucket name",
      });
    }
    if (!stepPaths.some((p) => p.path === "method")) {
      stepPaths.push({
        path: "method",
        type: "string",
        description: "HTTP download method (GET)",
      });
    }
    if (!stepPaths.some((p) => p.path === "expiresInSeconds")) {
      stepPaths.push({
        path: "expiresInSeconds",
        type: "number",
        description: "Expiration time in seconds",
      });
    }
  } else if (isList) {
    if (!stepPaths.some((p) => p.path === "length")) {
      stepPaths.push({
        path: "length",
        type: "number",
        description: "Number of objects in bucket",
      });
    }
    if (!stepPaths.some((p) => p.path === "[0].Key")) {
      stepPaths.push({
        path: "[0].Key",
        type: "string",
        description: "Object key in bucket",
      });
    }
    if (!stepPaths.some((p) => p.path === "[0].Size")) {
      stepPaths.push({
        path: "[0].Size",
        type: "number",
        description: "Object size in bytes",
      });
    }
    if (!stepPaths.some((p) => p.path === "bucket")) {
      stepPaths.push({
        path: "bucket",
        type: "string",
        description: "Bucket name",
      });
    }
  } else if (isExists) {
    if (!stepPaths.some((p) => p.path === "exists")) {
      stepPaths.push({
        path: "exists",
        type: "boolean",
        description: "Whether object exists",
      });
    }
    if (!stepPaths.some((p) => p.path === "key")) {
      stepPaths.push({
        path: "key",
        type: "string",
        description: "Target object key",
      });
    }
    if (!stepPaths.some((p) => p.path === "bucket")) {
      stepPaths.push({
        path: "bucket",
        type: "string",
        description: "Bucket name",
      });
    }
    if (!stepPaths.some((p) => p.path === "status")) {
      stepPaths.push({
        path: "status",
        type: "number",
        description: "HTTP status code",
      });
    }
  } else if (isDelete) {
    if (!stepPaths.some((p) => p.path === "success")) {
      stepPaths.push({
        path: "success",
        type: "boolean",
        description: "Whether deletion succeeded",
      });
    }
    if (!stepPaths.some((p) => p.path === "key")) {
      stepPaths.push({
        path: "key",
        type: "string",
        description: "Target object key",
      });
    }
    if (!stepPaths.some((p) => p.path === "bucket")) {
      stepPaths.push({
        path: "bucket",
        type: "string",
        description: "Bucket name",
      });
    }
    if (!stepPaths.some((p) => p.path === "status")) {
      stepPaths.push({
        path: "status",
        type: "number",
        description: "HTTP status code",
      });
    }
  } else if (isUpload) {
    if (!stepPaths.some((p) => p.path === "url")) {
      stepPaths.push({
        path: "url",
        type: "string",
        description: "Uploaded object public or CDN URL",
      });
    }
    if (!stepPaths.some((p) => p.path === "key")) {
      stepPaths.push({
        path: "key",
        type: "string",
        description: "Target object key in storage",
      });
    }
    if (!stepPaths.some((p) => p.path === "bucket")) {
      stepPaths.push({
        path: "bucket",
        type: "string",
        description: "Bucket name",
      });
    }
    if (!stepPaths.some((p) => p.path === "etag")) {
      stepPaths.push({
        path: "etag",
        type: "string",
        description: "Object ETag checksum",
      });
    }
    if (!stepPaths.some((p) => p.path === "success")) {
      stepPaths.push({
        path: "success",
        type: "boolean",
        description: "Whether upload succeeded",
      });
    }
    if (!stepPaths.some((p) => p.path === "status")) {
      stepPaths.push({
        path: "status",
        type: "number",
        description: "HTTP status code",
      });
    }
  }
}

/**
 * Creates an AvailableSource representation for a presigned URL step output
 * to make it immediately selectable and well-categorized in downstream bindings.
 */
export function createPresignedUrlExtraSource(
  step: PipelineStepDraft,
  kind: "upload" | "download" = "upload",
): AvailableSource {
  const varName = step.outputVariable || (kind === "upload" ? "uploadUrl" : "downloadUrl");
  const mainUrlPath = kind === "upload" ? "uploadUrl" : "downloadUrl";
  return {
    id: `presign:${step.id}`,
    label: `🔗 ${step.name || (kind === "upload" ? "Upload Presigned URL" : "Download Presigned URL")} (${varName})`,
    kind: "step_output",
    stepId: step.id,
    variableName: varName,
    rootVariableName: varName,
    paths: [
      {
        path: mainUrlPath,
        type: "string",
        description: `Direct presigned ${kind} URL`,
      },
      {
        path: "presignedUrl",
        type: "string",
        description: "Presigned URL (matching storage testing area output)",
      },
      {
        path: "signedUrl",
        type: "string",
        description: "Signed URL (standard S3 presigned URL)",
      },
      { path: "url", type: "string", description: "Presigned URL (alias)" },
      { path: "key", type: "string", description: "Target object key / path in storage" },
      { path: "bucket", type: "string", description: "Target bucket name" },
      {
        path: "method",
        type: "string",
        description: kind === "upload" ? "HTTP upload method (PUT)" : "HTTP download method (GET)",
      },
      { path: "expiresInSeconds", type: "number", description: "Expiration time in seconds" },
    ],
  };
}
