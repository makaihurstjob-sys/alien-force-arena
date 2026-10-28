"""Main-menu Command Deck music: starts after the intro, pauses in place for lobbies and matches, resumes after."""
import asyncio, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path('C:/Users/macor/dashboard_files/conversation-a11aa5db2bb84b0ca911c6f23478d060')
ROOT=Path(__file__).resolve().parents[1]/'dist-pages'
BASE=__import__('sys').argv[1] if len(__import__('sys').argv)>1 else None
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  f=ROOT/path.split('?')[0].replace('/alien-force-classic/','/',1).lstrip('/')
  return str(f if f.is_file() else ROOT/'index.html')
 def log_message(self,*args): pass
# Records each started song (by length) with its AudioContext, so tests can read each station's state.
PROBE='''(() => {
 window.__music = { starts: [] };
 const C = window.AudioContext; if (!C) return;
 const start = AudioBufferSourceNode.prototype.start;
 AudioBufferSourceNode.prototype.start = function (...a) {
  window.__music.starts.push({ seconds: Math.round(this.buffer.duration * 10) / 10, loop: this.loop, ctx: this.context });
  return start.apply(this, a);
 };
 window.__song = (s) => window.__music.starts.filter(x => x.seconds === s);
})();'''
MENU=33.1
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 url=BASE or f'http://127.0.0.1:{server.server_port}/alien-force-classic/'
 tag='live-' if BASE else ''
 async with async_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=await getattr(p,engine).launch(**({'channel':'msedge','args':['--autoplay-policy=user-gesture-required']} if engine=='chromium' else {}))
   for w,h in [(1440,900),(390,844)]:
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<500)
    await ctx.add_init_script(PROBE)
    page=await ctx.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    await page.goto(url)
    await page.locator('.opening-skip').click()
    await page.locator('.opening-start').click()
    await page.locator('.arena-play-button').wait_for()
    if not await page.evaluate('!!window.AudioContext'):
     print('NOTE',engine,w,h,'no Web Audio in this test browser; menu UI only',flush=True)
     assert not errors,errors
     await ctx.close(); continue
    state=lambda s: page.evaluate(f'window.__song({s})[0] && window.__song({s})[0].ctx.state')
    await page.wait_for_function(f'window.__song({MENU}).length===1 && window.__song({MENU})[0].ctx.state==="running"',timeout=15000)
    assert await page.evaluate(f'window.__song({MENU})[0].loop'),'menu theme should loop'
    assert await page.evaluate('window.__music.starts[0].ctx.state')=='closed','intro music should stop'
    await page.screenshot(path=str(OUT/f'menu-music-{tag}{engine}-{w}x{h}.png'))
    # Opening a lobby hands off to the lobby radio; the menu pauses in place.
    await page.locator('.arena-play-button').click()
    chooser=page.locator('.hangar-selector[open]')
    await chooser.get_by_role('button').filter(has=page.get_by_text('Adventure',exact=True)).click()
    await page.locator('.hangar-lobby').wait_for()
    await page.wait_for_function('window.__song(35.6).length>=1 && window.__song(35.6)[0].ctx.state==="running"',timeout=15000)
    await page.wait_for_function(f'window.__song({MENU})[0].ctx.state==="suspended"',timeout=5000)
    # Muting in the lobby carries back to the menu.
    await page.locator('.hangar-music').click()
    assert await page.evaluate('localStorage.getItem("alien-force-music-muted")')=='true'
    await page.locator('.hangar-music').click()
    # A match keeps the menu theme paused.
    await page.locator('.hangar-plaque > button').first.click()
    await page.locator('.hangar-start:not([disabled])').click()
    await page.locator('.online-match-screen').wait_for()
    await page.wait_for_timeout(1200)
    assert await state(MENU)=='suspended'
    lobby=await page.evaluate('window.__song(35.6)[0].ctx.state')
    assert lobby=='closed',lobby
    print('ok',engine,w,h,'menu loop, intro handoff, lobby handoff, shared mute, paused during match',flush=True)
    await ctx.close()
    # Leaving a lobby resumes the same menu song instead of restarting it.
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<500)
    await ctx.add_init_script(PROBE)
    page=await ctx.new_page()
    await page.goto(url)
    await page.locator('.opening-skip').click(); await page.locator('.opening-start').click()
    await page.wait_for_function(f'window.__song({MENU}).length===1 && window.__song({MENU})[0].ctx.state==="running"',timeout=15000)
    await page.locator('.arena-play-button').click()
    await page.locator('.hangar-selector[open]').get_by_role('button').filter(has=page.get_by_text('Adventure',exact=True)).click()
    await page.locator('.hangar-lobby').wait_for()
    await page.wait_for_function(f'window.__song({MENU})[0].ctx.state==="suspended"',timeout=5000)
    await page.get_by_role('button',name='Leave room',exact=True).click()
    await page.locator('.arena-play-button').wait_for()
    await page.wait_for_function(f'window.__song({MENU})[0].ctx.state==="running"',timeout=5000)
    assert await page.evaluate(f'window.__song({MENU}).length')==1,'menu song should resume, not restart'
    assert not errors,errors
    print('ok',engine,w,h,'menu resumes in place after leaving lobby',flush=True)
    await ctx.close()
   await browser.close()
 server.shutdown()
asyncio.run(main())
