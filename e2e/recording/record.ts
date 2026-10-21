import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test, type Browser } from "@playwright/test";
import { resetBackend } from "../support/backend.js";
import { addFromList } from "../support/cart.js";
import {
  fillCheckout,
  placeOrder,
  VALID_DETAILS,
} from "../support/checkout.js";
import { COPY } from "../support/copy.js";
import { padSeconds, stitchArgs } from "./ffmpeg.js";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";
const LEGACY_URL = process.env.LEGACY_URL ?? "http://localhost:4000";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const GIF = path.resolve(
  import.meta.dirname,
  "../../docs/media/side-by-side.gif",
);
const SLOW = 4;
const END_HOLD_SECONDS = 2;

const SETTLE_FRAMES = 45;

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

export async function recordFlow(
  browser: Browser,
  baseURL: string,
  outDir: string,
): Promise<string> {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: outDir, size: { width: 640, height: 400 } },
  });
  const page = await context.newPage();
  const video = page.video();
  if (video === null) {
    throw new Error("The page has no video");
  }
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.list.heading }),
  ).toBeVisible();
  await addFromList(page, "Lavender Dusk");
  await page
    .getByRole("banner")
    .getByRole("navigation", { name: COPY.header.nav })
    .getByRole("link", { name: /Cart \(\d+\)/ })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.cart.heading }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: COPY.cart.checkout, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.checkout.heading }),
  ).toBeVisible();
  await fillCheckout(page, VALID_DETAILS);
  await placeOrder(page);
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.confirmation.heading }),
  ).toBeVisible();
  await page.evaluate(settleFrames, SETTLE_FRAMES);
  await context.close();
  return video.path();
}

async function duration(file: string): Promise<number> {
  const { stdout } = await run(FFPROBE, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    file,
  ]);
  return Number(stdout.trim());
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
  const base = padSeconds(
    SLOW * (await duration(legacy)),
    SLOW * (await duration(next)),
  );
  const padding = {
    legacy: base.legacy + END_HOLD_SECONDS,
    next: base.next + END_HOLD_SECONDS,
  };
  const gif = path.join(outDir, "side-by-side.gif");
  await run(FFMPEG, stitchArgs(legacy, next, gif, padding, SLOW));
  await mkdir(path.dirname(GIF), { recursive: true });
  await copyFile(gif, GIF);
  console.log(`Recorded ${GIF} from ${outDir}`);
});
