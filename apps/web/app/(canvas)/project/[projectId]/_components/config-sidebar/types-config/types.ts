import type {
  CustomTypeItem,
  CustomTypeField,
  CustomTypeKind,
} from "@workspace/canvas/types";

export interface TypesConfigProps {
  id: string;
  nodeId: string;
  selectedTypeId?: string;
}

export interface TypePropertyRowProps {
  field: CustomTypeField;
  otherCustomTypes: string[];
  readOnly?: boolean;
  onUpdate: (updates: Partial<CustomTypeField>) => void;
  onDelete: () => void;
}

export interface TypeEditorFormProps {
  nodeId: string;
  currentType: CustomTypeItem;
  otherCustomTypes: string[];
  inheritedEnumValues?: string[];
  onUpdateCurrentType: (updates: Partial<CustomTypeItem>) => void;
  onDeleteCurrentType: () => void;
}

export interface EnumTypeEditorProps {
  currentType: CustomTypeItem;
  inheritedEnumValues: string[];
  onUpdateCurrentType: (updates: Partial<CustomTypeItem>) => void;
}

export interface FunctionTypeEditorProps {
  currentType: CustomTypeItem;
  otherCustomTypes: string[];
  onAddField: () => void;
  onUpdateField: (fieldId: string, updates: Partial<CustomTypeField>) => void;
  onDeleteField: (fieldId: string) => void;
  onUpdateCurrentType: (updates: Partial<CustomTypeItem>) => void;
}

export interface PropertiesEditorProps {
  currentType: CustomTypeItem;
  otherCustomTypes: string[];
  onAddField: () => void;
  onUpdateField: (fieldId: string, updates: Partial<CustomTypeField>) => void;
  onDeleteField: (fieldId: string) => void;
}

export interface TypePreviewSectionProps {
  currentType: CustomTypeItem;
}

export interface PackageTypesBannerProps {
  nodeId: string;
  packageName: string;
  packageVersion?: string;
  isInstalled: boolean;
  installError?: string;
}

export interface TypeNavigatorBarProps {
  types: CustomTypeItem[];
  currentTypeId?: string;
  isPackageNode: boolean;
  onSelectType: (id: string) => void;
  onAddType: () => void;
}
