import React from "react";
import {
  Tag,
  CreditCard,
  MousePointerClick,
  ToggleLeft,
  SquareCheck,
  BarChart3,
  Type,
  AlertTriangle,
  User,
  Loader2,
  Code2,
} from "lucide-react";
import {
  StateRenderComponent,
  StateRenderConfig,
  ComponentPropMappings,
} from "@/types/canvas";

export interface ComponentOption {
  id: StateRenderComponent;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  recommendedFor?: string[];
}

export const DEFAULT_COMPONENT_OPTION: ComponentOption = {
  id: "badge",
  label: "Badge",
  description: "Compact tag or pill with variant styles",
  icon: Tag,
  recommendedFor: ["string", "number", "boolean"],
};

export const COMPONENT_OPTIONS: ComponentOption[] = [
  DEFAULT_COMPONENT_OPTION,
  {
    id: "card",
    label: "Card",
    description: "Structured card with title and stat metric",
    icon: CreditCard,
    recommendedFor: ["number", "object"],
  },
  {
    id: "button",
    label: "Button",
    description: "Interactive button displaying state value",
    icon: MousePointerClick,
    recommendedFor: ["string", "number"],
  },
  {
    id: "switch",
    label: "Switch",
    description: "Toggle switch component",
    icon: ToggleLeft,
    recommendedFor: ["boolean"],
  },
  {
    id: "checkbox",
    label: "Checkbox",
    description: "Checkable box indicator",
    icon: SquareCheck,
    recommendedFor: ["boolean"],
  },
  {
    id: "progress",
    label: "Progress",
    description: "Progress bar for numeric values (0-100)",
    icon: BarChart3,
    recommendedFor: ["number"],
  },
  {
    id: "input",
    label: "Input",
    description: "Interactive form input with two-way binding & debounced updates",
    icon: Type,
    recommendedFor: ["string", "number"],
  },
  {
    id: "alert",
    label: "Alert Callout",
    description: "Banner box for notification or status values",
    icon: AlertTriangle,
    recommendedFor: ["string"],
  },
  {
    id: "avatar",
    label: "Avatar",
    description: "User avatar with initials or image link",
    icon: User,
    recommendedFor: ["string"],
  },
  {
    id: "skeleton",
    label: "Skeleton",
    description: "Shimmer placeholder for loading states",
    icon: Loader2,
    recommendedFor: ["boolean"],
  },
  {
    id: "code",
    label: "Code / JSON",
    description: "Formatted JSON block or code snippet",
    icon: Code2,
    recommendedFor: ["object", "array"],
  },
  {
    id: "text",
    label: "Plain Text",
    description: "Minimal inline key-value element",
    icon: Type,
    recommendedFor: ["string", "number"],
  },
];

export const isVariant = (val: string): val is NonNullable<StateRenderConfig["variant"]> =>
  val === "default" || val === "secondary" || val === "outline" || val === "destructive";

export const isFormatter = (val: string): val is NonNullable<StateRenderConfig["formatter"]> =>
  val === "none" || val === "currency" || val === "number" || val === "json" || val === "date";

export const isClickAction = (val: string): val is NonNullable<StateRenderConfig["clickAction"]> =>
  val === "none" ||
  val === "copy_to_clipboard" ||
  val === "trigger_event" ||
  val === "navigate" ||
  val === "toggle_state";

export const isInputType = (val: string): val is NonNullable<ComponentPropMappings["inputType"]> =>
  val === "text" ||
  val === "number" ||
  val === "password" ||
  val === "email" ||
  val === "tel" ||
  val === "url" ||
  val === "date" ||
  val === "search";

export const isOnChangeMode = (val: string): val is NonNullable<ComponentPropMappings["onChangeMode"]> =>
  val === "two_way" || val === "action" || val === "custom";

export const isButtonSize = (val: string): val is NonNullable<ComponentPropMappings["buttonSize"]> =>
  val === "default" || val === "sm" || val === "lg" || val === "icon";
