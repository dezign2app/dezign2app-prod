import React, { useState } from "react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Key, Plus, Trash, Lock, ShieldCheck, GitMerge, ShieldAlert, Copy, Check, Info } from "lucide-react";
import {
  AUTH_FRAMEWORK_OPTIONS,
  BETTER_AUTH_VERSIONS,
  DEFAULT_AUTH_FRAMEWORK,
  DEFAULT_BETTER_AUTH_VERSION,
  ACCOUNT_LINKING_POLICY_OPTIONS,
  OAuthProviderConfig,
  EmailPasswordConfig,
  AccountLinkingPolicy,
} from "@workspace/canvas";
import { AuthConfigSectionProps } from "./types";

export const AuthProvidersSection: React.FC<AuthConfigSectionProps> = ({
  data,
  updateData,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCallback = (id: string, providerName: string) => {
    const url = `/api/auth/callback/${providerName}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selectedFramework = data.framework || DEFAULT_AUTH_FRAMEWORK;
  const selectedVersion = data.version || DEFAULT_BETTER_AUTH_VERSION;

  const emailPassword: EmailPasswordConfig = data.providers?.emailPassword || {
    enabled: true,
    requireVerification: true,
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    rateLimit: {
      maxAttempts: 5,
      windowSeconds: 60,
      lockoutDurationSeconds: 900,
    },
  };

  const accountLinking: AccountLinkingPolicy = data.providers?.accountLinking || {
    policy: "merge",
    trustedProviders: [],
    allowDifferentEmails: false,
  };
  const activePolicy = accountLinking.policy || (accountLinking.enabled === false ? "block" : "merge");

  const providers = data.providers || {
    emailPassword,
    socialEnabled: true,
    oauth: [
      { id: "oa-1", provider: "google", clientIdEnv: "GOOGLE_CLIENT_ID", clientSecretEnv: "GOOGLE_CLIENT_SECRET" },
      { id: "oa-2", provider: "github", clientIdEnv: "GITHUB_CLIENT_ID", clientSecretEnv: "GITHUB_CLIENT_SECRET" },
    ],
    accountLinking,
    magicLink: true,
    passkey: false,
  };

  const isSocialEnabled =
    providers.socialEnabled ??
    providers.oauthEnabled ??
    (data.providers ? Boolean(providers.oauth && providers.oauth.length > 0) : true);

  return (
    <AccordionItem
      value="providers"
      className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden"
    >
      <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 text-left flex-1">
          <Key className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Providers & Password Security
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-medium">
            {emailPassword?.enabled ? "Email" : ""}
            {isSocialEnabled && providers.oauth?.length ? ` + ${providers.oauth.length} OAuth` : ""}
            {!emailPassword?.enabled && (!isSocialEnabled || !providers.oauth?.length) ? "None" : ""}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1">
        <div className="flex flex-col gap-4 pt-2">
          {/* Framework Selection */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-background/50 rounded-lg border border-border/40">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">Framework</Label>
              <Select
                value={selectedFramework}
                onValueChange={(val: string) => {
                  const option = AUTH_FRAMEWORK_OPTIONS.find((o) => o.value === val);
                  if (option) {
                    updateData({ framework: option.value, provider: option.label });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_FRAMEWORK_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">Version</Label>
              <Select
                value={selectedVersion}
                onValueChange={(val: string) => updateData({ version: val })}
              >
                <SelectTrigger className="h-8 text-xs font-mono bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="font-mono">
                  {BETTER_AUTH_VERSIONS.map((ver) => (
                    <SelectItem key={ver.value} value={ver.value} className="text-xs font-mono">
                      {ver.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Email / Password & Security Guardrails */}
          <div className="flex flex-col gap-3 p-3.5 bg-background/50 rounded-lg border border-border/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Email & Password Policy</Label>
              <Checkbox
                checked={emailPassword?.enabled}
                onCheckedChange={(checked) =>
                  updateData({
                    providers: {
                      ...providers,
                      emailPassword: {
                        ...emailPassword,
                        enabled: Boolean(checked),
                      },
                    },
                  })
                }
              />
            </div>
            {emailPassword?.enabled && (
              <div className="flex flex-col gap-3 pt-2 text-xs border-t border-border/30">
                {/* Require Email Verification */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="require-verify"
                    checked={emailPassword?.requireVerification}
                    onCheckedChange={(c) =>
                      updateData({
                        providers: {
                          ...providers,
                          emailPassword: {
                            ...emailPassword,
                            requireVerification: Boolean(c),
                          },
                        },
                      })
                    }
                  />
                  <Label htmlFor="require-verify" className="text-xs font-normal cursor-pointer">
                    Require Email Verification
                  </Label>
                </div>

                {/* Password Complexity Rules */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground font-medium">Min Password Length</Label>
                    <Select
                      value={String(emailPassword.minLength || 8)}
                      onValueChange={(val) =>
                        updateData({
                          providers: {
                            ...providers,
                            emailPassword: {
                              ...emailPassword,
                              minLength: parseInt(val, 10),
                            },
                          },
                        })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs font-mono bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="font-mono">
                        {[6, 8, 10, 12, 16].map((len) => (
                          <SelectItem key={len} value={String(len)} className="text-xs font-mono">
                            {len} characters
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5 justify-end">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="req-upper"
                        checked={emailPassword.requireUppercase}
                        onCheckedChange={(c) =>
                          updateData({
                            providers: {
                              ...providers,
                              emailPassword: { ...emailPassword, requireUppercase: Boolean(c) },
                            },
                          })
                        }
                      />
                      <Label htmlFor="req-upper" className="text-[11px] font-normal cursor-pointer">
                        Require Uppercase
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="req-num"
                        checked={emailPassword.requireNumbers}
                        onCheckedChange={(c) =>
                          updateData({
                            providers: {
                              ...providers,
                              emailPassword: { ...emailPassword, requireNumbers: Boolean(c) },
                            },
                          })
                        }
                      />
                      <Label htmlFor="req-num" className="text-[11px] font-normal cursor-pointer">
                        Require Numbers
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Brute Force Rate Limiting */}
                <div className="flex flex-col gap-2 p-2.5 rounded bg-background border border-border/40 mt-1">
                  <Label className="text-[11px] font-semibold flex items-center gap-1 text-primary">
                    <ShieldCheck className="w-3.5 h-3.5" /> Brute-Force Rate Limiting & Lockout
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground font-medium">Max Attempts</span>
                      <Input
                        className="h-7 text-xs font-mono bg-background"
                        type="number"
                        value={emailPassword.rateLimit?.maxAttempts ?? 5}
                        onChange={(e) =>
                          updateData({
                            providers: {
                              ...providers,
                              emailPassword: {
                                ...emailPassword,
                                rateLimit: {
                                  maxAttempts: parseInt(e.target.value, 10) || 5,
                                  windowSeconds: emailPassword.rateLimit?.windowSeconds ?? 60,
                                  lockoutDurationSeconds: emailPassword.rateLimit?.lockoutDurationSeconds ?? 900,
                                },
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground font-medium">Window (Sec)</span>
                      <Input
                        className="h-7 text-xs font-mono bg-background"
                        type="number"
                        value={emailPassword.rateLimit?.windowSeconds ?? 60}
                        onChange={(e) =>
                          updateData({
                            providers: {
                              ...providers,
                              emailPassword: {
                                ...emailPassword,
                                rateLimit: {
                                  maxAttempts: emailPassword.rateLimit?.maxAttempts ?? 5,
                                  windowSeconds: parseInt(e.target.value, 10) || 60,
                                  lockoutDurationSeconds: emailPassword.rateLimit?.lockoutDurationSeconds ?? 900,
                                },
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground font-medium">Lockout (Sec)</span>
                      <Input
                        className="h-7 text-xs font-mono bg-background"
                        type="number"
                        value={emailPassword.rateLimit?.lockoutDurationSeconds ?? 900}
                        onChange={(e) =>
                          updateData({
                            providers: {
                              ...providers,
                              emailPassword: {
                                ...emailPassword,
                                rateLimit: {
                                  maxAttempts: emailPassword.rateLimit?.maxAttempts ?? 5,
                                  windowSeconds: emailPassword.rateLimit?.windowSeconds ?? 60,
                                  lockoutDurationSeconds: parseInt(e.target.value, 10) || 900,
                                },
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Account Linking Policy */}
          {isSocialEnabled && (
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
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[11px] font-semibold flex items-center gap-1 text-foreground">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Trusted Providers (Elevated Trust Override)
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Selected providers bypass the email verification requirement and force-link accounts even if the provider does not flag the email as verified.
                    </p>

                    {providers.oauth && providers.oauth.length > 0 ? (
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
          )}

          {/* OAuth Providers Table with Secret Security Indicators */}
          <div className="flex flex-col gap-3 p-3.5 bg-background/50 rounded-lg border border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">OAuth 2.0 / Social Providers</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-social-auth"
                  checked={isSocialEnabled}
                  onCheckedChange={(checked) => {
                    const enabled = Boolean(checked);
                    const defaultOauth = [
                      { id: "oa-1", provider: "google", clientIdEnv: "GOOGLE_CLIENT_ID", clientSecretEnv: "GOOGLE_CLIENT_SECRET" },
                      { id: "oa-2", provider: "github", clientIdEnv: "GITHUB_CLIENT_ID", clientSecretEnv: "GITHUB_CLIENT_SECRET" },
                    ];
                    updateData({
                      providers: {
                        ...providers,
                        socialEnabled: enabled,
                        oauthEnabled: enabled,
                        oauth: enabled
                          ? (providers.oauth && providers.oauth.length > 0 ? providers.oauth : defaultOauth)
                          : providers.oauth,
                      },
                    });
                  }}
                />
                <Label htmlFor="enable-social-auth" className="text-xs font-normal cursor-pointer text-muted-foreground">
                  {isSocialEnabled ? "Enabled" : "Disabled"}
                </Label>
              </div>
            </div>

            {isSocialEnabled ? (
              <div className="flex flex-col gap-3 pt-1">
                {/* Better Auth Callback Info Notice */}
                <div className="text-[11px] text-muted-foreground p-2.5 rounded-md bg-muted/40 border border-border/40 flex items-start gap-2 leading-relaxed">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong>OAuth Callback Routing:</strong> Better Auth handles provider responses at <code className="text-primary font-mono text-[10px] bg-background px-1 py-0.5 rounded border border-border/40">/api/auth/callback/[provider]</code>. Register the specific callback URL below in each provider&apos;s Developer Portal.
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Configured Providers</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs bg-background"
                    onClick={() => {
                      const newOauth = [
                        ...(providers.oauth || []),
                        {
                          id: `oa-${Date.now()}`,
                          provider: "discord",
                          clientIdEnv: "DISCORD_CLIENT_ID",
                          clientSecretEnv: "DISCORD_CLIENT_SECRET",
                        },
                      ];
                      updateData({
                        providers: {
                          ...providers,
                          socialEnabled: true,
                          oauthEnabled: true,
                          oauth: newOauth,
                        },
                      });
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Provider
                  </Button>
                </div>

                {providers.oauth && providers.oauth.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {providers.oauth.map((oa: OAuthProviderConfig) => (
                      <div
                        key={oa.id}
                        className="flex flex-col gap-2 p-2.5 rounded-lg bg-background border border-border/50 text-xs shadow-xs"
                      >
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3">
                            <Select
                              value={oa.provider}
                              onValueChange={(val) => {
                                const updated = (providers.oauth || []).map((o) =>
                                  o.id === oa.id ? { ...o, provider: val } : o,
                                );
                                updateData({ providers: { ...providers, oauth: updated } });
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs font-medium capitalize bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["google", "github", "discord", "apple", "twitter", "microsoft"].map((p) => (
                                  <SelectItem key={p} value={p} className="text-xs capitalize">
                                    {p}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4 relative flex items-center">
                            <Input
                              className="h-7 text-xs font-mono bg-background pr-6"
                              value={oa.clientIdEnv}
                              placeholder="CLIENT_ID_ENV"
                              onChange={(e) => {
                                const updated = (providers.oauth || []).map((o) =>
                                  o.id === oa.id ? { ...o, clientIdEnv: e.target.value } : o,
                                );
                                updateData({ providers: { ...providers, oauth: updated } });
                              }}
                            />
                            <Lock className="w-3 h-3 text-muted-foreground absolute right-2 pointer-events-none" />
                          </div>
                          <div className="col-span-4 relative flex items-center">
                            <Input
                              className="h-7 text-xs font-mono bg-background pr-6"
                              value={oa.clientSecretEnv}
                              placeholder="CLIENT_SECRET_ENV"
                              onChange={(e) => {
                                const updated = (providers.oauth || []).map((o) =>
                                  o.id === oa.id ? { ...o, clientSecretEnv: e.target.value } : o,
                                );
                                updateData({ providers: { ...providers, oauth: updated } });
                              }}
                            />
                            <Lock className="w-3 h-3 text-muted-foreground absolute right-2 pointer-events-none" />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button
                              onClick={() => {
                                const updated = (providers.oauth || []).filter((o) => o.id !== oa.id);
                                updateData({ providers: { ...providers, oauth: updated } });
                              }}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                              title="Remove provider"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Per-Provider Callback URL Badge & Copy Button */}
                        <div className="flex items-center justify-between text-[11px] bg-muted/25 px-2.5 py-1 rounded border border-border/30 font-mono text-muted-foreground">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[10px] text-muted-foreground/70 uppercase font-sans font-semibold shrink-0">Callback:</span>
                            <code className="text-primary truncate">/api/auth/callback/{oa.provider}</code>
                          </div>
                          <button
                            onClick={() => handleCopyCallback(oa.id, oa.provider)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground shrink-0 ml-2 font-sans bg-background px-2 py-0.5 rounded border border-border/50 transition-colors cursor-pointer"
                            title="Copy path for provider console"
                          >
                            {copiedId === oa.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500 font-medium">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-muted-foreground" />
                                <span>Copy Path</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground py-2 text-center bg-background/30 rounded border border-dashed border-border/60">
                    No social providers added. Click &quot;Add Provider&quot; above to configure one.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-normal">
                Enable social authentication to allow signing in with Google, GitHub, Discord, Apple, etc.
              </p>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
