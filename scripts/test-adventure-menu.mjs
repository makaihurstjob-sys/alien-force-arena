// Run against a built Pages server. PLAYWRIGHT_MODULE may point at an existing installation.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PAGES_URL || 'http://127.0.0.1:4178/alien-force-classic/';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}#player=menu`);
    await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
    const fire = page.getByRole('button', { name: 'Change Fire, binding 1', exact: true });
    await fire.click();
    await page.keyboard.press('KeyZ');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
    assert.equal(await fire.innerText(), 'Z');
    await page.getByRole('button', { name: 'Restore defaults', exact: true }).click();
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await page.goto(`${base}classic`);
    await page.locator('.adventure-film').waitFor();
    for (let i = 0; i < 5; i++) {
      await page.locator('.film-primary').click();
      await page.waitForTimeout(150);
    }
    await page.getByRole('button', { name: 'Game', exact: true }).click();
    await page.waitForTimeout(250); // Allow the menu's simulation block to propagate.
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Game', exact: true }).click();
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByRole('button', { name: 'Game', exact: true }).click();
    await page.waitForTimeout(250);
    assert.equal(await page.getByRole('button', { name: 'Pause', exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}x${height}: reachable bindings, persistence, defaults, menu pause/resume`);
    await context.close();
  }
} finally {
  await browser.close();
}
