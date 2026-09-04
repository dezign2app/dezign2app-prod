"use client";

import React from "react";
import { Globe, Plus, Trash, AlertCircle } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ExternalHeader, ExternalQueryParam } from "@workspace/canvas/types";
import { cn } from "@workspace/ui/lib/utils";
import { HTTP_METHODS, HttpMethod } from "./externalConfigUtils";
import { BufferedInput, BufferedTextarea } from "./BufferedInput";

interface ExternalRequestConfigSectionProps {
  method: HttpMethod;
  onMethodChange: (method: HttpMethod) => void;
  url: string;
  onUrlCommit: (url: string) => void;
  queryParams: ExternalQueryParam[];
  onAddQueryParam: () => void;
  onUpdateQueryParam: (id: string, patch: Partial<ExternalQueryParam>) => void;
  onDeleteQueryParam: (id: string) => void;
  headers: ExternalHeader[];
  onAddHeader: (key?: string, value?: string) => void;
  onUpdateHeader: (id: string, patch: Partial<ExternalHeader>) => void;
  onDeleteHeader: (id: string) => void;
  bodyType: "json" | "text" | "raw" | "none";
  onBodyTypeChange: (val: "json" | "text" | "raw" | "none") => void;
  bodyContent: string;
  onBodyContentCommit: (val: string) => void;
  onFormatJson: () => void;
}

export const ExternalRequestConfigSection = React.memo<ExternalRequestConfigSectionProps>(
  ({
    method,
    onMethodChange,
    url,
    onUrlCommit,
    queryParams,
    onAddQueryParam,
    onUpdateQueryParam,
    onDeleteQueryParam,
    headers,
    onAddHeader,
    onUpdateHeader,
    onDeleteHeader,
    bodyType,
    onBodyTypeChange,
    bodyContent,
    onBodyContentCommit,
    onFormatJson,
  }) => {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Globe size={14} /> Request Configuration
        </span>

        {/* Method & URL */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium">HTTP Method & Target URL</Label>
          <div className="flex items-center gap-2">
            <Select value={method} onValueChange={(val: HttpMethod) => onMethodChange(val)}>
              <SelectTrigger className="h-8 w-28 text-xs font-mono font-bold bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((m) => (
                  <SelectItem key={m} value={m} className="font-mono font-bold">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <BufferedInput
              className={cn(
                "h-8 text-xs bg-background font-mono flex-1",
                !url?.trim() &&
                  "border-destructive text-destructive placeholder:text-destructive/60",
              )}
              placeholder="https://api.example.com/v1/resource/{{userId}}"
              value={url}
              onCommit={onUrlCommit}
            />
          </div>
          {!url?.trim() ? (
            <span className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
              <AlertCircle size={11} /> Target URL is required to execute this API call.
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              Can include path variables like{" "}
              <code className="font-mono">{`https://api.github.com/users/{{username}}`}</code>
            </span>
          )}
        </div>

        {/* Query Parameters */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Query Parameters ({queryParams.length})</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 text-[11px] gap-1 px-2"
              onClick={onAddQueryParam}
            >
              <Plus size={11} /> Add Param
            </Button>
          </div>

          {queryParams.length > 0 && (
            <div className="flex flex-col divide-y divide-border/60 border border-border rounded-lg overflow-hidden bg-background">
              {queryParams.map((qp) => (
                <div key={qp.id} className="p-2 flex items-center gap-2">
                  <BufferedInput
                    className="h-7 text-xs font-mono flex-1"
                    placeholder="key (e.g. limit)"
                    value={qp.key ?? ""}
                    onCommit={(val) => onUpdateQueryParam(qp.id, { key: val })}
                  />
                  <BufferedInput
                    className="h-7 text-xs font-mono flex-1"
                    placeholder="value (e.g. {{limit}})"
                    value={qp.value ?? ""}
                    onCommit={(val) => onUpdateQueryParam(qp.id, { value: val })}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteQueryParam(qp.id)}
                  >
                    <Trash size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HTTP Headers */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Request Headers ({headers.length})</Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[11px] gap-1 px-2"
                onClick={() => onAddHeader()}
              >
                <Plus size={11} /> Add Header
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Presets:</span>
            <button
              type="button"
              onClick={() => onAddHeader("Authorization", "Bearer ")}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary hover:bg-muted text-foreground border border-border/60"
            >
              + Authorization: Bearer
            </button>
            <button
              type="button"
              onClick={() => onAddHeader("Content-Type", "application/json")}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary hover:bg-muted text-foreground border border-border/60"
            >
              + Content-Type: json
            </button>
            <button
              type="button"
              onClick={() => onAddHeader("Accept", "application/json")}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary hover:bg-muted text-foreground border border-border/60"
            >
              + Accept: json
            </button>
          </div>

          {headers.length > 0 && (
            <div className="flex flex-col divide-y divide-border/60 border border-border rounded-lg overflow-hidden bg-background">
              {headers.map((h) => (
                <div key={h.id} className="p-2 flex items-center gap-2">
                  <BufferedInput
                    className="h-7 text-xs font-mono flex-1"
                    placeholder="Header-Name"
                    value={h.key ?? ""}
                    onCommit={(val) => onUpdateHeader(h.id, { key: val })}
                  />
                  <BufferedInput
                    className="h-7 text-xs font-mono flex-1"
                    placeholder="Value (e.g. {{apiKey}})"
                    value={h.value ?? ""}
                    onCommit={(val) => onUpdateHeader(h.id, { value: val })}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteHeader(h.id)}
                  >
                    <Trash size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Request Body */}
        {["POST", "PUT", "PATCH", "DELETE"].includes(method) && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Request Body</Label>
              <div className="flex items-center gap-1.5">
                <Select
                  value={bodyType}
                  onValueChange={(val) => {
                    if (val === "json" || val === "text" || val === "raw" || val === "none") {
                      onBodyTypeChange(val);
                    }
                  }}
                >
                  <SelectTrigger className="h-6 w-24 text-[11px] font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="raw">Raw Text</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
                {bodyType === "json" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={onFormatJson}
                    title="Format JSON"
                  >
                    Beautify
                  </Button>
                )}
              </div>
            </div>

            {bodyType !== "none" && (
              <div className="flex flex-col gap-1.5">
                <BufferedTextarea
                  className="min-h-[110px] text-xs font-mono bg-background resize-y leading-relaxed"
                  placeholder='{\n  "userId": "{{userId}}",\n  "amount": {{amount}}\n}'
                  value={bodyContent}
                  onCommit={onBodyContentCommit}
                />
                <span className="text-[10px] text-muted-foreground">
                  Variables like <code className="font-mono">{`"{{userId}}"`}</code> or{" "}
                  <code className="font-mono">{`{{amount}}`}</code> are replaced dynamically before calling.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
ExternalRequestConfigSection.displayName = "ExternalRequestConfigSection";
