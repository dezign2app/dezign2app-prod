import React from "react";
import { Globe, Key, HardDrive, ExternalLink } from "lucide-react";
import { Switch } from "@workspace/ui/components/switch";
import { Button } from "@workspace/ui/components/button";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BucketStorageSectionProps } from "./types";
import { EnvVarCombobox } from "../../EnvVarCombobox";

export const BucketConnectionSection: React.FC<BucketStorageSectionProps> = ({
  item,
  handleUpdate,
}) => {
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );
  const nodes = useBackendCanvasStore((s) => s.nodes);

  const parentNode = item.nodeId
    ? nodes.find((n) => n.id === item.nodeId)
    : nodes.find((n) => n.data?.buckets?.some((b) => b.id === item.id));
  const effectiveNodeId = item.nodeId || parentNode?.id;
  const parentData = parentNode?.data;
  const parentLabel = parentData?.label || "Storage Host";
  const parentProvider = parentData?.storageProvider || item.storageType || "s3";

  const handleOpenStorageNode = () => {
    if (effectiveNodeId) {
      setActiveConfigItem({
        type: "storage",
        id: effectiveNodeId,
        nodeId: effectiveNodeId,
      });
    }
  };

  const accessKeyVal = item.accessKeyIdEnv || parentData?.accessKeyIdEnv || "AWS_ACCESS_KEY_ID";
  const secretKeyVal = item.secretAccessKeyEnv || parentData?.secretAccessKeyEnv || "AWS_SECRET_ACCESS_KEY";
  const sessionTokenVal = item.sessionTokenEnv || parentData?.sessionTokenEnv || "";
  const roleArnVal = item.roleArn || parentData?.roleArn || "";

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Connection & Network
          </span>
        </div>
        {effectiveNodeId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenStorageNode}
            className="h-6 text-[10px] px-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1 font-medium"
            title="Configure parent cloud storage host node"
          >
            <HardDrive size={11} />
            <span>Host Node</span>
            <ExternalLink size={10} />
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Select environment variables used to authenticate and connect this bucket across services and SDK pipelines.
      </p>

      {/* ─── Credentials (.env Environment Variables) ─── */}
      <div className="flex flex-col gap-3 pt-1 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <Key size={12} className="text-amber-500" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            AWS / Storage Credentials (.env Variables)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-foreground">
                Access Key ID Env
              </label>
              <code className="text-[9px] font-mono text-primary font-semibold truncate max-w-[100px]">
                process.env.{accessKeyVal}
              </code>
            </div>
            <EnvVarCombobox
              value={accessKeyVal}
              onValueChange={(val) => handleUpdate(item.id, { accessKeyIdEnv: val })}
              nodeId={effectiveNodeId}
              placeholder="AWS_ACCESS_KEY_ID"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-foreground">
                Secret Key Env
              </label>
              <code className="text-[9px] font-mono text-primary font-semibold truncate max-w-[100px]">
                process.env.{secretKeyVal}
              </code>
            </div>
            <EnvVarCombobox
              value={secretKeyVal}
              onValueChange={(val) => handleUpdate(item.id, { secretAccessKeyEnv: val })}
              nodeId={effectiveNodeId}
              placeholder="AWS_SECRET_ACCESS_KEY"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-foreground">
                Session Token Env (Optional)
              </label>
              {sessionTokenVal && (
                <code className="text-[9px] font-mono text-primary font-semibold truncate max-w-[100px]">
                  process.env.{sessionTokenVal}
                </code>
              )}
            </div>
            <EnvVarCombobox
              value={sessionTokenVal}
              onValueChange={(val) => handleUpdate(item.id, { sessionTokenEnv: val })}
              nodeId={effectiveNodeId}
              placeholder="AWS_SESSION_TOKEN"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-foreground">
                IAM Role ARN (Optional)
              </label>
              {roleArnVal && (
                <code className="text-[9px] font-mono text-primary font-semibold truncate max-w-[100px]">
                  {roleArnVal.startsWith("arn:") ? "ARN" : `process.env.${roleArnVal}`}
                </code>
              )}
            </div>
            <EnvVarCombobox
              value={roleArnVal}
              onValueChange={(val) => handleUpdate(item.id, { roleArn: val })}
              nodeId={effectiveNodeId}
              placeholder="arn:aws:iam::..."
              allowRawInput={true}
            />
          </div>
        </div>
      </div>

      {/* ─── Region & Endpoint URL ─── */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-foreground">
            AWS Region
          </label>
          <EnvVarCombobox
            value={item.region || parentData?.defaultRegion || "AWS_REGION"}
            onValueChange={(val) => handleUpdate(item.id, { region: val })}
            nodeId={effectiveNodeId}
            placeholder="e.g. AWS_REGION"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-foreground">
            Endpoint URL (Optional)
          </label>
          <EnvVarCombobox
            value={item.endpointUrl || parentData?.endpointUrl || ""}
            onValueChange={(val) => handleUpdate(item.id, { endpointUrl: val })}
            nodeId={effectiveNodeId}
            placeholder="e.g. S3_ENDPOINT_URL or https://..."
            allowRawInput={true}
          />
        </div>
      </div>

      {/* ─── Force Path-Style URLs ─── */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground">
            Force Path-Style URLs
          </span>
          <span className="text-[10px] text-muted-foreground">
            Use path mode (s3.amazonaws.com/bucket) for MinIO / local emulation
          </span>
        </div>
        <Switch
          checked={
            item.forcePathStyle !== undefined
              ? Boolean(item.forcePathStyle)
              : parentData?.forcePathStyle !== undefined
                ? Boolean(parentData.forcePathStyle)
                : false
          }
          onCheckedChange={(checked) => handleUpdate(item.id, { forcePathStyle: checked })}
        />
      </div>
    </div>
  );
};
