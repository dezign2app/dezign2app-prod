import { useState, useCallback } from "react";
import {
  checkStorageConnection,
  executeStorageOperation,
  listStorageBuckets,
  createStorageBucket,
  syncStorageBucket,
  executeStorageTestSuite,
  type CheckStorageConnectionResult,
  type ExecuteStorageOperationResult,
  type ServerBucketInfo,
  type StorageTestSuiteResult,
  type SyncStorageBucketResult,
} from "@/lib/services/storageService";
import { ConfigItemData } from "../types";
import { StorageTestingConfig } from "./useStorageTestingConfig";

export interface StorageTestingActions {
  // Bucket creation
  isCreatingBucket: boolean;
  createSuccessMsg: string | null;
  createErrorMsg: string | null;
  handleCreateBucketNow: () => Promise<void>;

  // Bucket sync (policy, ACL, CORS)
  isSyncingBucket: boolean;
  syncSuccessMsg: string | null;
  syncErrorMsg: string | null;
  syncResult: SyncStorageBucketResult | null;
  handleSyncBucketToServer: () => Promise<void>;

  // Server bucket scan
  serverBuckets: ServerBucketInfo[] | null;
  serverScanError: string | null;
  isScanningServer: boolean;
  handleScanServerBuckets: () => Promise<void>;

  // Connection test
  isTestingConn: boolean;
  connResult: CheckStorageConnectionResult | null;
  handleRunConnectionTest: () => Promise<void>;

  // Operation execution
  isExecutingOp: boolean;
  opResult: ExecuteStorageOperationResult | null;
  setOpResult: (r: ExecuteStorageOperationResult | null) => void;
  handleRunOperation: (args: {
    selectedOpKey: string;
    keyInput: string;
    bodyInput: string;
    contentTypeInput: string;
    ttlInput: string;
    prefixInput: string;
    metadataUser: string;
    metadataTags: string;
  }) => Promise<void>;

  // Test suite
  isRunningSuite: boolean;
  suiteResult: StorageTestSuiteResult | null;
  handleRunTestSuite: () => Promise<void>;

  // Clipboard
  copiedCode: boolean;
  copiedResult: boolean;
  handleCopy: (text: string, isResult?: boolean) => void;

  // Bucket switch
  handleSwitchBucket: (newBucketName: string) => void;
}

