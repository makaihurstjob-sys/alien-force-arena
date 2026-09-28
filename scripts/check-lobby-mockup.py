import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
DROP=Path('C:/Users/macor/dashboard_files/conversation-a11aa5db2bb84b0ca911c6f23478d060')
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(channel='msedge',headless=True)
        for width in [1440,390]:
            page=await browser.new_page(viewport={'width':width,'height':1000})
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            await page.goto((DROP/'alien-force-room-mockup.html').as_uri())
            await page.locator('#create').click()
            await page.screenshot(path=str(DROP/f'room-preview-{width}.png'),full_page=True)
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert await page.locator('#start').is_disabled()
            await page.locator('#add').click()
            await page.locator('#ready').click()
            assert await page.locator('#start').is_enabled()
            await page.locator('#start').click()
            await page.locator('#recover').click()
            await page.locator('[data-mode=solo]').click()
            assert 'too large' in await page.locator('#toast').inner_text()
            await page.locator('#leave').click()
            await page.locator('#create').click()
            await page.locator('[data-mode=solo]').click()
            await page.locator('#ready').click()
            assert await page.locator('#start').is_enabled()
            await page.locator('[data-mode=coop]').click()
            assert 'Future mode' in await page.locator('#ready-note').inner_text()
            await page.locator('#connection').select_option('closed')
            assert not await page.locator('#room-content').is_visible()
            await page.locator('#recover').click()
            assert await page.locator('#start').is_disabled()
            await page.locator('#leave').click()
            await page.locator('#join').click()
            assert await page.locator('#start').is_disabled()
            assert await page.locator('[data-mode=bullet]').is_disabled()
            await page.locator('#leave').click()
            await page.locator('#create').click()
            for _ in range(23):
                await page.locator('#add').click()
            assert await page.locator('.pilot').count()==24
            assert await page.locator('#add').is_disabled()
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert not errors,errors
            print(f'PASS {width}: layout, readiness, launch/return, solo, 2vE label, closed-room recovery, guest permissions',flush=True)
            await page.close()
        await browser.close()
asyncio.run(main())
