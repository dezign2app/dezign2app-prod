import { COMPONENT_REGISTRY } from "./componentRegistry";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates generated Next.js / React TSX code for common syntax and structure issues.
 */
export function validateTsxCode(rawCode: string): ValidationResult {
  const errors: string[] = [];
  const code = rawCode
    .replace(/^```(tsx?|typescript|jsx?)?[\r\n]*/gi, "")
    .replace(/[\r\n]*```\s*$/g, "")
    .trim();

  if (!code) {
    return { isValid: false, errors: ["Generated code is empty."] };
  }

  // 1. Check for Default Export
  const hasDefaultExport = /export\s+default\s+(function|const|class|\w+)/.test(code);
  if (!hasDefaultExport) {
    errors.push("Missing 'export default' for the Next.js page component.");
  }

  // 2. Check for "use client" when React hooks are used
  const usesHooks = /\b(useState|useEffect|useRef|useMemo|useCallback|useRouter|useSearchParams|usePathname)\b/.test(code);
  const hasUseClient = /^\s*["']use client["'];?/m.test(code);
  if (usesHooks && !hasUseClient) {
    errors.push("Component uses React hooks (useState/useEffect) but is missing '\"use client\";' directive at top.");
  }

  // 3. Check balanced brackets/parentheses outside strings
  const bracketErrors = checkBalancedDelimiters(code);
  if (bracketErrors) {
    errors.push(bracketErrors);
  }

  // 4. Validate @workspace/ui imports
  const importMatches = code.matchAll(/from\s+["']@workspace\/ui\/components\/([^"']+)["']/g);
  for (const match of importMatches) {
    const compKey = match[1];
    if (compKey && !COMPONENT_REGISTRY[compKey.toLowerCase()] && !isValidUiComponent(compKey)) {
      errors.push(`Invalid import path: '@workspace/ui/components/${compKey}'. Verify component exists in design system.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function isValidUiComponent(key: string): boolean {
  const validKeys = [
    "accordion", "action-menu", "alert-dialog", "alert", "aspect-ratio", "avatar", "badge",
    "breadcrumb", "button-group", "button", "calendar", "card", "carousel", "chart",
    "checkbox", "collapsible", "combobox", "command", "context-menu", "dialog", "drawer",
    "dropdown-menu", "empty", "field", "hover-card", "input-group", "input-otp", "input",
    "item", "kbd", "label", "menubar", "navigation-menu", "pagination", "popover", "progress",
    "radio-group", "resizable", "scroll-area", "select", "separator", "sheet", "sidebar",
    "skeleton", "slider", "sonner", "spinner", "switch", "table", "tabs", "textarea",
    "toggle-group", "toggle", "tooltip"
  ];
  return validKeys.includes(key.toLowerCase());
}

/**
 * Checks matching pairs of (), {}, [] while ignoring strings and comments.
 */
function checkBalancedDelimiters(code: string): string | null {
  const stack: { char: string; line: number }[] = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inSingleComment = false;
  let inMultiComment = false;
  let line = 1;

  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const next = code[i + 1];

    if (c === "\n") {
      line++;
      inSingleComment = false;
      continue;
    }

    if (inSingleComment) continue;

    if (inMultiComment) {
      if (c === "*" && next === "/") {
        inMultiComment = false;
        i++;
      }
      continue;
    }

    if (inSingleQuote) {
      if (c === "'" && code[i - 1] !== "\\") inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      if (c === '"' && code[i - 1] !== "\\") inDoubleQuote = false;
      continue;
    }
    if (inBacktick) {
      if (c === "`" && code[i - 1] !== "\\") inBacktick = false;
      continue;
    }

    // Check for comment starts
    if (c === "/" && next === "/") {
      inSingleComment = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      inMultiComment = true;
      i++;
      continue;
    }

    // Check string starts
    if (c === "'") { inSingleQuote = true; continue; }
    if (c === '"') { inDoubleQuote = true; continue; }
    if (c === "`") { inBacktick = true; continue; }

    // Check delimiters
    if (c === "(" || c === "{" || c === "[") {
      stack.push({ char: c, line });
    } else if (c === ")" || c === "}" || c === "]") {
      const match = stack.pop();
      if (!match) {
        return `Unmatched closing delimiter '${c}' at line ${line}`;
      }
      if (
        (c === ")" && match.char !== "(") ||
        (c === "}" && match.char !== "{") ||
        (c === "]" && match.char !== "[")
      ) {
        return `Mismatched delimiter: opened '${match.char}' on line ${match.line} but closed with '${c}' at line ${line}`;
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack.pop()!;
    return `Unclosed delimiter '${unclosed.char}' opened at line ${unclosed.line}`;
  }

  return null;
}
