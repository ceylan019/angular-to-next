import { describe, expect, it } from "vitest";
import { escapeHtml, tailOf } from "./text.js";

describe("escapeHtml", () => {
  it("escapes the five special characters", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    );
  });

  it("escapes the ampersand first so entities are not doubled", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves plain text and the empty string alone", () => {
    expect(escapeHtml("Legacy (Angular 10, port 4000)")).toBe(
      "Legacy (Angular 10, port 4000)",
    );
    expect(escapeHtml("")).toBe("");
  });

  it("escapes every occurrence", () => {
    expect(escapeHtml("<<>>")).toBe("&lt;&lt;&gt;&gt;");
  });
});

describe("tailOf", () => {
  it("keeps the last lines of long output", () => {
    expect(tailOf("a\nb\nc\nd", 2)).toBe("c\nd");
  });

  it("returns short output whole", () => {
    expect(tailOf("a\nb", 5)).toBe("a\nb");
  });

  it("ignores trailing blank lines", () => {
    expect(tailOf("a\nb\nc\n\n", 2)).toBe("b\nc");
  });

  it("returns an empty string for empty output", () => {
    expect(tailOf("", 3)).toBe("");
  });

  it("returns an empty string when no lines are asked for", () => {
    expect(tailOf("a\nb", 0)).toBe("");
  });
});
