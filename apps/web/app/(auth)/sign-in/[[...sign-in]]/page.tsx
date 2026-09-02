import { SignInView } from "@/app/(auth)/_components/ui/views/sign-in-view";
import React, { Suspense } from "react";

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
      <SignInView />
    </Suspense>
  );
};

export default Page;
