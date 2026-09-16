import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const url = process.env.CLASSIC_URL || "https://desktop-56u49jf.tailb2892a.ts.net:8447/classic";
const errors = [];
async function snapshot(page) {
  await page.waitForTimeout(100);
  return page.locator("canvas").evaluate((c) => c.toDataURL());
}
async function checkMenu(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name, exact: true }).getAttribute("aria-expanded"),
    "true",
  );
  const paused = await snapshot(page);
  assert.equal(await snapshot(page), paused, `${name} must pause gameplay`);
  await page.locator("canvas").click();
  assert.equal(await page.locator(".classic-dropdown").count(), 0);
  const running = await snapshot(page);
  assert.notEqual(await snapshot(page), running, `${name} dismissal must resume gameplay`);
}
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await desktop.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(1500);
  assert.equal(await page.locator(".classic-controller").isVisible(), false);
  for (const name of ["Game", "Options", "Help", "Window menu"]) await checkMenu(page, name);
  await page.getByRole("button", { name: "Minimize window", exact: true }).click();
  assert.equal(await page.locator("canvas").isVisible(), false);
  await page.getByRole("button", { name: "Restore window", exact: true }).click();
  const restored = await snapshot(page);
  assert.notEqual(
    await snapshot(page),
    restored,
    "Restoring must resume a previously running game",
  );
  await page.getByRole("button", { name: "Maximize window", exact: true }).click();
  assert.equal(await page.locator(".classic-window.is-maximized").count(), 1);
  await checkMenu(page, "Game");
  await page.getByRole("button", { name: "Restore window", exact: true }).click();
  await page.keyboard.press("KeyP");
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.locator("canvas").click();
  const explicitPause = await snapshot(page);
  assert.equal(await snapshot(page), explicitPause, "Closing Help must preserve an explicit pause");
  await page.getByRole("button", { name: "Game", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const resumed = await snapshot(page);
  assert.notEqual(await snapshot(page), resumed);
  await page.getByRole("button", { name: "Game", exact: true }).click();
  await page.getByRole("button", { name: "New game", exact: true }).click();
  assert.equal(await page.locator("canvas").evaluate((c) => document.activeElement === c), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.locator(".classic-controller").isVisible(),
    false,
    "A narrow PC window still hides touch controls",
  );
  console.log(
    "PASS desktop: menus during gameplay, automatic pause/resume, explicit pause preserved, minimize/restore, maximize, new game, no controller at either width",
  );
  await desktop.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(url);
  await phone.locator("canvas").waitFor();
  await phone.waitForTimeout(1000);
  assert.equal(await phone.locator(".classic-controller").isVisible(), true);
  await phone.getByRole("button", { name: "Start: Pause", exact: true }).tap();
  const paused = await snapshot(phone);
  assert.equal(await snapshot(phone), paused);
  await phone.getByRole("button", { name: "Start: Resume", exact: true }).tap();
  await phone.getByRole("button", { name: "B: Reverse", exact: true }).tap();
  await phone.getByRole("button", { name: "Move up", exact: true }).tap();
  await phone.getByRole("button", { name: "A: Fire", exact: true }).tap();
  await checkMenu(phone, "Game");
  assert.equal(
    await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await phone.setViewportSize({ width: 1024, height: 768 });
  assert.equal(
    await phone.locator(".classic-controller").isVisible(),
    true,
    "Tablet controls must remain visible",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS mobile: touch controls, pause/resume, menus, phone/tablet visibility, no horizontal overflow or page errors",
  );
  await mobile.close();
} finally {
  await browser.close();
}
