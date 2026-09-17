import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='msedge', headless=True)
        for touch in (False, True):
            context = await browser.new_context(viewport={'width':390 if touch else 1440,'height':844 if touch else 1000},has_touch=touch,is_mobile=touch)
            page = await context.new_page()
            page.set_default_timeout(10000)
            errors=[]
            page.on('pageerror',lambda error: errors.append(str(error)))
            await page.add_init_script('''window.drawn=[]; const original=CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
              if (x===210) window.drawn.push({text,font:this.font});
              return original.call(this,text,x,y,...rest);
            };''')
            await page.goto(os.environ.get('ALIEN_TEST_ORIGIN','http://127.0.0.1:5192/alien-force-classic/').rstrip('/') + '/classic')
            await page.wait_for_function("window.drawn.some(x=>x.text==='3')")
            await page.get_by_role('button',name='Game',exact=True).click()
            await page.wait_for_function("window.drawn.at(-1)?.text==='PAUSED'")
            paused_count = await page.evaluate("window.drawn.filter(x=>['3','2','1'].includes(x.text)).length")
            await page.wait_for_timeout(1200)
            assert await page.evaluate("window.drawn.filter(x=>['3','2','1'].includes(x.text)).length") == paused_count
            await page.get_by_role('button',name='Game',exact=True).click()
            await page.wait_for_function("window.drawn.some(x=>x.text==='1')",timeout=6000)
            await page.wait_for_timeout(1200)
            numbers=await page.evaluate("window.drawn.filter(x=>['3','2','1'].includes(x.text))")
            assert list(dict.fromkeys(x['text'] for x in numbers))==['3','2','1']
            assert all('Windows Bold' in x['font'] and '48px' in x['font'] for x in numbers)
            count=len(numbers)
            await page.wait_for_timeout(200)
            assert await page.evaluate("window.drawn.filter(x=>['3','2','1'].includes(x.text)).length")==count
            await page.get_by_role('button',name='Game',exact=True).click()
            await page.evaluate('window.drawn=[]')
            await page.get_by_role('button',name='New game',exact=True).click()
            await page.wait_for_function("window.drawn.some(x=>x.text==='3')")
            assert not errors, errors
            print('PASS: '+('mobile' if touch else 'desktop')+' countdown, Windows Bold, menu pause/resume and restart',flush=True)
            await context.close()
        await browser.close()

asyncio.run(main())
