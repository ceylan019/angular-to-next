export type Flow = "shell" | "browse" | "cart" | "checkout";

export const ENABLED_NEXT_FLOWS: readonly Flow[] = ["shell", "browse", "cart"];

export function flowGrep(flows: readonly Flow[]): RegExp {
  if (flows.length === 0) {
    return /(?!)/;
  }
  return new RegExp(flows.map((flow) => `@${flow}(?!\\S)`).join("|"));
}
