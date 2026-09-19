import React from "react";
import { Label } from "@workspace/ui/components/label";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { GitMerge, ShieldAlert } from "lucide-react";
import {
  ACCOUNT_LINKING_POLICY_OPTIONS,
  AccountLinkingPolicy,
} from "@workspace/canvas";
import { BackendNodeData } from "@/types/canvas";

interface AccountLinkingConfigCardProps {
  accountLinking: AccountLinkingPolicy;
  activePolicy: string;
  providers: NonNullable<BackendNodeData["providers"]>;
  updateData: (changes: Partial<BackendNodeData>) => void;
}

export const AccountLinkingConfigCard: React.FC<AccountLinkingConfigCardProps> = ({
  accountLinking,
  activePolicy,
  providers,
  updateData,
}) => {
  return (
    <div className="flex flex-col gap-3.5 p-3.5 bg-background/50 rounded-lg border border-border/40 text-xs">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <GitMerge className="w-3.5 h-3.5 text-primary" /> Multi-Provider Account Linking Policy
        </Label>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 capitalize font-medium">
          {activePolicy === "prompt"
            ? "Prompt & Verify"
            : activePolicy === "merge"
            ? "Auto-Merge"
            : "Block Account Linking"}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Determines how Better Auth handles an OAuth sign-in when an existing user profile possesses the same email.
      </p>

      {/* Policy Buttons */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {ACCOUNT_LINKING_POLICY_OPTIONS.map((strat) => (
          <button
            key={strat.id}
            type="button"
            onClick={() =>
              updateData({
                providers: {
                  ...providers,
                  accountLinking: {
                    ...accountLinking,
                    policy: strat.id,
                    enabled: strat.id !== "block",
                  },
                },
              })
            }
            className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
              activePolicy === strat.id
                ? "bg-primary/15 border-primary text-primary font-semibold shadow-sm"
                : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <span className="text-[11px] font-bold">{strat.label}</span>
            <span className="text-[10px] opacity-80 leading-tight font-normal">
              {strat.desc.split(" — ")[0]}
            </span>
          </button>
        ))}
      </div>

      <div className="text-[10px] text-muted-foreground p-2 rounded bg-muted/50 border border-border/30">
        {activePolicy === "prompt" && (
          <span>
            <strong>Prompt & Verify:</strong> Disables silent automatic linking (<code>disableImplicitLinking: true</code>). Better Auth returns an <code>account_not_linked</code> status so your app can prompt the user to sign in with their password and link manually via <code>authClient.linkSocial()</code>.
          </span>
        )}
        {activePolicy === "merge" && (
          <span>
            <strong>Auto-Merge:</strong> Implicitly links same-email accounts when the provider confirms the email is verified (<code>enabled: true</code>).
          </span>
        )}
        {activePolicy === "block" && (
          <span>
            <strong>Block Account Linking:</strong> Disables account linking entirely (<code>enabled: false</code>). OAuth sign-in attempts for existing emails will be rejected.
          </span>
        )}
      </div>

      {/* Elevated Security Overrides (Visible when policy != block) */}
      {activePolicy !== "block" && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border/30">
          {/* trustedProviders selection */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-trusted-override" className="text-[11px] font-semibold flex items-center gap-1 text-foreground cursor-pointer">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Trusted Providers (Elevated Trust Override)
              </Label>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="enable-trusted-override"
                  checked={Boolean(accountLinking.trustedProviders && accountLinking.trustedProviders.length > 0)}
                  onCheckedChange={(checked) => {
                    const enabled = Boolean(checked);
                    updateData({
                      providers: {
                        ...providers,
                        accountLinking: {
                          ...accountLinking,
                          trustedProviders: enabled
                            ? (providers.oauth && providers.oauth.length > 0 ? providers.oauth.map((o) => o.provider) : ["google"])
                            : [],
                        },
                      },
                    });
                  }}
                />
                <Label htmlFor="enable-trusted-override" className="text-[10px] text-muted-foreground font-normal cursor-pointer">
                  {Boolean(accountLinking.trustedProviders && accountLinking.trustedProviders.length > 0) ? "Enabled" : "Disabled"}
                </Label>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Selected providers bypass the email verification requirement and force-link accounts even if the provider does not flag the email as verified.
            </p>

            {Boolean(accountLinking.trustedProviders && accountLinking.trustedProviders.length > 0) && (
              providers.oauth && providers.oauth.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {providers.oauth.map((oa) => {
                    const isTrusted = (accountLinking.trustedProviders || []).includes(oa.provider);
                    return (
                      <div
                        key={oa.id || oa.provider}
                        className="flex items-center gap-2 p-1.5 rounded bg-background border border-border/40"
                      >
                        <Checkbox
                          id={`trusted-${oa.id || oa.provider}`}
                          checked={isTrusted}
                          onCheckedChange={(checked) => {
                            const current = accountLinking.trustedProviders || [];
                            const updated = checked
                              ? [...current, oa.provider]
                              : current.filter((p) => p !== oa.provider);
                            updateData({
                              providers: {
                                ...providers,
                                accountLinking: {
                                  ...accountLinking,
                                  trustedProviders: updated,
                                },
                              },
                            });
                          }}
                        />
                        <Label
                          htmlFor={`trusted-${oa.id || oa.provider}`}
                          className="text-xs font-mono capitalize cursor-pointer"
                        >
                          {oa.provider}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground italic">No OAuth providers configured yet.</span>
              )
            )}
          </div>

          {/* allowDifferentEmails */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="allow-diff-emails" className="text-[11px] font-medium cursor-pointer">
                Allow Different Emails for Manual Linking
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Permit signed-in users to manually call <code>linkSocial()</code> with an OAuth account using a different email.
              </span>
            </div>
            <Checkbox
              id="allow-diff-emails"
              checked={Boolean(accountLinking.allowDifferentEmails)}
              onCheckedChange={(checked) =>
                updateData({
                  providers: {
                    ...providers,
                    accountLinking: {
                      ...accountLinking,
                      allowDifferentEmails: Boolean(checked),
                    },
                  },
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};
