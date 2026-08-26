import React, { useState, useEffect } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { PageSection } from "@/types/canvas";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Layers, Sparkles, Plus, X, Box, Code2 } from "lucide-react";

export interface WebPageSectionConfigProps {
  id: string; // The section ID
  nodeId: string;
}

const COMMON_LIBRARIES = [
  "tldraw",
  "@xyflow/react",
  "framer-motion",
  "recharts",
  "lucide-react",
  "@tanstack/react-table",
  "@tanstack/react-query",
  "zod",
  "three",
  "@react-three/fiber",
  "date-fns",
];

export const WebPageSectionConfig = ({ id, nodeId }: WebPageSectionConfigProps) => {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);

  const parentNode = nodes.find((n) => n.id === nodeId);
  const sections: PageSection[] = parentNode?.data?.sections || [];
  const section = sections.find((s) => s.id === id);

  const [name, setName] = useState(section?.name || "");
  const [renderMode, setRenderMode] = useState<"server" | "client">(
    section?.renderMode || "client",
  );
  const [loadStrategy, setLoadStrategy] = useState<
    "eager" | "dynamic" | "dynamic-no-ssr"
  >(section?.loadStrategy || "eager");
  const [description, setDescription] = useState(section?.description || "");
  const [uiPrompt, setUiPrompt] = useState(section?.uiPrompt || "");
  const [libraries, setLibraries] = useState<string[]>(section?.libraries || []);
  const [newLibInput, setNewLibInput] = useState("");

  useEffect(() => {
    if (section) {
      setName(section.name || "");
      setRenderMode(section.renderMode || "client");
      setLoadStrategy(section.loadStrategy || "eager");
      setDescription(section.description || "");
      setUiPrompt(section.uiPrompt || "");
      setLibraries(section.libraries || []);
    }
  }, [section]);

  if (!parentNode || !section) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Section not found. It may have been deleted.
      </div>
    );
  }

  const handleUpdate = (changes: Partial<PageSection>) => {
    const updated = sections.map((s) =>
      s.id === id ? { ...s, ...changes } : s,
    );
    updateNode(nodeId, { data: { ...parentNode.data, sections: updated } });
  };

  const handleAddLibrary = (libName: string) => {
    const trimmed = libName.trim();
    if (!trimmed || libraries.includes(trimmed)) return;
    const next = [...libraries, trimmed];
    setLibraries(next);
    handleUpdate({ libraries: next });
    setNewLibInput("");
  };

  const handleRemoveLibrary = (libName: string) => {
    const next = libraries.filter((l) => l !== libName);
    setLibraries(next);
    handleUpdate({ libraries: next });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <Layers size={16} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-foreground truncate">
              {section.name || "Section"}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono truncate">
              Page Section Configuration
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="general" className="flex-1 flex flex-col">
        <div className="px-4 pt-2 border-b bg-muted/20">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="general" className="text-xs flex items-center gap-1.5">
              <Box size={12} /> General
            </TabsTrigger>
            <TabsTrigger value="ai-context" className="text-xs flex items-center gap-1.5">
              <Sparkles size={12} className="text-indigo-400" /> AI Context
            </TabsTrigger>
          </TabsList>
        </div>

        {/* General Tab */}
        <TabsContent value="general" className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Section Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Section Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                handleUpdate({ name: e.target.value });
              }}
              placeholder="e.g. HeroSection, CanvasArea"
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Compiled into <code className="text-primary font-mono">_components/{name || "Section"}.tsx</code>
            </p>
          </div>

          {/* Render Mode */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Render Mode</Label>
            <Select
              value={renderMode}
              onValueChange={(val: "server" | "client") => {
                setRenderMode(val);
                handleUpdate({ renderMode: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select render mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client" className="text-xs">
                  Client Component (&apos;use client&apos;) — required for hooks, state, DOM events
                </SelectItem>
                <SelectItem value="server" className="text-xs">
                  Server Component (RSC) — fast SSR, no browser JS bundle
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Load Strategy */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Component Load Strategy</Label>
            <Select
              value={loadStrategy}
              onValueChange={(val: "eager" | "dynamic" | "dynamic-no-ssr") => {
                setLoadStrategy(val);
                handleUpdate({ loadStrategy: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select load strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eager" className="text-xs">
                  Eager (Static import) — standard import statement
                </SelectItem>
                <SelectItem value="dynamic" className="text-xs">
                  Dynamic import — next/dynamic code splitting
                </SelectItem>
                <SelectItem value="dynamic-no-ssr" className="text-xs">
                  Dynamic (No SSR) — next/dynamic with ssr: false (for tldraw, xyflow, etc.)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Third-Party Libraries */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Code2 size={13} className="text-indigo-400" /> Third-Party Dependencies
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {libraries.length} added
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Dependencies needed by this section component. The compiler automatically adds them to package.json.
            </p>

            {/* Added libraries chips */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-md bg-secondary/30 border">
              {libraries.length === 0 ? (
                <span className="text-[10px] text-muted-foreground italic">
                  No custom libraries declared
                </span>
              ) : (
                libraries.map((lib) => (
                  <Badge
                    key={lib}
                    variant="secondary"
                    className="text-[10px] gap-1 bg-background border font-mono"
                  >
                    {lib}
                    <button
                      type="button"
                      onClick={() => handleRemoveLibrary(lib)}
                      className="hover:text-destructive cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            {/* Add new library */}
            <div className="flex items-center gap-1.5">
              <Input
                value={newLibInput}
                onChange={(e) => setNewLibInput(e.target.value)}
                placeholder="Add package (e.g. tldraw, @xyflow/react)"
                className="h-7 text-xs font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddLibrary(newLibInput);
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs shrink-0"
                onClick={() => handleAddLibrary(newLibInput)}
              >
                <Plus size={12} className="mr-1" /> Add
              </Button>
            </div>

            {/* Quick Suggestions */}
            <div className="space-y-1 pt-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground">
                Common suggestions
              </span>
              <div className="flex flex-wrap gap-1">
                {COMMON_LIBRARIES.filter((l) => !libraries.includes(l)).slice(0, 6).map((lib) => (
                  <button
                    key={lib}
                    type="button"
                    onClick={() => handleAddLibrary(lib)}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground font-mono border transition-colors cursor-pointer"
                  >
                    + {lib}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* AI Context Tab */}
        <TabsContent value="ai-context" className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500">
              <Sparkles size={13} />
              AI Code Generation Prompts
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              These descriptions guide the AI when generating the TSX implementation, components, and styling for this section.
            </p>
          </div>

          {/* Section Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Section Functional Description</Label>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                handleUpdate({ description: e.target.value });
              }}
              placeholder="Describe what this section renders or does... (e.g. Renders an interactive flow chart canvas powered by xyflow with node toolbar and mini-map)"
              className="min-h-[90px] text-xs resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              Explains the purpose and data flow of this component.
            </p>
          </div>

          {/* UI Visual Style Prompt */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Visual Design & UI Prompt</Label>
            <Textarea
              value={uiPrompt}
              onChange={(e) => {
                setUiPrompt(e.target.value);
                handleUpdate({ uiPrompt: e.target.value });
              }}
              placeholder="Describe visual appearance, layout, styling... (e.g. Modern dark card with frosted glass background, subtle indigo borders, floating action buttons, and responsive grid layout)"
              className="min-h-[110px] text-xs resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              Guides styling, component hierarchy, animations, and Tailwind classes.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
