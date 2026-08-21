import { SignUpView } from "@/app/(auth)/_components/ui/views/sign-up-view";
import React, { Suspense } from "react";

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <SignUpView />
    </Suspense>
  );
};

export default Page;
