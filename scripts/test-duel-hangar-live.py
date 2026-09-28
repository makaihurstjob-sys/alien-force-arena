"""Two independent users exercise the shared hangar with the real duel backend."""
import asyncio
import os
from playwright.async_api import async_playwright
URL=os.environ.get('ALIEN_FORCE_TEST_URL','http://100.88.192.111:5198/alien-force-classic/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(channel='msedge',headless=True)
  host=await browser.new_page(viewport={'width':1440,'height':1000})
  guest=await browser.new_page(viewport={'width':390,'height':844})
  errors=[]
  for page in [host,guest]:
   page.set_default_timeout(30000)
   page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   await host.goto(URL)
   await host.get_by_role('button',name='Classic 1v1',exact=True).click()
   await host.locator('.desktop-play').click()
   await host.locator('.hangar-tabs > strong').wait_for()
   code=(await host.locator('.hangar-tabs > strong').inner_text()).split()[-1]
   await guest.goto(URL+'#room='+code+'&mode=duel')
   await guest.get_by_text('0/2 pilots ready',exact=True).wait_for()
   ids=[await page.evaluate("JSON.parse(localStorage.getItem('alien-force-multiplayer')).user.id") for page in [host,guest]]
   assert ids[0]!=ids[1]
   matches=[]
   for round_number in [1,2]:
    for page in [host,guest]:
     await page.get_by_text('0/2 pilots ready',exact=True).wait_for()
    assert await host.get_by_role('button',name='Start match',exact=True).is_disabled()
    await guest.get_by_role('button',name='Ready up',exact=True).click()
    await host.get_by_text('1/2 pilots ready',exact=True).wait_for()
    await guest.get_by_role('button',name='Cancel ready',exact=True).click()
    await host.get_by_text('0/2 pilots ready',exact=True).wait_for()
    for page in [host,guest]: await page.get_by_role('button',name='Ready up',exact=True).click()
    await host.get_by_role('button',name='Start match',exact=True).click()
    for page in [host,guest]:
     await page.locator('.online-duel').wait_for()
     assert not await page.locator('dialog[open]').count()
    match=await host.locator('.online-duel').get_attribute('data-match-id')
    assert match==await guest.locator('.online-duel').get_attribute('data-match-id')
    assert match not in matches
    matches.append(match)
    # Guest invite reload recovers the same identity and match.
    if round_number==1:
     await guest.reload()
     await guest.locator('.online-duel').wait_for()
     assert match==await guest.locator('.online-duel').get_attribute('data-match-id')
    await host.get_by_role('button',name='Game',exact=True).click()
    await host.get_by_role('button',name='Return to room',exact=True).click()
    for page in [host,guest]: await page.get_by_text('0/2 pilots ready',exact=True).wait_for()
    print(f'PASS duel round {round_number}: invite join, shared readiness, matching match, return/reset',flush=True)
   await host.get_by_role('button',name='Leave room',exact=True).click()
   await guest.get_by_text('The host closed this room.',exact=True).wait_for()
   await guest.get_by_role('button',name='Leave room',exact=True).click()
   assert not errors,errors
   print('PASS duel host closure, both home, no browser errors',flush=True)
  finally:
   for page in [guest,host]:
    for name in ['Leave match','Leave room']:
     button=page.get_by_role('button',name=name,exact=True)
     if await button.count() and await button.is_visible():
      try: await button.click(timeout=5000)
      except Exception: pass
   await browser.close()
asyncio.run(main())
