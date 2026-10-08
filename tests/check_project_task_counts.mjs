// TC477: real API/controller/render code, isolated from network and production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
let queries = 0, fail = false;
let rows = [{project:'SyncBoard NT',status:'todo',count:2},{project:'SyncBoard NT',status:'inprogress',count:4},{project:'SyncBoard NT',status:'done',count:44},{project:'Arquivo <&>',status:'done',count:3}];
const module = {exports:{}};
const CosmosClient = class { database(name){assert.equal(name,'TasksDB');return {container(name){assert.equal(name,'Tasks');return {items:{query(spec){queries++;assert.match(spec.query,/COUNT\(1\)/);assert.match(spec.query,/GROUP BY c.project, c.status/);assert.doesNotMatch(spec.query,/SELECT \*/);return {async fetchAll(){if(fail)throw Error('offline');return {resources:rows};}};}}};}};}};
vm.runInNewContext(read('api/getProjectTaskCounts/index.js'),{require:name=>{assert.equal(name,'@azure/cosmos');return {CosmosClient};},process:{env:{}},Buffer,module});
async function call(roles=['travelcash_user']){const log=()=>{};log.error=()=>{};const ctx={log};await module.exports(ctx,{headers:roles===null?{}:{'x-ms-client-principal':Buffer.from(JSON.stringify({userRoles:roles})).toString('base64')}});return plain(ctx.res);}
assert.equal((await call(null)).status,401);assert.equal((await call(['authenticated'])).status,403);assert.equal(queries,0);
assert.deepEqual((await call()).body,[{project:'SyncBoard NT',active:6,total:50},{project:'Arquivo <&>',active:0,total:3}]);
rows=[];assert.deepEqual((await call()).body,[]);fail=true;assert.equal((await call()).status,500);fail=false;

let requests=[],renders=0,focus;
const state={projectTaskCounts:[],projectTaskCountsStatus:'loading'};
const ctx={state,window:{addEventListener(name,fn){assert.equal(name,'focus');focus=fn;}},fetch(url,options){assert.equal(url,'/api/getProjectTaskCounts');assert.equal(options.cache,'no-store');return new Promise((resolve,reject)=>requests.push({resolve,reject}));}};
vm.createContext(ctx);vm.runInContext(read('app/js/project-task-counts.js').replace(/^import .*;\n/m,'').replaceAll('export ',''),ctx);
assert.equal(ctx.refreshProjectTaskCounts(),undefined);assert.equal(requests.length,0);
const response=body=>({ok:true,json:async()=>body});
const first=ctx.initializeProjectTaskCounts(()=>renders++);assert.equal(requests.length,1);
ctx.refreshProjectTaskCounts();ctx.refreshProjectTaskCounts();requests[0].resolve(response([{project:'stale',active:1,total:1}]));
await new Promise(setImmediate);assert.equal(requests.length,2);assert.deepEqual(state.projectTaskCounts,[]);
requests[1].resolve(response([{project:'SyncBoard NT',active:6,total:50}]));await first;
assert.equal(renders,1);assert.equal(state.projectTaskCountsStatus,'ready');assert.equal(state.projectTaskCounts[0].total,50);
// A refresh can arrive after the loop resolves but before its finally callback.
// Keep fetch/JSON Promises in the same realm to exercise that exact microtask gap.
const finalizationRace = await vm.runInNewContext(`(async () => {
  const state = {projectTaskCounts: [], projectTaskCountsStatus: 'loading'};
  const window = {addEventListener() {}};
  let calls = 0, renders = 0;
  const fetch = async () => {
    const count = ++calls;
    return {ok: true, json: async () => [{project: 'Finalization', active: count, total: count}]};
  };
  ${read('app/js/project-task-counts.js').replace(/^import .*;\n/m,'').replaceAll('export ','')}
  const first = initializeProjectTaskCounts(() => renders++);
  queueMicrotask(() => queueMicrotask(() => refreshProjectTaskCounts()));
  await first;
  return {calls, renders, dirty, pending, state};
})()`, {queueMicrotask});
assert.deepEqual(plain(finalizationRace), {calls:2, renders:1, dirty:false, pending:null, state:{projectTaskCounts:[{project:'Finalization',active:2,total:2}],projectTaskCountsStatus:'ready'}});
let pending=focus();requests.at(-1).reject(Error('offline'));await pending;assert.equal(state.projectTaskCountsStatus,'error');assert.equal(state.projectTaskCounts[0].total,50);
pending=focus();requests.at(-1).resolve(response([{project:'bad',active:8,total:2}]));await pending;assert.equal(state.projectTaskCountsStatus,'error');
// Authoritative refresh covers create, archive, restore, delete and project-name change.
for (const counts of [[7,51],[6,51],[7,51],[6,50],[0,50]]) {pending=ctx.refreshProjectTaskCounts();requests.at(-1).resolve(response([{project:'Renomeado',active:counts[0],total:counts[1]}]));await pending;assert.equal(state.projectTaskCountsStatus,'ready');assert.deepEqual(plain(state.projectTaskCounts),[{project:'Renomeado',active:counts[0],total:counts[1]}]);}

