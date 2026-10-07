// TC462: shipped decision controller + permission helpers, isolated APIs only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const permissions = await import('data:text/javascript;base64,'+Buffer.from(read('app/js/homologation-v2.js')).toString('base64'));
const {canDecideHomologation,forwardCandidates}=permissions;
const reviewer={userDetails:'QA@example.test',userRoles:['authenticated','travelcash_user']};
const task={id:'T1',status:'homologation',_etag:'"v1"',progress:63,homologador:{email:'qa@example.test'},responsible:[{email:'old@example.test',name:'Old'}],history:[]};
assert.ok(canDecideHomologation(task,reviewer));
assert.ok(canDecideHomologation({...task,homologador:' QA@example.test '},reviewer));
for(const user of [null,{userDetails:'other@example.test',userRoles:['travelcash_user','admin']},{userDetails:'qa@example.test',userRoles:['admin']},{userDetails:'QA',userRoles:['travelcash_user']}])assert.equal(canDecideHomologation(task,user),false);
for(const homologador of [null,{},'QA',{name:'QA'}])assert.equal(canDecideHomologation({...task,homologador},reviewer),false);
assert.equal(canDecideHomologation({...task,status:'publication'},reviewer),false);
assert.ok(canDecideHomologation(task,{userDetails:'QA',userRoles:['travelcash_user'],claims:[{typ:'email',val:'qa@example.test'}]}));
assert.equal(canDecideHomologation(task,{userDetails:'other@example.test',userRoles:['travelcash_user'],claims:[{typ:'email',val:'qa@example.test'}]}),false);
const users=[{name:'Old',email:'old@example.test'},{name:'Self',email:'qa@example.test'},{name:'New',email:'new@example.test'},{name:'DEFINIR',email:''},{name:'Duplicate',email:'NEW@example.test'}];
assert.deepEqual(forwardCandidates(task,users).map(u=>u.email).sort(),['new@example.test','qa@example.test']);
const main=read('app/js/main.js');
const controller=main.slice(main.indexOf('const pendingHomologationDecisions'),main.indexOf('// --- PONTO DE ENTRADA ---'));
function fixture(update) {
 const calls=[],buttons=Array.from({length:6},()=>({dataset:{taskId:'T1'},disabled:false,setAttribute(){},removeAttribute(){}}));
 const state={tasks:[structuredClone(task)],currentUser:structuredClone(reviewer),users,lastInteractedTaskId:'T1',returnToNotifications:true};
 let hidden=false,shown=true;
 const ctx={canDecideHomologation,openForwardDialog:(task,users,submit)=>{calls.push(['forwardDialog']);ctx.submitForward=submit;return true;},showApprovalSuccess:()=>calls.push(['celebrate']),state,api:{updateTask:async(id,p)=>{calls.push(['api',id,p]);if(update)return update(id,p);const data=p.homologationAction==='approve'?{status:'publication',progress:100}:p.homologationAction==='reject'?{status:'inprogress',homologador:null}:{status:'todo',homologador:null,responsible:[{email:p.newResponsibleEmail}]};return {...state.tasks[0],...data,_etag:'"v2"',history:[{description:'server audit'}]};}},document:{querySelectorAll:()=>buttons,getElementById:()=>({classList:{contains:name=>name==='hidden'?hidden:shown}})},ui:{showToast:(...args)=>calls.push(['toast',...args]),renderTaskHistory:(...args)=>calls.push(['detail',...args]),updateActiveView:()=>calls.push(['view'])}};
 vm.createContext(ctx);vm.runInContext(controller,ctx);
 return {ctx,state,calls,buttons,decide:ctx.decideHomologation,start:ctx.startHomologationDecision,close(){hidden=true;shown=false;},closing(){shown=false;}};
}
for(const action of ['approve','reject','forward']) {
 const t=fixture();assert.equal(await t.decide('T1',action,'new@example.test'),true);
 const expected={homologationAction:action,expectedStatus:'homologation',expectedEtag:'"v1"',...(action==='forward'?{newResponsibleEmail:'new@example.test'}:{})};
 assert.deepEqual(JSON.parse(JSON.stringify(t.calls[0])),['api','T1',expected]);
 assert.equal(t.state.tasks[0].status,{approve:'publication',reject:'inprogress',forward:'todo'}[action]);
 assert.equal(t.state.tasks[0].progress,action==='approve'?100:63);
 assert.equal(t.calls.filter(c=>c[0]==='celebrate').length,action==='approve'?1:0);
 assert.deepEqual(t.calls.find(c=>c[0]==='detail'),['detail','T1',true]);
 assert.equal(t.state.tasks[0].history[0].description,'server audit');
 await t.decide('T1',action);assert.equal(t.calls.filter(c=>c[0]==='api').length,1);
}
for(const navigation of ['close','closing','other']) {
 let resolve;const t=fixture((id,p)=>new Promise(r=>{resolve=()=>r({...t.state.tasks[0],status:'inprogress'});}));
 const first=t.decide('T1','reject');assert.ok(t.buttons.every(b=>b.disabled));
 await t.decide('T1','approve');await t.decide('T1','forward','new@example.test');assert.equal(t.calls.filter(c=>c[0]==='api').length,1);
 if(navigation==='close')t.close();else if(navigation==='closing')t.closing();else t.state.lastInteractedTaskId='T2';
 resolve();await first;assert.equal(t.calls.filter(c=>c[0]==='detail').length,0);assert.ok(t.buttons.every(b=>b.disabled));
}
for(const action of ['approve','reject','forward']) {
 let fail=true;const t=fixture(async()=>{if(fail)throw Object.assign(Error('offline'),{status:409});return {...task,status:{approve:'publication',reject:'inprogress',forward:'todo'}[action]};});
 assert.equal(await t.decide('T1',action,'new@example.test'),false);assert.equal(t.state.tasks[0].status,'homologation');assert.ok(t.buttons.every(b=>!b.disabled));assert.equal(t.calls.filter(c=>c[0]==='celebrate').length,0);
 fail=false;assert.equal(await t.decide('T1',action,'new@example.test'),true);
}
for(const action of ['approve','reject','forward']){const t=fixture();t.state.currentUser.userDetails='other@example.test';await t.start('T1',action);assert.equal(t.calls.filter(c=>c[0]==='api'||c[0]==='forwardDialog').length,0);}
const forward=fixture();forward.start('T1','forward');assert.equal(forward.calls.filter(c=>c[0]==='api').length,0);await forward.ctx.submitForward('qa@example.test');assert.equal(forward.state.tasks[0].responsible[0].email,'qa@example.test');
const stale=fixture(async()=>{throw Object.assign(Error('conflict'),{status:409});});
stale.ctx.api.fetchTasks=async()=>[{...task,_etag:'"v2"',title:'Fresh'}];
assert.equal(await stale.decide('T1','reject'),false);
assert.equal(stale.state.tasks[0]._etag,'"v2"');
assert.equal(stale.calls.filter(c=>c[0]==='api').length,1,'Conflict refresh must not automatically retry write');
const unconfirmed=fixture(async()=>({...task}));await unconfirmed.decide('T1','approve');assert.equal(unconfirmed.calls.filter(c=>c[0]==='celebrate').length,0);
for(const path of ['app/index.html','app/ui-v2-fidelity-preview.html','app/fragments/taskHistoryModal-fidelity-v2.html'])for(const id of ['modal-approve-btn','modal-reject-btn','modal-forward-btn'])assert.equal((read(path).match(new RegExp('id="'+id+'"','g'))||[]).length,1);
const ui=read('app/js/ui.js');assert.match(ui,/if \(canDecideHomologation\(task, state.currentUser\)\)/);assert.match(ui,/signalBtn.hidden = task.status === 'homologation'/);assert.match(main,/if \(oldStatus === 'homologation' && newStatus !== oldStatus\)/);
console.log('PASS TC462 frontend: homologator-only/no-admin permission, exact decision contract/ETag, 3 destinations, preserved approval GIF, duplicate guards, errors/retry, stale navigation, forward/self and responsible replacement.');
