"""Shared initial/lobby game chooser regression with mocked multiplayer."""
import asyncio, json, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path('C:/Users/macor/dashboard_files/conversation-a11aa5db2bb84b0ca911c6f23478d060')
ROOT=Path(__file__).resolve().parents[1]/'dist-pages'
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  f=ROOT/path.split('?')[0].replace('/alien-force-classic/','/',1).lstrip('/')
  return str(f if f.is_file() else ROOT/'index.html')
 def log_message(self,*args): pass
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 user={'id':'11111111-1111-4111-8111-111111111111','aud':'authenticated','role':'authenticated','email':'test@example.com','app_metadata':{'provider':'discord'},'user_metadata':{},'identities':[{'provider':'discord','id':'test'}]}
 async with async_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=await getattr(p,engine).launch(**({'channel':'msedge'} if engine=='chromium' else {}))
   for w,h in [(1440,900),(390,844),(320,568),(844,390)]:
    page=await browser.new_page(viewport={'width':w,'height':h},reduced_motion='reduce')
    room={'id':'22222222-2222-4222-8222-222222222222','code':'ABC123','host_id':user['id'],'status':'open','phase':'lobby','mode':'ranked','members':[{'player_id':user['id'],'display_name':'Test Pilot','ready':False}]}
    session={'access_token':'test-token','refresh_token':'test-refresh','expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
    await page.add_init_script('localStorage.setItem("alien-force-multiplayer",'+json.dumps(json.dumps(session))+');')
    async def api(route):
     url=route.request.url
     if '/rpc/game_lobby' in url:
      body=route.request.post_data_json or {}
      if body.get('p_action') in ['create','mode']: room['mode']=body['p_mode']
      data=room
     elif '/rpc/ranked_queue_' in url: data={'status':'idle'}
     elif '/rest/v1/ranked_players' in url: data={'rating':35,'peak':35,'wins':1,'losses':0,'draws':0}
     elif '/auth/v1/user' in url: data=user
     else: data=[]
     await route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
    await page.route('https://*.supabase.co/**',api)
    await page.goto(f'http://127.0.0.1:{server.server_port}/alien-force-classic/#player=menu')
    play=page.locator('.arena-play-button')
    await play.click()
    chooser=page.locator('.hangar-selector[open]')
    await chooser.wait_for()
    names=['Classic','Versus','Bullet Run','Practice','Ranked','Arcade']
    assert await chooser.locator('.hangar-game-cards strong').all_text_contents()==names
    assert 'Ranked Ratings' not in await chooser.inner_text()
    assert await chooser.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    await page.screenshot(path=str(OUT/f'chooser-initial-{engine}-{w}.png'))
    await page.keyboard.press('Escape')
    await chooser.wait_for(state='hidden')
    await page.wait_for_function("document.activeElement===document.querySelector('.arena-play-button')")
    await page.locator('.arena-selected-game').click()
    await page.get_by_role('button',name='Close game selector',exact=True).click()
    await page.locator('.arena-play-button').click()
    await chooser.get_by_role('button').filter(has=page.get_by_text('Ranked',exact=True)).click()
    await page.locator('.hangar-lobby').wait_for()
    await page.get_by_label('35 rating points',exact=True).wait_for()
    assert 'Ranked' in await page.locator('.hangar-game-selector').inner_text()
    await page.locator('.hangar-game-selector').click()
    chooser=page.locator('.hangar-selector[open]')
    assert await chooser.locator('.hangar-game-cards strong').all_text_contents()==names
    assert await chooser.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    await page.screenshot(path=str(OUT/f'chooser-lobby-{engine}-{w}.png'))
    await page.keyboard.press('Escape')
    await chooser.wait_for(state='hidden')
    await page.wait_for_function("document.activeElement===document.querySelector('.hangar-game-selector')")
    await page.locator('.hangar-game-selector').click()
    await chooser.get_by_role('button').filter(has=page.get_by_text('Arcade',exact=True)).click()
    await page.wait_for_function("document.querySelector('.hangar-game-selector')?.textContent.includes('Arcade')")
    room['members'].extend([{'player_id':f'guest{i}','display_name':f'Pilot {i}','ready':False} for i in range(2)])
    await page.wait_for_function("document.querySelectorAll('.hangar-slot:not(.is-empty)').length===3")
    await page.locator('.hangar-game-selector').click()
    assert await chooser.get_by_role('button').filter(has=page.get_by_text('Classic',exact=True)).is_disabled()
    await page.get_by_role('button',name='Close game selector',exact=True).click()
    room['host_id']='other'
    await page.wait_for_timeout(2200)
    await page.locator('.hangar-game-selector').click()
    assert await chooser.get_by_role('button').filter(has=page.get_by_text('Bullet Run',exact=True)).is_disabled()
    await page.keyboard.press('Escape')
    print(f'PASS {engine} {w}x{h}: shared cards, no Ratings, Play -> Ranked, lobby -> Arcade, Escape/focus, capacity/host restrictions',flush=True)
    await page.close()
   await browser.close()
asyncio.run(main())
