import GestureField from "./GestureField";

export const demoRegistry = {
  "gesture-field": GestureField,
} as const;

export type NativeDemoId = keyof typeof demoRegistry;
