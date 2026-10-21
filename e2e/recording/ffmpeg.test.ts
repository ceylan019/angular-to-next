import { describe, expect, it } from "vitest";
import { planSegments, stitchArgs, totalLength } from "./ffmpeg.js";

describe("planSegments", () => {
  it("cuts each clip at its own marks", () => {
    const segments = planSegments([1, 2, 4], [0.5, 1, 1.5], [1, 1]);
    expect(segments.map((segment) => segment.legacy)).toEqual([
      [1, 2],
      [2, 4],
    ]);
    expect(segments.map((segment) => segment.next)).toEqual([
      [0.5, 1],
      [1, 1.5],
    ]);
  });

  it("lets the longer of the two cuts set the length", () => {
    const [first, second] = planSegments([0, 3, 4], [0, 1, 5], [0.5, 0.5]);
    expect(first?.length).toBe(3);
    expect(second?.length).toBe(4);
  });

  it("lifts a short step to its minimum length", () => {
    const [first] = planSegments([0, 0.25], [0, 0.5], [1.2]);
    expect(first?.length).toBe(1.2);
  });

  it("keeps the same length for both halves of a step", () => {
    for (const segment of planSegments([0, 2, 3], [0, 1, 7], [1, 1])) {
      expect(segment.length).toBeGreaterThanOrEqual(
        segment.legacy[1] - segment.legacy[0],
      );
      expect(segment.length).toBeGreaterThanOrEqual(
        segment.next[1] - segment.next[0],
      );
    }
  });

  it("rounds lengths to three decimals", () => {
    const [first] = planSegments([0, 1.00049], [0, 0.2], [0.1]);
    expect(first?.length).toBe(1);
  });

  it("rejects clips with a different number of marks", () => {
    expect(() => planSegments([0, 1], [0, 1, 2], [1])).toThrow("same number");
  });

  it("rejects fewer than two marks", () => {
    expect(() => planSegments([0], [0], [])).toThrow("two marks");
  });

  it("rejects marks that do not increase", () => {
    expect(() => planSegments([0, 1, 1], [0, 1, 2], [1, 1])).toThrow(
      "increase",
    );
    expect(() => planSegments([0, 2, 1], [0, 1, 2], [1, 1])).toThrow(
      "increase",
    );
    expect(() => planSegments([0, Number.NaN], [0, 1], [1])).toThrow(
      "increase",
    );
  });

  it("rejects a minimum list that does not match the steps", () => {
    expect(() => planSegments([0, 1, 2], [0, 1, 2], [1])).toThrow("minimum");
  });
});

describe("totalLength", () => {
  it("adds the segment lengths", () => {
    expect(totalLength(planSegments([0, 1, 2], [0, 1, 2], [1.5, 2]))).toBe(3.5);
  });
});

describe("stitchArgs", () => {
  const segments = planSegments([1, 2, 4], [0.5, 1, 1.5], [1.2, 1.2]);
  const args = stitchArgs(
    "l.webm",
    "n.webm",
    ["lc.png", "nc.png"],
    "out.gif",
    segments,
  );
  const graph = args[args.indexOf("-filter_complex") + 1] ?? "";

  it("reads both clips, then both captions as stills limited to the total", () => {
    expect(args.slice(0, 5)).toEqual(["-y", "-i", "l.webm", "-i", "n.webm"]);
    expect(args.slice(5, 9)).toEqual(["-loop", "1", "-t", "3.2"]);
    expect(args.slice(9, 11)).toEqual(["-i", "lc.png"]);
    expect(args.slice(11, 15)).toEqual(["-loop", "1", "-t", "3.2"]);
    expect(args.slice(15, 17)).toEqual(["-i", "nc.png"]);
  });

  it("trims every step from the clip at its marks", () => {
    expect(graph).toContain("[0:v]fps=10,trim=start=1:end=2");
    expect(graph).toContain("[0:v]fps=10,trim=start=2:end=4");
    expect(graph).toContain("[1:v]fps=10,trim=start=0.5:end=1");
    expect(graph).toContain("[1:v]fps=10,trim=start=1:end=1.5");
  });

  it("restarts timestamps and holds the last frame for the padding", () => {
    expect(graph).toContain(
      "setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.2[l0]",
    );
    expect(graph).toContain(
      "setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.7[n0]",
    );
    expect(graph).toContain("stop_duration=0[l1]");
    expect(graph).toContain("stop_duration=1.5[n1]");
  });

  it("joins the steps of each half in order", () => {
    expect(graph).toContain("[l0][l1]concat=n=2:v=1:a=0[L]");
    expect(graph).toContain("[n0][n1]concat=n=2:v=1:a=0[N]");
  });

  it("puts each caption under its half, then the halves side by side", () => {
    expect(graph).toContain("[L][2:v]vstack=inputs=2[LC]");
    expect(graph).toContain("[N][3:v]vstack=inputs=2[NC]");
    expect(graph).toContain("[LC][NC]hstack=inputs=2,fps=10,split[a][b]");
    expect(graph).toContain("[a]palettegen[p];[b][p]paletteuse");
  });

  it("limits the output to the total length and writes the gif last", () => {
    expect(args.slice(-3)).toEqual(["-t", "3.2", "out.gif"]);
  });

  it("does not pad a step whose two halves already match", () => {
    const even = stitchArgs(
      "l",
      "n",
      ["a", "b"],
      "o",
      planSegments([0, 2], [0, 2], [1]),
    );
    const evenGraph = even[even.indexOf("-filter_complex") + 1] ?? "";
    expect(evenGraph).toContain("stop_duration=0[l0]");
    expect(evenGraph).toContain("stop_duration=0[n0]");
  });
});
