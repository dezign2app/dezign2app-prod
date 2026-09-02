import React, { Suspense } from "react";
import { OrgSelectionView } from "@/app/(auth)/_components/ui/views/org-selection-view";

export const dynamic = "force-dynamic";

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <OrgSelectionView />
    </Suspense>
  );
};

export default Page;
