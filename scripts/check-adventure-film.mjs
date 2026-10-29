import assert from "node:assert/strict";
import { createServer as createViteServer } from "vite";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const vite = await createViteServer({ configFile: "scripts/qa/vite.config.ts" });
await vite.listen();
const mime = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const file = resolve(
      "dist-pages",
      decodeURIComponent(req.url.split("?")[0]).replace(/^\/alien-force-classic\/?/, "").replace(/^(practice|arcade)$/, "index.html") ||
        "index.html",
    );
    if (!file.startsWith(resolve("dist-pages") + "/")) throw Error();
    const bytes = await readFile(file);
    res.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
    res.end(bytes);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((done) => server.listen(8788, "127.0.0.1", done));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-zygote"],
});
const errors = [];
const base = "http://127.0.0.1:8788/alien-force-classic/";
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.route("**/*.supabase.co/**", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ code: "PGRST202", message: "Isolated offline test" }),
    }),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole("button", { name: "START", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Skip intro", exact: true }).count(), 0);
  assert.equal(await page.getByRole("dialog", { name: "Adventure story cinematic" }).count(), 0);
  await page.getByRole("button", { name: "START", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).last().click();
  await page
    .locator(".hangar-selector[open] .hangar-game-cards button")
    .filter({ has: page.locator("strong", { hasText: /^Adventure$/ }) })
    .click();
  await page.getByRole("region", { name: "Adventure lobby" }).waitFor();
  assert.equal(await page.getByRole("dialog", { name: "Adventure story cinematic" }).count(), 0);
  await page.getByRole("button", { name: "Ready up", exact: true }).click();
  await page.getByRole("button", { name: "Start match", exact: true }).click();
  await page.getByRole("dialog", { name: "Adventure story cinematic" }).waitFor();
  await page.getByRole("heading", { name: "Before the silence", exact: true }).waitFor();
  await page.getByRole("button", { name: "Next scene" }).click();
  await page.getByRole("heading", { name: "One voice made it through" }).waitFor();
  await page.getByRole("button", { name: "Next scene" }).click();
  await page.getByRole("button", { name: "Board Last Light" }).click();
  await page.getByRole("heading", { name: "Last Light", exact: true }).waitFor();
  await page.getByRole("button", { name: "Next scene" }).click();
  await page.getByRole("button", { name: "Start Protecting" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog", { name: "Adventure story cinematic" }).count(), 1);
  await page.screenshot({ path: "../adventure-confirm-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Start Protecting" }).click();
  assert.equal(await page.getByRole("dialog", { name: "Adventure story cinematic" }).count(), 0);
  await page.getByRole("button", { name: "Return to lobby", exact: true }).click();
  await page.getByRole("region", { name: "Adventure lobby" }).waitFor();
  for (const mode of ["Practice", "Arcade", "Ranked", "Versus", "Bullet Run"]) {
    await page.goto(base);
    await page.getByRole("button", { name: "START", exact: true }).click();
    await page.getByRole("button", { name: "Play", exact: true }).last().click();
    await page
      .locator(".hangar-selector[open] .hangar-game-cards button")
      .filter({ has: page.locator("strong", { hasText: new RegExp("^" + mode + "$") }) })
      .click();
    await page.locator(".mobile-menu-dialog[open]").waitFor();
    if (["Practice", "Arcade", "Ranked"].includes(mode))
      await page.getByRole("region", { name: mode + " lobby" }).waitFor();
    assert.equal(await page.getByRole("dialog", { name: "Adventure story cinematic" }).count(), 0);
  }
  for (const path of ["practice", "arcade"]) {
    await page.goto(base + path);
    await page.locator("canvas").first().waitFor();
    assert.equal(await page.getByRole("dialog", { name: "Adventure story cinematic" }).count(), 0);
  }
  console.log(
    "Built app: static start, Adventure lobby without story, story after Start match, explicit Start Protecting, and other modes without pilot story passed.",
  );
  const preview = await context.newPage();
  preview.on("pageerror", (e) => errors.push(e.message));
  await preview.goto(`http://127.0.0.1:${vite.config.server.port}/scripts/qa/adventure-film.html`);
  await preview.clock.install();
  await preview.clock.runFor(9700);
  await preview.getByRole("heading", { name: "One voice made it through" }).waitFor();
  await preview.getByRole("button", { name: "Skip narration" }).click();
  await preview.getByRole("button", { name: "Skip narration" }).click();
  await preview.getByRole("button", { name: "Start Protecting" }).waitFor();
  await preview.clock.runFor(20000);
  assert.equal(await preview.getByRole("button", { name: "Start Protecting" }).count(), 1);
  await preview.setViewportSize({ width: 390, height: 844 });
  await preview.screenshot({ path: "../adventure-confirm-phone.png", fullPage: true });
  assert.ok(await preview.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await preview.goto(
    `http://127.0.0.1:${vite.config.server.port}/scripts/qa/adventure-film.html?transfer`,
  );
  await preview.getByRole("button", { name: "Next scene" }).click();
  await preview.screenshot({ path: "../adventure-transfer-phone.png", fullPage: true });
  await preview.getByRole("button", { name: "Next scene" }).click();
  await preview.getByRole("button", { name: "Continue Mission" }).click();
  await preview.getByText("Mission ready").waitFor();
  const animated = await context.newPage();
  animated.on("pageerror", error => errors.push(error.message));
  await animated.emulateMedia({reducedMotion:"no-preference"});
  await animated.goto(`http://127.0.0.1:${vite.config.server.port}/scripts/qa/adventure-film.html`);
  await animated.locator(".art-home").waitFor();
  assert.ok(await animated.evaluate(() => document.getAnimations().some(animation => animation.playState === "running")));
  await animated.screenshot({path:"../adventure-prologue-desktop.png"});
  assert.deepEqual(errors, []);
  console.log(
    "Automatic narration, skip confirmation, mobile layout and post-boss transfer checks passed.",
  );
} finally {
  await browser.close();
  await vite.close();
  await new Promise((done) => server.close(done));
}
