import React from "react";
import { Label } from "@workspace/ui/components/label";
import { KeyRound } from "lucide-react";
import { RedirectRouteSelector } from "./RedirectRouteSelector";
import { AuthPagesCardProps } from "./types";

export const AuthPagesCard: React.FC<AuthPagesCardProps> = ({
  redirects,
  configuredPages,
  projectId,
  onUpdateRedirects,
  onCreatePageNode,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3.5 bg-background/50 rounded-lg border border-border/40 text-xs">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-primary" /> Auth Pages (Login & Register)
        </Label>
        <span className="text-[10px] text-muted-foreground font-mono">
          Define Auth UI routes
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <RedirectRouteSelector
          label="Sign-In / Login Page Path"
          placeholder="/login"
          value={redirects.signInPageUrl || ""}
          nodeIdValue={redirects.signInPageNodeId}
          configuredPages={configuredPages}
          targetZoneType="public"
          projectId={projectId}
          onChange={(val, newId) =>
            onUpdateRedirects({
              signInPageUrl: val,
              signInPageNodeId: newId,
            })
          }
          onCreatePageNode={() =>
            onCreatePageNode(redirects.signInPageUrl || "/login", false, "signInPage")
          }
        />

        <RedirectRouteSelector
          label="Sign-Up / Register Page Path"
          placeholder="/register"
          value={redirects.signUpPageUrl || ""}
          nodeIdValue={redirects.signUpPageNodeId}
          configuredPages={configuredPages}
          targetZoneType="public"
          projectId={projectId}
          onChange={(val, newId) =>
            onUpdateRedirects({
              signUpPageUrl: val,
              signUpPageNodeId: newId,
            })
          }
          onCreatePageNode={() =>
            onCreatePageNode(redirects.signUpPageUrl || "/register", false, "signUpPage")
          }
        />
      </div>
    </div>
  );
};
