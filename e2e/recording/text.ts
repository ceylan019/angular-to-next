const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? "");
}

export function tailOf(output: string, lines: number): string {
  if (lines <= 0) {
    return "";
  }
  return output.trimEnd().split("\n").slice(-lines).join("\n");
}
