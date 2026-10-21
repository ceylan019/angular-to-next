import { test, type TestInfo } from "@playwright/test";

export const KNOWN_DIFFERENCES = {
  "KD-01": {
    title: "Cart amounts are summed in floating point and truncated to cents",
    rules: ["BR-C5"],
  },
  "KD-02": {
    title: "Not found pages answer HTTP 200",
    rules: ["BR-B7", "BR-K7"],
  },
  "KD-03": {
    title: "A subtotal of exactly $50.00 is still charged shipping",
    rules: ["BR-C5"],
  },
  "KD-04": {
    title: "The server rendered cart badge always shows 0",
    rules: ["BR-C4"],
  },
  "KD-05": {
    title: "Place order stays enabled while the order is submitted",
    rules: ["BR-K6"],
  },
} as const;

export type KnownDifferenceId = keyof typeof KNOWN_DIFFERENCES;

type TargetInfo = {
  project: { name: string };
  annotations: TestInfo["annotations"];
};

const ANNOTATION = "known-difference";

export function byTarget<T>(
  kd: KnownDifferenceId,
  values: { legacy: T; next: T },
  info: TargetInfo = test.info(),
): T {
  const target = info.project.name;
  if (target !== "legacy" && target !== "next") {
    throw new Error(
      `${kd} has values for the legacy and next projects only, not "${target}"`,
    );
  }
  const annotated = info.annotations.some(
    (annotation) =>
      annotation.type === ANNOTATION && annotation.description === kd,
  );
  if (!annotated) {
    info.annotations.push({ type: ANNOTATION, description: kd });
  }
  return values[target];
}
