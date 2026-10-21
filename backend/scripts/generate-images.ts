import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import catalog from "../src/db/catalog.json" with { type: "json" };

type Palette = {
  top: string;
  bottom: string;
  jar: string;
  wax: string;
  ink: string;
};

const FLORAL: Palette = {
  top: "#fbe4ec",
  bottom: "#f2b5c9",
  jar: "#fff7fa",
  wax: "#f6d3de",
  ink: "#5a2a3c",
};

const PALETTES: Record<string, Palette> = {
  floral: FLORAL,
  woody: {
    top: "#efe2d0",
    bottom: "#c9a57c",
    jar: "#fbf5ec",
    wax: "#e3cfb4",
    ink: "#4a3320",
  },
  fresh: {
    top: "#e0f3ee",
    bottom: "#a5d8cc",
    jar: "#f6fcfa",
    wax: "#cfeae3",
    ink: "#1f4a40",
  },
  gourmand: {
    top: "#fbe9cf",
    bottom: "#e8b172",
    jar: "#fff8ee",
    wax: "#f3d3a4",
    ink: "#59340f",
  },
  spicy: {
    top: "#f8dccf",
    bottom: "#d98a62",
    jar: "#fff4ee",
    wax: "#eebfa5",
    ink: "#5a2410",
  },
  herbal: {
    top: "#e6efd9",
    bottom: "#b3cc8f",
    jar: "#f9fcf4",
    wax: "#d6e4bd",
    ink: "#2f4219",
  },
};

const SIZE = 1200;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSvg(name: string, family: string): string {
  const palette = PALETTES[family] ?? FLORAL;
  const label = escapeXml(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(SIZE)}" height="${String(SIZE)}" viewBox="0 0 1200 1200">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${palette.top}"/>
<stop offset="1" stop-color="${palette.bottom}"/>
</linearGradient>
</defs>
<rect width="1200" height="1200" fill="url(#bg)"/>
<ellipse cx="600" cy="1010" rx="330" ry="38" fill="#000000" opacity="0.12"/>
<path d="M600 300 C 585 270 615 250 600 215 C 640 250 625 280 600 300 Z" fill="#f4a93a"/>
<rect x="596" y="296" width="8" height="70" rx="3" fill="${palette.ink}"/>
<rect x="320" y="360" width="560" height="640" rx="70" fill="${palette.jar}" stroke="${palette.ink}" stroke-width="6"/>
<rect x="350" y="400" width="500" height="150" rx="40" fill="${palette.wax}"/>
<rect x="345" y="620" width="510" height="230" rx="14" fill="#ffffff" opacity="0.85" stroke="${palette.ink}" stroke-width="3"/>
<text x="600" y="745" text-anchor="middle" font-family="DejaVu Serif, Georgia, serif" font-size="46" fill="${palette.ink}">${label}</text>
<text x="600" y="805" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" letter-spacing="6" fill="${palette.ink}" opacity="0.7">WICK &amp; CO.</text>
</svg>`;
}

const outDir = fileURLToPath(new URL("../public/images", import.meta.url));
await mkdir(outDir, { recursive: true });

await Promise.all(
  catalog.map((product) =>
    sharp(Buffer.from(renderSvg(product.name, product.family)))
      .jpeg({ quality: 88 })
      .toFile(`${outDir}/${product.slug}.jpg`),
  ),
);

console.log(`wrote ${String(catalog.length)} images to ${outDir}`);
