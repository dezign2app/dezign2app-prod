export type CustomTypeKind = "interface" | "type" | "enum";

export interface CustomTypeField {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  isArray?: boolean;
  description?: string;
  defaultValue?: string;
}

export interface CustomTypeItem {
  id: string;
  name: string;
  kind: CustomTypeKind;
  description?: string;
  fields?: CustomTypeField[];
  enumValues?: string[];
  typeAliasValue?: string;
  rawCode?: string;
}

export interface CanvasTypesNodeData {
  label?: string;
  description?: string;
  color?: string;
  scope?: "global" | "local";
  targetServiceId?: string;
  definitionMode?: "visual" | "raw";
  rawTypeScript?: string;
  types?: CustomTypeItem[];
}
