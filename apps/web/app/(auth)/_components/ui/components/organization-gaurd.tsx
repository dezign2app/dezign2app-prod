"use client";

import React, { ReactNode } from "react";
import { useActiveOrganization } from "@/lib/auth-client";
import { AuthLayout } from "../layouts/auth-layout";
import { OrgSelectionView } from "../views/org-selection-view";

export const OrganizationGuard = ({ children }: { children: ReactNode }) => {
  const { data: organization, isPending } = useActiveOrganization();

  if (isPending) {
    return null;
  }

  if (!organization) {
    return (
      <AuthLayout>
        <OrgSelectionView />
      </AuthLayout>
    );
  }

  return <>{children}</>;
};
