import { toSqlIdentifier } from "@/lib/compiler/utils";

export function toPascal(str: string): string {
  if (!str) return "Item";
  const snake = str.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  const clean = toSqlIdentifier(snake, "table");
  return clean
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export function toCamel(str: string): string {
  const p = toPascal(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

export function toSingular(str: string): string {
  if (!str) return str;
  const lower = str.toLowerCase();

  const irregulars: Record<string, string> = {
    people: "person",
    children: "child",
    men: "man",
    women: "woman",
    data: "data",
    media: "media",
    species: "species",
    series: "series",
  };

  if (irregulars[lower]) {
    const s = irregulars[lower];
    return str.charAt(0) === str.charAt(0).toUpperCase()
      ? s.charAt(0).toUpperCase() + s.slice(1)
      : s;
  }

  if (lower.endsWith("ies") && lower.length > 3) {
    return str.slice(0, -3) + (str.charAt(str.length - 3) === "I" ? "Y" : "y");
  }
  if (
    lower.endsWith("sses") ||
    lower.endsWith("shes") ||
    lower.endsWith("ches") ||
    lower.endsWith("xes") ||
    lower.endsWith("zes")
  ) {
    return str.slice(0, -2);
  }
  if (lower.endsWith("ses") && lower.length > 4) {
    if (
      lower.endsWith("status") ||
      lower.endsWith("statuses") ||
      lower.endsWith("process") ||
      lower.endsWith("processes")
    ) {
      return str.slice(0, -2);
    }
    return str.slice(0, -1);
  }
  if (
    lower.endsWith("s") &&
    !lower.endsWith("ss") &&
    !lower.endsWith("us") &&
    !lower.endsWith("is") &&
    lower.length > 2
  ) {
    return str.slice(0, -1);
  }

  return str;
}

export function toPlural(str: string): string {
  if (!str) return str;
  const lower = str.toLowerCase();

  if (
    lower.endsWith("ies") ||
    lower.endsWith("ses") ||
    (lower.endsWith("s") &&
      !lower.endsWith("ss") &&
      !lower.endsWith("us") &&
      !lower.endsWith("is"))
  ) {
    return str;
  }

  const irregulars: Record<string, string> = {
    person: "people",
    child: "children",
    man: "men",
    woman: "women",
    data: "data",
    media: "media",
    species: "species",
    series: "series",
  };

  if (irregulars[lower]) {
    const p = irregulars[lower];
    return str.charAt(0) === str.charAt(0).toUpperCase()
      ? p.charAt(0).toUpperCase() + p.slice(1)
      : p;
  }

  if (lower.endsWith("y") && !/[aeiou]y$/i.test(str)) {
    return str.slice(0, -1) + (str.charAt(str.length - 1) === "Y" ? "IES" : "ies");
  }
  if (
    lower.endsWith("s") ||
    lower.endsWith("sh") ||
    lower.endsWith("ch") ||
    lower.endsWith("x") ||
    lower.endsWith("z")
  ) {
    return str + (str.charAt(str.length - 1) === str.charAt(str.length - 1).toUpperCase() ? "ES" : "es");
  }

  return str + (str.charAt(str.length - 1) === str.charAt(str.length - 1).toUpperCase() ? "S" : "s");
}

export interface RawTableColumn {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isNotNull?: boolean;
  isUnique?: boolean;
  references?: { table: string; column?: string };
}
