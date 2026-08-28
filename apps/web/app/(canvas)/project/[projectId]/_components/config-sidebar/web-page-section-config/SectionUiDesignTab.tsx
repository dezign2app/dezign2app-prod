"use client";

import React, { useState, useRef } from "react";
import {
  Palette,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Trash,
  Eye,
  Plus,
  Sparkles,
  Loader2,
  Check,
  Zap,
} from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import { Badge } from "@workspace/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

export interface SectionUiDesignTabProps {
  sectionName?: string;
  actionsCount?: number;
  uiPrompt: string;
  images?: string[];
  primaryImageUrl?: string;
  onUpdateUiPrompt: (uiPrompt: string) => void;
  onUpdateImages: (images: string[], primaryImageUrl?: string) => void;
  onGenerateUI?: () => void;
}

const STYLE_CHIPS = [
  "Responsive 3-Column Card Grid",
  "Data Table with Action Buttons",
  "Hero Section with CTA & Badges",
  "Bento Grid Layout",
  "Modern Glassmorphic Dark",
  "Minimal Clean Monochrome",
  "Interactive Filter & Search Bar",
  "Split Sidebar + Feed Layout",
];

export const SectionUiDesignTab: React.FC<SectionUiDesignTabProps> = ({
  sectionName,
  actionsCount = 0,
  uiPrompt,
  images = [],
  primaryImageUrl,
  onUpdateUiPrompt,
  onUpdateImages,
  onGenerateUI,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlPopoverOpen, setUrlPopoverOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Normalize image list (combine primaryImageUrl + images array without duplicates)
  const allImages = React.useMemo(() => {
    const list: string[] = [];
    if (primaryImageUrl && primaryImageUrl.trim()) {
      list.push(primaryImageUrl.trim());
    }
    images.forEach((img) => {
      if (img && img.trim() && !list.includes(img.trim())) {
        list.push(img.trim());
      }
    });
    return list;
  }, [images, primaryImageUrl]);

  const cleanCompName = React.useMemo(() => {
    const raw = sectionName?.trim() || "Section";
    const cleaned = raw.replace(/[^a-zA-Z0-9]+/g, " ").trim();
    const pascal = cleaned
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
    const finalName = pascal.endsWith("Section") ? pascal : `${pascal}Section`;
    const folder =
      raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "section";
    return {
      component: finalName,
      folder,
    };
  }, [sectionName]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    toast.info(`Generating UI component code for ${sectionName || "Section"}...`);
    try {
      if (onGenerateUI) {
        onGenerateUI();
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast.success(`UI component layout generated for ${sectionName || "Section"}!`);
    } catch {
      toast.error("Failed to generate UI component.");
    } finally {
      setIsGenerating(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WebP, GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const next = [...allImages, dataUrl];
        onUpdateImages(next, next[0]);
        toast.success("Reference image added!");
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f) processFile(f);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f) processFile(f);
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    if (
      !trimmed.startsWith("http://") &&
      !trimmed.startsWith("https://") &&
      !trimmed.startsWith("data:image/")
    ) {
      toast.error("Please enter a valid image URL starting with http:// or https://");
      return;
    }

    const next = [...allImages, trimmed];
    onUpdateImages(next, next[0]);
    setUrlInput("");
    setUrlPopoverOpen(false);
    toast.success("Reference image URL attached!");
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const next = allImages.filter((_, idx) => idx !== indexToRemove);
    onUpdateImages(next, next[0]);
  };

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto m-0 outline-none pb-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* AI UI Generation Informational Banner */}
      <div className="p-3.5 rounded-xl bg-secondary/25 border border-border/50 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-secondary text-foreground border border-border/50 shrink-0 mt-0.5">
            <Sparkles size={14} className="text-foreground" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground">
              AI UI Generator & Layout Assistant
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              AI will generate and update this section&apos;s UI component according to the defined visual prompt, design instructions, reference mockups, and interactive actions.
            </p>
          </div>
        </div>

        {/* Readiness Checklist */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/30 text-[10px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check size={11} className={uiPrompt.trim() ? "text-emerald-400" : "text-muted-foreground/60"} />
            Prompt: {uiPrompt.trim() ? `${uiPrompt.length} chars` : "Default"}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Check size={11} className={allImages.length > 0 ? "text-emerald-400" : "text-muted-foreground/60"} />
            {allImages.length} mockup {allImages.length === 1 ? "reference" : "references"}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Check size={11} className={actionsCount > 0 ? "text-emerald-400" : "text-muted-foreground/60"} />
            {actionsCount} interactive {actionsCount === 1 ? "action" : "actions"}
          </span>
        </div>
      </div>

      {/* Reference Images Card */}
      <div className="space-y-2.5 p-3.5 rounded-xl bg-secondary/20 border border-border/50">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <ImageIcon size={13} className="text-muted-foreground" />
            <span>Design Reference Images & Mockups</span>
          </Label>
          <Badge
            variant="outline"
            className="text-[10px] font-mono py-0 px-1.5 bg-secondary/50 text-muted-foreground border-border/50"
          >
            {allImages.length} {allImages.length === 1 ? "image" : "images"}
          </Badge>
        </div>

        {/* Upload Drop Zone / Gallery */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className={cn(
            "p-3 rounded-lg border transition-all flex flex-col gap-2.5",
            isDraggingOver
              ? "border-primary bg-secondary/60 ring-1 ring-primary/30"
              : "border-border/40 bg-background/40",
          )}
        >
          {allImages.length > 0 ? (
            <div className="flex flex-wrap gap-2 items-center">
              {allImages.map((imgUrl, idx) => (
                <div
                  key={`${imgUrl.slice(0, 32)}-${idx}`}
                  className="relative group/img rounded-lg overflow-hidden border border-border/60 bg-secondary/30 shrink-0 w-16 h-16 shadow-xs select-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt={`Reference ${idx + 1}`}
                    className="w-full h-full object-cover cursor-pointer transition-transform duration-200 group-hover/img:scale-105"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImage(imgUrl);
                    }}
                  />

                  {/* Hover overlay actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(imgUrl);
                      }}
                      className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                      title="View full image"
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(idx);
                      }}
                      className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                      title="Remove image"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add more button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-lg border border-dashed border-border/60 hover:border-border hover:bg-secondary/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                title="Upload another image"
              >
                <Plus size={14} />
                <span className="text-[9px] font-medium">Add</span>
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="py-4 px-3 border border-dashed border-border/60 rounded-lg flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer hover:bg-secondary/30 hover:border-border/90 transition-all"
            >
              <div className="p-2 rounded-full bg-secondary/60 text-muted-foreground border border-border/40">
                <Upload size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground">
                  Drop reference mockups or click to browse
                </span>
                <span className="text-[10px] text-muted-foreground">
                  PNG, JPG, SVG, WebP up to 5MB
                </span>
              </div>
            </div>
          )}

          {/* Action Row: Upload Button and Image URL popover */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/30">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-7 text-xs font-medium gap-1.5 bg-secondary/40 hover:bg-secondary border-border/50"
            >
              <Upload size={12} className="text-muted-foreground" />
              <span>Upload Files</span>
            </Button>

            <Popover open={urlPopoverOpen} onOpenChange={setUrlPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-medium gap-1.5 bg-secondary/40 hover:bg-secondary border-border/50"
                >
                  <LinkIcon size={12} className="text-muted-foreground" />
                  <span>Attach URL</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 p-3 flex flex-col gap-2.5 bg-popover border border-border shadow-lg"
                align="start"
              >
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Attach Reference Image URL</span>
                </div>
                <Input
                  type="url"
                  placeholder="https://example.com/mockup.png"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddUrl();
                    }
                  }}
                  className="h-7 text-xs bg-background"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setUrlInput("");
                      setUrlPopoverOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 px-2.5 text-xs font-medium"
                    onClick={handleAddUrl}
                  >
                    Attach
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* UI Visual Style Prompt */}
      <div className="space-y-2.5 p-3.5 rounded-xl bg-secondary/20 border border-border/50">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground">
              Visual Layout & UI Rendering Instructions
            </Label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {uiPrompt.length} chars
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Describe how buttons, interactive actions, and fetched data items should look and be rendered in this section component.
          </p>
        </div>

        <Textarea
          value={uiPrompt}
          onChange={(e) => onUpdateUiPrompt(e.target.value)}
          placeholder="Describe how actions, buttons, and fetched data items should look and be rendered (e.g. Render fetched items in a responsive 3-column card grid with hover glow, primary action button with icons and pill style, secondary actions in a dropdown menu, and subtle loading skeleton animations)..."
          className="min-h-[130px] text-xs bg-background/50 border-border/50 resize-none leading-relaxed"
        />

        {/* Theme & Layout Quick Chips */}
        <div className="pt-1.5 space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Quick Layout & Style Ideas
          </span>
          <div className="flex flex-wrap gap-1.5">
            {STYLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  const updated = uiPrompt ? `${uiPrompt}, ${chip}` : chip;
                  onUpdateUiPrompt(updated);
                }}
                className="text-[10px] px-2 py-0.5 rounded bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground font-mono border border-border/40 transition-colors"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Generate Action Bar */}
      <div className="p-3.5 rounded-xl bg-secondary/25 border border-border/50 flex flex-col gap-2">
        <Button
          type="button"
          size="default"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full h-9 text-xs font-medium gap-2 shadow-sm"
        >
          {isGenerating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Generating UI Component with AI...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>Generate UI Component</span>
            </>
          )}
        </Button>
        <p className="text-[10px] text-center text-muted-foreground">
          Generates and compiles this section into <code className="font-mono text-foreground/80">_components/{cleanCompName.folder}/{cleanCompName.component}.tsx</code>
        </p>
      </div>

      {/* Lightbox / Full Image Preview Dialog */}
      {previewImage && (
        <Dialog open={Boolean(previewImage)} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl p-3 bg-card border border-border">
            <DialogHeader className="p-1">
              <DialogTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Reference Image Preview</span>
              </DialogTitle>
            </DialogHeader>
            <div className="relative max-h-[75vh] w-full flex items-center justify-center overflow-auto rounded-lg bg-black/40 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="Full reference preview"
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
