import { MessagesAnnotation, Annotation } from "@langchain/langgraph";

export const UiEditorAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  nodeId: Annotation<string>(),
  projectId: Annotation<string>(),
  convexUrl: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  token: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  pageName: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  pageRoute: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "/",
  }),
  currentCode: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  prompt: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  canvasEndpoints: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  componentCatalog: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  plan: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  generatedCode: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  cleanCode: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  validationStatus: Annotation<"pending" | "valid" | "invalid">({
    reducer: (_, y) => y,
    default: () => "pending",
  }),
  validationErrors: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  retryCount: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
});

export type UiEditorState = typeof UiEditorAnnotation.State;
