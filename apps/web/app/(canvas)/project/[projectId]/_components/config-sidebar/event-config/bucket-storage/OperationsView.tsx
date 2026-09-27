import React, { useState, useMemo } from "react";
import {
  Play, Check, Copy, Clock, Terminal, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@workspace/ui/components/select";
import { LocalInput, LocalTextarea } from "../../../backend-nodes/graph-nodes/shared";
import { STORAGE_OPERATIONS } from "@workspace/canvas/constants";
import { StorageTestingConfig } from "./useStorageTestingConfig";
import { StorageTestingActions } from "./useStorageTestingActions";
import { generateOperationInvocationCode } from "./codeGenerators";

interface OperationsViewProps {
  config: StorageTestingConfig;
  actions: StorageTestingActions;
}

export const OperationsView: React.FC<OperationsViewProps> = ({ config, actions }) => {
  const { bucketName, activeEndpoint } = config;
  const {
    isExecutingOp, opResult, setOpResult, handleRunOperation,
    isCreatingBucket, createSuccessMsg, createErrorMsg, handleCreateBucketNow,
    copiedCode, copiedResult, handleCopy,
  } = actions;

  const [selectedOpKey, setSelectedOpKey] = useState<string>("uploadObject");
  const [keyInput, setKeyInput] = useState<string>("uploads/avatars/user-42.png");
  const [contentTypeInput, setContentTypeInput] = useState<string>("image/png");
  const [bodyInput, setBodyInput] = useState<string>("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
  const [ttlInput, setTtlInput] = useState<string>("900");
  const [prefixInput, setPrefixInput] = useState<string>("uploads/");
  const [metadataUser, setMetadataUser] = useState<string>("user-9842");
  const [metadataTags, setMetadataTags] = useState<string>("avatar,profile");

  const selectedOp = useMemo(
    () => STORAGE_OPERATIONS.find((o) => o.key === selectedOpKey) ?? STORAGE_OPERATIONS[0],
    [selectedOpKey],
  );

  const activeInvocationCode = useMemo(
    () => generateOperationInvocationCode(selectedOpKey, bucketName, {
      key: keyInput, body: bodyInput, contentType: contentTypeInput,
      ttl: ttlInput, prefix: prefixInput,
      metadata: { userId: metadataUser, tags: metadataTags },
    }),
    [selectedOpKey, bucketName, keyInput, bodyInput, contentTypeInput, ttlInput, prefixInput, metadataUser, metadataTags],
  );

  const runOp = () =>
    handleRunOperation({
      selectedOpKey, keyInput, bodyInput, contentTypeInput, ttlInput, prefixInput,
      metadataUser, metadataTags,
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Operation Selector */}
      <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-border/80 bg-card/50">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
            <Play size={12} /> Generated Storage Operation
          </label>
          <Badge variant="outline" className="text-[10px] font-mono">
            @workspace/storage/operations
          </Badge>
        </div>

        <Select
          value={selectedOpKey}
          onValueChange={(val) => {
            setSelectedOpKey(val);
            const found = STORAGE_OPERATIONS.find((o) => o.key === val);
            if (found) {
              setKeyInput(found.defaultKey);
              if (found.defaultContentType) setContentTypeInput(found.defaultContentType);
              if (found.defaultBody) setBodyInput(found.defaultBody);
              if (found.defaultTtl) setTtlInput(found.defaultTtl);
            }
            setOpResult(null);
          }}
        >
          <SelectTrigger className="h-8 bg-background/80 text-xs font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STORAGE_OPERATIONS.map((op) => (
              <SelectItem key={op.key} value={op.key} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{op.name}()</span>
                  <span className="text-[10px] text-muted-foreground">({op.kind})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-[11px] text-muted-foreground">{selectedOp?.desc}</p>
      </div>

      {/* Request Parameters */}
      <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-border/80 bg-card/50">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Request Parameters (Live Server Dispatch)
        </span>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-foreground">Object Key / Path</label>
          <LocalInput
            className="h-8 text-xs font-mono bg-background"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            debounceMs={150}
            placeholder="e.g. uploads/avatars/user-1.png"
          />
        </div>

        {selectedOpKey === "uploadObject" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-foreground">Content-Type</label>
              <LocalInput
                className="h-8 text-xs font-mono bg-background"
                value={contentTypeInput}
                onChange={(e) => setContentTypeInput(e.target.value)}
                debounceMs={150}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-foreground">Payload Data to Send</label>
              <LocalTextarea
                className="h-16 text-xs font-mono bg-background resize-none"
                value={bodyInput}
                onChange={(e) => setBodyInput(e.target.value)}
                debounceMs={200}
              />
            </div>

            {Boolean(config.configuredForcePathStyle) && (
              <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                  Custom Metadata Schema Attributes (x-amz-meta-*)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] text-muted-foreground">userId</label>
                    <LocalInput
                      className="h-7 text-xs bg-background"
                      value={metadataUser}
                      onChange={(e) => setMetadataUser(e.target.value)}
                      debounceMs={150}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] text-muted-foreground">tags</label>
                    <LocalInput
                      className="h-7 text-xs bg-background"
                      value={metadataTags}
                      onChange={(e) => setMetadataTags(e.target.value)}
                      debounceMs={150}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {(selectedOpKey === "getUploadPresignedUrl" || selectedOpKey === "getDownloadPresignedUrl") && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-foreground">Expiration (Seconds)</label>
            <LocalInput
              className="h-8 text-xs font-mono bg-background"
              value={ttlInput}
              onChange={(e) => setTtlInput(e.target.value)}
              debounceMs={150}
            />
          </div>
        )}

        {selectedOpKey === "listObjects" && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-foreground">Folder / Prefix Filter</label>
            <LocalInput
              className="h-8 text-xs font-mono bg-background"
              value={prefixInput}
              onChange={(e) => setPrefixInput(e.target.value)}
              debounceMs={150}
            />
          </div>
        )}
      </div>

      {/* Generated Code Preview */}
      <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-border/80 bg-black/60 dark:bg-black/80">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Terminal size={12} /> Generated Code Under Test
          </span>
          <Button
            variant="ghost" size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
            onClick={() => handleCopy(activeInvocationCode)}
          >
            {copiedCode ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            {copiedCode ? "Copied" : "Copy Code"}
          </Button>
        </div>
        <pre className="text-[11px] font-mono text-emerald-400/90 overflow-x-auto leading-relaxed select-text p-1">
          {activeInvocationCode}
        </pre>
      </div>

      {/* Run Button */}
      <Button
        size="sm" onClick={runOp} disabled={isExecutingOp}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-9 gap-2 shadow-sm"
      >
        <Play size={12} fill="currentColor" />
        {isExecutingOp
          ? `Sending ${selectedOp?.name || "operation"}() to ${activeEndpoint}...`
          : `Run ${selectedOp?.name || "operation"}() Test (Hit Server)`}
      </Button>

      {/* Result */}
      {opResult && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-border/80 bg-card/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] font-bold font-mono px-2 py-0.5 border ${
                  opResult.success
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-destructive/15 text-destructive border-destructive/30"
                }`}
              >
                {opResult.status > 0 ? `${opResult.status} ${opResult.statusText}` : "Network Error"}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                <Clock size={11} /> {opResult.durationMs}ms
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground truncate">
              <span>{opResult.method}</span>
              <span className="truncate max-w-[200px]">{opResult.url}</span>
            </div>
          </div>

          {opResult.error && (
            <div className="flex flex-col gap-2 p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px]">
              <div>
                <strong>Server Error:</strong> {opResult.error}
                {opResult.tip && <p className="text-[10px] text-muted-foreground mt-1">{opResult.tip}</p>}
              </div>

              {opResult.status === 404 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-destructive/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Bucket &quot;{bucketName}&quot; does not exist on this server.
                    </span>
                    <Button
                      size="sm" disabled={isCreatingBucket} onClick={handleCreateBucketNow}
                      className="h-6 text-[10px] bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1 px-2 shrink-0"
                    >
                      {isCreatingBucket ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                      Create Bucket Now
                    </Button>
                  </div>

                  {createSuccessMsg && (
                    <div className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                      <CheckCircle2 size={12} /> {createSuccessMsg}
                    </div>
                  )}
                  {createErrorMsg && (
                    <div className="p-2 rounded bg-destructive/15 border border-destructive/30 text-destructive text-[11px] flex items-start gap-1.5 font-mono">
                      <XCircle size={12} className="shrink-0 mt-0.5" />
                      <span className="break-all">{createErrorMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {opResult.signedUrl && (
            <div className="flex flex-col gap-1 p-2 rounded bg-background/80 border border-border/60">
              <span className="text-[10px] font-bold text-amber-500 uppercase">Generated Presigned URL:</span>
              <span className="text-[10px] font-mono break-all text-muted-foreground select-all">
                {opResult.signedUrl}
              </span>
            </div>
          )}

          {opResult.data !== null && opResult.data !== undefined && (
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Live Server Response:</span>
                <Button
                  variant="ghost" size="sm"
                  className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => handleCopy(JSON.stringify(opResult.data, null, 2), true)}
                >
                  {copiedResult ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  {copiedResult ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="p-2.5 rounded bg-black/60 dark:bg-black/90 text-[11px] font-mono text-foreground/90 overflow-x-auto whitespace-pre-wrap select-text leading-relaxed">
                {typeof opResult.data === "object"
                  ? JSON.stringify(opResult.data, null, 2)
                  : String(opResult.data)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
