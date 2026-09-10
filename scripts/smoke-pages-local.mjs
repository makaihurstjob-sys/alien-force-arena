import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve('dist-pages');
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const relative = pathname.replace(/^\/alien-force-classic\//, '') || 'index.html';
    const file = resolve(root, relative);
    if (!file.startsWith(root + '\\')) throw new Error('Invalid path');
    const data = await readFile(file);
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.PAGES_URL || `http://127.0.0.1:${server.address().port}/alien-force-classic/`);
  await page.getByRole('button', { name: 'Play Classic', exact: true }).click();
  await page.getByRole('button', { name: 'Start: Pause', exact: true }).click();
  await page.waitForTimeout(150);
  const before = await page.locator('canvas').evaluate(c => c.toDataURL());
  await page.waitForTimeout(150);
  if (before !== await page.locator('canvas').evaluate(c => c.toDataURL())) throw new Error('Pause failed');
  await page.getByRole('button', { name: 'Start: Resume', exact: true }).click();
  await page.getByRole('button', { name: 'B: Reverse', exact: true }).click();
  const fire = page.getByRole('button', { name: 'A: Fire', exact: true });
  await fire.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
  await fire.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile overflow');
  await page.getByRole('link', { name: 'Main menu', exact: true }).click();
  await page.getByRole('button', { name: 'Play Classic', exact: true }).waitFor();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: static subpath, play, pause/resume, reverse/fire controls, menu, mobile width; no runtime errors.');
} finally { await browser.close(); server.close(); }

