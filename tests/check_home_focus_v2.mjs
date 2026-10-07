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

// Exercise the real controller: hiding a focused view blurs it; hidden controls cannot focus.
const controllerStart=source.indexOf('export function updateActiveView() {');
const controllerEnd=source.indexOf('// --- FILTROS NO ORB + BADGE ---',controllerStart);
const controllerSource=source.slice(controllerStart,controllerEnd).replace('export function','function');
for (const view of ['home','list']) for (const focusKind of ['metric','row','outside']) {
 let active;let generation=0;let metricFocuses=0;
 const body={};const classes=new Map();const nodes=new Map();
 const node=id=>{
  const hidden=new Set();classes.set(id,hidden);
  const n={id,dataset:{},style:{},textContent:'',classList:{add(...names){names.forEach(x=>hidden.add(x));if(id==='homeView'&&names.includes('hidden')&&nodes.get('homeView').contains(active))active=body},remove(...names){names.forEach(x=>hidden.delete(x))},contains:x=>hidden.has(x)},contains:n=>Boolean(n?.home),querySelectorAll:()=>[]};nodes.set(id,n);return n;
 };
 for(const id of ['homeView','kanbanView','listView','archivedView','userManagementView','main-content','current-view-label','orb-sort','orb-filter'])node(id);
 const homeNode=nodes.get('homeView');let currentMetric;
 const createMetric=()=>({home:true,generation:++generation,dataset:{filter:'homologation'},closest(){return this},focus(){assert.equal(classes.get('homeView').has('hidden'),false,'restore must happen after unhide');metricFocuses++;active=this}});
 currentMetric=createMetric();homeNode.querySelectorAll=()=>[currentMetric];
 active=focusKind==='metric'?currentMetric:focusKind==='row'?{home:true,closest:()=>null}:body;
 const context={state:{currentView:view},document:{get activeElement(){return active},getElementById:id=>nodes.get(id),querySelectorAll:()=>[]},renderHomeView(){currentMetric=createMetric()},updateFilterBadge(){},renderListView(){},renderKanbanView(){},renderArchivedTasks(){},renderUserManagementView(){},setTimeout:()=>{},requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(controllerSource,context);context.updateActiveView();
 assert.equal(metricFocuses,view==='home'&&focusKind==='metric'?1:0,JSON.stringify({view,focusKind}));
 if(view==='home'&&focusKind==='metric') {assert.equal(active,currentMetric);context.updateActiveView();assert.equal(metricFocuses,2);assert.equal(active,currentMetric);}
}
console.log('Passed six real view-controller scenarios plus repeated Home rerender; no focus stolen outside Home metrics.');
