// TC462: execute the shipped controller and API handler with isolated fixtures.
// No live API, Cosmos DB, Discord or production task writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const main=read('app/js/main.js');
const controller=main.slice(main.indexOf('const pendingHomologationDecisions'),main.indexOf('// --- PONTO DE ENTRADA ---'));
function fixture(update) {
 const calls=[], buttons=Array.from({length:4},()=>({dataset:{taskId:'T1'},disabled:false,setAttribute(){},removeAttribute(){}}));
 const state={tasks:[{id:'T1',status:'homologation',progress:63,homologador:{email:'qa@example.test'},history:[]}],lastInteractedTaskId:'T1'};
 let hidden=false, shown=true;
 const context={state,api:{updateTask:async(id,payload)=>{calls.push(['api',id,payload]);return update?update(id,payload):{...state.tasks[0],...payload,history:[{description:'server history'}]};}},document:{querySelectorAll:()=>buttons,getElementById:()=>({classList:{contains:name=>name==='hidden'?hidden:shown}})},ui:{showToast:(...a)=>calls.push(['toast',...a]),renderTaskHistory:id=>calls.push(['detail',id]),updateActiveView:()=>calls.push(['view'])}};
 vm.createContext(context);vm.runInContext(controller,context);
 return {state,calls,buttons,decide:context.decideHomologation,close(){hidden=true;shown=false;},closing(){shown=false;}};
}
for (const decision of ['approve','reject']) {
 const t=fixture();await t.decide('T1',decision);
 assert.deepEqual(JSON.parse(JSON.stringify(t.calls[0])),['api','T1',decision==='approve'?{status:'publication',progress:100}:{status:'inprogress',homologador:null}]);
 assert.equal(t.state.tasks[0].status,decision==='approve'?'publication':'inprogress');
 assert.equal(t.state.tasks[0].progress,decision==='approve'?100:63);
 assert.equal(t.state.tasks[0].history[0].description,'server history');
 assert.equal(t.calls.filter(c=>c[0]==='detail').length,1);
 await t.decide('T1',decision);assert.equal(t.calls.filter(c=>c[0]==='api').length,1);
 assert.ok(t.buttons.every(b=>!b.disabled));
}
for (const navigation of ['close','closing','other']) {
 let resolve;const t=fixture((id,p)=>new Promise(r=>{resolve=()=>r({...t.state.tasks[0],...p});}));
 const first=t.decide('T1','reject');assert.ok(t.buttons.every(b=>b.disabled));
 await t.decide('T1','approve');await t.decide('T1','reject');assert.equal(t.calls.length,1);
 if(navigation==='close')t.close();else if(navigation==='closing')t.closing();else t.state.lastInteractedTaskId='T2';
 resolve();await first;assert.equal(t.calls.filter(c=>c[0]==='detail').length,0);
 assert.ok(t.buttons.every(b=>!b.disabled));
}
let fail=true;const t=fixture(async(id,p)=>{if(fail)throw Error('offline');return {...t.state.tasks[0],...p};});
await t.decide('T1','reject');assert.equal(t.state.tasks[0].status,'homologation');assert.ok(t.buttons.every(b=>!b.disabled));assert.equal(t.calls.filter(c=>c[0]==='detail').length,0);
fail=false;await t.decide('T1','reject');assert.equal(t.state.tasks[0].status,'inprogress');
for(const status of ['todo','stopped','inprogress','publication','done']){const t=fixture();t.state.tasks[0].status=status;await t.decide('T1','reject');assert.equal(t.calls.length,0);}
const absent=fixture();await absent.decide('missing','reject');assert.equal(absent.calls.length,0);
// Real backend: existing history + SignalR + no new homologation notification on return.
let saved={id:'T1',status:'homologation',progress:63,homologador:{email:'qa@example.test'},history:[]};let writes=0,notifications=0;
const container={item:()=>({read:async()=>({resource:structuredClone(saved)}),replace:async task=>{writes++;saved=task;return {resource:task};}})};
const apiContext={module:{exports:{}},process:{env:{}},console,require(name){if(name==='@azure/cosmos')return {CosmosClient:class{database(){return {container(name){return name==='Tasks'?container:{items:{create:async()=>{notifications++;}}};}};}}};if(name==='axios')return {post:async()=>{throw Error('unexpected network');}};if(name==='crypto')return {randomUUID:()=> 'fixture'};throw Error(name);}};
vm.createContext(apiContext);vm.runInContext(read('api/updateTask/index.js'),apiContext);
const ctx={bindingData:{id:'T1'},bindings:{},log:Object.assign(()=>{},{error:()=>{}})};
await apiContext.module.exports(ctx,{body:{status:'inprogress',homologador:null}});
assert.equal(writes,1);assert.equal(saved.progress,63);assert.equal(saved.homologador,null);assert.equal(saved.history.length,1);assert.match(saved.history[0].description,/Andamento/);assert.equal(ctx.bindings.signalRMessage.arguments[0],saved);assert.equal(notifications,0);
// Same status request must not create duplicate history through the existing API.
await apiContext.module.exports(ctx,{body:{status:'inprogress',homologador:null}});assert.equal(saved.history.length,1);
for(const p of ['app/index.html','app/ui-v2-fidelity-preview.html','app/fragments/taskHistoryModal-fidelity-v2.html'])assert.equal((read(p).match(/id="modal-reject-btn"/g)||[]).length,1);
assert.match(main,/closest\('\.approve-btn, \.reject-btn'\)/);assert.match(main,/\['modal-reject-btn', 'reject'\]/);
assert.match(read('app/js/ui.js'),/class="reject-btn sb-kanban-action/);assert.match(read('app/js/ui.js'),/button.classList.toggle\('hidden', task.status !== 'homologation'\)/);
console.log('PASS TC462: approve/reject payloads, progress/history, shared in-flight guard, retry, stale status, close/navigation, API history and SignalR, notification suppression, card/detail wiring.');