const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',contains:()=>false,querySelectorAll:()=>[]});return elements.get(id);};
const document={body:{classList:{contains:()=>true},dataset:{}},getElementById:element,querySelectorAll:()=>[],activeElement:null};
const renderCtx={document,taskUserFilterOptions:()=>[],Event};vm.createContext(renderCtx);vm.runInContext(read('app/js/fidelity-v2.js').replace(/^import .*;\n/m,'').replaceAll('export ',''),renderCtx);
const view={tasks:[{project:'SyncBoard NT',status:'todo'}],projectTaskCounts:[{project:'SyncBoard NT',active:6,total:50},{project:'Arquivo <&>',active:0,total:3}],projectTaskCountsStatus:'ready',currentView:'kanban',selectedProject:'all',selectedResponsible:'Someone',searchQuery:'unrelated'};
renderCtx.syncFidelityShell(view,[]);let html=element('fidelity-project-links').innerHTML;assert.match(html,/>6\/50</);assert.match(html,/>0\/3</);assert.match(html,/Arquivo &lt;&amp;&gt;/);assert.match(html,/incluindo arquivadas/);assert.match(element('fidelity-project-filter').innerHTML,/Arquivo/);
for(const status of ['error','loading']){renderCtx.syncFidelityShell({...view,projectTaskCountsStatus:status},[]);html=element('fidelity-project-links').innerHTML;assert.match(html,/>—\/—</);assert.doesNotMatch(html,/>6\/50</);assert.match(html,status==='error'?/indisponíveis/:/Carregando/);}
renderCtx.syncFidelityShell({...view,projectTaskCounts:[]},[]);assert.match(element('fidelity-project-links').innerHTML,/Nenhum projeto com tarefas/);
for(const name of ['createTask','updateTask','deleteTask','updateProjectColor']){const source=read('app/js/api.js');const start=source.indexOf(`export async function ${name}(`);const end=source.indexOf('export async function ',start+1);assert.match(source.slice(start,end<0?undefined:end),/refreshProjectTaskCounts\(\)/);}
for(const event of ['taskCreated','taskUpdated','taskDeleted'])assert.match(read('app/js/signalr.js'),new RegExp(`connection.on\\('${event}'[^]*?refreshProjectTaskCounts\\(\\)`));
assert.match(read('app/js/main.js'), /initializeProjectTaskCounts\(\(\) => \{ ui.populateProjectFilter\(\); syncFidelityProjectCounts\(state\); \}\)/);
assert.match(read('app/staticwebapp.config.json'),/"route": "\/\*"[^]*?"travelcash_user"/);
console.log('PASS TC477: aggregate API/auth/error; refresh deduplication, race invalidation/recovery and lifecycle counts; sidebar 6/50, archived-only, escaping, unfiltered totals and unknown states.');
