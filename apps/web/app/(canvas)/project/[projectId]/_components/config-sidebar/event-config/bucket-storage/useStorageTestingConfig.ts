import { useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { cleanEnvVarName, getLocalEnvVariable } from "@/lib/utils/localEnvSync";
import { ConfigItemData } from "../types";
import { BackendNode } from "@workspace/canvas";

export interface StorageTestingConfig {
  activeEndpoint: string;
  effectiveAccessKeyId: string;
  effectiveSecretAccessKey: string;
  bucketName: string;
  region: string;
  accessPolicy: string;
  configuredStorageType: string;
  configuredForcePathStyle: boolean;
  configuredAccessKeyIdEnv: string | undefined;
  configuredSecretAccessKeyEnv: string | undefined;
  parentNode: BackendNode | undefined;
}


export function useStorageTestingConfig(item: ConfigItemData): StorageTestingConfig {
  const nodes = useBackendCanvasStore((s) => s.nodes);

  const parentNode = useMemo(() => {
    if (item.nodeId) {
      const match = nodes.find((n) => n.id === item.nodeId);
      if (match) {
        if (match.type === "storage") return match;
        if (match.data?.storageNodeId) {
          const targetStorage = nodes.find((n) => n.id === match.data.storageNodeId);
          if (targetStorage) return targetStorage;
        }
        return match;
      }
    }
    return nodes.find((n) => n.data?.buckets?.some((b: { id: string }) => b.id === item.id));
  }, [nodes, item.nodeId, item.id]);

  const parentData = parentNode?.data;

  const configuredEndpoint = (item.endpointUrl || parentData?.endpointUrl || "").trim();
  const configuredRegion = item.region || parentData?.defaultRegion || "us-east-1";
  const configuredStorageType = item.storageType || parentData?.storageProvider || "s3";
  const configuredForcePathStyle =
    item.forcePathStyle !== undefined
      ? item.forcePathStyle
      : parentData?.forcePathStyle !== undefined
        ? parentData.forcePathStyle
        : true;
  const configuredAccessKeyId = (item.accessKeyId || parentData?.accessKeyId || "").trim();
  const configuredSecretAccessKey = (item.secretAccessKey || parentData?.secretAccessKey || "").trim();
  const configuredAccessKeyIdEnv = item.accessKeyIdEnv || parentData?.accessKeyIdEnv;
  const configuredSecretAccessKeyEnv = item.secretAccessKeyEnv || parentData?.secretAccessKeyEnv;

  const region = configuredRegion;
  const bucketName = item.name || "default-bucket";
  const accessPolicy = item.accessPolicy || "private";

  const activeEndpoint = useMemo(() => {
    let raw = configuredEndpoint;
    raw = raw.replace(/^["']+|["']+$/g, "").trim();

    if (raw) {
      const cleanKey = cleanEnvVarName(raw);
      if (cleanKey && !raw.includes("://") && !raw.includes(".")) {
        const localVal = getLocalEnvVariable(cleanKey);
        if (localVal && localVal.trim()) raw = localVal.trim();
      }
    }

    raw = raw.replace(/^["']+|["']+$/g, "").trim();

    if (
      raw &&
      !/^https?:\/\//i.test(raw) &&
      !raw.includes(" ") &&
      (raw.includes(":") || raw.startsWith("localhost") || raw.startsWith("127.0.0.1"))
    ) {
      raw = `http://${raw}`;
    }

    return raw || configuredEndpoint || `https://s3.${region}.amazonaws.com`;
  }, [configuredEndpoint, region]);

  const effectiveAccessKeyId = useMemo(() => {
    if (configuredAccessKeyId) return configuredAccessKeyId;
    if (configuredAccessKeyIdEnv) {
      const val = getLocalEnvVariable(configuredAccessKeyIdEnv);
      if (val) return val;
    }
    return getLocalEnvVariable("AWS_ACCESS_KEY_ID") || getLocalEnvVariable("STORAGE_ACCESS_KEY_ID") || "";
  }, [configuredAccessKeyId, configuredAccessKeyIdEnv]);

  const effectiveSecretAccessKey = useMemo(() => {
    if (configuredSecretAccessKey) return configuredSecretAccessKey;
    if (configuredSecretAccessKeyEnv) {
      const val = getLocalEnvVariable(configuredSecretAccessKeyEnv);
      if (val) return val;
    }
    return getLocalEnvVariable("AWS_SECRET_ACCESS_KEY") || getLocalEnvVariable("STORAGE_SECRET_ACCESS_KEY") || "";
  }, [configuredSecretAccessKey, configuredSecretAccessKeyEnv]);

  return {
    activeEndpoint,
    effectiveAccessKeyId,
    effectiveSecretAccessKey,
    bucketName,
    region,
    accessPolicy,
    configuredStorageType,
    configuredForcePathStyle,
    configuredAccessKeyIdEnv,
    configuredSecretAccessKeyEnv,
    parentNode,
  };
}
