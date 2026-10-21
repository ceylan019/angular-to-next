export type Padding = { legacy: number; next: number };

function round(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

export function padSeconds(legacy: number, next: number): Padding {
  for (const duration of [legacy, next]) {
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(
        `A clip duration must be positive, got ${String(duration)}`,
      );
    }
  }
  return {
    legacy: round(Math.max(0, next - legacy)),
    next: round(Math.max(0, legacy - next)),
  };
}

function hold(
  input: number,
  label: string,
  seconds: number,
  slow: number,
): string {
  const filter =
    seconds > 0
      ? `tpad=stop_mode=clone:stop_duration=${String(seconds)}`
      : "null";
  return `[${String(input)}:v]setpts=${String(slow)}*PTS,${filter}[${label}]`;
}

export function stitchArgs(
  legacy: string,
  next: string,
  output: string,
  padding: Padding,
  slow: number,
): string[] {
  if (!Number.isFinite(slow) || slow < 1) {
    throw new Error(`The slow factor must be at least 1, got ${String(slow)}`);
  }
  const graph = [
    hold(0, "l", padding.legacy, slow),
    hold(1, "n", padding.next, slow),
    "[l][n]hstack=inputs=2,fps=10,split[a][b]",
    "[a]palettegen[p]",
    "[b][p]paletteuse",
  ].join(";");
  return ["-y", "-i", legacy, "-i", next, "-filter_complex", graph, output];
}
