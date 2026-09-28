import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Shield, Check, Clock, RefreshCw, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { LocalInput } from "../../../backend-nodes/graph-nodes/shared";
import { BucketStorageSectionProps } from "./types";
import { ACCESS_POLICIES, OPERATIONS, PRESET_EXPIRATIONS } from "./constants";
import {
  syncOperationsWithAccessControl,
  StorageOperationFunction,
} from "@/lib/utils/storageOperationsHelper";
import { cn } from "@workspace/ui/lib/utils";
import { useStorageTestingConfig } from "./useStorageTestingConfig";
import { useStorageTestingActions } from "./useStorageTestingActions";

export const AccessPolicySection: React.FC<BucketStorageSectionProps> = ({
  item,
  handleUpdate,
}) => {
  const allowedOps = Array.isArray(item.allowedOperations)
    ? item.allowedOperations
    : ["read", "write"];

  const accessPolicy = item.accessPolicy || "private";
  const isPresignedActive = Boolean(
    item.enablePresignedUrls || accessPolicy === "presigned-only",
  );

  const config = useStorageTestingConfig(item);
  const {
    isSyncingBucket,
    syncSuccessMsg,
    syncErrorMsg,
    syncResult,
    handleSyncBucketToServer,
  } = useStorageTestingActions(item, config, handleUpdate);

  const toggleOp = (opKey: string) => {
    const nextAllowed = allowedOps.includes(opKey)
      ? allowedOps.filter((o) => o !== opKey)
      : [...allowedOps, opKey];

    const currentOps: StorageOperationFunction[] = item.storageOperations || [];
    const nextOps = syncOperationsWithAccessControl(
      currentOps,
      nextAllowed,
      accessPolicy,
      isPresignedActive,
    );

    handleUpdate(item.id, {
      allowedOperations: nextAllowed,
      storageOperations: nextOps,
    });
  };

  const handleAccessPolicyChange = (newPolicy: string) => {
    const isPresignedOnly = newPolicy === "presigned-only";
    const nextEnablePresigned = isPresignedOnly ? true : Boolean(item.enablePresignedUrls);

    const currentOps: StorageOperationFunction[] = item.storageOperations || [];
    const nextOps = syncOperationsWithAccessControl(
      currentOps,
      allowedOps,
      newPolicy,
      nextEnablePresigned,
    );

    handleUpdate(item.id, {
      accessPolicy: newPolicy,
      enablePresignedUrls: nextEnablePresigned,
      storageOperations: nextOps,
    });
  };

  const handlePresignedToggle = (checked: boolean) => {
    const currentOps: StorageOperationFunction[] = item.storageOperations || [];
    const nextOps = syncOperationsWithAccessControl(
      currentOps,
      allowedOps,
      accessPolicy,
      checked,
    );

    handleUpdate(item.id, {
      enablePresignedUrls: checked,
      storageOperations: nextOps,
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm border-primary/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Connectability & Access Control
          </span>
        </div>
        <Badge variant="outline" className="text-[10px]">
          Ingress Rules
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-foreground">Access Policy</label>
        <Select
          value={accessPolicy}
          onValueChange={handleAccessPolicyChange}
        >
          <SelectTrigger className="w-full bg-background/50 h-8 text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCESS_POLICIES.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                <div className="flex flex-col text-left">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-[10px] text-muted-foreground">{p.desc}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Live Server Policy Synchronization Card ─── */}
      <div
        className={cn(
          "flex flex-col gap-2 p-3 rounded-lg border transition-all",
          accessPolicy === "public-read"
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-secondary/20 border-border/60",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <RefreshCw
              size={13}
              className={cn("text-amber-500 shrink-0", isSyncingBucket && "animate-spin")}
            />
            <span className="text-[11px] font-semibold text-foreground truncate">
              Storage Server Policy Sync
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isSyncingBucket}
            onClick={handleSyncBucketToServer}
            className="h-6 px-2.5 text-[10px] font-medium gap-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-sm shrink-0"
          >
            {isSyncingBucket ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                <span>Applying to Server...</span>
              </>
            ) : (
              <>
                <RefreshCw size={11} />
                <span>Sync Policy to Server</span>
              </>
            )}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground leading-normal">
          {accessPolicy === "public-read"
            ? "Canvas is set to Public Read. To allow anonymous downloads from your browser, click 'Sync Policy to Server' to apply public s3:GetObject policies and CORS on the storage server."
            : "Click 'Sync Policy to Server' to enforce private IAM permissions and remove public bucket policies on the target server."}
        </p>

        {syncSuccessMsg && (
          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] flex items-start gap-1.5 font-medium">
            <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span>{syncSuccessMsg}</span>
              {syncResult?.publicUrl && accessPolicy === "public-read" && (
                <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground pt-0.5">
                  <span>Public Base URL:</span>
                  <code className="text-emerald-500 dark:text-emerald-300 font-semibold select-all break-all">
                    {syncResult.publicUrl}
                  </code>
                </div>
              )}
            </div>
          </div>
        )}

        {syncErrorMsg && (
          <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[10px] flex items-start gap-1.5 font-medium">
            <XCircle size={12} className="shrink-0 mt-0.5" />
            <span>{syncErrorMsg}</span>
          </div>
        )}
      </div>

      {/* Allowed Operations Matrix */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border/50">
        <label className="text-[11px] font-medium text-foreground">
          Allowed Bucket Operations (Connectable Capabilities)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {OPERATIONS.map((op) => {
            const active = allowedOps.includes(op.key);
            return (
              <button
                type="button"
                key={op.key}
                onClick={() => toggleOp(op.key)}
                className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-colors ${
                  active
                    ? "bg-primary/10 border-primary/40 text-foreground"
                    : "bg-muted/20 border-border/60 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <div
                  className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-muted-foreground/40 bg-background"
                  }`}
                >
                  {active && <Check size={10} strokeWidth={3} />}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium leading-none">{op.label}</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5 truncate">
                    {op.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Direct Client / WebApp Uploads & Presigned URLs */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground">
              Presigned URLs for Client Uploads
            </span>
            <span className="text-[10px] text-muted-foreground">
              Generate temporary signed URLs for browser direct-to-S3 uploads
            </span>
          </div>
          <Switch
            checked={isPresignedActive}
            onCheckedChange={handlePresignedToggle}
          />
        </div>

        {isPresignedActive && (
          <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-background/60 border border-border/60 mt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                <Clock size={12} className="text-muted-foreground" />
                Presigned URL Lifetime (TTL)
              </span>
              <div className="flex items-center gap-1">
                {PRESET_EXPIRATIONS.map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant={item.presignedUrlTtl === preset.value ? "secondary" : "ghost"}
                    size="sm"
                    className="h-6 px-1.5 text-[10px]"
                    onClick={() =>
                      handleUpdate(item.id, { presignedUrlTtl: preset.value })
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <LocalInput
              className="h-7 text-xs font-mono"
              placeholder="Expiration in seconds (default 900s)"
              value={item.presignedUrlTtl || "900"}
              onChange={(e) =>
                handleUpdate(item.id, { presignedUrlTtl: e.target.value })
              }
              onBlur={(e) =>
                handleUpdate(item.id, { presignedUrlTtl: e.target.value })
              }
              debounceMs={200}
            />
          </div>
        )}
      </div>
    </div>
  );
};
