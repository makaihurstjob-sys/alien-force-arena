"""Test the real desktop/mobile menu against controlled profile responses."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
MOCK = '''
export const multiplayerConfigured=true;
window.profileWrites=[];
const user={id:'11111111-1111-4111-8111-111111111111',identities:[],user_metadata:{}};
const stored=()=>JSON.parse(localStorage.getItem('profile-fixture')||'null');
export async function connection(){return {
  auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},
    async getSession(){return {data:{session:localStorage.getItem('guest-fixture')?{user}:null}}},
    async signInAnonymously(){localStorage.setItem('guest-fixture','yes');return {data:{user}}}},
  from(){return {select(){return {eq(){return {async maybeSingle(){return {data:stored()}}}}}},
    async upsert(row){if(window.failSave)return {error:{message:'Test connection failure'}};
      window.profileWrites.push(row);localStorage.setItem('profile-fixture',JSON.stringify(row));return {error:null}}}}
}}
export async function lobbyAction(){return null;}
export async function lobbyPlayerId(){return user.id;}
'''

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(channel='msedge',headless=True)
        for width,height in [(1440,1000),(390,844)]:
            context=await browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
            page=await context.new_page()
            errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            await page.route('**/src/lib/multiplayer.ts',lambda route:route.fulfill(content_type='application/javascript',body=MOCK))
            await page.goto('http://127.0.0.1:5197/alien-force-classic/')
            await page.get_by_role('button',name='Player profile',exact=True).click()
            assert await page.locator('.player-profile-button svg.lucide-log-in').count()==1
            await page.get_by_role('button',name='Flag you represent No flag selected').click()
            assert await page.locator('.profile-flag-list button').count()==272
            await page.get_by_role('searchbox',name='Search flags').fill('United States')
            await page.get_by_role('button',name='United States of America',exact=True).click()
            await page.get_by_role('button',name='Save profile',exact=True).click()
            await page.get_by_text('Profile saved.',exact=True).wait_for()
            assert await page.evaluate("JSON.parse(localStorage.getItem('profile-fixture')).flag_code")=='us'
            # Selecting only a flag creates a named guest profile, without requiring Discord.
            assert (await page.get_by_role('textbox',name='Display name').input_value()).startswith('Pilot-')
            await page.get_by_role('button',name='Close profile').click()
            await page.reload()
            await page.get_by_role('button',name='Player profile',exact=True).click()
            await page.get_by_role('button',name='Flag you represent United States of America').wait_for()
            await page.get_by_role('textbox',name='Display name').fill('Flag Test Pilot')
            await page.get_by_role('button',name='Flag you represent United States of America').click()
            await page.get_by_role('searchbox',name='Search flags').fill('Wales')
            await page.get_by_role('button',name='Wales',exact=True).click()
            await page.evaluate('window.failSave=true')
            await page.get_by_role('button',name='Close profile').click()
            await page.get_by_text('Test connection failure',exact=True).wait_for()
            assert await page.locator('dialog[open]').count()==1
            await page.evaluate('window.failSave=false')
            await page.get_by_role('button',name='Save profile',exact=True).click()
            await page.get_by_text('Profile saved.',exact=True).wait_for()
            assert await page.evaluate("JSON.parse(localStorage.getItem('profile-fixture')).flag_code")=='gb-wls'
            assert await page.evaluate("JSON.parse(localStorage.getItem('profile-fixture')).display_name")=='Flag Test Pilot'
            await page.get_by_role('button',name='Flag you represent Wales').click()
            await page.get_by_role('searchbox',name='Search flags').fill('zzzzzz')
            await page.get_by_text('No matching flags.',exact=False).wait_for()
            await page.get_by_role('searchbox',name='Search flags').fill('')
            # Inspect flag image availability across the full catalog.
            await page.wait_for_function("Array.from(document.querySelectorAll('.profile-flag-list img')).every(img=>img.complete&&img.naturalWidth>0)")
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert await page.locator('.player-profile-dialog').evaluate('(el)=>el.scrollWidth<=el.clientWidth')
            out=ROOT/'profile-flags-check.local'
            out.mkdir(exist_ok=True)
            await page.screenshot(path=str(out/f'profile-{width}.png'))
            await page.get_by_role('button',name='No flag',exact=True).click()
            await page.get_by_role('button',name='Close profile').click()
            await page.locator('dialog[open]').wait_for(state='hidden')
            assert await page.evaluate("JSON.parse(localStorage.getItem('profile-fixture')).flag_code") is None
            assert not errors,errors
            print(f'PASS {width}px: sign-in icon, all 271 flags render, search, guest save, reload persistence, name+flag save, error recovery, flag removal, no overflow',flush=True)
            await context.close()
        await browser.close()

asyncio.run(main())
