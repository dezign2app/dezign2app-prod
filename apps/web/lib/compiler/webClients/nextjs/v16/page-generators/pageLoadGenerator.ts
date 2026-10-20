import type { PageInfo } from "../types";

export function generatePageLoadState(hasPageLoad: boolean, pageLoadDataType: string = "JSONValue"): string {
  if (!hasPageLoad) return "";
  return `  const [pageLoadData, setPageLoadData] = useState<${pageLoadDataType}>(null);
  const [pageLoadLoading, setPageLoadLoading] = useState<boolean>(false);
  const [pageLoadError, setPageLoadError] = useState<string | null>(null);

`;
}

export function generatePageLoadEffect(
  hasPageLoad: boolean,
  pageMeta: PageInfo,
  pageLoadFetchStatements: string,
  unmountCleanups: string = "",
): string {
  const hasUnmount = Boolean(unmountCleanups && unmountCleanups.trim());
  if (!hasPageLoad && !hasUnmount) return "";

  const loadDataBlock = hasPageLoad
    ? `    async function loadPageData() {
      setPageLoadLoading(true);
      setPageLoadError(null);
      try {
        ${pageLoadFetchStatements}
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : "Failed to load page data";
          setPageLoadError(errorMessage);
          setTriggerLogs((prev) => [
            {
              id: Math.random().toString(36).substring(2, 9),
              eventName: "pageLoad",
              eventType: "pageLoad",
              timestamp: new Date().toLocaleTimeString(),
              url: "N/A",
              method: "LOAD",
              error: errorMessage,
              data: null,
            },
            ...prev,
          ]);
        }
      } finally {
        if (isMounted) {
          setPageLoadLoading(false);
        }
      }
    }
    loadPageData();`
    : "";

  const cleanupBlock = [
    "      isMounted = false;",
    unmountCleanups ? `      ${unmountCleanups.trim()}` : "",
  ].filter(Boolean).join("\n");

  return `  // Page lifecycle (load & unmount cleanup) for ${pageMeta.label}
  useEffect(() => {
    let isMounted = true;
${loadDataBlock ? `${loadDataBlock}\n` : ""}    return () => {
${cleanupBlock}
    };
  }, []);

`;
}

export function generatePageLoadSection(hasPageLoad: boolean): string {
  // Page load data is now presented in the Output Log section
  return "";
}

export function generateJsonValueTypeDecl(hasPageLoad: boolean): string {
  if (!hasPageLoad) return "";
  return `type JSONPrimitive = string | number | boolean | null;
type JSONObject = { [key: string]: JSONValue };
type JSONArray = JSONValue[];
type JSONValue = JSONPrimitive | JSONObject | JSONArray;

`;
}
