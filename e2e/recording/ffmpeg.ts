export type Marks = readonly number[];
export type Span = readonly [number, number];
export type Segment = { legacy: Span; next: Span; length: number };

const FPS = 10;

function round(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

function checkMarks(marks: Marks): void {
  for (let index = 1; index < marks.length; index += 1) {
    const previous = marks[index - 1] ?? Number.NaN;
    const current = marks[index] ?? Number.NaN;
    if (!(current > previous)) {
      throw new Error(`Marks must increase, got ${marks.join(", ")}`);
    }
  }
  if (marks.some((mark) => !Number.isFinite(mark))) {
    throw new Error(`Marks must increase, got ${marks.join(", ")}`);
  }
}

export function planSegments(
  legacy: Marks,
  next: Marks,
  minimums: readonly number[],
): Segment[] {
  if (legacy.length !== next.length) {
    throw new Error("Both clips need the same number of marks");
  }
  if (legacy.length < 2) {
    throw new Error("A recording needs at least two marks");
  }
  checkMarks(legacy);
  checkMarks(next);
  if (minimums.length !== legacy.length - 1) {
    throw new Error("The minimum list needs one entry per step");
  }
  return minimums.map((minimum, index) => {
    const legacySpan: Span = [legacy[index] ?? 0, legacy[index + 1] ?? 0];
    const nextSpan: Span = [next[index] ?? 0, next[index + 1] ?? 0];
    return {
      legacy: legacySpan,
      next: nextSpan,
      length: round(
        Math.max(
          minimum,
          legacySpan[1] - legacySpan[0],
          nextSpan[1] - nextSpan[0],
        ),
      ),
    };
  });
}

export function totalLength(segments: readonly Segment[]): number {
  return round(segments.reduce((sum, segment) => sum + segment.length, 0));
}

function cut(input: number, label: string, span: Span, length: number): string {
  const pad = round(length - (span[1] - span[0]));
  return `[${String(input)}:v]fps=${String(FPS)},trim=start=${String(span[0])}:end=${String(span[1])},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${String(pad)}[${label}]`;
}

function join(prefix: string, count: number, label: string): string {
  const inputs = Array.from(
    { length: count },
    (_, index) => `[${prefix}${String(index)}]`,
  ).join("");
  return `${inputs}concat=n=${String(count)}:v=1:a=0[${label}]`;
}

function still(file: string, total: string): string[] {
  return ["-loop", "1", "-t", total, "-i", file];
}

export function stitchArgs(
  legacy: string,
  next: string,
  captions: readonly [string, string],
  output: string,
  segments: readonly Segment[],
): string[] {
  const graph = [
    ...segments.flatMap((segment, index) => [
      cut(0, `l${String(index)}`, segment.legacy, segment.length),
      cut(1, `n${String(index)}`, segment.next, segment.length),
    ]),
    join("l", segments.length, "L"),
    join("n", segments.length, "N"),
    "[L][2:v]vstack=inputs=2[LC]",
    "[N][3:v]vstack=inputs=2[NC]",
    `[LC][NC]hstack=inputs=2,fps=10,split[a][b]`,
    "[a]palettegen[p]",
    "[b][p]paletteuse",
  ].join(";");
  const total = String(totalLength(segments));
  return [
    "-y",
    "-i",
    legacy,
    "-i",
    next,
    ...still(captions[0], total),
    ...still(captions[1], total),
    "-filter_complex",
    graph,
    "-t",
    total,
    output,
  ];
}
