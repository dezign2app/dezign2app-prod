import type { TransformerPackageImport } from "@workspace/canvas/types";

export interface PackageExportSuggestion {
  name: string;
  kind: "function" | "variable" | "class" | "type" | "interface" | "enum";
  isDefault?: boolean;
  description?: string;
  snippet?: string;
}

/**
 * Curated map of common exports for utility packages frequently used in data transformers.
 */
const CURATED_PACKAGE_EXPORTS: Record<string, PackageExportSuggestion[]> = {
  "lodash-es": [
    { name: "cloneDeep", kind: "function", description: "Deeply clones an object or array", snippet: "const cloned = cloneDeep(input);" },
    { name: "merge", kind: "function", description: "Deeply merges source objects into destination", snippet: "const merged = merge({}, input, { updated: true });" },
    { name: "pick", kind: "function", description: "Creates an object composed of the picked object properties", snippet: "const picked = pick(input, ['id', 'name']);" },
    { name: "omit", kind: "function", description: "Creates an object omitting specified properties", snippet: "const sanitized = omit(input, ['password', 'secret']);" },
    { name: "get", kind: "function", description: "Gets nested object property path with default fallback", snippet: "const val = get(input, 'nested.prop', 'default');" },
    { name: "set", kind: "function", description: "Sets the value at path of object", snippet: "const updated = set({ ...input }, 'status', 'active');" },
    { name: "has", kind: "function", description: "Checks if path is a direct or inherited property", snippet: "if (has(input, 'targetKey')) { /* ... */ }" },
    { name: "debounce", kind: "function", description: "Creates a debounced function delaying execution", snippet: "const debounced = debounce(() => {}, 300);" },
    { name: "throttle", kind: "function", description: "Creates a throttled function invoking at most once per wait ms", snippet: "const throttled = throttle(() => {}, 200);" },
    { name: "isEmpty", kind: "function", description: "Checks if value is an empty object, collection, or string", snippet: "if (isEmpty(input)) return {};" },
    { name: "isEqual", kind: "function", description: "Performs deep comparison between two values", snippet: "const isSame = isEqual(input.a, input.b);" },
    { name: "uniq", kind: "function", description: "Creates duplicate-free version of an array", snippet: "const uniqueItems = uniq(input.items);" },
    { name: "groupBy", kind: "function", description: "Creates object composed of keys generated from collection", snippet: "const grouped = groupBy(input.items, 'category');" },
    { name: "sortBy", kind: "function", description: "Sorts collection elements in ascending order", snippet: "const sorted = sortBy(input.items, ['created_at']);" },
    { name: "chunk", kind: "function", description: "Splits array into elements split into groups the length of size", snippet: "const batches = chunk(input.items, 50);" },
    { name: "compact", kind: "function", description: "Creates an array with all falsey values removed", snippet: "const truthyList = compact(input.values);" },
    { name: "flatten", kind: "function", description: "Flattens array a single level deep", snippet: "const flat = flatten(input.nestedArray);" },
    { name: "capitalize", kind: "function", description: "Capitalizes string", snippet: "const title = capitalize(input.name);" },
    { name: "camelCase", kind: "function", description: "Converts string to camelCase", snippet: "const key = camelCase(input.rawName);" },
    { name: "kebabCase", kind: "function", description: "Converts string to kebab-case", snippet: "const slug = kebabCase(input.title);" },
  ],
  lodash: [
    { name: "cloneDeep", kind: "function", description: "Deeply clones an object or array", snippet: "const cloned = cloneDeep(input);" },
    { name: "merge", kind: "function", description: "Deeply merges source objects into destination", snippet: "const merged = merge({}, input, { updated: true });" },
    { name: "pick", kind: "function", description: "Creates an object composed of the picked object properties", snippet: "const picked = pick(input, ['id', 'name']);" },
    { name: "omit", kind: "function", description: "Creates an object omitting specified properties", snippet: "const sanitized = omit(input, ['password']);" },
    { name: "get", kind: "function", description: "Gets nested object property path", snippet: "const val = get(input, 'path', null);" },
    { name: "isEmpty", kind: "function", description: "Checks if value is empty", snippet: "if (isEmpty(input)) return null;" },
    { name: "uniq", kind: "function", description: "Creates duplicate-free array", snippet: "const unique = uniq(input.items);" },
  ],
  dayjs: [
    { name: "dayjs", kind: "function", isDefault: true, description: "Fast 2kB date library parser & formatter", snippet: "const now = dayjs().toISOString();" },
    { name: "Dayjs", kind: "type", description: "Dayjs instance type" },
    { name: "isDayjs", kind: "function", description: "Checks if value is a Dayjs object", snippet: "if (isDayjs(input.date)) { /* ... */ }" },
  ],
  "date-fns": [
    { name: "format", kind: "function", description: "Formats date string using tokens", snippet: "const formatted = format(new Date(), 'yyyy-MM-dd');" },
    { name: "addDays", kind: "function", description: "Adds days to given date", snippet: "const future = addDays(new Date(), 7);" },
    { name: "subDays", kind: "function", description: "Subtracts days from given date", snippet: "const past = subDays(new Date(), 7);" },
    { name: "addMonths", kind: "function", description: "Adds months to given date", snippet: "const nextMonth = addMonths(new Date(), 1);" },
    { name: "parseISO", kind: "function", description: "Parses ISO-8601 date string to Date object", snippet: "const parsedDate = parseISO(input.dateStr);" },
    { name: "isValid", kind: "function", description: "Checks if given date is valid", snippet: "const valid = isValid(new Date(input.date));" },
    { name: "differenceInDays", kind: "function", description: "Calculates difference in days between dates", snippet: "const diff = differenceInDays(dateA, dateB);" },
    { name: "startOfDay", kind: "function", description: "Returns start of day (00:00:00)", snippet: "const sod = startOfDay(new Date());" },
    { name: "endOfDay", kind: "function", description: "Returns end of day (23:59:59.999)", snippet: "const eod = endOfDay(new Date());" },
  ],
  slugify: [
    { name: "slugify", kind: "function", isDefault: true, description: "Generates clean URL slug from string", snippet: "const slug = slugify(input.name, { lower: true, strict: true });" },
  ],
  uuid: [
    { name: "v4", kind: "function", description: "Generates cryptographically strong RFC4122 v4 UUID", snippet: "const id = v4();" },
    { name: "v1", kind: "function", description: "Generates timestamp-based RFC4122 v1 UUID", snippet: "const id = v1();" },
    { name: "v5", kind: "function", description: "Generates namespace-based RFC4122 v5 UUID", snippet: "const id = v5(name, namespace);" },
    { name: "validate", kind: "function", description: "Checks if string is a valid UUID", snippet: "const isValid = validate(input.id);" },
    { name: "version", kind: "function", description: "Returns UUID version number", snippet: "const ver = version(input.id);" },
  ],
  nanoid: [
    { name: "nanoid", kind: "function", description: "Generates compact, URL-friendly unique string ID", snippet: "const id = nanoid();" },
    { name: "customAlphabet", kind: "function", description: "Creates custom alphabet ID generator", snippet: "const gen = customAlphabet('1234567890abcdef', 10);\nconst id = gen();" },
  ],
  zod: [
    { name: "z", kind: "variable", description: "Zod validation schema builder", snippet: "const schema = z.object({\n  id: z.string(),\n  name: z.string().min(1)\n});\nconst validated = schema.parse(input);" },
    { name: "infer", kind: "type", description: "Extracts TypeScript type from Zod schema", snippet: "type SchemaType = z.infer<typeof schema>;" },
    { name: "ZodSchema", kind: "type", description: "Base ZodSchema interface" },
    { name: "ZodError", kind: "class", description: "Zod validation error class" },
  ],
  validator: [
    { name: "isEmail", kind: "function", description: "Validates email address format", snippet: "const valid = isEmail(input.email);" },
    { name: "isURL", kind: "function", description: "Validates URL format", snippet: "const valid = isURL(input.url);" },
    { name: "isUUID", kind: "function", description: "Validates UUID format", snippet: "const valid = isUUID(input.id);" },
    { name: "isNumeric", kind: "function", description: "Checks if string contains only numbers", snippet: "const numeric = isNumeric(input.code);" },
    { name: "isEmpty", kind: "function", description: "Checks if string is empty", snippet: "const empty = isEmpty(input.text, { ignore_whitespace: true });" },
    { name: "isLength", kind: "function", description: "Checks if string length is in range", snippet: "const valid = isLength(input.name, { min: 2, max: 50 });" },
    { name: "escape", kind: "function", description: "Escapes HTML entities in string", snippet: "const sanitized = escape(input.htmlContent);" },
    { name: "normalizeEmail", kind: "function", description: "Normalizes email address", snippet: "const normalized = normalizeEmail(input.email);" },
    { name: "trim", kind: "function", description: "Trims whitespace from string", snippet: "const trimmed = trim(input.str);" },
  ],
  "crypto-js": [
    { name: "AES", kind: "variable", description: "Advanced Encryption Standard (AES) cipher", snippet: "const encrypted = AES.encrypt(input.text, secretKey).toString();" },
    { name: "SHA256", kind: "function", description: "SHA-256 cryptographic hashing function", snippet: "const hash = SHA256(input.data).toString();" },
    { name: "MD5", kind: "function", description: "MD5 cryptographic hashing function", snippet: "const hash = MD5(input.data).toString();" },
    { name: "enc", kind: "variable", description: "Encoders (Utf8, Base64, Hex)", snippet: "const utf8 = enc.Utf8.parse(input.str);" },
    { name: "HmacSHA256", kind: "function", description: "HMAC-SHA256 hashing", snippet: "const hmac = HmacSHA256(input.data, secret).toString();" },
  ],
  "bignumber.js": [
    { name: "BigNumber", kind: "class", isDefault: true, description: "Arbitrary-precision decimal arithmetic class", snippet: "const bn = new BigNumber(input.amount).plus(0.05);" },
  ],
  mathjs: [
    { name: "evaluate", kind: "function", description: "Evaluates expressions string safely", snippet: "const result = evaluate(input.expression, input.scope);" },
    { name: "round", kind: "function", description: "Rounds a value to specified decimals", snippet: "const rounded = round(input.val, 2);" },
    { name: "format", kind: "function", description: "Formats value to formatted string", snippet: "const formatted = format(input.num, { precision: 14 });" },
  ],
  deepmerge: [
    { name: "deepmerge", kind: "function", isDefault: true, description: "Deeply merges two or more objects", snippet: "const merged = deepmerge(baseObj, overrides);" },
    { name: "all", kind: "function", description: "Deeply merges array of objects", snippet: "const merged = deepmerge.all([objA, objB, objC]);" },
  ],
  papaparse: [
    { name: "parse", kind: "function", description: "Parses CSV string or stream into objects", snippet: "const parsed = parse(input.csvString, { header: true });" },
    { name: "unparse", kind: "function", description: "Converts JSON objects or arrays into CSV string", snippet: "const csv = unparse(input.rows);" },
  ],
  cheerio: [
    { name: "load", kind: "function", description: "Parses HTML markup into a queryable DOM", snippet: "const $ = load(input.htmlString);" },
  ],
  qs: [
    { name: "stringify", kind: "function", description: "Stringifies object into URL query string", snippet: "const qs = stringify(input.params, { encode: true });" },
    { name: "parse", kind: "function", description: "Parses URL query string into nested object", snippet: "const obj = parse(input.queryString);" },
  ],
  axios: [
    { name: "axios", kind: "function", isDefault: true, description: "Promise-based HTTP client", snippet: "const resp = await axios.get(input.url);" },
    { name: "isAxiosError", kind: "function", description: "Checks if error is AxiosError", snippet: "if (isAxiosError(err)) { /* ... */ }" },
  ],
  "hash-wasm": [
    { name: "sha256", kind: "function", description: "Lightning-fast WebAssembly SHA256", snippet: "const hash = await sha256(input.data);" },
    { name: "md5", kind: "function", description: "Lightning-fast WebAssembly MD5", snippet: "const hash = await md5(input.data);" },
  ],
};

