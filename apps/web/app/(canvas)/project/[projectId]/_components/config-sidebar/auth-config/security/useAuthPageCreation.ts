import { toast } from "sonner";
import { BackendNode, BackendEdge, BackendNodeData } from "@/types/canvas";
import { RedirectsConfig, WebAppZone, PageSection, normalizePageRoute, arePageRoutesEqual } from "@workspace/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { MissingAuthPage } from "./types";

interface UseAuthPageCreationProps {
  allNodes: BackendNode[];
  edges: BackendEdge[];
  nodeId: string;
  redirects: RedirectsConfig;
  updateData: (changes: Partial<BackendNodeData>) => void;
}

export function useAuthPageCreation({
  allNodes = [],
  edges = [],
  nodeId,
  redirects,
  updateData,
}: UseAuthPageCreationProps) {
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);

  // Resolve target WebApp connected to this Auth node
  const webAppNodes = (allNodes || []).filter((n) => n.type === "webApp");
  const connectedWebApps = webAppNodes.filter((app) => {
    if (app.data?.authNodeId === nodeId) return true;
    return (edges || []).some(
      (e) =>
        (e.target === app.id && e.source === nodeId) ||
        (e.source === app.id && e.target === nodeId),
    );
  });
  const targetWebApp = connectedWebApps[0] || webAppNodes[0];

  // Resolve WebApp zone handles
  const defaultZones: WebAppZone[] = [
    { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
    { id: "zone-private", handleId: "private-in", name: "Private Section", accessType: "protected" },
  ];
  const zones: WebAppZone[] =
    targetWebApp?.data?.zones && targetWebApp.data.zones.length > 0
      ? targetWebApp.data.zones
      : defaultZones;

  const publicZone =
    zones.find(
      (z) => z.accessType === "public" || z.handleId === "public-in" || z.id === "zone-public",
    ) || zones[0];
  const protectedZone =
    zones.find(
      (z) => z.accessType === "protected" || z.handleId === "private-in" || z.id === "zone-private",
    ) || zones[1] || zones[0];

  const publicHandle = publicZone?.handleId || "public-in";
  const privateHandle = protectedZone?.handleId || "private-in";

  const authNode = (allNodes || []).find((n) => n.id === nodeId);
  const baseX = targetWebApp?.position?.x ?? ((authNode?.position?.x ?? 200) + 100);
  const baseY = targetWebApp?.position?.y ?? ((authNode?.position?.y ?? 200) + 100);

  const connectedEdgesCount = (edges || []).filter(
    (e) => targetWebApp && (e.source === targetWebApp.id || e.target === targetWebApp.id),
  ).length;

  // Helper to create a single WebPageNode on demand
  const handleCreateWebPageNode = (
    targetRoute: string,
    isProtected: boolean,
    fieldPrefix?: "signInPage" | "signUpPage" | "signInRedirect" | "signUpRedirect" | "signOutRedirect",
  ) => {
    const cleanPath = targetRoute.startsWith("/") ? targetRoute : `/${targetRoute}`;

    // Check if an equivalent route already exists on the connected targetWebApp
    if (targetWebApp) {
      const existingConnectedPage = (edges || [])
        .filter((e) => e.source === targetWebApp.id || e.target === targetWebApp.id)
        .map((e) => (e.source === targetWebApp.id ? e.target : e.source))
        .map((id) => (allNodes || []).find((n) => n.id === id))
        .find(
          (n) =>
            n?.type === "webPage" &&
            arePageRoutesEqual(n.data?.label || n.data?.path || "", cleanPath),
        );

      if (existingConnectedPage) {
        if (fieldPrefix) {
          updateData({
            redirects: {
              ...redirects,
              [`${fieldPrefix}Url`]: existingConnectedPage.data?.label || cleanPath,
              [`${fieldPrefix}NodeId`]: existingConnectedPage.id,
            },
          });
        }
        toast.info(
          `Page for "${cleanPath}" already exists on this WebApp ("${existingConnectedPage.data?.label}"). Linked redirect.`,
        );
        return;
      }
    }

    const newPageId = `webPage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const zoneHandleId = isProtected ? privateHandle : publicHandle;

    let pageLabel = cleanPath;
    let description = `${cleanPath} page`;
    let sections: PageSection[] = [];

    const lower = cleanPath.toLowerCase();
    if (lower === "/login" || lower === "/signin") {
      pageLabel = "/login";
      description = "User sign-in and authentication page";
      sections = [
        {
          id: `sec-${Date.now()}-login`,
          name: "Sign In Form",
          renderMode: "client",
          loadStrategy: "eager",
          actions: [
            {
              id: `act-${Date.now()}-login`,
              name: "Sign In",
              event: "signInWithEmail",
            },
          ],
        },
      ];
    } else if (lower === "/register" || lower === "/signup") {
      pageLabel = "/register";
      description = "User registration and account creation page";
      sections = [
        {
          id: `sec-${Date.now()}-reg`,
          name: "Registration Form",
          renderMode: "client",
          loadStrategy: "eager",
          actions: [
            {
              id: `act-${Date.now()}-reg`,
              name: "Sign Up",
              event: "signUpWithEmail",
            },
          ],
        },
      ];
    } else if (lower === "/dashboard") {
      pageLabel = "/dashboard";
      description = "Authenticated user dashboard overview";
      sections = [
        {
          id: `sec-${Date.now()}-dash`,
          name: "Dashboard Overview",
          renderMode: "server",
          loadStrategy: "eager",
          actions: [
            {
              id: `act-${Date.now()}-dash`,
              name: "View Dashboard",
              event: "pageLoad",
            },
          ],
        },
      ];
    } else {
      sections = [
        {
          id: `sec-${Date.now()}-main`,
          name: "Main Section",
          renderMode: isProtected ? "server" : "client",
          loadStrategy: "eager",
          actions: [
            {
              id: `act-${Date.now()}-load`,
              name: "pageLoad",
              event: "pageLoad",
            },
          ],
        },
      ];
    }

    const newPageNode: BackendNode = {
      id: newPageId,
      type: "webPage",
      fractionalIndex: "a0",
      position: {
        x: baseX + 380,
        y: baseY + (connectedEdgesCount + 1) * 150,
      },
      data: {
        label: pageLabel,
        path: cleanPath,
        appSlug: targetWebApp?.data?.appSlug || "web-app",
        description,
        useZoneDefault: true,
        sections,
      },
    };

    addNode(newPageNode);

    if (targetWebApp) {
      const newEdgeId = `edge-${targetWebApp.id}-${zoneHandleId}-${newPageId}-page-in`;
      addEdge({
        id: newEdgeId,
        source: targetWebApp.id,
        sourceHandle: zoneHandleId,
        target: newPageId,
        targetHandle: "page-in",
        type: "connection",
      });
    }

    if (fieldPrefix) {
      updateData({
        redirects: {
          ...redirects,
          [`${fieldPrefix}Url`]: cleanPath,
          [`${fieldPrefix}NodeId`]: newPageId,
        },
      });
    }

    toast.success(`Created WebPage node for ${cleanPath} on canvas`);
  };

  // Determine which standard auth pages are missing from canvas
  const hasLoginCanvasNode = Boolean(
    (redirects.signInPageNodeId &&
      allNodes.some((n) => n.id === redirects.signInPageNodeId)) ||
    allNodes.some(
      (n) =>
        n.type === "webPage" &&
        (arePageRoutesEqual(n.data?.label || "", "/login") ||
          arePageRoutesEqual(n.data?.path || "", "/login")),
    ),
  );

  const hasRegisterCanvasNode = Boolean(
    (redirects.signUpPageNodeId &&
      allNodes.some((n) => n.id === redirects.signUpPageNodeId)) ||
    allNodes.some(
      (n) =>
        n.type === "webPage" &&
        (arePageRoutesEqual(n.data?.label || "", "/register") ||
          arePageRoutesEqual(n.data?.path || "", "/register")),
    ),
  );

  const hasDashboardCanvasNode = Boolean(
    (redirects.signInRedirectNodeId &&
      allNodes.some((n) => n.id === redirects.signInRedirectNodeId)) ||
    allNodes.some(
      (n) =>
        n.type === "webPage" &&
        (arePageRoutesEqual(n.data?.label || "", "/dashboard") ||
          arePageRoutesEqual(n.data?.path || "", "/dashboard")),
    ),
  );

  const missingPages: MissingAuthPage[] = [];

  if (!hasLoginCanvasNode) {
    missingPages.push({
      key: "signIn",
      path: redirects.signInPageUrl || "/login",
      isProtected: false,
      label: "/login",
    });
  }
  if (!hasRegisterCanvasNode) {
    missingPages.push({
      key: "signUp",
      path: redirects.signUpPageUrl || "/register",
      isProtected: false,
      label: "/register",
    });
  }
  if (!hasDashboardCanvasNode) {
    missingPages.push({
      key: "dashboard",
      path: redirects.signInRedirectUrl || "/dashboard",
      isProtected: true,
      label: "/dashboard",
    });
  }

  const missingAuthPagesCount = missingPages.length;

  // Batch create all missing standard auth pages
  const handleCreateAllMissingAuthPages = () => {
    const updatedRedirects = { ...redirects };
    const createdLabels: string[] = [];
    let currentOffset = connectedEdgesCount;

    missingPages.forEach((item) => {
      const cleanPath = item.path.startsWith("/") ? item.path : `/${item.path}`;

      // If connected targetWebApp already has a page for this route, link to it instead of creating duplicate
      if (targetWebApp) {
        const existingConnectedPage = (edges || [])
          .filter((e) => e.source === targetWebApp.id || e.target === targetWebApp.id)
          .map((e) => (e.source === targetWebApp.id ? e.target : e.source))
          .map((id) => (allNodes || []).find((n) => n.id === id))
          .find(
            (n) =>
              n?.type === "webPage" &&
              arePageRoutesEqual(n.data?.label || n.data?.path || "", cleanPath),
          );

        if (existingConnectedPage) {
          if (item.key === "signIn") {
            updatedRedirects.signInPageUrl = existingConnectedPage.data?.label || "/login";
            updatedRedirects.signInPageNodeId = existingConnectedPage.id;
          } else if (item.key === "signUp") {
            updatedRedirects.signUpPageUrl = existingConnectedPage.data?.label || "/register";
            updatedRedirects.signUpPageNodeId = existingConnectedPage.id;
          } else if (item.key === "dashboard") {
            updatedRedirects.signInRedirectUrl = existingConnectedPage.data?.label || "/dashboard";
            updatedRedirects.signInRedirectNodeId = existingConnectedPage.id;
          }
          return;
        }
      }

      const newPageId = `webPage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const isProtected = item.isProtected;
      const zoneHandleId = isProtected ? privateHandle : publicHandle;

      let sections: PageSection[] = [];
      let pageLabel = cleanPath;
      let description = `${cleanPath} page`;

      if (item.key === "signIn") {
        pageLabel = "/login";
        description = "User sign-in and authentication page";
        sections = [
          {
            id: `sec-${Date.now()}-login`,
            name: "Sign In Form",
            renderMode: "client",
            loadStrategy: "eager",
            actions: [
              {
                id: `act-${Date.now()}-login`,
                name: "Sign In",
                event: "signInWithEmail",
              },
            ],
          },
        ];
        updatedRedirects.signInPageUrl = "/login";
        updatedRedirects.signInPageNodeId = newPageId;
      } else if (item.key === "signUp") {
        pageLabel = "/register";
        description = "User registration and account creation page";
        sections = [
          {
            id: `sec-${Date.now()}-reg`,
            name: "Registration Form",
            renderMode: "client",
            loadStrategy: "eager",
            actions: [
              {
                id: `act-${Date.now()}-reg`,
                name: "Sign Up",
                event: "signUpWithEmail",
              },
            ],
          },
        ];
        updatedRedirects.signUpPageUrl = "/register";
        updatedRedirects.signUpPageNodeId = newPageId;
      } else if (item.key === "dashboard") {
        pageLabel = "/dashboard";
        description = "Authenticated user dashboard overview";
        sections = [
          {
            id: `sec-${Date.now()}-dash`,
            name: "Dashboard Overview",
            renderMode: "server",
            loadStrategy: "eager",
            actions: [
              {
                id: `act-${Date.now()}-dash`,
                name: "View Dashboard",
                event: "pageLoad",
              },
            ],
          },
        ];
        updatedRedirects.signInRedirectUrl = "/dashboard";
        updatedRedirects.signInRedirectNodeId = newPageId;
      }

      const newPageNode: BackendNode = {
        id: newPageId,
        type: "webPage",
        fractionalIndex: "a0",
        position: {
          x: baseX + 380,
          y: baseY + (currentOffset + 1) * 150,
        },
        data: {
          label: pageLabel,
          path: cleanPath,
          appSlug: targetWebApp?.data?.appSlug || "web-app",
          description,
          useZoneDefault: true,
          sections,
        },
      };

      addNode(newPageNode);

      if (targetWebApp) {
        const newEdgeId = `edge-${targetWebApp.id}-${zoneHandleId}-${newPageId}-page-in`;
        addEdge({
          id: newEdgeId,
          source: targetWebApp.id,
          sourceHandle: zoneHandleId,
          target: newPageId,
          targetHandle: "page-in",
          type: "connection",
        });
      }

      createdLabels.push(pageLabel);
      currentOffset++;
    });

    updateData({ redirects: updatedRedirects });
    toast.success(`Created auth pages on canvas: ${createdLabels.join(", ")}`);
  };

  return {
    targetWebApp,
    missingPages,
    missingAuthPagesCount,
    handleCreateWebPageNode,
    handleCreateAllMissingAuthPages,
  };
}
