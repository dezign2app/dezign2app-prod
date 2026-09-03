"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Eye, EyeOff, Check, FileCode, Lock } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import {
  cleanEnvVarName,
  formatEnvVarRef,
  saveLocalEnvVariable,
  getLocalEnvVariable,
  fetchLocalEnvVariable,
} from "@/lib/utils/localEnvSync";
import { toast } from "sonner";

interface EnvSecretInputProps {
  envVarName: string;
  onEnvVarNameChange: (cleanName: string, refString: string) => void;
  projectId?: string;
  labelPrefix?: string;
  compact?: boolean;
}

export const EnvSecretInput: React.FC<EnvSecretInputProps> = ({
  envVarName,
  onEnvVarNameChange,
  projectId,
  labelPrefix = "",
  compact = false,
}) => {
  const cleanName = cleanEnvVarName(envVarName) || "API_KEY";
  const [localName, setLocalName] = useState(cleanName);
  const [secretValue, setSecretValue] = useState<string>(() =>
    getLocalEnvVariable(cleanName),
  );
  const [showSecret, setShowSecret] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Sync external name changes
  useEffect(() => {
    const currentClean = cleanEnvVarName(envVarName);
    if (currentClean && currentClean !== localName) {
      setLocalName(currentClean);
      const cached = getLocalEnvVariable(currentClean);
      setSecretValue(cached);
    }
  }, [envVarName, localName]);

  // Load secret from local .env if available
  useEffect(() => {
    if (localName) {
      fetchLocalEnvVariable(localName, projectId).then((val) => {
        if (val) setSecretValue(val);
      });
    }
  }, [localName, projectId]);

  const handleNameBlur = useCallback(() => {
    const nextClean = cleanEnvVarName(localName) || "API_KEY";
    setLocalName(nextClean);
    onEnvVarNameChange(nextClean, formatEnvVarRef(nextClean));
    // Load matching local secret if cached
    const cached = getLocalEnvVariable(nextClean);
    if (cached) setSecretValue(cached);
  }, [localName, onEnvVarNameChange]);

  const handleSaveSecret = useCallback(
    async (valToSave: string) => {
      if (!localName) return;
      try {
        await saveLocalEnvVariable(localName, valToSave, projectId);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
        toast.success(`Saved ${localName} to local .env`);
      } catch (err) {
        toast.error("Failed to save to local .env");
      }
    },
    [localName, projectId],
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center justify-between">
            <span>Environment Variable</span>
            <span className="font-mono text-[9px] text-primary/80">
              process.env.{localName}
            </span>
          </Label>
          <Input
            className="h-6 text-xs bg-background font-mono"
            placeholder="API_KEY"
            value={localName}
            onChange={(e) => setLocalName(cleanEnvVarName(e.target.value))}
            onBlur={handleNameBlur}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Lock size={9} /> Secret Value (Local .env)
            </span>
            {isSaved && (
              <span className="text-[9px] text-emerald-500 font-medium flex items-center gap-0.5">
                <Check size={9} /> Saved
              </span>
            )}
          </Label>
          <div className="flex items-center gap-1">
            <Input
              type={showSecret ? "text" : "password"}
              className="h-6 text-xs bg-background font-mono flex-1"
              placeholder="sk_live_... (stored in .env)"
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              onBlur={(e) => handleSaveSecret(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground"
              title={showSecret ? "Hide secret" : "Show secret"}
            >
              {showSecret ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </div>
        </div>

        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
          <ShieldAlert size={10} className="shrink-0" />
          Saved to local .env only; excluded from DB.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Environment Variable Name */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            {labelPrefix}Environment Variable Name
          </Label>
          <span className="text-[10px] font-mono text-muted-foreground">
            Code: <code className="text-primary font-semibold">process.env.{localName}</code>
          </span>
        </div>
        <Input
          className="h-8 text-xs bg-background font-mono"
          placeholder="e.g. STRIPE_SECRET_KEY"
          value={localName}
          onChange={(e) => setLocalName(cleanEnvVarName(e.target.value))}
          onBlur={handleNameBlur}
        />
        <span className="text-[10px] text-muted-foreground">
          The variable name referenced in compiled code and request headers.
        </span>
      </div>

      {/* 2. Environment Variable Secret Value */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5">
            <Lock size={12} className="text-primary" />
            <span>{labelPrefix}Secret Value (Local .env only)</span>
          </Label>
          {isSaved ? (
            <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
              <Check size={11} /> Saved to .env
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <FileCode size={11} /> Writes to .env
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showSecret ? "text" : "password"}
              className="h-8 text-xs bg-background font-mono pr-8"
              placeholder="sk_live_... or token value"
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              onBlur={(e) => handleSaveSecret(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
              title={showSecret ? "Hide secret" : "Show secret"}
            >
              {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs px-2.5 shrink-0"
            onClick={() => handleSaveSecret(secretValue)}
          >
            Save to .env
          </Button>
        </div>
      </div>

      {/* 3. Security Warning Alert Banner */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs leading-relaxed">
        <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[11px] flex items-center gap-1.5">
            Security Warning — Local .env Storage Only
          </span>
          <span className="text-[10px] opacity-90">
            Secret values are saved only into your local <code className="bg-amber-500/20 px-1 py-0.2 rounded font-mono">.env</code> file and are never stored in the database. (Compiler support will be implemented later).
          </span>
        </div>
      </div>
    </div>
  );
};
