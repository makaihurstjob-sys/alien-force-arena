"""Local frontend smoke test; multiplayer paths use real temporary rooms."""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright
URL = os.environ.get('ALIEN_FORCE_TEST_URL', 'http://100.88.192.111:5198/alien-force-classic/')
OUT = Path('C:/Users/macor/dashboard_files/conversation-a11aa5db2bb84b0ca911c6f23478d060')

async def main():
 async with async_playwright() as p:
  browser = await p.chromium.launch(channel='msedge', headless=True)
  for width in [1440, 390]:
   page = await browser.new_page(viewport={'width':width,'height':1000})
   page.set_default_timeout(45000)
   errors=[]
   page.on('pageerror', lambda e: errors.append(str(e)))
   try:
    await page.goto(URL)
    assert not await page.get_by_role('button',name='Create Room',exact=True).count()
    assert not await page.get_by_role('button',name='Join Room',exact=True).count()
    for mode in ['Classic','Practice','Ranked','Arcade','Classic 1v1','Bullet Run']:
     print(f'TEST {width} {mode}',flush=True)
     if width == 1440:
      await page.locator('.desktop-mode-tile').filter(has=page.get_by_text(mode,exact=True)).click()
     else:
      await page.get_by_role('button',name='Show '+mode,exact=True).click()
     await page.locator('.desktop-play:visible, .mobile-play:visible').click()
     lobby=page.get_by_role('region',name=mode+' lobby',exact=True)
     await lobby.wait_for()
     assert await page.locator('.hangar-slot').count()==4
     assert await page.get_by_role('button',name='Close dialog',exact=True,include_hidden=True).is_disabled()
     assert await page.locator('.is-hangar').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
     await page.locator('.hangar-game-selector').click()
     await page.keyboard.press('Escape')
     await lobby.wait_for()
     if mode in ['Classic','Practice']:
      assert await page.get_by_role('button',name='Start match',exact=True).is_disabled()
      await page.get_by_role('button',name='Ready up',exact=True).click()
      await page.get_by_role('button',name='Start match',exact=True).click()
      await page.locator('.online-match-screen canvas').first.wait_for()
      await page.get_by_role('button',name='Return to lobby',exact=True).click()
      await lobby.wait_for()
      assert await page.get_by_role('button',name='Start match',exact=True).is_disabled()
      assert await page.get_by_role('button',name='Ready up',exact=True).is_enabled()
     elif mode in ['Ranked','Arcade']:
      assert await page.get_by_role('button',name='Coming soon',exact=True).is_disabled()
      assert await page.get_by_role('button',name='Ready up',exact=True).is_disabled()
     else:
      await page.get_by_role('button',name='Ready up',exact=True).click()
      await page.get_by_role('button',name='Cancel ready',exact=True).wait_for()
      assert await page.get_by_role('button',name='Start match',exact=True).is_disabled()
     await page.screenshot(path=str(OUT / f'unified-lobby-{mode.replace(" ","-").lower()}-{width}.png'))
     await page.get_by_role('button',name='Leave room',exact=True).click()
     await page.locator('.desktop-play:visible, .mobile-play:visible').wait_for()
     await page.locator('dialog[open]').wait_for(state='hidden')
     print(f'PASS {width} {mode}: direct lobby, overlay, readiness/launch, leave',flush=True)
    # Switching local game choices resets readiness and keeps the hangar open.
    await page.get_by_role('button',name='Classic' if width==1440 else 'Show Classic',exact=True).click()
    await page.locator('.desktop-play:visible, .mobile-play:visible').click()
    await page.get_by_role('button',name='Ready up',exact=True).click()
    await page.locator('.hangar-game-selector').click()
    await page.locator('.hangar-game-cards button').filter(has=page.get_by_text('Practice',exact=True)).click()
    await page.get_by_role('region',name='Practice lobby',exact=True).wait_for()
    assert await page.get_by_role('button',name='Start match',exact=True).is_disabled()
    await page.get_by_role('button',name='Leave room',exact=True).click()
    assert not errors,errors
   except Exception:
    await page.screenshot(path=str(OUT / f'unified-failure-{width}.png'))
    print((await page.locator('body').inner_text()).encode('ascii','backslashreplace').decode()[-4000:],flush=True)
    raise
   finally:
    leave=page.get_by_role('button',name='Leave room',exact=True)
    if await leave.count() and await leave.is_visible():
     try: await leave.click(timeout=5000)
     except Exception: pass
    await page.close()
  await browser.close()

asyncio.run(main())
