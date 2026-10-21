import { describe, expect, it } from "vitest";
import { padSeconds, stitchArgs } from "./ffmpeg.js";

describe("padSeconds", () => {
  it("pads the legacy clip when the next clip is longer", () => {
    expect(padSeconds(10, 12.5)).toEqual({ legacy: 2.5, next: 0 });
  });

  it("pads the next clip when the legacy clip is longer", () => {
    expect(padSeconds(12.5, 10)).toEqual({ legacy: 0, next: 2.5 });
  });

  it("pads nothing when the clips are equally long", () => {
    expect(padSeconds(8, 8)).toEqual({ legacy: 0, next: 0 });
  });

  it("rounds a tiny difference to three decimals", () => {
    expect(padSeconds(1, 1.00049)).toEqual({ legacy: 0, next: 0 });
    expect(padSeconds(1, 1.0006)).toEqual({ legacy: 0.001, next: 0 });
  });

  it("rejects a clip with no duration", () => {
    expect(() => padSeconds(0, 5)).toThrow("positive");
    expect(() => padSeconds(5, Number.NaN)).toThrow("positive");
  });
});

describe("stitchArgs", () => {
  const args = stitchArgs(
    "l.webm",
    "n.webm",
    "out.gif",
    {
      legacy: 2,
      next: 0,
    },
    4,
  );

  it("reads both inputs and writes the gif last", () => {
    expect(args.slice(0, 5)).toEqual(["-y", "-i", "l.webm", "-i", "n.webm"]);
    expect(args.at(-1)).toBe("out.gif");
  });

  it("holds the last frame of the shorter clip", () => {
    const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
    expect(graph).toContain(
      "[0:v]setpts=4*PTS,tpad=stop_mode=clone:stop_duration=2[l]",
    );
    expect(graph).toContain("[1:v]setpts=4*PTS,null[n]");
  });

  it("slows both clips down by the given factor before padding", () => {
    const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
    expect(graph).toContain("[0:v]setpts=4*PTS,tpad=stop_mode=clone");
    expect(graph).toContain("[1:v]setpts=4*PTS,null[n]");
  });

  it("rejects a slow factor below one", () => {
    expect(() =>
      stitchArgs("l", "n", "o", { legacy: 0, next: 0 }, 0.5),
    ).toThrow("at least 1");
  });

  it("stacks side by side and builds a palette", () => {
    const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
    expect(graph).toContain("[l][n]hstack=inputs=2,fps=10,split[a][b]");
    expect(graph).toContain("[a]palettegen[p];[b][p]paletteuse");
  });

  it("pads the next clip when it is the shorter one", () => {
    const graph =
      stitchArgs("l", "n", "o", { legacy: 0, next: 1.5 }, 4)[
        stitchArgs("l", "n", "o", { legacy: 0, next: 1.5 }, 4).indexOf(
          "-filter_complex",
        ) + 1
      ] ?? "";
    expect(graph).toContain(
      "[1:v]setpts=4*PTS,tpad=stop_mode=clone:stop_duration=1.5[n]",
    );
    expect(graph).toContain("[0:v]setpts=4*PTS,null[l]");
  });
});
