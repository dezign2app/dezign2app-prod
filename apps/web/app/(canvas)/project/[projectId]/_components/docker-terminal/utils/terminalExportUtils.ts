import React from "react";
import { getElectronAPI } from "@/lib/electron";
import { CompiledFile } from "@/lib/compiler";
import { toast } from "sonner";

/**
 * Sync monorepo files directly to a local workspace directory using Electron FS IPC.
 */
export async function exportFilesToDirectory(
  files: CompiledFile[],
  targetDir: string,
  logSetter?: React.Dispatch<React.SetStateAction<string[]>>,
): Promise<void> {
  const api = getElectronAPI();
  if (!api?.fs?.writeProject) {
    throw new Error("File export not available in this environment");
  }

  logSetter?.((prev) => [
    ...prev,
    `📂 Syncing ${files.length} monorepo files to ${targetDir}...\n`,
  ]);

  const exportFiles: CompiledFile[] = files.map((f: CompiledFile) => ({
    filename: f.filename,
    language: f.language,
    content: f.content,
  }));

  const res = await api.fs.writeProject(targetDir, exportFiles, { cleanStale: true });
  logSetter?.((prev) => [
    ...prev,
    `✅ Files written successfully to ${targetDir} (${res?.writtenCount ?? files.length} updated)\n`,
  ]);
}

/**
 * Package compiled monorepo files into a .zip archive and trigger browser download.
 */
export async function downloadMonorepoZip(
  files: CompiledFile[],
  formattedProjectName: string,
): Promise<void> {
  if (files.length === 0) return;
  toast.info("Compressing project into ZIP...");
  try {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    files.forEach((f) => zip.file(f.filename, f.content));
    const blob = await zip.generateAsync({ type: "blob" });
    const zipName = `${formattedProjectName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.zip`;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: zipName });
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${zipName}!`);
  } catch (err) {
    toast.error("Failed to generate ZIP archive");
    throw err;
  }
}
