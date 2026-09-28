"""Local UI regression checks; all multiplayer calls are replaced with fixtures."""
import asyncio
from playwright.async_api import async_playwright
MOCK='''
export const multiplayerConfigured=true;
const user={id:'11111111-1111-4111-8111-111111111111',identities:[],user_metadata:{}};
window.fixtureRoom={id:'room',code:'ABC123',host_id:'other',status:'open',phase:'lobby',match_id:null,match_roster:[],members:[{player_id:user.id,display_name:'Test Pilot',ready:false}]};
window.fixtureUnsub=0;window.fixtureHandlers={};
export async function lobbyPlayerId(){return user.id}
export async function lobbyAction(){return null}
export async function connection(){return {
auth:{getSession:async()=>({data:{session:{user}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
from(){return {select(){return {eq(){return {maybeSingle:async()=>({data:null})}}}}}},
rpc:async(name,args)=>{if(window.fixtureFail)throw new TypeError('Load failed');if(args.p_action==='ready'||args.p_action==='unready')window.fixtureRoom.members.find(m=>m.player_id===user.id).ready=args.p_action==='ready';
if(args.p_action==='launch'){window.fixtureLaunches=(window.fixtureLaunches||0)+1;if(window.fixtureRejectLaunch)return {data:null,error:{message:'Every pilot must be ready'}};window.fixtureRoom.phase='playing';window.fixtureRoom.match_id='round-'+window.fixtureLaunches;window.fixtureRoom.match_roster=window.fixtureRoom.members.map(m=>m.player_id);window.fixtureRoom.members.forEach(m=>m.ready=false);}
if(args.p_action==='return'){window.fixtureRoom.phase='lobby';window.fixtureRoom.match_id=null;window.fixtureRoom.match_roster=[];window.fixtureRoom.members.forEach(m=>m.ready=false);}
return {data:args.p_action==='leave'?null:structuredClone(window.fixtureRoom),error:null}},
channel(){return {on(type,filter,cb){window.fixtureHandlers[filter.event]=cb;return this},subscribe(cb){cb('SUBSCRIBED');return this},unsubscribe(){window.fixtureUnsub++;return Promise.resolve()},send(){return Promise.resolve()}}}
}}
'''
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(channel='msedge',headless=True)
        for width in [1440,390]:
            page=await browser.new_page(viewport={'width':width,'height':1000})
            page.set_default_navigation_timeout(120000)
            page.set_default_timeout(60000)
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            await page.route('**/src/lib/multiplayer.ts',lambda r:r.fulfill(content_type='application/javascript',body=MOCK))
            await page.goto('http://127.0.0.1:5198/alien-force-classic/')
            await page.locator('.desktop-play:visible, .mobile-play:visible').click()
            await page.get_by_role('heading',name='Classic Solo Room',exact=True).wait_for()
            assert await page.get_by_role('button',name='Start Classic',exact=True).is_disabled()
            await page.get_by_role('button',name='Ready up',exact=True).click()
            await page.get_by_role('button',name='Cancel ready',exact=True).click()
            assert await page.get_by_role('button',name='Start Classic',exact=True).is_disabled()
            await page.get_by_role('button',name='Close dialog',exact=True).click()
            await page.get_by_role('button',name='Create Room',exact=True).click()
            await page.get_by_role('button',name='Classic Solo survival',exact=False).click()
            assert await page.get_by_role('button',name='Start Classic',exact=True).is_disabled()
            await page.get_by_role('button',name='Ready up',exact=True).click()
            await page.get_by_role('link',name='Start Classic',exact=True).click()
            await page.locator('canvas').first.wait_for()
            await page.goto('http://127.0.0.1:5198/alien-force-classic/')
            await page.get_by_role('button',name='Create Room',exact=True).click()
            assert await page.get_by_role('button',name='Classic 2vE',exact=False).is_disabled()
            await page.get_by_role('button',name='Bullet Run Free for all',exact=False).click()
            await page.get_by_role('button',name='Create Bullet Run room').click()
            await page.locator('#bullet-link').wait_for()
            assert await page.get_by_role('button',name='Close dialog',exact=True).is_disabled()
            assert await page.get_by_role('button',name='Choose mode',exact=True).is_disabled()
            await page.evaluate("window.fixtureRoom.members=Array.from({length:24},(_,i)=>({player_id:i===0?'11111111-1111-4111-8111-111111111111':`pilot-${i}`,ready:false,display_name:i===23?'VeryLongPilotNameWithoutSpaces':'Pilot '+i}))")
            await page.wait_for_function("document.querySelectorAll('.bullet-pilot-lineup li').length===24")
            assert await page.locator('.bullet-pilot-lineup .is-you').count()==1
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            await page.get_by_role('button',name='Ready up',exact=True).click()
            await page.get_by_role('button',name='Cancel ready',exact=True).wait_for()
            assert await page.locator('.is-you').get_by_text('Ready',exact=True).count()==1
            await page.get_by_role('button',name='Cancel ready',exact=True).click()
            await page.get_by_role('button',name='Ready up',exact=True).wait_for()
            assert await page.get_by_role('button',name='Start match',exact=True).count()==0
            await page.evaluate('window.fixtureFail=true')
            await page.get_by_text('Room connection interrupted. Reconnecting…',exact=True).wait_for(timeout=12000)
            assert await page.locator('#bullet-link').count()==0
            assert await page.evaluate('window.fixtureUnsub')>0
            await page.evaluate('window.fixtureFail=false')
            await page.locator('#bullet-link').wait_for(timeout=12000)
            assert await page.get_by_role('alert').count()==0
            await page.evaluate("window.fixtureRoom.status='closed'")
            await page.get_by_text('The host closed this room.',exact=True).wait_for(timeout=12000)
            assert await page.locator('#bullet-link').count()==0
            assert await page.get_by_text('Waiting for the host to start...',exact=True).count()==0
            assert await page.get_by_role('button',name='Start match',exact=True).count()==0
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            await page.get_by_role('button',name='Leave room',exact=True).click()
            await page.get_by_role('button',name='Create Bullet Run room').wait_for()
            await page.evaluate("window.fixtureRoom={id:'host-room',code:'DEF456',host_id:'11111111-1111-4111-8111-111111111111',status:'open',phase:'lobby',match_id:null,match_roster:[],members:[{player_id:'11111111-1111-4111-8111-111111111111',display_name:'Host',ready:false},{player_id:'guest',display_name:'Guest',ready:false}]}")
            await page.get_by_role('button',name='Create Bullet Run room').click()
            assert await page.get_by_role('button',name='Start match',exact=True).is_disabled()
            await page.get_by_role('button',name='Ready up',exact=True).click()
            await page.get_by_role('button',name='Cancel ready',exact=True).wait_for()
            assert await page.get_by_role('button',name='Start match',exact=True).is_disabled()
            await page.evaluate('window.fixtureRoom.members[1].ready=true;window.fixtureRejectLaunch=true')
            await page.wait_for_function("!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Start match').disabled")
            await page.get_by_role('button',name='Start match',exact=True).click()
            await page.get_by_role('alert').get_by_text('Every pilot must be ready',exact=True).wait_for()
            assert await page.locator('canvas[aria-label="Bullet Run arena"]').count()==0
            await page.evaluate('window.fixtureRejectLaunch=false')
            await page.get_by_role('button',name='Start match',exact=True).click()
            await page.locator('canvas[aria-label="Bullet Run arena"]').wait_for()
            assert await page.evaluate('window.fixtureLaunches')==2
            await page.get_by_role('button',name='Return everyone to room',exact=True).click()
            await page.get_by_role('button',name='Ready up',exact=True).wait_for()
            assert await page.locator('canvas[aria-label="Bullet Run arena"]').count()==0
            assert await page.get_by_role('button',name='Start match',exact=True).is_disabled()
            assert await page.get_by_text('0/2 pilots ready',exact=True).count()==1
            await page.get_by_role('button',name='Leave room',exact=True).click()
            await page.evaluate("window.fixtureRoom={id:'late-room',code:'LATE12',host_id:'other',status:'open',phase:'playing',match_id:'new-round',match_roster:['other','guest'],members:[{player_id:'11111111-1111-4111-8111-111111111111',display_name:'Late pilot',ready:false}]}")
            await page.get_by_role('button',name='Create Bullet Run room').click()
            await page.get_by_text('Round in progress. You will join the next round.',exact=True).wait_for()
            await page.evaluate("window.fixtureHandlers.snapshot({payload:{hostId:'other',matchId:'new-round',state:{tick:1,pilots:[],bullets:[]}}})")
            assert await page.locator('canvas[aria-label="Bullet Run arena"]').count()==0
            assert await page.get_by_role('button',name='Ready up',exact=True).count()==0
            await page.evaluate("window.fixtureRoom.phase='lobby';window.fixtureRoom.match_id=null;window.fixtureRoom.match_roster=[]")
            await page.get_by_role('button',name='Ready up',exact=True).wait_for()
            await page.evaluate("window.fixtureHandlers.snapshot({payload:{hostId:'other',matchId:'new-round',state:{tick:2,pilots:[],bullets:[]}}})")
            assert await page.locator('canvas[aria-label="Bullet Run arena"]').count()==0
            await page.get_by_role('button',name='Leave room',exact=True).click()
            await page.get_by_role('button',name='Choose mode',exact=True).click()
            await page.get_by_role('button',name='Close dialog',exact=True).click()
            if width > 768:
                await page.locator('.desktop-mode-tile').filter(has_text='Bullet Run').click()
            else:
                await page.get_by_role('button',name='Show Bullet Run',exact=True).click()
            await page.locator('.desktop-play:visible, .mobile-play:visible').click()
            await page.get_by_role('heading',name='Bullet Run Room',exact=True).wait_for()
            await page.get_by_role('button',name='Create Bullet Run room').wait_for()
            await page.screenshot(path=f'room-integrated-{width}.png')
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert not errors,errors
            print(f'PASS {width}: shared entry, solo ready gate, future 2vE, 24-pilot roster, readiness toggle, guest restrictions, rejected/approved host launch, recovery and closure',flush=True)
            await page.close()
        await browser.close()
asyncio.run(main())
