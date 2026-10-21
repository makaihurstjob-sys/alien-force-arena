"""Lobby radio checks: station order, saved Music toggle, shutdown on leave, and header layout."""
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
# Shortens each decoded track to 2 s (4 s per station slot) and records every scheduled song.
PROBE='''(() => {
 window.__radio = { starts: [] };
 const C = window.AudioContext; if (!C) return;
 const decode = C.prototype.decodeAudioData;
 C.prototype.decodeAudioData = function (data) {
  return decode.call(this, data).then((full) => {
   const short = this.createBuffer(1, Math.floor(full.sampleRate * 2), full.sampleRate);
   short.copyToChannel(full.getChannelData(0).subarray(0, short.length), 0);
   short.__track = Math.round(full.duration);
   return short;
  });
 };
 const start = AudioBufferSourceNode.prototype.start;
 AudioBufferSourceNode.prototype.start = function (when, ...rest) {
  if (this.buffer && this.buffer.__track) window.__radio.starts.push({ track: this.buffer.__track, when });
  window.__radio.ctx = this.context;
  return start.call(this, when, ...rest);
 };
})();'''
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 user={'id':'11111111-1111-4111-8111-111111111111','aud':'authenticated','role':'authenticated','email':'test@example.com','app_metadata':{'provider':'discord'},'user_metadata':{},'identities':[{'provider':'discord','id':'test'}]}
 async with async_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=await getattr(p,engine).launch(**({'channel':'msedge','args':['--autoplay-policy=no-user-gesture-required']} if engine=='chromium' else {}))
   for w,h in [(1920,1080),(1440,900),(1366,768),(1024,768),(768,1024),(844,390),(667,375),(390,844),(320,568)]:
    page=await browser.new_page(viewport={'width':w,'height':h},reduced_motion='reduce')
    room={'id':'22222222-2222-4222-8222-222222222222','code':'ABC123','host_id':user['id'],'status':'open','phase':'lobby','mode':'ranked','members':[{'player_id':user['id'],'display_name':'Test Pilot','ready':False}]}
    session={'access_token':'test-token','refresh_token':'test-refresh','expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
    await page.add_init_script('localStorage.setItem("alien-force-multiplayer",'+json.dumps(json.dumps(session))+');')
    await page.add_init_script(PROBE)
    async def api(route):
     url=route.request.url
     if '/rpc/game_lobby' in url: data=room
     elif '/rpc/ranked_queue_' in url: data={'status':'idle'}
     elif '/rest/v1/ranked_players' in url: data={'rating':35,'peak':35,'wins':1,'losses':0,'draws':0}
     elif '/auth/v1/user' in url: data=user
     else: data=[]
     await route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
    await page.route('https://*.supabase.co/**',api)
    await page.goto(f'http://127.0.0.1:{server.server_port}/alien-force-classic/#room=ABC123&mode=shared')
    await page.locator('.hangar-footer').wait_for()
    music=page.locator('.hangar-music')
    assert (await music.inner_text()).strip()=='Music on' and await music.get_attribute('aria-pressed')=='true'
    layout=await page.evaluate('''() => {
     const tabs=document.querySelector('.hangar-tabs'),m=document.querySelector('.hangar-music').getBoundingClientRect(),t=tabs.getBoundingClientRect();
     const dialog=document.querySelector('.is-hangar');
     const overlap=[...tabs.children].filter(e=>!e.classList.contains('hangar-music')).some(e=>{const r=e.getBoundingClientRect();return r.width&&r.left<m.right-1&&r.right>m.left+1&&r.top<m.bottom-1&&r.bottom>m.top+1;});
     return {inside:m.left>=t.left-1&&m.right<=t.right+1&&m.top>=t.top-1&&m.bottom<=t.bottom+1,overlap,overflow:dialog.scrollWidth-dialog.clientWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth};
    }''')
    assert layout['inside'] and not layout['overlap'] and layout['overflow']<=1 and layout['pageOverflow']<=1,(engine,w,h,layout)
    await page.screenshot(path=str(OUT/f'lobby-radio-{engine}-{w}x{h}.png'))
    audio=await page.evaluate('!!window.AudioContext')
    if audio and w==1440:
     await page.mouse.click(5,h-5)  # user gesture so the browser allows audio
     await page.wait_for_function('window.__radio.starts.length>=3',timeout=20000)
     starts=await page.evaluate('window.__radio.starts')
     tracks=[s['track'] for s in starts[:3]]
     assert tracks==[36,40,36],(engine,starts)                    # Hangar Standby -> Signal Lock -> Hangar Standby
     gaps=[round(starts[i+1]['when']-starts[i]['when'],2) for i in range(2)]
     assert all(abs(g-1.5)<0.05 for g in gaps),(engine,gaps)      # 2 plays x 2 s, minus the 2.5 s crossfade
     await music.click()
     assert (await music.inner_text()).strip()=='Music off' and await page.evaluate('localStorage.getItem("alien-force-music-muted")')=='true'
     await page.reload(); await page.locator('.hangar-footer').wait_for()
     assert (await page.locator('.hangar-music').inner_text()).strip()=='Music off'
     await page.locator('.hangar-music').click()
     assert await page.evaluate('localStorage.getItem("alien-force-music-muted")')=='false'
     await page.mouse.click(5,h-5)
     await page.wait_for_function('window.__radio.ctx && window.__radio.ctx.state==="running"',timeout=10000)
     await page.get_by_role('button',name='Leave room',exact=True).click()
     await page.wait_for_function("!document.querySelector('.hangar-lobby')",timeout=10000)
     await page.wait_for_timeout(900)
     state=await page.evaluate('window.__radio.ctx.state')
     assert state=='closed',(engine,state)
     print(f'PASS {engine} {w}x{h}: radio order {tracks}, gaps {gaps}, saved toggle, closes after leaving',flush=True)
    elif w==1440:
     print(f'NOTE {engine}: no Web Audio in this test browser; playback not checked',flush=True)
    print(f'PASS {engine} {w}x{h}: Music toggle fits header, no overflow',flush=True)
    await page.close()
   await browser.close()
asyncio.run(main())
