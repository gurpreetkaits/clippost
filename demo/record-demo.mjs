import { chromium } from "playwright";
import { mkdirSync, rmSync, existsSync } from "fs";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAMES_DIR = "/Users/gurpreetkait/code/clippost/demo/frames";
const OUTPUT = "/Users/gurpreetkait/code/clippost/demo/clippost-demo.mp4";

let frameNum = 0;

async function captureFrames(page, durationMs, fps = 8) {
  const interval = 1000 / fps;
  const count = Math.ceil(durationMs / interval);
  for (let i = 0; i < count; i++) {
    const path = `${FRAMES_DIR}/frame_${String(frameNum++).padStart(5, "0")}.png`;
    await page.screenshot({ path, type: "png" });
    await sleep(interval * 0.6); // account for screenshot time
  }
}

(async () => {
  // Clean frames dir
  if (existsSync(FRAMES_DIR)) rmSync(FRAMES_DIR, { recursive: true });
  mkdirSync(FRAMES_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // ── Scene 1: Landing Page ──
  console.log("Scene 1: Landing page");
  await page.goto(BASE, { waitUntil: "load" });
  await sleep(1000);
  await captureFrames(page, 3000);

  // Scroll down to features
  console.log("Scrolling to features...");
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "smooth" }));
  await captureFrames(page, 2500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await captureFrames(page, 2000);

  // ── Scene 2: Navigate to Editor ──
  console.log("Scene 2: Navigate to editor");
  await page.goto(
    `${BASE}/editor?video=59hDYKSldSg.mp4&title=Demo+Video&duration=911.13`,
    { waitUntil: "load" }
  );
  await sleep(500);
  await captureFrames(page, 3000);

  // ── Scene 3: Play the video ──
  console.log("Scene 3: Play video");
  const playBtn = page.locator("button").nth(4);
  await playBtn.click();
  await captureFrames(page, 5000);

  // ── Scene 4: Seek to a good part ──
  console.log("Scene 4: Seek to 15s");
  await page.evaluate(() => {
    const video = document.querySelector("video");
    if (video) video.currentTime = 15;
  });
  await captureFrames(page, 4000);

  // Pause
  await playBtn.click();
  await captureFrames(page, 1500);

  // ── Scene 5: Open Caption Style ──
  console.log("Scene 5: Caption Style modal");
  const captionBtn = page.getByRole("button", { name: "Caption Style" });
  await captionBtn.click();
  await sleep(300);
  await captureFrames(page, 3000);

  // Change text color to yellow
  console.log("Changing text color...");
  const yellowBtn = page.getByRole("button", { name: "#FACC15" });
  await yellowBtn.click();
  await captureFrames(page, 2000);

  // Change position to top
  console.log("Changing position to top...");
  const topBtn = page.getByRole("button", { name: "Top" });
  await topBtn.click();
  await captureFrames(page, 2000);

  // Change position to center
  const centerBtn = page.getByRole("button", { name: "Center" });
  await centerBtn.click();
  await captureFrames(page, 1500);

  // Change position back to bottom
  const bottomBtn = page.getByRole("button", { name: "Bottom" });
  await bottomBtn.click();
  await captureFrames(page, 1500);

  // Reset color
  const blackTextBtn = page.getByRole("button", { name: "#000000" }).first();
  await blackTextBtn.click();
  await captureFrames(page, 1000);

  // ── Scene 6: Templates tab ──
  console.log("Scene 6: Templates tab");
  const templatesTab = page.getByRole("tab", { name: "Templates" });
  await templatesTab.click();
  await sleep(200);
  await captureFrames(page, 2500);

  // Click templates
  const neonBtn = page.getByRole("button", { name: /Neon Pop/ });
  await neonBtn.click();
  await captureFrames(page, 2000);

  const cinemaBtn = page.getByRole("button", { name: /Cinema/ });
  await cinemaBtn.click();
  await captureFrames(page, 2000);

  const classicBtn = page.getByRole("button", { name: /Classic/ });
  await classicBtn.click();
  await captureFrames(page, 1500);

  // Close modal
  console.log("Closing modal...");
  await page.keyboard.press("Escape");
  await sleep(200);
  await captureFrames(page, 2000);

  // ── Scene 7: Adjust clip range ──
  console.log("Scene 7: Adjust clip range");
  const endInput = page.getByRole("textbox", { name: "End" });
  await endInput.click();
  await endInput.fill("1:00");
  await endInput.press("Enter");
  await captureFrames(page, 2500);

  // ── Scene 8: Final play ──
  console.log("Scene 8: Final play");
  await page.evaluate(() => {
    const video = document.querySelector("video");
    if (video) {
      video.currentTime = 5;
      video.play();
    }
  });
  await captureFrames(page, 5000);

  // Pause
  await page.evaluate(() => {
    const video = document.querySelector("video");
    if (video) video.pause();
  });
  await captureFrames(page, 2000);

  await browser.close();

  // ── Stitch frames into video ──
  console.log(`Captured ${frameNum} frames. Stitching into video...`);
  execSync(
    `ffmpeg -y -framerate 8 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p -preset medium -crf 20 -r 25 "${OUTPUT}"`,
    { stdio: "inherit" }
  );

  console.log(`Demo video saved to ${OUTPUT}`);
})();
