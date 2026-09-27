import {
  checkStorageConnectionAction,
  executeStorageOperationAction,
  listStorageBucketsAction,
  createStorageBucketAction,
  executeStorageTestSuiteAction,
  type StorageConnectionConfig,
  type CheckStorageConnectionResult,
  type ExecuteStorageOperationPayload,
  type ExecuteStorageOperationResult,
  type ListStorageBucketsResult,
  type CreateStorageBucketResult,
  type ServerBucketInfo,
  type StorageTestCaseResult,
  type StorageTestSuiteResult,
} from "@/app/actions/storageActions";

export type {
  StorageConnectionConfig,
  CheckStorageConnectionResult,
  ExecuteStorageOperationPayload,
  ExecuteStorageOperationResult,
  ListStorageBucketsResult,
  CreateStorageBucketResult,
  ServerBucketInfo,
  StorageTestCaseResult,
  StorageTestSuiteResult,
};

/**
 * Check storage connection and reachability against the configured server.
 * Uses Next.js Server Actions to execute network requests from the server environment.
 */
export async function checkStorageConnection(
  config: StorageConnectionConfig,
): Promise<CheckStorageConnectionResult> {
  return checkStorageConnectionAction(config);
}

/**
 * Execute an operation directly against the configured storage server.
 */
export async function executeStorageOperation(
  payload: ExecuteStorageOperationPayload,
): Promise<ExecuteStorageOperationResult> {
  return executeStorageOperationAction(payload);
}

/**
 * Discover and list all existing buckets on the configured storage server.
 */
export async function listStorageBuckets(
  config: StorageConnectionConfig,
): Promise<ListStorageBucketsResult> {
  return listStorageBucketsAction(config);
}

/**
 * Create a bucket directly on the configured storage server.
 */
export async function createStorageBucket(
  config: StorageConnectionConfig,
  bucketName: string,
): Promise<CreateStorageBucketResult> {
  return createStorageBucketAction(config, bucketName);
}

/**
 * Execute the entire generated Vitest test suite against the configured storage server.
 */
export async function executeStorageTestSuite(
  config: StorageConnectionConfig,
): Promise<StorageTestSuiteResult> {
  return executeStorageTestSuiteAction(config);
}

