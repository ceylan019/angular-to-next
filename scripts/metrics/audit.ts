export class ReportError extends Error {
  name = "ReportError";
}

export type Vulnerabilities = {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  total: number;
};

const SEVERITIES = new Set<unknown>([
  "info",
  "low",
  "moderate",
  "high",
  "critical",
]);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

export function unreadable(): never {
  throw new ReportError("report unreadable");
}

export function countVulnerabilities(report: unknown): Vulnerabilities {
  const advisories = isRecord(report) ? report.advisories : undefined;
  if (!isRecord(advisories)) unreadable();
  const severities = Object.values(advisories).map((advisory) => {
    const severity = isRecord(advisory) ? advisory.severity : undefined;
    return SEVERITIES.has(severity) ? severity : unreadable();
  });
  const count = (severity: string): number =>
    severities.filter((value) => value === severity).length;
  const critical = count("critical");
  const high = count("high");
  const moderate = count("moderate");
  const low = count("low");
  return {
    critical,
    high,
    moderate,
    low,
    total: critical + high + moderate + low,
  };
}
