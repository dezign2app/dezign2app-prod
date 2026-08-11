export function labelToSlug(label: string, index: number): string {
  const clean = label.trim().toLowerCase();
  if (
    clean === "home" ||
    clean === "index" ||
    clean === "/" ||
    clean === "web client" ||
    clean === "web client (page)" ||
    clean === "web client(page)" ||
    clean === "webclient" ||
    clean === "web-client" ||
    clean === "web-client-page" ||
    clean === "page-client"
  ) {
    return "home";
  }
  const slug = clean.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "home";
}

export function slugToComponentName(slug: string): string {
  if (slug === "home") return "HomePage";
  const camel = slug.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1) + "Page";
}
