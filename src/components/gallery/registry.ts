export const visualRegistry = {
  orbit: { label: "Orbit", presentation: "kinetic-collage" },
  contactSheet: { label: "Contact sheet", presentation: "film-strip" }
} as const;

export type VisualModuleId = keyof typeof visualRegistry;
