import asyncio, os
from playwright.async_api import async_playwright
async def enter(page,mode):
 await page.goto(os.environ.get('PAGES_URL','http://127.0.0.1:4178/alien-force-classic/'))
 await page.get_by_role('button',name='START',exact=True).click()
 if mode!='Classic':
  await page.locator('.arena-selected-game').click()
  await page.locator('.arena-game-grid > button').filter(has=page.get_by_text(mode,exact=True)).click()
 await page.locator('.arena-play-button').click()
 await page.get_by_role('region',name=mode+' lobby',exact=True).wait_for()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(channel='msedge',headless=True)
  host=await b.new_page(reduced_motion='reduce'); await enter(host,'Classic 1v1')
  code=(await host.locator('.hangar-tabs > strong').inner_text()).split()[-1]
  for width in [1440,390]:
   context=await b.new_context(viewport={'width':width,'height':844},reduced_motion='reduce',has_touch=width==390)
   page=await context.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    await enter(page,'Classic')
    await page.locator('.hangar-tabs').get_by_role('button',name='Join Room',exact=True).click()
    popup=page.get_by_role('dialog',name='Join Game Room',exact=True)
    await popup.wait_for()
    await popup.get_by_role('button',name='1',exact=True).click()
    assert await popup.locator('input').input_value()=='1'
    key=popup.get_by_role('button',name='2, hold for ABC',exact=True)
    await key.hover();await page.mouse.down();await page.wait_for_timeout(550);await page.mouse.up()
    await popup.get_by_role('button',name='B',exact=True).click()
    assert await popup.locator('input').input_value()=='1B'
    await popup.get_by_role('button',name='Backspace code',exact=True).click()
    assert await popup.locator('input').input_value()=='1'
    await popup.locator('input').fill('abcdef')
    assert await popup.locator('input').input_value()=='ABCDEF'
    assert await popup.get_by_role('button',name='3, hold for DEF',exact=True).is_disabled()
    await page.screenshot(path=f'test-artifacts/join-popup-{width}.png')
    assert await popup.evaluate('(e)=>e.getBoundingClientRect().width<=innerWidth')
    await page.keyboard.press('Escape');assert not await popup.is_visible()
    await page.locator('.hangar-tabs').get_by_role('button',name='Join Room',exact=True).click()
    await popup.locator('input').fill(code)
    await popup.get_by_role('button',name='Join',exact=True).click()
    await page.get_by_role('region',name='Classic 1v1 lobby',exact=True).wait_for()
    assert not await popup.is_visible()
    assert code in await page.locator('.hangar-tabs > strong').inner_text()
    assert not errors,errors
    print('PASS',width,'numbers, held letters, backspace, typing, escape, real room join',flush=True)
   finally:
    await page.get_by_role('button',name='Leave room',exact=True).click()
    await context.close()
  await host.get_by_role('button',name='Leave room',exact=True).click();await b.close()
asyncio.run(main())
