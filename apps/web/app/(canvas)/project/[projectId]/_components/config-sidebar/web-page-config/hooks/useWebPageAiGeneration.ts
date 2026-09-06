import { useState } from "react";
import { toast } from "sonner";
import { Id } from "@workspace/backend/_generated/dataModel";
import { pageRouteToUrl, parsePageRoute } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";
import { isElectron, getElectronAPI } from "@/lib/electron";

interface CustomWindow extends Window {
  __convexUrl?: string;
}

declare const window: CustomWindow | undefined;

interface UseWebPageAiGenerationParams {
  nodeId: string;
  projectId: Id<"projects">;
  data: BackendNode["data"];
  serverCode: string | null;
  detectedDiskPath: string | null;
  defaultFilePath: string;
  outputDir: string | null;
  updateData: (changes: Partial<BackendNode["data"]>) => void;
  patchNodeData: (args: {
    projectId: Id<"projects">;
    nodeId: string;
    patch: Partial<BackendNode["data"]>;
  }) => Promise<void | null>;
  checkDiskStatus: () => Promise<void>;
}

export function useWebPageAiGeneration({
  nodeId,
  projectId,
  data,
  serverCode,
  detectedDiskPath,
  defaultFilePath,
  outputDir,
  updateData,
  patchNodeData,
  checkDiskStatus,
}: UseWebPageAiGenerationParams) {
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleGenerateAiCode = async () => {
    if (isGeneratingAi) return;
    const sectionLibs = (data.sections || []).flatMap((s) => s.libraries || []);
    const actionLibs = (data.sections || []).flatMap((s) =>
      (s.actions || []).flatMap((a) => a.libraries || [])
    );
    const allDeclaredLibs = Array.from(new Set([...sectionLibs, ...actionLibs]));

    const libraryGuidance =
      allDeclaredLibs.length > 0
        ? `Declared Installed Libraries: ${allDeclaredLibs.join(", ")}. Please import and utilize their canonical functions, hooks, and types directly in the component implementation.`
        : "";

    const promptText = [
      data.description ? `Page Purpose: ${data.description}` : "",
      data.uiPrompt ? `Visual & Theme Style: ${data.uiPrompt}` : "",
      libraryGuidance,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!promptText.trim()) {
      toast.error("Please provide a page purpose or visual style prompt first.");
      return;
    }

    setIsGeneratingAi(true);
    toast.info("Generating UI code with AI...");

    try {
      const engineBaseUrl =
        process.env.NEXT_PUBLIC_SYSTEM_DESIGN_ENGINE_URL || "http://localhost:3002";
      const convexUrl =
        typeof window !== "undefined"
          ? window.__convexUrl ||
            process.env.NEXT_PUBLIC_CONVEX_URL ||
            ""
          : "";

      let token: string | undefined = undefined;
      try {
        const tokenRes = await fetch("/api/auth/token");
        if (tokenRes.ok) {
          const tokenData: { token?: string } = await tokenRes.json();
          token = tokenData.token;
        }
      } catch {}

      const rawLabel = typeof data.label === "string" ? data.label : "";
      const routeUrl = pageRouteToUrl(rawLabel);
      const nameParsed = parsePageRoute(rawLabel) || nodeId;

      const response = await fetch(`${engineBaseUrl}/page-editor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId,
          projectId,
          currentCode: serverCode || "",
          prompt: promptText,
          pageName: nameParsed,
          pageRoute: routeUrl,
          convexUrl,
          token,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Engine error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalCode = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed: { type?: string; code?: string } = JSON.parse(line);
            if (parsed.type === "done" && parsed.code) {
              finalCode = parsed.code;
            }
          } catch {}
        }
      }

      if (finalCode) {
        // 1. Direct sync to Convex backend
        updateData({ pageSourceCode: finalCode, aiEditing: false });
        await patchNodeData({
          projectId,
          nodeId,
          patch: { pageSourceCode: finalCode, aiEditing: false },
        });

        // 2. Direct sync to local disk
        if (isElectron() && outputDir) {
          const api = getElectronAPI();
          if (api?.fs?.writeProject) {
            await api.fs.writeProject(
              outputDir,
              [{ filename: detectedDiskPath || defaultFilePath, content: finalCode }],
              { cleanStale: false },
            );
          }
        }

        toast.success("AI code generated & synced to server file and disk!");
        await checkDiskStatus();
      } else {
        toast.error("Generation completed without code output.");
      }
    } catch (err) {
      console.error("[WebPageConfig] AI Generation error:", err);
      toast.error(err instanceof Error ? err.message : "AI Generation failed");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return {
    isGeneratingAi,
    handleGenerateAiCode,
  };
}
