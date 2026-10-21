import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { resetBackend } from "../support/backend.js";
import { addFromList } from "../support/cart.js";
import {
  fillCheckout,
  placeOrder,
  VALID_DETAILS,
} from "../support/checkout.js";
import { COPY } from "../support/copy.js";
import { planSegments, stitchArgs } from "./ffmpeg.js";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const LEGACY_URL = process.env.LEGACY_URL ?? "http://localhost:4000";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const GIF = path.resolve(
  import.meta.dirname,
  "../../docs/media/side-by-side.gif",
);
const MIN_STEP_SECONDS = [1.4, 1.2, 1.6, 1.4, 3];
const CAPTIONS = [
  "Legacy (Angular 10, port 4000)",
  "New (Next.js, port 3000)",
] as const;
const IMAGES_TO_AWAIT = 3;
const SETTLE_FRAMES = 45;
const DWELL_FRAMES = 30;

function settleFrames(frames: number): Promise<void> {
  const raf = (
    globalThis as unknown as {
      requestAnimationFrame: (callback: () => void) => void;
    }
  ).requestAnimationFrame;
  return new Promise((resolve) => {
    let remaining = frames;
    const tick = (): void => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
      } else {
        raf(tick);
      }
    };
    raf(tick);
  });
}

async function expectImagesLoaded(page: Page): Promise<void> {
  const images = page
    .getByRole("list", { name: COPY.list.products })
    .locator("img");
  const count = Math.min(await images.count(), IMAGES_TO_AWAIT);
  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    await expect(image).toHaveJSProperty("complete", true);
    await expect(image).not.toHaveJSProperty("naturalWidth", 0);
  }
}

export type Recording = { path: string; marks: number[] };

export async function recordFlow(
  browser: Browser,
  baseURL: string,
  outDir: string,
): Promise<Recording> {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: outDir, size: { width: 640, height: 400 } },
  });
  const started = performance.now();
  const page = await context.newPage();
  const video = page.video();
  if (video === null) {
    throw new Error("The page has no video");
  }
  const marks: number[] = [];
  const mark = async (): Promise<void> => {
    await page.evaluate(settleFrames, DWELL_FRAMES);
    marks.push((performance.now() - started) / 1000);
    await page.evaluate(settleFrames, DWELL_FRAMES);
  };
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.list.heading }),
  ).toBeVisible();
  await expectImagesLoaded(page);
  await mark();
  await addFromList(page, "Lavender Dusk");
  await mark();
  await page
    .getByRole("banner")
    .getByRole("navigation", { name: COPY.header.nav })
    .getByRole("link", { name: /Cart \(\d+\)/ })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.cart.heading }),
  ).toBeVisible();
  await mark();
  await page
    .getByRole("link", { name: COPY.cart.checkout, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.checkout.heading }),
  ).toBeVisible();
  await fillCheckout(page, VALID_DETAILS);
  await mark();
  await placeOrder(page);
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.confirmation.heading }),
  ).toBeVisible();
  await mark();
  await page.evaluate(settleFrames, SETTLE_FRAMES);
  await mark();
  await context.close();
  return { path: await video.path(), marks };
}

async function captionImage(
  browser: Browser,
  text: string,
  file: string,
): Promise<string> {
  const page = await browser.newPage({ viewport: { width: 640, height: 40 } });
  await page.setContent(
    `<body style="margin:0;display:flex;align-items:center;justify-content:center;height:40px;background:#111;color:#fff;font:600 18px Helvetica,Arial,sans-serif">${text}</body>`,
  );
  await page.screenshot({ path: file });
  await page.close();
  return file;
}

test("record the same purchase in both apps", async ({ browser, request }) => {
  const outDir = await mkdtemp(path.join(tmpdir(), "side-by-side-"));
  await resetBackend(request);
  const legacy = await recordFlow(
    browser,
    LEGACY_URL,
    path.join(outDir, "legacy"),
  );
  await resetBackend(request);
  const next = await recordFlow(browser, WEB_URL, path.join(outDir, "next"));
  const captions = [
    await captionImage(browser, CAPTIONS[0], path.join(outDir, "legacy.png")),
    await captionImage(browser, CAPTIONS[1], path.join(outDir, "next.png")),
  ] as const;
  const gif = path.join(outDir, "side-by-side.gif");
  await run(
    FFMPEG,
    stitchArgs(
      legacy.path,
      next.path,
      captions,
      gif,
      planSegments(legacy.marks, next.marks, MIN_STEP_SECONDS),
    ),
  );
  await mkdir(path.dirname(GIF), { recursive: true });
  await copyFile(gif, GIF);
  console.log(
    `Recorded ${GIF} from ${outDir} with marks`,
    legacy.marks,
    next.marks,
  );
});
