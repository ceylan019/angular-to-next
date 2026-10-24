import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function rootTokens(): Map<string, string> {
  const css = readFileSync(
    path.join(import.meta.dirname, "globals.css"),
    "utf8",
  );
  const root = /:root\s*\{([^}]*)\}/.exec(css);
  expect(root).not.toBeNull();
  const raw = new Map(
    [...(root?.[1] ?? "").matchAll(/--([\w-]+):\s*([^;]+);/g)].map(
      (match) => [String(match[1]), String(match[2]).trim()] as const,
    ),
  );
  const resolve = (name: string, seen: string[] = []): string => {
    expect(seen).not.toContain(name);
    const value = raw.get(name);
    expect(value, `--${name} is defined`).toBeDefined();
    const reference = /^var\(--([\w-]+)\)$/.exec(value ?? "");
    return reference
      ? resolve(String(reference[1]), [...seen, name])
      : (value ?? "");
  };
  return new Map([...raw.keys()].map((name) => [name, resolve(name)]));
}

function token(name: string): string {
  const value = rootTokens().get(name);
  expect(value, `--${name} is defined`).toBeDefined();
  expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
  return value ?? "";
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  ) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

function hue(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => value / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const spread = max - Math.min(r, g, b);
  expect(spread).toBeGreaterThan(0);
  const sector =
    max === r
      ? (g - b) / spread
      : max === g
        ? (b - r) / spread + 2
        : (r - g) / spread + 4;
  return (sector * 60 + 360) % 360;
}

describe("theme tokens", () => {
  it("measures contrast the WCAG way", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrast("#007bff", "#ffffff")).toBeCloseTo(3.98, 2);
    expect(contrast("#123456", "#123456")).toBe(1);
  });

  it("reads hues the usual way", () => {
    expect(hue("#ff0000")).toBe(0);
    expect(hue("#00ff00")).toBe(120);
    expect(hue("#0000ff")).toBe(240);
    expect(hue("#ff00ff")).toBe(300);
    expect(hue("#007bff")).toBeCloseTo(211.06, 2);
  });

  it.each([
    ["foreground", "background"],
    ["foreground", "card"],
    ["muted-foreground", "background"],
    ["muted-foreground", "card"],
    ["primary-foreground", "primary"],
    ["secondary-foreground", "secondary"],
    ["destructive", "background"],
    ["destructive", "card"],
    ["header-foreground", "header"],
  ])("keeps %s text on %s at 4.5:1 or more", (text, surface) => {
    expect(contrast(token(text), token(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["input", "background"],
    ["input", "card"],
    ["ring", "background"],
    ["ring", "card"],
  ])("keeps the %s outline against %s at 3:1 or more", (outline, surface) => {
    expect(contrast(token(outline), token(surface))).toBeGreaterThanOrEqual(3);
  });

  it("keeps the dark header bar of the legacy shop", () => {
    expect(luminance(token("header"))).toBeLessThan(0.1);
    expect(luminance(token("background"))).toBeGreaterThan(0.85);
  });

  it("keeps the blue of the legacy shop for primary actions", () => {
    expect(hue(token("primary"))).toBeGreaterThanOrEqual(200);
    expect(hue(token("primary"))).toBeLessThanOrEqual(230);
    expect(hue(token("ring"))).toBeGreaterThanOrEqual(200);
    expect(hue(token("ring"))).toBeLessThanOrEqual(230);
  });
});
