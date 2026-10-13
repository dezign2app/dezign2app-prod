export const truncate = (text = "", limit: number) =>
  text.length > limit ? `${text.slice(0, limit)}...` : text;

/**
 * Converts a string into PascalCase (e.g. "submit button" -> "SubmitButton", "pageLoad" -> "PageLoad", "SUBHASH" -> "Subhash").
 */
export function toPascalCase(str?: string): string {
  if (!str || !str.trim()) return "";
  const formatted = str
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ");

  const words = formatted.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  return words
    .map((word) => {
      if (word.length > 1 && word === word.toUpperCase()) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");
}

/**
 * Converts a string into camelCase (e.g. "Full Name" -> "fullName", "Email" -> "email").
 */
export function toCamelCase(str?: string): string {
  const p = toPascalCase(str);
  if (!p) return "";
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/**
 * Converts a camelCase/snake_case/kebab-case identifier into human-readable Title Case (e.g. "fullName" -> "Full Name").
 */
export function toHumanLabel(str?: string): string {
  if (!str || !str.trim()) return "";
  const formatted = str
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ");

  return formatted
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
