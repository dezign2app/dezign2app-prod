import { pageRouteToFolderPath } from "@workspace/canvas";

export function labelToSlug(label: string, index: number): string {
  const clean = label.trim().toLowerCase();
  if (clean === "/" || clean === "home" || clean === "index") {
    return "home";
  }
  const folder = pageRouteToFolderPath(label);
  if (folder) {
    return folder;
  }
  const slug = clean.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || `page-${index + 1}`;
}

export function slugToComponentName(slug: string): string {
  if (slug === "home") return "HomePage";
  const sanitized = slug.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const camel = sanitized.replace(/-([a-zA-Z0-9])/g, (_, char) => char.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1) + "Page";
}


