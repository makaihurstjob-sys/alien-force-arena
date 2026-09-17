"""Read-only smoke check of the published menu and live leaderboard."""
import asyncio, os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(channel='msedge',headless=True)
        for width,height in [(1440,1000),(390,844)]:
            context=await browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
            page=await context.new_page()
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            await page.goto(os.environ.get('PAGES_URL','https://makaihurstjob-sys.github.io/alien-force-classic/'),wait_until='networkidle')
            assert await page.locator('.desktop-mode-tile strong').all_text_contents()==['Classic','Ranked','Arcade','Practice','Global Leaderboard','Ranked Ratings']
            await page.get_by_role('button',name='Player profile',exact=True).click()
            assert await page.locator('.player-profile-button svg.lucide-log-in').count()==1
            await page.get_by_role('button',name='Flag you represent No flag selected').click()
            assert await page.locator('.profile-flag-list button').count()==272
            await page.get_by_role('searchbox',name='Search flags').fill('Wales')
            await page.get_by_role('button',name='Wales',exact=True).wait_for()
            await page.wait_for_function("document.querySelector('.profile-flag-list img')?.naturalWidth>0")
            await page.get_by_role('button',name='Close profile').click()
            if width>767:
                await page.locator('.desktop-mode-tile').filter(has_text='Global Leaderboard').click()
            else:
                await page.get_by_role('button',name='Show Global Leaderboard',exact=True).click()
            async with page.expect_response(lambda r:'/rest/v1/classic_leaderboard' in r.url) as response:
                await page.get_by_role('button',name='View Global Leaderboard',exact=True).click()
            assert (await response.value).status==200
            await page.get_by_text('Loading records…',exact=True).wait_for(state='hidden')
            assert await page.locator('.classic-tracker').is_visible()
            assert await page.locator('.classic-tracker [role="alert"]').count()==0
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not errors,errors
            print(f'PASS live {width}px: card order, door icon, 271 flags, SVG loading, live leaderboard response, no overflow/runtime errors',flush=True)
            await context.close()
        await browser.close()

asyncio.run(main())
