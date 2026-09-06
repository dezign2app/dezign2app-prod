export type CustomTypeKind = "interface" | "type" | "enum";

export interface CustomTypeField {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  isArray?: boolean;
  description?: string;
  defaultValue?: string;
  enumValues?: string[];
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
  packageSource?: string;
  isReadOnly?: boolean;
  isExtendable?: boolean;
  extendedFrom?: string;
  extendedFromTypeId?: string;
}

export interface CanvasTypesNodeData {
  label?: string;
  description?: string;
  color?: string;
  scope?: "global" | "local";
  targetServiceId?: string;
  targetWebAppId?: string;
  definitionMode?: "visual" | "raw";
  rawTypeScript?: string;
  types?: CustomTypeItem[];
  packageSources?: string[];
  isExtended?: boolean;
  extendedFromNodeId?: string;
  isPackageNode?: boolean;
  packageName?: string;
  packageVersion?: string;
  isInstalled?: boolean;
  installError?: string;
  isReadOnly?: boolean;
}

