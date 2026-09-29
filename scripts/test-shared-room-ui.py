"""Actual SQL in disposable PGlite; real anonymous auth and realtime transport.
Run node scripts/test-shared-room-db.mjs --serve first. No remote room writes.
"""
import asyncio
import base64
import json
from playwright.async_api import async_playwright

URL = 'http://100.88.192.111:5198/alien-force-classic/'

async def main():
 async with async_playwright() as p:
  browser = await p.chromium.launch(channel='msedge', headless=True)
  host = await browser.new_page(viewport={'width':1440,'height':1000})
  guest = await browser.new_page(viewport={'width':390,'height':844})
  errors=[]
  async def rpc(route):
   bearer=route.request.headers.get('authorization','').split(' ')[-1]
   uid=''
   if bearer.count('.')==2:
    part=bearer.split('.')[1]
    uid=json.loads(base64.urlsafe_b64decode(part+'='*(-len(part)%4))).get('sub','')
   response=await host.request.post('http://127.0.0.1:5201',data={'uid':uid,'args':route.request.post_data_json})
   await route.fulfill(status=response.status,content_type='application/json',body=await response.text())
  for page in [host,guest]:
   page.set_default_timeout(30000)
   page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('**/rest/v1/rpc/game_lobby',rpc)
  async def choose(page,mode):
   await page.locator('.hangar-game-selector').click()
   popup=page.locator('.hangar-selector')
   rect=await popup.bounding_box()
   view=page.viewport_size
   assert abs(rect['x']+rect['width']/2-view['width']/2)<2,rect
   assert abs(rect['y']+rect['height']/2-view['height']/2)<2,rect
   await popup.locator('button').filter(has=page.get_by_text(mode,exact=True)).click()
   await page.get_by_role('region',name=mode+' lobby',exact=True).wait_for()
  try:
   await host.goto(URL)
   await host.get_by_role('button',name='Bullet Run',exact=True).click()
   await host.locator('.desktop-play').click()
   await host.locator('.hangar-tabs > strong').wait_for()
   code=(await host.locator('.hangar-tabs > strong').inner_text()).split()[-1]
   await guest.goto(URL+'#room='+code+'&mode=bullet')
   await guest.get_by_text('0/2 pilots ready',exact=True).wait_for()
   for page in [host,guest]: await page.get_by_role('button',name='Ready up',exact=True).click()
   await host.get_by_text('2/2 pilots ready',exact=True).wait_for()
   await choose(host,'Classic 1v1')
   for page in [host,guest]:
    await page.get_by_role('region',name='Classic 1v1 lobby',exact=True).wait_for()
    await page.get_by_text('0/2 pilots ready',exact=True).wait_for()
    assert code in await page.locator('.hangar-tabs > strong').inner_text()
   await guest.locator('.hangar-game-selector').click()
   assert await guest.locator('.hangar-game-cards button').filter(has=guest.get_by_text('Bullet Run',exact=True)).is_disabled()
   await guest.get_by_role('button',name='Close game selector',exact=True).click()
   for page in [host,guest]: await page.get_by_role('button',name='Ready up',exact=True).click()
   await host.get_by_role('button',name='Start match',exact=True).click()
   for page in [host,guest]: await page.locator('.online-duel').wait_for()
   assert await host.locator('.online-duel').get_attribute('data-match-id')==await guest.locator('.online-duel').get_attribute('data-match-id')
   await host.get_by_role('button',name='Game',exact=True).click()
   await host.get_by_role('button',name='Return to room',exact=True).click()
   for page in [host,guest]: await page.get_by_text('0/2 pilots ready',exact=True).wait_for()
   await choose(host,'Bullet Run')
   await guest.get_by_role('region',name='Bullet Run lobby',exact=True).wait_for()
   await guest.reload()
   await guest.get_by_role('region',name='Bullet Run lobby',exact=True).wait_for()
   for page in [host,guest]: await page.get_by_role('button',name='Ready up',exact=True).click()
   await host.get_by_role('button',name='Start match',exact=True).click()
   for page in [host,guest]: await page.get_by_label('Bullet Run arena',exact=True).wait_for()
   await host.get_by_role('button',name='Return everyone to room',exact=True).click()
   for page in [host,guest]: await page.get_by_text('0/2 pilots ready',exact=True).wait_for()
   await guest.get_by_role('button',name='Leave room',exact=True).click()
   await guest.locator('dialog[open]').wait_for(state='hidden')
   await host.get_by_text('0/1 pilots ready',exact=True).wait_for()
   for mode in ['Classic','Practice']:
    await choose(host,mode)
    assert code in await host.locator('.hangar-tabs > strong').inner_text()
    await host.get_by_role('button',name='Ready up',exact=True).click()
    await host.get_by_role('button',name='Start match',exact=True).click()
    await host.get_by_role('button',name='Return to lobby',exact=True).click()
    await host.get_by_text('0/1 pilots ready',exact=True).wait_for()
   await host.get_by_role('button',name='Leave room',exact=True).click()
   await host.locator('dialog[open]').wait_for(state='hidden')
   assert not errors,errors
   print('PASS same-code Bullet Run -> duel -> Bullet Run -> Classic -> Practice; two peers, reset, reload, live matches, centered selector, leave')
  except Exception:
   for name,page in [('host',host),('guest',guest)]:
    print(name,(await page.locator('body').inner_text()).encode('ascii','backslashreplace').decode()[-3500:])
   raise
  finally: await browser.close()
asyncio.run(main())
