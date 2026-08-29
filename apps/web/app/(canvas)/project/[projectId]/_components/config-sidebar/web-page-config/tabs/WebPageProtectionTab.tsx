import React from "react";
import { TabsContent } from "@workspace/ui/components/tabs";
import { WebPageProtectionSection } from "../WebPageProtectionSection";

export type WebPageAccessType =
  | "public"
  | "private"
  | "role-gated"
  | "payment-gated"
  | "org-gated";

interface WebPageProtectionTabProps {
  useZoneDefault: boolean;
  accessType: WebPageAccessType;
  allowedRoles: string[];
  requiredPlans: string[];
  redirectTo: string;
  isAuthPage: boolean;
  onUpdateUseZoneDefault: (useDefault: boolean) => void;
  onUpdateAccessType: (type: WebPageAccessType, defaultRedirect: string) => void;
  onUpdateAllowedRoles: (roles: string[]) => void;
  onUpdateRequiredPlans: (plans: string[]) => void;
  onUpdateRedirectTo: (target: string) => void;
  onUpdateIsAuthPage: (isAuth: boolean) => void;
}

export function WebPageProtectionTab({
  useZoneDefault,
  accessType,
  allowedRoles,
  requiredPlans,
  redirectTo,
  isAuthPage,
  onUpdateUseZoneDefault,
  onUpdateAccessType,
  onUpdateAllowedRoles,
  onUpdateRequiredPlans,
  onUpdateRedirectTo,
  onUpdateIsAuthPage,
}: WebPageProtectionTabProps) {
  return (
    <TabsContent
      value="protection"
      className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
    >
      <WebPageProtectionSection
        useZoneDefault={useZoneDefault}
        accessType={accessType}
        allowedRoles={allowedRoles}
        requiredPlans={requiredPlans}
        redirectTo={redirectTo}
        isAuthPage={isAuthPage}
        onUpdateUseZoneDefault={onUpdateUseZoneDefault}
        onUpdateAccessType={onUpdateAccessType}
        onUpdateAllowedRoles={onUpdateAllowedRoles}
        onUpdateRequiredPlans={onUpdateRequiredPlans}
        onUpdateRedirectTo={onUpdateRedirectTo}
        onUpdateIsAuthPage={onUpdateIsAuthPage}
      />
    </TabsContent>
  );
}
