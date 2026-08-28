"use client";

import React, { useState, useRef } from "react";
import {
  Image as ImageIcon,
  Trash2,
  Upload,
  Link as LinkIcon,
  Eye,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
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

interface ReferralImagesUploaderProps {
  images?: string[];
  primaryImageUrl?: string;
  onImagesChange: (images: string[], primaryUrl?: string) => void;
  compact?: boolean;
}

export const ReferralImagesUploader = ({
  images = [],
  primaryImageUrl,
  onImagesChange,
  compact = false,
}: ReferralImagesUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlPopoverOpen, setUrlPopoverOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WebP)");
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
        onImagesChange(next, next[0]);
        toast.success("Referral image attached!");
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("data:image/")) {
      toast.error("Please enter a valid image URL starting with http:// or https://");
      return;
    }

    const next = [...allImages, trimmed];
    onImagesChange(next, next[0]);
    setUrlInput("");
    setUrlPopoverOpen(false);
    toast.success("Referral image URL added!");
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const next = allImages.filter((_, idx) => idx !== indexToRemove);
    onImagesChange(next, next[0]);
  };

  return (
    <div className="flex flex-col gap-1.5 nodrag">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Thumbnails Row / Grid */}
      {allImages.length > 0 && (
        <div className={cn("flex flex-wrap gap-1.5 items-center", compact ? "gap-1" : "gap-2")}>
          {allImages.map((imgUrl, idx) => (
            <div
              key={`${imgUrl.slice(0, 32)}-${idx}`}
              className={cn(
                "relative group/img rounded-md overflow-hidden border border-border/60 bg-muted/30 shrink-0 select-none shadow-xs",
                compact ? "w-11 h-11" : "w-14 h-14"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                alt={`Referral Mockup ${idx + 1}`}
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
                  <Eye size={compact ? 10 : 12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(idx);
                  }}
                  className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                  title="Remove referral image"
                >
                  <Trash2 size={compact ? 10 : 12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Strip: Upload file or Add URL */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className={cn(
            "flex items-center gap-1 rounded font-medium border transition-colors cursor-pointer text-muted-foreground hover:text-foreground",
            compact
              ? "text-[9px] px-1.5 py-0.5 bg-secondary/30 hover:bg-secondary/60 border-border/40"
              : "text-xs px-2.5 py-1 bg-secondary/40 hover:bg-secondary border-border/60"
          )}
          title="Upload image file (PNG, JPG, SVG, WebP)"
        >
          <Upload size={compact ? 10 : 12} className="text-indigo-400 shrink-0" />
          <span>Upload Image</span>
        </button>

        <Popover open={urlPopoverOpen} onOpenChange={setUrlPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center gap-1 rounded font-medium border transition-colors cursor-pointer text-muted-foreground hover:text-foreground",
                compact
                  ? "text-[9px] px-1.5 py-0.5 bg-secondary/30 hover:bg-secondary/60 border-border/40"
                  : "text-xs px-2.5 py-1 bg-secondary/40 hover:bg-secondary border-border/60"
              )}
              title="Add Image via URL"
            >
              <LinkIcon size={compact ? 10 : 12} className="text-indigo-400 shrink-0" />
              <span>Image URL</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 p-2.5 flex flex-col gap-2 bg-popover border border-border shadow-lg"
            align="start"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Attach Referral Image URL</span>
            </div>
            <Input
              type="url"
              placeholder="https://example.com/layout-mockup.png"
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
                className="h-6 px-2.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleAddUrl}
              >
                Attach
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {allImages.length === 0 && (
          <span className="text-[10px] text-muted-foreground/60 italic">
            Attach layout wireframes / mockups
          </span>
        )}
      </div>

      {/* Lightbox / Full Image Preview Dialog */}
      {previewImage && (
        <Dialog open={Boolean(previewImage)} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl p-3 bg-card border border-border">
            <DialogHeader className="p-1">
              <DialogTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Layout Referral Image Preview</span>
              </DialogTitle>
            </DialogHeader>
            <div className="relative max-h-[75vh] w-full flex items-center justify-center overflow-auto rounded-lg bg-black/40 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="Full layout preview"
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
