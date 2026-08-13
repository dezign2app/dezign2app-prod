import React from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Switch } from "@workspace/ui/components/switch";

interface AuthAwarenessBannerProps {
  zoneName: string | null;
  isProtected?: boolean;
  requireAuth?: boolean;
  onRequireAuthChange?: (enabled: boolean) => void;
}

/**
 * Shown in EndpointConfig to display and manage whether the Authorization: Bearer <token>
 * header is required/forwarded automatically.
 */
export const AuthAwarenessBanner: React.FC<AuthAwarenessBannerProps> = ({
  zoneName,
  isProtected = true,
  requireAuth = true,
  onRequireAuthChange,
}) => {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 shadow-sm transition-colors ${
        requireAuth
          ? "border-amber-500/25 bg-amber-500/8"
          : "border-border/60 bg-muted/20"
      }`}
    >
      <div className="flex items-start gap-3">
        {requireAuth ? (
          <ShieldCheck
            size={16}
            className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400"
          />
        ) : (
          <ShieldOff
            size={16}
            className="mt-0.5 shrink-0 text-muted-foreground"
          />
        )}
        <div className="flex flex-col gap-0.5">
          <span
            className={`text-xs font-semibold ${
              requireAuth
                ? "text-amber-700 dark:text-amber-300"
                : "text-foreground"
            }`}
          >
            {requireAuth ? "Authenticated Endpoint" : "Unauthenticated"}
          </span>
          {requireAuth ? (
            <>
              <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                {isProtected ? (
                  <>
                    Called from{" "}
                    <span className="font-mono font-semibold">
                      {zoneName ?? "a protected page"}
                    </span>
                    {" "}&mdash; an{" "}
                  </>
                ) : (
                  <>An </>
                )}
                <code className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-mono">
                  Authorization: Bearer &lt;token&gt;
                </code>
                {" "}header is automatically forwarded by the client.
              </span>
              <span className="text-[10px] text-amber-600/60 dark:text-amber-500/60 mt-0.5">
                Configure the Auth Rule below to validate this token.
              </span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground leading-relaxed">
              <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                Authorization: Bearer &lt;token&gt;
              </code>
              {" "}header requirement is disabled (e.g. for internal servers or public access).
            </span>
          )}
        </div>
      </div>

      {onRequireAuthChange && (
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <span className="text-[10px] font-medium text-muted-foreground">
            {requireAuth ? "Enabled" : "Disabled"}
          </span>
          <Switch
            size="sm"
            checked={requireAuth}
            onCheckedChange={onRequireAuthChange}
          />
        </div>
      )}
    </div>
  );
};
