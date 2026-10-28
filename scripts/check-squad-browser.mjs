import assert from "node:assert/strict";
import { createServer as createViteServer } from "vite";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const vite = await createViteServer({ configFile: "scripts/qa/vite.config.ts" });
await vite.listen();
const port = vite.config.server.port;
const mime = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".wav": "audio/wav",
};
const staticServer = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(req.url.split("?")[0]).replace(/^\/alien-force-classic\/?/, "");
    const file = resolve("dist-pages", path || "index.html");
    if (!file.startsWith(resolve("dist-pages") + "/")) throw Error();
    const data = await readFile(file);
    res.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((done) => staticServer.listen(8787, "127.0.0.1", done));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-zygote",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const errors = [];
async function track(page) {
  page.on("pageerror", (e) => errors.push(e.message));
}
const base = `http://127.0.0.1:${port}/scripts/qa/lobby.html`;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    Object.defineProperty(document, "hidden", { get: () => false });
    const fill = CanvasRenderingContext2D.prototype.fillText;
    window.__tags = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (["Alice", "Bob", "Carol", "Dan"].includes(text)) window.__tags.push(text);
      return fill.call(this, text, ...args);
    };
  });
  const pages = await Promise.all(
    ["a", "b", "c", "d"].map(async (player) => {
      const page = await context.newPage();
      await track(page);
      await page.goto(base + "?match&player=" + player);
      return page;
    }),
  );
  await Promise.all(
    pages.map((p) => p.waitForFunction(() => window.__qa?.duel.view?.game.tick > 10)),
  );
  const views = await Promise.all(
    pages.map((p) =>
      p.evaluate(() => ({
        id: window.__qa.duel.view.matchId,
        ships: window.__qa.duel.view.game.ships.length,
        tags: [...new Set(window.__tags)],
      })),
    ),
  );
  assert.equal(new Set(views.map((v) => v.id)).size, 1);
  assert.ok(views.every((v) => v.ships === 4));
  assert.deepEqual(views[0].tags.sort(), ["Alice", "Carol"]);
  assert.deepEqual(views[1].tags.sort(), ["Bob", "Dan"]);
  await pages[0].waitForFunction(() => window.__qa.duel.view.game.phase === "playing");
  const beforeY = await pages[0].evaluate(() => window.__qa.duel.view.game.ships.find(ship => ship.id === "d").y);
  await pages[3].keyboard.down("ArrowDown");
  await pages[0].waitForFunction(y => window.__qa.duel.view.game.ships.find(ship => ship.id === "d").y > y + 5, beforeY);
  await pages[3].keyboard.up("ArrowDown");
  await pages[2].evaluate(() => window.__qa.duel.requestPause(true));
  await pages[0].waitForFunction(() => window.__qa.duel.view.paused);
  await pages[2].evaluate(() => window.__qa.duel.requestPause(false));
  await pages[0].waitForFunction(() => !window.__qa.duel.view.paused);
  await pages[3].close();
  await pages[0].waitForFunction(() => window.__qa.duel.view.paused);
  console.log(
    "Four browser clients: common match, 4 ships, remote movement, allied-only tags, pause/resume, missing-peer pause passed.",
  );
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await mobile.newPage();
  await track(page);
  await page.goto(base + "?joystick");
  const stick = page.getByRole("group", { name: "Movement joystick" });
  const box = await stick.boundingBox();
  const cdp = await mobile.newCDPSession(page);
  const touch = async (type, x = 0, y = 0) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y, id: 1 }],
    });
  await touch("touchStart", box.x + box.width * 0.8, box.y + box.height / 2);
  await page.waitForFunction(() => window.__qa.direction === "right");
  await touch("touchMove", box.x + box.width / 2, box.y - 100);
  await page.waitForFunction(() => window.__qa.direction === "up");
  await touch("touchCancel");
  await page.waitForFunction(() => window.__qa.direction === null);
  await page.goto(base + "?adventure");
  await page.getByRole("button", { name: "Game", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Options", exact: true }).count(), 0);
  await page.screenshot({ path: "../adventure-phone.png", fullPage: true });
  await page.goto(base);
  await page.getByRole("region", { name: "Arcade lobby" }).waitFor();
  assert.equal(await page.locator(".hangar-slot").count(), 4);
  const drone = page.getByRole("img", { name: /3D drone preview/ }).first();
  const initial = await page.locator(".drone-model").first().getAttribute("style");
  const db = await drone.boundingBox();
  await touch("touchStart", db.x + db.width / 2, db.y + db.height / 2);
  await touch("touchMove", db.x + db.width / 2 + 70, db.y + db.height / 2 + 50);
  await touch("touchEnd");
  assert.notEqual(await page.locator(".drone-model").first().getAttribute("style"), initial);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: "../squad-lobby-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "../squad-lobby-desktop.png", fullPage: true });
  await mobile.close();
  const main = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const home = await main.newPage();
  await track(home);
  await home.route("**/*.supabase.co/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"message":"Offline QA"}',
    }),
  );
  await home.goto("http://127.0.0.1:8787/alien-force-classic/");
  await home.getByRole("button", { name: "START", exact: true }).click();
  await home.getByRole("button", { name: "Invite a friend to your lobby" }).waitFor();
  const hero = home.locator(".arena-hero-drone .drone-orbit");
  const hb = await hero.boundingBox();
  const before = await home.locator(".arena-hero-drone .drone-model").getAttribute("style");
  await home.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await home.mouse.down();
  await home.mouse.move(hb.x + hb.width / 2 + 70, hb.y + hb.height / 2 + 30);
  await home.mouse.up();
  assert.notEqual(
    await home.locator(".arena-hero-drone .drone-model").getAttribute("style"),
    before,
  );
  await home.screenshot({ path: "../squad-home-desktop.png", fullPage: true });
  await home.setViewportSize({ width: 390, height: 844 });
  await home.screenshot({ path: "../squad-home-phone.png", fullPage: true });
  assert.ok(await home.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log(
    "Phone joystick slide/cancel, Adventure options removal, four lobby slots, touch/mouse rotation and responsive home/lobby passed.",
  );
  assert.deepEqual(errors, []);
  await main.close();
} finally {
  await browser.close();
  await vite.close();
  await new Promise((done) => staticServer.close(done));
}
