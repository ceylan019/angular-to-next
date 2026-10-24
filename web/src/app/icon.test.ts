import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.join(import.meta.dirname);
const ICON = path.join(APP, "icon.svg");

function icon(): string {
  return readFileSync(ICON, "utf8");
}

function accent(): string {
  const css = readFileSync(path.join(APP, "globals.css"), "utf8");
  const match = /--accent:\s*(#[0-9a-fA-F]{6})\s*;/.exec(css);
  expect(match).not.toBeNull();
  return (match?.[1] ?? "").toLowerCase();
}

function tagNames(svg: string): string[] {
  return [...svg.matchAll(/<([a-zA-Z][\w:-]*)/g)].map((match) =>
    String(match[1]),
  );
}

describe("site icon", () => {
  it("is served by the app icon file convention", () => {
    expect(existsSync(ICON)).toBe(true);
  });

  it("is a standalone svg with a namespace and a square viewBox", () => {
    const svg = icon().trim();

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    expect(box).not.toBeNull();
    expect(box?.[1]).toBe(box?.[2]);
  });

  it("paints with the theme accent color and no other color", () => {
    const colors = [...icon().matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) =>
      match[0].toLowerCase(),
    );

    expect(colors.length).toBeGreaterThan(0);
    expect(new Set(colors)).toEqual(new Set([accent()]));
  });

  it("is built from plain shapes only", () => {
    const allowed = new Set([
      "svg",
      "path",
      "circle",
      "ellipse",
      "rect",
      "polygon",
    ]);
    const tags = tagNames(icon());

    expect(tags.length).toBeGreaterThan(1);
    expect(tags.filter((tag) => !allowed.has(tag))).toEqual([]);
    expect(tags.filter((tag) => tag !== "svg").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("carries nothing that loads or runs", () => {
    const svg = icon();

    expect(svg).not.toMatch(/<script|<image|<style|<foreignObject|<text|<use/i);
    expect(svg).not.toMatch(/href=|url\(|data:|on[a-z]+=/i);
  });

  it("stays small", () => {
    expect(Buffer.byteLength(icon())).toBeLessThan(1024);
  });
});
