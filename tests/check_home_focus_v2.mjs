import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const model=readFileSync(new URL('../app/js/home-v2.js',import.meta.url),'utf8');
const {restoreHomeTaskFocus}=await import('data:text/javascript;base64,'+Buffer.from(model).toString('base64'));
const row={dataset:{taskId:'FIX-1'},isConnected:true,focus(){this.focused=true}};
const metric={isConnected:true,focus(){this.focused=true}};
const home={querySelectorAll:()=>[row],querySelector:()=>metric};
assert.equal(restoreHomeTaskFocus(home,'FIX-1'),true);assert.equal(row.focused,true);
assert.equal(restoreHomeTaskFocus(home,'gone'),true);assert.equal(metric.focused,true);
assert.equal(restoreHomeTaskFocus(null,'gone'),false);
const source=readFileSync(new URL('../app/js/ui.js',import.meta.url),'utf8');
const start=source.indexOf('export function closeTaskHistory(taskId) {');const end=source.indexOf('// --- SETUP DO RICH TEXT EDITOR',start);
const closeSource=source.slice(start,end).replace('export function','function');
for(const animated of [false,true])for(const view of ['home','list'])for(const returnToNotifications of [false,true]){
 let focused=0;const events=[];const node=()=>({style:{},classList:{remove(...v){events.push(['remove',...v])},add(...v){events.push(['add',...v])}},getBoundingClientRect(){return{left:0,top:0,width:100,height:100}}});
 const content=node();const modal=node();modal.querySelector=()=>content;const notif=node();
 const context={state:{currentView:view,returnToNotifications},document:{getElementById:id=>id==='homeView'?home:id==='notificationsModal'?notif:modal},restoreHomeTaskFocus(){focused++},isAnimating:false,activeOriginRect:animated?{left:0,top:0,width:100,height:100}:null,activeOriginEl:null,setTimeout:fn=>fn(),requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(closeSource,context);context.closeTaskHistory('FIX-1');
 assert.equal(focused,view==='home'&&!returnToNotifications?1:0,JSON.stringify({animated,view,returnToNotifications}));
 assert.ok(events.some(e=>e[0]==='add'&&e.includes('hidden')));
}
console.log(JSON.stringify({status:'passed',checks:['Home row return','Selected-category fallback for removed row','Missing Home container is safe','Eight real close-handler scenarios: animated/immediate, Home/List, notification-return exclusions'],scope:'Isolated focus/control-flow mocks; live browser recheck required'},null,2));