/**
 * Returns curated common exports for a given package name.
 */
export function getPackageExportSuggestions(pkgName: string): PackageExportSuggestion[] {
  if (!pkgName) return [];
  const clean = pkgName.trim().toLowerCase();
  if (CURATED_PACKAGE_EXPORTS[clean]) {
    return CURATED_PACKAGE_EXPORTS[clean];
  }

  // Handle packages without @types or subpaths
  const baseName = clean.replace(/^@types\//, "").split("/")[0] || clean;
  if (CURATED_PACKAGE_EXPORTS[baseName]) {
    return CURATED_PACKAGE_EXPORTS[baseName];
  }

  // Generic fallback: suggest default import named after the package
  const camelName = clean
    .replace(/^@[a-z0-9_-]+\//, "")
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

  return [
    {
      name: camelName || "helper",
      kind: "function",
      isDefault: true,
      description: `Default export from ${pkgName}`,
      snippet: `const result = ${camelName || "helper"}(input);`,
    },
  ];
}

/**
 * Formats a TransformerPackageImport into an exact TypeScript import declaration.
 */
export function formatPackageImportStatement(item: TransformerPackageImport): string {
  if (!item || !item.packageName) return "";
  const typePrefix = item.isTypeOnly ? "type " : "";
  const pkg = item.packageName.trim();

  if (item.namespaceImport) {
    const ns = item.namespaceImport.replace(/^\*\s+as\s+/, "").trim();
    return `import ${typePrefix}* as ${ns || "_"} from "${pkg}";`;
  }

  const parts: string[] = [];
  if (item.defaultImport && item.defaultImport.trim()) {
    parts.push(item.defaultImport.trim());
  }

  const named = (item.namedImports || []).map((s) => s.trim()).filter(Boolean);
  if (named.length > 0) {
    parts.push(`{ ${named.join(", ")} }`);
  }

  if (parts.length === 0) {
    return `import "${pkg}";`;
  }

  return `import ${typePrefix}${parts.join(", ")} from "${pkg}";`;
}

/**
 * Generates an example call/usage snippet for a function from a package.
 */
export function generateFunctionUsageSnippet(
  pkgName: string,
  funcName: string,
  isDefault = false,
): string {
  const suggestions = getPackageExportSuggestions(pkgName);
  const match = suggestions.find((s) => s.name === funcName);
  if (match?.snippet) {
    return match.snippet;
  }

  if (isDefault) {
    return `const result = ${funcName}(input);`;
  }

  return `const result = ${funcName}(input);`;
}

/**
 * Dynamically fetches package exports extracted from node_modules via the API route.
 */
export async function fetchDynamicPackageExports(
  pkgName: string,
  outputDir?: string,
): Promise<PackageExportSuggestion[]> {
  const trimmed = pkgName.trim();
  if (!trimmed) return [];

  try {
    const params = new URLSearchParams({ pkg: trimmed });
    if (outputDir) params.set("outputDir", outputDir);

    const res = await fetch(`/api/packages/extract-types?${params.toString()}`);
    if (!res.ok) return getPackageExportSuggestions(trimmed);

    const data = await res.json();
    const rawExports = Array.isArray(data.exports) ? data.exports : [];
    if (rawExports.length === 0) {
      return getPackageExportSuggestions(trimmed);
    }

    const curated = getPackageExportSuggestions(trimmed);
    const curatedMap = new Map(curated.map((c) => [c.name, c]));

    const merged: PackageExportSuggestion[] = rawExports.map((exp: any) => {
      const cur = curatedMap.get(exp.name);
      return {
        name: exp.name,
        kind: exp.kind || "function",
        isDefault: Boolean(exp.isDefault),
        description: exp.description || cur?.description || `Exported ${exp.kind || "symbol"} from ${trimmed}`,
        snippet: cur?.snippet || generateFunctionUsageSnippet(trimmed, exp.name, exp.isDefault),
      };
    });

    // Append any curated items that weren't detected
    curated.forEach((c) => {
      if (!merged.some((m) => m.name === c.name)) {
        merged.push(c);
      }
    });

    return merged;
  } catch {
    return getPackageExportSuggestions(trimmed);
  }
}
