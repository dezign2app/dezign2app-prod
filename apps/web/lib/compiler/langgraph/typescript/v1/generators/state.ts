import type { CompileContext } from "../types";
import { toPascalCase, toCamelCase } from "../utils";

export function buildStateFile(ctx: CompileContext): string {
  const schemaName = `${toPascalCase(ctx.graphId)}State`;
  const imports: string[] = ["Annotation"];

  if (ctx.usesMessages) {
    imports.push("MessagesAnnotation");
  }

  const hasCustomMessages = ctx.input.stateChannels.some(
    (c) =>
      c.key !== "messages" &&
      (c.type === "messages" || c.reducer === "add_messages"),
  );

  const channelLines: string[] = [];

  for (const ch of ctx.input.stateChannels) {
    const field = toCamelCase(ch.key);
    if (
      ch.key === "messages" ||
      ch.type === "messages" ||
      ch.reducer === "add_messages"
    ) {
      if (ch.key === "messages") {
        channelLines.push(`  ...MessagesAnnotation.spec,`);
      } else {
        channelLines.push(
          `  ${field}: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  }),`,
        );
      }
      continue;
    }

    if (ch.reducer === "custom" || ch.customReducerCode) {
      const typeMap: Record<string, string> = {
        string: "string",
        number: "number",
        boolean: "boolean",
        array: "unknown[]",
        object: "Record<string, unknown>",
        json: "Record<string, unknown>",
        messages: "BaseMessage[]",
      };
      const tsType = typeMap[ch.type] || "unknown";
      const customFn = (ch.customReducerCode || "(prev, next) => next").trim();
      const defaultVal =
        ch.defaultValue !== undefined && ch.defaultValue !== ""
          ? JSON.stringify(ch.defaultValue)
          : undefined;
      channelLines.push(
        `  ${field}: Annotation<${tsType}>({
    reducer: ${customFn},${defaultVal !== undefined ? `\n    default: () => ${defaultVal},` : ""}
  }),`,
      );
      continue;
    }

    if (ch.type === "string") {
      if (ch.reducer === "append") {
        channelLines.push(
          `  ${field}: Annotation<string>({
    reducer: (x: string, y: string) => x + y,
    default: () => ${JSON.stringify(ch.defaultValue ?? "")},
  }),`,
        );
      } else if (ch.defaultValue !== undefined && ch.defaultValue !== "") {
        channelLines.push(
          `  ${field}: Annotation<string>({
    reducer: (_, y: string) => y,
    default: () => ${JSON.stringify(ch.defaultValue)},
  }),`,
        );
      } else {
        channelLines.push(`  ${field}: Annotation<string>(),`);
      }
    } else if (ch.type === "number") {
      if (ch.reducer === "append") {
        channelLines.push(
          `  ${field}: Annotation<number>({
    reducer: (x: number, y: number) => x + y,
    default: () => ${Number(ch.defaultValue ?? 0)},
  }),`,
        );
      } else if (ch.defaultValue !== undefined && ch.defaultValue !== 0) {
        channelLines.push(
          `  ${field}: Annotation<number>({
    reducer: (_, y: number) => y,
    default: () => ${Number(ch.defaultValue)},
  }),`,
        );
      } else {
        channelLines.push(`  ${field}: Annotation<number>(),`);
      }
    } else if (ch.type === "boolean") {
      if (ch.defaultValue !== undefined) {
        channelLines.push(
          `  ${field}: Annotation<boolean>({
    reducer: (_, y: boolean) => y,
    default: () => ${Boolean(ch.defaultValue)},
  }),`,
        );
      } else {
        channelLines.push(`  ${field}: Annotation<boolean>(),`);
      }
    } else if (ch.type === "array") {
      const defArr = Array.isArray(ch.defaultValue) ? ch.defaultValue : [];
      if (ch.reducer === "concat_array" || ch.reducer === "append") {
        channelLines.push(
          `  ${field}: Annotation<string[]>({
    reducer: (x: string[], y: string[]) => x.concat(y),
    default: () => ${JSON.stringify(defArr)},
  }),`,
        );
      } else if (defArr.length > 0) {
        channelLines.push(
          `  ${field}: Annotation<string[]>({
    reducer: (_, y: string[]) => y,
    default: () => ${JSON.stringify(defArr)},
  }),`,
        );
      } else {
        channelLines.push(`  ${field}: Annotation<string[]>(),`);
      }
    } else if (ch.type === "object" || ch.type === "json") {
      if (ch.reducer === "merge_object") {
        channelLines.push(
          `  ${field}: Annotation<Record<string, string>>({
    reducer: (x: Record<string, string>, y: Record<string, string>) => ({ ...x, ...y }),
    default: () => ({}),
  }),`,
        );
      } else {
        channelLines.push(`  ${field}: Annotation<Record<string, string>>(),`);
      }
    } else {
      channelLines.push(`  ${field}: Annotation<string>(),`);
    }
  }

  const extraImports: string[] = [];
  if (hasCustomMessages) {
    extraImports.push(`import type { BaseMessage } from "@langchain/core/messages";`);
  }

  return `import { ${imports.sort().join(", ")} } from "@langchain/langgraph";${extraImports.length > 0 ? "\n" + extraImports.join("\n") : ""}

/**
 * Graph State Schema Definition
 */
export const ${schemaName} = Annotation.Root({
${channelLines.join("\n")}
});

export type ${schemaName}Type = typeof ${schemaName}.State;
export type ${schemaName}UpdateType = typeof ${schemaName}.Update;
`;
}
