import { RedirectsConfig } from "@workspace/canvas";

export interface ConfiguredPage {
  id: string;
  path: string;
  label: string;
  isCanvasPage?: boolean;
}

export interface MissingAuthPage {
  key: "signIn" | "signUp" | "dashboard";
  path: string;
  isProtected: boolean;
  label: string;
}

export interface RedirectRouteSelectorProps {
  label: string;
  value: string;
  nodeIdValue?: string;
  placeholder: string;
  configuredPages: ConfiguredPage[];
  targetZoneType: "public" | "protected";
  projectId: string;
  onChange: (newPath: string, newNodeId?: string) => void;
  onCreatePageNode: () => void;
}

export interface AuthPagesCardProps {
  redirects: RedirectsConfig;
  configuredPages: ConfiguredPage[];
  projectId: string;
  onUpdateRedirects: (changes: Partial<RedirectsConfig>) => void;
  onCreatePageNode: (
    targetRoute: string,
    isProtected: boolean,
    fieldPrefix?: "signInPage" | "signUpPage" | "signInRedirect" | "signUpRedirect" | "signOutRedirect",
  ) => void;
}

export interface RedirectRoutingCardProps {
  redirects: RedirectsConfig;
  configuredPages: ConfiguredPage[];
  canvasPagesCount: number;
  projectId: string;
  onUpdateRedirects: (changes: Partial<RedirectsConfig>) => void;
  onCreatePageNode: (
    targetRoute: string,
    isProtected: boolean,
    fieldPrefix?: "signInPage" | "signUpPage" | "signInRedirect" | "signUpRedirect" | "signOutRedirect",
  ) => void;
}

export interface AuthPagesQuickSetupBannerProps {
  missingPages: MissingAuthPage[];
  onCreateAll: () => void;
}

export interface TrustedOriginsCardProps {
  trustedOrigins: string[];
  onUpdateOrigins: (origins: string[]) => void;
}
