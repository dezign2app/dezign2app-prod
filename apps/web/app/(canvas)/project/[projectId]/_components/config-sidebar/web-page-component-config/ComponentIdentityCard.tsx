"use client";

import React, { useState, useEffect, useRef } from "react";
import { Tag, Sparkles, AlertCircle } from "lucide-react";
import { toPascalCase } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";
import { LocalInput } from "../pipeline-step-editor";

export interface ComponentIdentityCardProps {
  componentId: string;
  name?: string;
  label?: string;
  displayLabel: string;
  description?: string;
  onUpdate: (changes: { name?: string; label?: string; description?: string }) => void;
}

export const ComponentIdentityCard: React.FC<ComponentIdentityCardProps> = ({
  componentId,
  name,
  label,
  displayLabel,
  description,
  onUpdate,
}) => {
  const isFocusedRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const [nameInputValue, setNameInputValue] = useState(
    name || label || (displayLabel !== "Component" ? displayLabel : ""),
  );

  useEffect(() => {
    if (!isFocusedRef.current && !debounceTimerRef.current) {
      setNameInputValue(
        name || label || (displayLabel !== "Component" ? displayLabel : ""),
      );
    }
  }, [componentId, name, label, displayLabel]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setNameInputValue(raw);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    // Do not format while user has trailing whitespace (still typing next word)
    if (raw.trim() && !/\s$/.test(raw)) {
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const pascal = toPascalCase(raw);
        if (pascal) {
          setNameInputValue(pascal);
          onUpdate({ name: pascal, label: pascal });
        }
      }, 500);
    }
  };

  const handleNameFocus = () => {
    isFocusedRef.current = true;
  };

  const handleNameBlur = () => {
    isFocusedRef.current = false;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pascal = toPascalCase(nameInputValue);
    if (pascal) {
      setNameInputValue(pascal);
      onUpdate({ name: pascal, label: pascal });
    } else {
      const olderName = name || label || "Component";
      setNameInputValue(olderName);
      onUpdate({ name: olderName, label: olderName });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      isFocusedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const pascal = toPascalCase(nameInputValue);
      if (pascal) {
        setNameInputValue(pascal);
        onUpdate({ name: pascal, label: pascal });
        e.currentTarget.blur();
      } else {
        const olderName = name || label || "Component";
        setNameInputValue(olderName);
        onUpdate({ name: olderName, label: olderName });
        e.currentTarget.blur();
      }
    } else if (e.key === "Escape") {
      isFocusedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const olderName = name || label || "Component";
      setNameInputValue(olderName);
      onUpdate({ name: olderName, label: olderName });
      e.currentTarget.blur();
    }
  };

  const handleFormatPascalCase = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pascal = toPascalCase(nameInputValue || displayLabel);
    if (pascal) {
      setNameInputValue(pascal);
      onUpdate({ name: pascal, label: pascal });
    } else {
      const olderName = name || label || "Component";
      setNameInputValue(olderName);
      onUpdate({ name: olderName, label: olderName });
    }
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-foreground">
            <Tag size={13} className="text-purple-500" />
            <span>Component Identity &amp; Naming</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">ID: {componentId}</span>
        </CardTitle>
        <CardDescription className="text-[11px] text-muted-foreground">
          Configure the component name and visible display text in PascalCase format.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-medium text-foreground flex items-center gap-1">
              <span>Component Name</span>
              <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleFormatPascalCase}
                className="h-5 px-1.5 text-[10px] font-mono text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 cursor-pointer"
                title="Format component name as PascalCase"
              >
                <Sparkles size={10} className="mr-1" />
                Format PascalCase
              </Button>
              <Badge variant="outline" className="text-[9px] font-mono text-purple-600 dark:text-purple-400 border-purple-500/30">
                PascalCase
              </Badge>
            </div>
          </div>
          <Input
            value={nameInputValue}
            onChange={handleNameChange}
            onFocus={handleNameFocus}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            placeholder="e.g. SubmitButton, UserProfileCard"
            className={cn(
              "h-8 text-xs font-mono bg-background",
              !nameInputValue.trim() && "border-destructive focus-visible:ring-destructive",
            )}
          />
          {!nameInputValue.trim() ? (
            <p className="text-[10px] text-destructive flex items-center gap-1 font-medium">
              <AlertCircle size={10} />
              <span>Component name cannot be empty</span>
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Formatted in PascalCase (e.g. PrimaryButton, SectionHeader)</span>
              {displayLabel !== "Component" && (
                <span className="font-mono text-[9px] text-purple-600 dark:text-purple-400 font-semibold">
                  &lt;{displayLabel} /&gt;
                </span>
              )}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">
            Description / Notes (Optional)
          </Label>
          <LocalInput
            key={`${componentId}-description`}
            value={description ?? ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="e.g. Primary call-to-action button for the section..."
            className="h-7 text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
};
