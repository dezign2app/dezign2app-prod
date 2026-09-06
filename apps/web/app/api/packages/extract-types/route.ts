import { NextRequest, NextResponse } from "next/server";
import {
  extractPackageTypesFromNodeModules,
  type PackageTypeExtractionResult,
} from "@/lib/server/packageTypeExtractor";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pkg = searchParams.get("pkg")?.trim();

  if (!pkg) {
    return NextResponse.json<PackageTypeExtractionResult>(
      {
        installed: false,
        pkg: "",
        types: [],
        error: "Package name parameter 'pkg' is required.",
      },
      { status: 400 },
    );
  }

  const result = extractPackageTypesFromNodeModules(pkg);
  return NextResponse.json<PackageTypeExtractionResult>(result);
}
