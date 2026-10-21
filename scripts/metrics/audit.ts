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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

export function unreadable(): never {
  throw new ReportError("report unreadable");
}

export function countVulnerabilities(report: unknown): Vulnerabilities {
  const metadata = isRecord(report) ? report.metadata : undefined;
  const vulnerabilities = isRecord(metadata)
    ? metadata.vulnerabilities
    : undefined;
  if (!isRecord(vulnerabilities)) unreadable();
  const count = (severity: string): number => {
    const value = vulnerabilities[severity];
    return isCount(value) ? value : unreadable();
  };
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