export function useStorageTestingActions(
  item: ConfigItemData,
  config: StorageTestingConfig,
  handleUpdate?: (id: string, updates: Partial<ConfigItemData>) => void,
): StorageTestingActions {
  const { activeEndpoint, effectiveAccessKeyId, effectiveSecretAccessKey, bucketName, region,
    configuredStorageType, configuredForcePathStyle, configuredAccessKeyIdEnv, configuredSecretAccessKeyEnv } = config;

  const [isCreatingBucket, setIsCreatingBucket] = useState(false);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);
  const [createErrorMsg, setCreateErrorMsg] = useState<string | null>(null);

  const [isSyncingBucket, setIsSyncingBucket] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncStorageBucketResult | null>(null);

  const [serverBuckets, setServerBuckets] = useState<ServerBucketInfo[] | null>(null);
  const [serverScanError, setServerScanError] = useState<string | null>(null);
  const [isScanningServer, setIsScanningServer] = useState(false);

  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<CheckStorageConnectionResult | null>(null);

  const [isExecutingOp, setIsExecutingOp] = useState(false);
  const [opResult, setOpResult] = useState<ExecuteStorageOperationResult | null>(null);

  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [suiteResult, setSuiteResult] = useState<StorageTestSuiteResult | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);

  const connectionConfig = {
    endpointUrl: activeEndpoint,
    region,
    bucketName,
    storageType: configuredStorageType,
    forcePathStyle: configuredForcePathStyle,
    accessKeyId: effectiveAccessKeyId || undefined,
    secretAccessKey: effectiveSecretAccessKey || undefined,
    accessKeyIdEnv: configuredAccessKeyIdEnv,
    secretAccessKeyEnv: configuredSecretAccessKeyEnv,
  };

  const handleScanServerBuckets = useCallback(async () => {
    setIsScanningServer(true);
    setServerScanError(null);
    try {
      const res = await listStorageBuckets(connectionConfig);
      if (res.success) {
        setServerBuckets(res.buckets);
      } else {
        setServerScanError(res.error || "Failed to scan server buckets");
      }
    } catch (err) {
      setServerScanError(err instanceof Error ? err.message : "Failed to scan server buckets");
    } finally {
      setIsScanningServer(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEndpoint, region, bucketName, configuredStorageType, configuredForcePathStyle,
      effectiveAccessKeyId, effectiveSecretAccessKey, configuredAccessKeyIdEnv, configuredSecretAccessKeyEnv]);

  const handleRunConnectionTest = useCallback(async () => {
    setIsTestingConn(true);
    setConnResult(null);
    try {
      const res = await checkStorageConnection(connectionConfig);
      setConnResult(res);
    } catch (err) {
      setConnResult({
        success: false,
        serverActive: false,
        status: 0,
        statusText: "Request Error",
        durationMs: 0,
        endpoint: activeEndpoint,
        bucket: bucketName,
        region,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsTestingConn(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEndpoint, region, bucketName, configuredStorageType, configuredForcePathStyle,
      effectiveAccessKeyId, effectiveSecretAccessKey, configuredAccessKeyIdEnv, configuredSecretAccessKeyEnv]);

  const handleCreateBucketNow = useCallback(async () => {
    setIsCreatingBucket(true);
    setCreateSuccessMsg(null);
    setCreateErrorMsg(null);
    try {
      const res = await createStorageBucket(connectionConfig, bucketName);
      if (res.success) {
        setCreateSuccessMsg(`✓ Bucket "${bucketName}" created successfully on server.`);
        await handleRunConnectionTest();
        await handleScanServerBuckets();
      } else {
        setCreateErrorMsg(res.error || res.message || "Failed to create bucket on server");
      }
    } catch (err) {
      setCreateErrorMsg(err instanceof Error ? err.message : "Failed to create bucket on server");
    } finally {
      setIsCreatingBucket(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketName, handleRunConnectionTest, handleScanServerBuckets, activeEndpoint, region,
      configuredStorageType, configuredForcePathStyle, effectiveAccessKeyId, effectiveSecretAccessKey,
      configuredAccessKeyIdEnv, configuredSecretAccessKeyEnv]);

  const handleSyncBucketToServer = useCallback(async () => {
    setIsSyncingBucket(true);
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);
    try {
      const res = await syncStorageBucket(connectionConfig, {
        accessPolicy: item.accessPolicy || "private",
        enableCors: item.enableCors,
        corsOrigins: item.corsOrigins,
        corsMethods: item.corsMethods,
        corsHeaders: item.corsHeaders,
        corsMaxAge: item.corsMaxAge,
      });
      setSyncResult(res);
      if (res.success) {
        setSyncSuccessMsg(res.message);
        await handleRunConnectionTest();
        await handleScanServerBuckets();
      } else {
        setSyncErrorMsg(res.error || res.message || "Failed to sync bucket with storage server");
      }
    } catch (err) {
      setSyncErrorMsg(err instanceof Error ? err.message : "Failed to sync bucket with storage server");
    } finally {
      setIsSyncingBucket(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketName, handleRunConnectionTest, handleScanServerBuckets, activeEndpoint, region,
      configuredStorageType, configuredForcePathStyle, effectiveAccessKeyId, effectiveSecretAccessKey,
      configuredAccessKeyIdEnv, configuredSecretAccessKeyEnv, item.accessPolicy, item.enableCors,
      item.corsOrigins, item.corsMethods, item.corsHeaders, item.corsMaxAge]);

  const handleRunOperation = useCallback(async (args: {
    selectedOpKey: string;
    keyInput: string;
    bodyInput: string;
    contentTypeInput: string;
    ttlInput: string;
    prefixInput: string;
    metadataUser: string;
    metadataTags: string;
  }) => {
    setIsExecutingOp(true);
    setOpResult(null);
    try {
      const res = await executeStorageOperation({
        connection: {
          ...connectionConfig,
          cdnUrl: item.cdnDomain,
        },
        operation: args.selectedOpKey,
        params: {
          key: args.keyInput,
          body: args.bodyInput,
          contentType: args.contentTypeInput,
          ttl: args.ttlInput,
          prefix: args.prefixInput,
          metadata: { userId: args.metadataUser, tags: args.metadataTags },
        },
      });
      setOpResult(res);
    } catch (err) {
      setOpResult({
        success: false,
        serverActive: false,
        status: 0,
        statusText: "Execution Failed",
        durationMs: 0,
        endpoint: activeEndpoint,
        method: "FETCH",
        url: activeEndpoint,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsExecutingOp(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEndpoint, region, bucketName, configuredStorageType, configuredForcePathStyle,
      effectiveAccessKeyId, effectiveSecretAccessKey, configuredAccessKeyIdEnv, configuredSecretAccessKeyEnv,
      item.cdnDomain]);

  const handleRunTestSuite = useCallback(async () => {
    setIsRunningSuite(true);
    setSuiteResult(null);
    try {
      const res = await executeStorageTestSuite({
        ...connectionConfig,
        cdnUrl: item.cdnDomain,
      });
      setSuiteResult(res);
    } catch (err) {
      setSuiteResult({
        total: 1,
        passed: 0,
        failed: 1,
        durationMs: 0,
        serverActive: false,
        endpoint: activeEndpoint,
        bucket: bucketName,
        cases: [{
          id: "suite-fatal-error",
          title: "Test Suite Runner Execution",
          category: "Client Initialization & Config",
          passed: false,
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        }],
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRunningSuite(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEndpoint, region, bucketName, configuredStorageType, configuredForcePathStyle,
      effectiveAccessKeyId, effectiveSecretAccessKey, configuredAccessKeyIdEnv, configuredSecretAccessKeyEnv,
      item.cdnDomain]);

  const handleCopy = useCallback((text: string, isResult = false) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (isResult) {
        setCopiedResult(true);
        setTimeout(() => setCopiedResult(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    }
  }, []);

  const handleSwitchBucket = useCallback((newBucketName: string) => {
    handleUpdate?.(item.id, { name: newBucketName });
  }, [handleUpdate, item.id]);

  return {
    isCreatingBucket, createSuccessMsg, createErrorMsg, handleCreateBucketNow,
    isSyncingBucket, syncSuccessMsg, syncErrorMsg, syncResult, handleSyncBucketToServer,
    serverBuckets, serverScanError, isScanningServer, handleScanServerBuckets,
    isTestingConn, connResult, handleRunConnectionTest,
    isExecutingOp, opResult, setOpResult, handleRunOperation,
    isRunningSuite, suiteResult, handleRunTestSuite,
    copiedCode, copiedResult, handleCopy,
    handleSwitchBucket,
  };
}
