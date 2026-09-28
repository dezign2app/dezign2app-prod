"use server";

import {
  checkStorageConnectionLive,
  executeStorageOperationLive,
  listStorageBucketsLive,
  createStorageBucketLive,
  syncStorageBucketLive,
  executeStorageTestSuiteLive,
  type StorageConnectionConfig,
  type CheckStorageConnectionResult,
  type ExecuteStorageOperationPayload,
  type ExecuteStorageOperationResult,
  type ListStorageBucketsResult,
  type CreateStorageBucketResult,
  type ServerBucketInfo,
  type StorageTestCaseResult,
  type StorageTestSuiteResult,
  type SyncBucketOptions,
  type SyncStorageBucketResult,
} from "@/lib/utils/storageRunner";

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
  SyncBucketOptions,
  SyncStorageBucketResult,
};

/**
 * Server action to check live storage connection against the configured S3 / storage server.
 * Dispatches a real network request (HEAD / Ping) to the target server endpoint.
 */
export async function checkStorageConnectionAction(
  config: StorageConnectionConfig,
): Promise<CheckStorageConnectionResult> {
  return checkStorageConnectionLive(config);
}

/**
 * Server action to execute a storage operation (upload, download, exists, delete, list)
 * directly against the configured live storage server.
 */
export async function executeStorageOperationAction(
  payload: ExecuteStorageOperationPayload,
): Promise<ExecuteStorageOperationResult> {
  return executeStorageOperationLive(payload);
}

/**
 * Server action to discover and list all buckets on the configured storage server.
 */
export async function listStorageBucketsAction(
  config: StorageConnectionConfig,
): Promise<ListStorageBucketsResult> {
  return listStorageBucketsLive(config);
}

/**
 * Server action to create a new bucket directly on the configured storage server.
 */
export async function createStorageBucketAction(
  config: StorageConnectionConfig,
  bucketName: string,
): Promise<CreateStorageBucketResult> {
  return createStorageBucketLive(config, bucketName);
}

/**
 * Server action to sync and update bucket policy (public/private), ACL, and CORS
 * directly on the live storage server.
 */
export async function syncStorageBucketAction(
  config: StorageConnectionConfig,
  options?: SyncBucketOptions,
): Promise<SyncStorageBucketResult> {
  return syncStorageBucketLive(config, options);
}

/**
 * Server action to execute the entire generated test suite against the live storage server.
 */
export async function executeStorageTestSuiteAction(
  config: StorageConnectionConfig,
): Promise<StorageTestSuiteResult> {
  return executeStorageTestSuiteLive(config);
}

