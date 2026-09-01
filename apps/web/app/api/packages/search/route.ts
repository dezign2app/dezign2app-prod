import { NextRequest, NextResponse } from "next/server";

export interface NpmPackageSearchResult {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  date?: string;
}

export interface NpmPackageDetailResult {
  exists: boolean;
  name: string;
  latestVersion?: string;
  description?: string;
  versions?: string[];
  distTags?: Record<string, string>;
  homepage?: string;
  license?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const packageName = searchParams.get("name")?.trim();

  // If a specific package name is requested, fetch exact details and version list
  if (packageName) {
    try {
      // Handle scoped packages like @tanstack/react-query -> @tanstack%2Freact-query
      const encodedName = packageName.startsWith("@")
        ? `@${encodeURIComponent(packageName.slice(1))}`
        : encodeURIComponent(packageName);

      const res = await fetch(`https://registry.npmjs.org/${encodedName}`, {
        headers: {
          Accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*",
        },
        next: { revalidate: 300 }, // cache for 5 mins
      });

      if (res.status === 404) {
        return NextResponse.json<NpmPackageDetailResult>({
          exists: false,
          name: packageName,
        });
      }

      if (!res.ok) {
        return NextResponse.json<NpmPackageDetailResult>(
          { exists: false, name: packageName },
          { status: res.status }
        );
      }

      const data = await res.json();
      const distTags = data["dist-tags"] || {};
      const latestVersion = distTags.latest || Object.keys(data.versions || {}).pop() || "latest";

      // Extract and reverse the version keys to list latest first
      const allVersions = Object.keys(data.versions || {});
      const recentVersions = allVersions.slice(-25).reverse();

      return NextResponse.json<NpmPackageDetailResult>({
        exists: true,
        name: data.name || packageName,
        latestVersion,
        description: data.description || "",
        versions: recentVersions,
        distTags,
        homepage: data.homepage || (typeof data.repository === "string" ? data.repository : data.repository?.url) || "",
        license: data.license || "MIT",
      });
    } catch (error) {
      console.error(`[NPM_SEARCH_API] Failed to fetch details for ${packageName}:`, error);
      return NextResponse.json<NpmPackageDetailResult>({
        exists: false,
        name: packageName,
      });
    }
  }

  // If search query is provided
  if (query) {
    try {
      const res = await fetch(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=8`,
        {
          headers: { Accept: "application/json" },
          next: { revalidate: 120 },
        }
      );

      if (!res.ok) {
        return NextResponse.json({ results: [] });
      }

      const data = await res.json();
      const objects = data.objects || [];
      const results: NpmPackageSearchResult[] = objects.map((obj: { package?: NpmPackageSearchResult }) => ({
        name: obj.package?.name || "",
        version: obj.package?.version || "latest",
        description: obj.package?.description || "",
        keywords: obj.package?.keywords || [],
        date: obj.package?.date || "",
      }));

      return NextResponse.json({ results });
    } catch (error) {
      console.error(`[NPM_SEARCH_API] Failed to search for "${query}":`, error);
      return NextResponse.json({ results: [] });
    }
  }

  return NextResponse.json({ results: [] });
}
