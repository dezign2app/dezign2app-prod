import { describe, it, expect } from "vitest";
import { generateAuthConfig } from "../auth/better-auth/v1.6/generators/generateAuthConfig";
import {
  isAuthLoginPage,
  isAuthRegisterPage,
  isAuthPage,
  shouldGenerateSocialProviders,
} from "../compileAuth";
import { generateAuthFormComponent } from "../webClients/nextjs/v16/authPageGenerators";
import { compileNextjsV16WebClient } from "../webClients/nextjs/v16";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { PageInfo } from "../webClients/nextjs/v16/types";
import { BetterAuthV16NodeData } from "../auth/better-auth/v1.6/types";
import { resolveOAuthProviders } from "../auth/better-auth/v1.6";

describe("OAuth 2.0 / Social Providers Compilation & Page Generation", () => {
  it("should generate lowercased socialProviders keys in auth.ts from BetterAuth node data", () => {
    const authData: BetterAuthV16NodeData = {
      framework: "better_auth",
      providers: {
        socialEnabled: true,
        oauthEnabled: true,
        oauth: [
          {
            id: "oa-1",
            provider: "Google",
            clientIdEnv: "GOOGLE_CLIENT_ID",
            clientSecretEnv: "GOOGLE_CLIENT_SECRET",
          },
          {
            id: "oa-2",
            provider: "Github",
            clientIdEnv: "GITHUB_CLIENT_ID",
            clientSecretEnv: "GITHUB_CLIENT_SECRET",
          },
        ],
      },
    };

    const authConfig = generateAuthConfig(authData);

    expect(authConfig).toContain("socialProviders: {");
    expect(authConfig).toContain("google: {");
    expect(authConfig).toContain("clientId: process.env.GOOGLE_CLIENT_ID || \"\",");
    expect(authConfig).toContain("clientSecret: process.env.GOOGLE_CLIENT_SECRET || \"\",");
    expect(authConfig).toContain("github: {");
    expect(authConfig).toContain("clientId: process.env.GITHUB_CLIENT_ID || \"\",");
    expect(authConfig).toContain("clientSecret: process.env.GITHUB_CLIENT_SECRET || \"\",");
    expect(authConfig).not.toContain("Google: {");
    expect(authConfig).not.toContain("Github: {");
  });

  it("should correctly identify sign-in and sign-up pages regardless of slug or route format", () => {
    const authNodeData: BetterAuthV16NodeData = {
      label: "Auth",
      framework: "better_auth",
      redirects: {
        signInPageUrl: "/login",
        signUpPageUrl: "/register",
      },
    };

    const signInVariants: Partial<PageInfo>[] = [
      { slug: "login", routePath: "/login", label: "Login" },
      { slug: "signin", routePath: "/signin", label: "Sign In" },
      { slug: "sign-in", routePath: "/sign-in", label: "Sign In" },
      { slug: "auth-login", routePath: "/auth/login", label: "Login" },
    ];

    signInVariants.forEach((p) => {
      const meta = p as PageInfo;
      expect(isAuthLoginPage(meta, authNodeData)).toBe(true);
      expect(isAuthPage(meta, authNodeData)).toBe(true);
    });

    const signUpVariants: Partial<PageInfo>[] = [
      { slug: "register", routePath: "/register", label: "Register" },
      { slug: "signup", routePath: "/signup", label: "Sign Up" },
      { slug: "sign-up", routePath: "/sign-up", label: "Sign Up" },
      { slug: "auth-register", routePath: "/auth/register", label: "Register" },
    ];

    signUpVariants.forEach((p) => {
      const meta = p as PageInfo;
      expect(isAuthRegisterPage(meta, authNodeData)).toBe(true);
      expect(isAuthPage(meta, authNodeData)).toBe(true);
    });

    const randomPage: PageInfo = {
      nodeId: "p1",
      slug: "dashboard",
      routePath: "/dashboard",
      label: "Dashboard",
      componentName: "DashboardPage",
      isRoot: false,
    };
    expect(isAuthLoginPage(randomPage, authNodeData)).toBe(false);
    expect(isAuthRegisterPage(randomPage, authNodeData)).toBe(false);
    expect(isAuthPage(randomPage, authNodeData)).toBe(false);

    // If explicit isAuthPage is set
    const explicitAuthPage: PageInfo = {
      ...randomPage,
      isAuthPage: true,
    };
    // If explicit isAuthPage is set but no social providers configured, shouldGenerateSocialProviders is false
    expect(isAuthPage(explicitAuthPage, authNodeData)).toBe(true);
    expect(shouldGenerateSocialProviders(explicitAuthPage, authNodeData)).toBe(false);

    // If explicit isAuthPage is set AND social providers are configured, shouldGenerateSocialProviders is true
    const authWithSocial: BetterAuthV16NodeData = {
      ...authNodeData,
      providers: {
        socialEnabled: true,
        oauth: [
          {
            id: "oa-1",
            provider: "google",
            clientIdEnv: "GOOGLE_CLIENT_ID",
            clientSecretEnv: "GOOGLE_CLIENT_SECRET",
          },
        ],
      },
    };
    expect(shouldGenerateSocialProviders(explicitAuthPage, authWithSocial)).toBe(true);
  });

  it("should generate social login buttons in generateAuthFormComponent when social auth is enabled", () => {
    const authNodeData: BetterAuthV16NodeData = {
      label: "Auth",
      framework: "better_auth",
      providers: {
        socialEnabled: true,
        oauth: [
          {
            id: "oa-1",
            provider: "google",
            clientIdEnv: "GOOGLE_CLIENT_ID",
            clientSecretEnv: "GOOGLE_CLIENT_SECRET",
          },
          {
            id: "oa-2",
            provider: "github",
            clientIdEnv: "GITHUB_CLIENT_ID",
            clientSecretEnv: "GITHUB_CLIENT_SECRET",
          },
        ],
      },
    };

    const signInPageMeta: PageInfo = {
      nodeId: "page-signin",
      label: "Sign In",
      slug: "sign-in",
      routePath: "/sign-in",
      componentName: "SignInPage",
      isRoot: false,
    };

    const formCode = generateAuthFormComponent(signInPageMeta, authNodeData);

    expect(formCode).toContain("Social Authentication");
    expect(formCode).toContain("Continue with Google");
    expect(formCode).toContain("Continue with GitHub");
    expect(formCode).toContain("handleSocialSignIn(e, \"google\")");
    expect(formCode).toContain("handleSocialSignIn(e, \"github\")");
    expect(formCode).toContain("authClient.signIn.social");
    expect(formCode).toContain("Or continue with email");
  });

  it("should omit social buttons in generateAuthFormComponent when social auth is disabled", () => {
    const authNodeData: BetterAuthV16NodeData = {
      label: "Auth",
      framework: "better_auth",
      providers: {
        socialEnabled: false,
        oauthEnabled: false,
        oauth: [
          {
            id: "oa-1",
            provider: "google",
            clientIdEnv: "GOOGLE_CLIENT_ID",
            clientSecretEnv: "GOOGLE_CLIENT_SECRET",
          },
        ],
      },
    };

    const signInPageMeta: PageInfo = {
      nodeId: "page-signin",
      label: "Sign In",
      slug: "sign-in",
      routePath: "/sign-in",
      componentName: "SignInPage",
      isRoot: false,
    };

    const formCode = generateAuthFormComponent(signInPageMeta, authNodeData);

    expect(formCode).not.toContain("Social Authentication");
    expect(formCode).not.toContain("Continue with Google");
    expect(formCode).not.toContain("handleSocialSignIn");
  });

  it("should show only what is configured and omit social buttons when oauth is empty array (e.g. user deleted them)", () => {
    const authNodeData: BetterAuthV16NodeData = {
      label: "Auth",
      framework: "better_auth",
      providers: {
        socialEnabled: true,
        oauthEnabled: true,
        oauth: [], // User deleted all providers
      },
    };

    expect(resolveOAuthProviders(authNodeData)).toEqual([]);

    const signInPageMeta: PageInfo = {
      nodeId: "page-signin",
      label: "Sign In",
      slug: "sign-in",
      routePath: "/sign-in",
      componentName: "SignInPage",
      isRoot: false,
    };

    const formCode = generateAuthFormComponent(signInPageMeta, authNodeData);
    expect(formCode).not.toContain("Social Authentication");
    expect(formCode).not.toContain("Continue with Google");
    expect(formCode).not.toContain("Continue with GitHub");
    expect(formCode).not.toContain("handleSocialSignIn");
  });

  it("should show ONLY the configured provider (e.g. Discord only) without falling back to Google or GitHub", () => {
    const authNodeData: BetterAuthV16NodeData = {
      label: "Auth",
      framework: "better_auth",
      providers: {
        socialEnabled: true,
        oauth: [
          {
            id: "oa-discord",
            provider: "discord",
            clientIdEnv: "DISCORD_CLIENT_ID",
            clientSecretEnv: "DISCORD_CLIENT_SECRET",
          },
        ],
      },
    };

    const providers = resolveOAuthProviders(authNodeData);
    expect(providers).toHaveLength(1);
    expect(providers[0]?.provider).toBe("discord");

    const signInPageMeta: PageInfo = {
      nodeId: "page-signin",
      label: "Sign In",
      slug: "sign-in",
      routePath: "/sign-in",
      componentName: "SignInPage",
      isRoot: false,
    };

    const formCode = generateAuthFormComponent(signInPageMeta, authNodeData);
    expect(formCode).toContain("Social Authentication");
    expect(formCode).toContain("Continue with Discord");
    expect(formCode).not.toContain("Continue with Google");
    expect(formCode).not.toContain("Continue with GitHub");
  });

  it("should compile Next.js web client with social authentication buttons in generated auth forms", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Portal",
        appSlug: "portal",
        authNodeId: "node-auth",
      },
    };

    const signInNode: BackendNode = {
      id: "node-signin",
      type: "webPage",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Sign In",
        path: "/sign-in",
        appSlug: "portal",
        isAuthPage: true,
      },
    };

    const signUpNode: BackendNode = {
      id: "node-signup",
      type: "webPage",
      position: { x: 200, y: 200 },
      fractionalIndex: "a2",
      data: {
        label: "Sign Up",
        path: "/sign-up",
        appSlug: "portal",
        isAuthPage: true,
      },
    };

    const authNode: BackendNode = {
      id: "node-auth",
      type: "auth",
      position: { x: -200, y: 0 },
      fractionalIndex: "a3",
      data: {
        label: "Auth",
        framework: "better_auth",
        providers: {
          socialEnabled: true,
          oauthEnabled: true,
          oauth: [
            {
              id: "oa-1",
              provider: "google",
              clientIdEnv: "GOOGLE_CLIENT_ID",
              clientSecretEnv: "GOOGLE_CLIENT_SECRET",
            },
            {
              id: "oa-2",
              provider: "github",
              clientIdEnv: "GITHUB_CLIENT_ID",
              clientSecretEnv: "GITHUB_CLIENT_SECRET",
            },
          ],
        },
      },
    };

    const edges: BackendEdge[] = [
      {
        id: "edge-auth-webapp",
        source: "node-auth",
        target: "node-webapp",
        sourceHandle: "auth-out",
        targetHandle: "auth-in",
        type: "connection",
        fractionalIndex: "a0",
      },
      {
        id: "edge-webapp-signin",
        source: "node-webapp",
        target: "node-signin",
        sourceHandle: "public-in",
        type: "connection",
        fractionalIndex: "a1",
      },
      {
        id: "edge-webapp-signup",
        source: "node-webapp",
        target: "node-signup",
        sourceHandle: "public-in",
        type: "connection",
        fractionalIndex: "a2",
      },
    ];

    const result = compileNextjsV16WebClient(
      [signInNode, signUpNode],
      [],
      [],
      [webAppNode, signInNode, signUpNode, authNode],
      edges,
      "SocialAuthProject",
      [],
      "portal",
      webAppNode,
    );

    // Verify SignIn form file exists and contains social buttons
    const signInFormFile = result.files.find(
      (f) => f.filename.endsWith("sign-in/_components/SignInForm.tsx"),
    );
    expect(signInFormFile).toBeDefined();
    expect(signInFormFile?.content).toContain("Social Authentication");
    expect(signInFormFile?.content).toContain("Continue with Google");
    expect(signInFormFile?.content).toContain("Continue with GitHub");
    expect(signInFormFile?.content).toContain("handleSocialSignIn");

    // Verify SignUp form file exists and contains social buttons
    const signUpFormFile = result.files.find(
      (f) => f.filename.endsWith("sign-up/_components/SignUpForm.tsx"),
    );
    expect(signUpFormFile).toBeDefined();
    expect(signUpFormFile?.content).toContain("Social Authentication");
    expect(signUpFormFile?.content).toContain("Continue with Google");
    expect(signUpFormFile?.content).toContain("Continue with GitHub");

    // Verify auth.ts contains socialProviders configuration
    const authTsFile = result.files.find((f) => f.filename === "lib/auth.ts");
    expect(authTsFile).toBeDefined();
    expect(authTsFile?.content).toContain("socialProviders: {");
    expect(authTsFile?.content).toContain("google: {");
    expect(authTsFile?.content).toContain("github: {");
  });

  it("should synthesize default login and register pages with social providers if no explicit auth pages exist", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Portal",
        appSlug: "portal",
        authNodeId: "node-auth",
      },
    };

    const homeNode: BackendNode = {
      id: "node-home",
      type: "webPage",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Home",
        path: "/",
        appSlug: "portal",
      },
    };

    const authNode: BackendNode = {
      id: "node-auth",
      type: "auth",
      position: { x: -200, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "Auth",
        framework: "better_auth",
        redirects: {
          signInRedirectUrl: "/dashboard",
          signUpRedirectUrl: "/dashboard",
          signInPageUrl: "/login",
          signUpPageUrl: "/register",
        },
        providers: {
          socialEnabled: true,
          oauthEnabled: true,
          oauth: [
            {
              id: "oa-1",
              provider: "google",
              clientIdEnv: "GOOGLE_CLIENT_ID",
              clientSecretEnv: "GOOGLE_CLIENT_SECRET",
            },
            {
              id: "oa-2",
              provider: "github",
              clientIdEnv: "GITHUB_CLIENT_ID",
              clientSecretEnv: "GITHUB_CLIENT_SECRET",
            },
          ],
        },
      },
    };

    const edges: BackendEdge[] = [
      {
        id: "edge-auth-webapp",
        source: "node-auth",
        target: "node-webapp",
        sourceHandle: "auth-out",
        targetHandle: "auth-in",
        type: "connection",
        fractionalIndex: "a0",
      },
      {
        id: "edge-webapp-home",
        source: "node-webapp",
        target: "node-home",
        sourceHandle: "public-in",
        type: "connection",
        fractionalIndex: "a1",
      },
    ];

    const result = compileNextjsV16WebClient(
      [homeNode],
      [],
      [],
      [webAppNode, homeNode, authNode],
      edges,
      "AutoAuthProject",
      [],
      "portal",
      webAppNode,
    );

    // Verify synthesized login page and form
    const loginForm = result.files.find(
      (f) => f.filename.endsWith("login/_components/LoginForm.tsx"),
    );
    expect(loginForm).toBeDefined();
    expect(loginForm?.content).toContain("Social Authentication");
    expect(loginForm?.content).toContain("Continue with Google");

    const loginPage = result.files.find((f) => f.filename.endsWith("login/page.tsx"));
    expect(loginPage).toBeDefined();

    // Verify synthesized register page and form
    const registerForm = result.files.find(
      (f) => f.filename.endsWith("register/_components/RegisterForm.tsx"),
    );
    expect(registerForm).toBeDefined();
    expect(registerForm?.content).toContain("Social Authentication");
    expect(registerForm?.content).toContain("Continue with Google");
    expect(registerForm?.content).toContain("Continue with GitHub");
  });
});
