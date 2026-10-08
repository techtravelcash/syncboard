// TC473: real browser-controller callbacks in a small DOM/API fixture.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const helpers=await import('data:text/javascript;base64,'+Buffer.from(read('app/js/homologation-v2.js')).toString('base64'));
const {homologationCandidates,hasRegisteredHomologador,canRecoverHomologador,homologationAssignmentPayload}=helpers;
const users=[{name:'Same',email:'second@example.test'},{name:'Same',email:'FIRST@example.test'},{name:'Duplicate',email:' first@example.test '},{name:'No email'},{email:'bad'},{email:'admin@example.test',isAdmin:true}];
const admin={userDetails:'admin@example.test',userRoles:['travelcash_user','admin']};
const task={id:'TC473',status:'inprogress',_etag:'v1',progress:61,responsible:[{email:'worker@example.test'}]};
const orphan={...task,status:'homologation',homologador:{name:'Same'}};
assert.equal(homologationCandidates(users).length,3);
assert.equal(hasRegisteredHomologador(orphan,users),false);
assert.equal(hasRegisteredHomologador({...orphan,homologador:{email:'FIRST@example.test'}},users),true);
assert.equal(canRecoverHomologador(orphan,admin,users),true);
for(const current of [{...admin,userRoles:['travelcash_user']},{...admin,userDetails:'unknown@example.test'},null])assert.equal(canRecoverHomologador(orphan,current,users),false);
assert.equal(canRecoverHomologador(orphan,admin,users.map(u=>({...u,isAdmin:false}))),false);
assert.equal(canRecoverHomologador({...orphan,homologador:{email:'first@example.test'}},admin,users),false);
assert.equal(canRecoverHomologador({...orphan,homologador:{email:'deleted@example.test'}},admin,users),true);
assert.deepEqual(homologationAssignmentPayload(task,' FIRST@example.test ',users),{status:'homologation',homologador:{email:'first@example.test'},expectedStatus:'inprogress',expectedEtag:'v1'});
assert.deepEqual(homologationAssignmentPayload(orphan,'second@example.test',users,true),{homologationRecovery:true,homologador:{email:'second@example.test'},expectedStatus:'homologation',expectedEtag:'v1'});
for(const address of ['', 'bad', 'deleted@example.test', 'Same'])assert.throws(()=>homologationAssignmentPayload(task,address,users));
assert.throws(()=>homologationAssignmentPayload({...task,_etag:null},'first@example.test',users));
// Actual dialog: email options, one open dialog, cancel/Escape cleanup, no default assignment.
function dialogFixture(list=users,supported=true){
 let active=null;
 const node=()=>({handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(){}});
 const select={...node(),value:'',options:[{value:''}],appendChild(o){this.options.push(o);}};
 const buttons=[node(),node()],error=node(),form=node();
 const dialog={...node(),querySelector:s=>s==='select'?select:s==='form'?form:error,querySelectorAll:()=>buttons,remove(){active=null;},close(){this.handlers.close();},showModal:supported?()=>{}:undefined};
 const document={getElementById:()=>active,createElement:tag=>tag==='dialog'?dialog:node(),body:{appendChild:d=>active=d}};
 const context={document};vm.createContext(context);vm.runInContext(read('app/js/homologation-v2.js').replaceAll('export function','function'),context);
 return {show:()=>context.selectHomologador(list),select,buttons,error,dialog,submit:()=>form.handlers.submit({preventDefault(){}}),get active(){return active;}};
}
{
 const f=dialogFixture();const result=f.show();assert.equal(f.select.options.length,4);assert.ok(f.select.options.slice(1).every(o=>o.value===o.textContent));assert.equal(await f.show(),null);f.submit();assert.ok(f.active);f.buttons[0].handlers.click();assert.equal(await result,null);assert.equal(f.active,null);
 const again=f.show();f.select.value='second@example.test';f.submit();assert.equal(await again,'second@example.test');
}
{const f=dialogFixture();const p=f.show();f.dialog.close();assert.equal(await p,null);}
{const f=dialogFixture([{email:'bad'}]);const p=f.show();assert.equal(f.buttons[1].disabled,true);assert.match(f.error.textContent,/Nenhum homologador/);f.dialog.close();await p;}
assert.equal(await dialogFixture(users,false).show(),null);
const main=read('app/js/main.js');
const controller=main.slice(main.indexOf('// Entry and orphan recovery'),main.indexOf('\n}',main.indexOf('// Entry and orphan recovery'))+2);
function controllerFixture({selection='first@example.test',update,snapshot=task}={}){
 const calls=[];const state={tasks:[structuredClone(snapshot)],users,currentUser:admin};
 const context={...helpers,state,structuredClone,document:{getElementById:()=>null},selectHomologador:async()=>selection,updateDragAndDropState(){},ui:{updateActiveView(){},showToast:(...args)=>calls.push(['toast',...args])},api:{fetchUsers:async()=>users,updateTask:async(id,payload)=>{calls.push(['save',id,structuredClone(payload)]);return update?update(payload):{...snapshot,homologador:{email:payload.homologador.email},status:'homologation',_etag:'v2'};},fetchTasks:async()=>state.tasks}};
 vm.createContext(context);vm.runInContext(controller,context);
 return {state,calls,context,run:(recovery=false)=>context.openHomologadorModal(state.tasks[0],snapshot.status,'homologation',recovery)};
}
{const f=controllerFixture({selection:null});await f.run();assert.equal(f.calls.length,0);assert.equal(f.state.tasks[0].status,'inprogress');}
{const f=controllerFixture();await f.run();assert.deepEqual(f.calls[0][2],homologationAssignmentPayload(task,'first@example.test',users));assert.equal(f.state.tasks[0]._etag,'v2');assert.equal(f.state.tasks[0].progress,61);}
{const f=controllerFixture({snapshot:orphan});await f.run(true);assert.deepEqual(f.calls[0][2],homologationAssignmentPayload(orphan,'first@example.test',users,true));}
{const f=controllerFixture({snapshot:orphan});f.state.currentUser={...admin,userRoles:['travelcash_user']};await f.run(true);assert.equal(f.calls.length,0);}
for(const status of [400,403,409,500]){
 const f=controllerFixture({update:async()=>{throw Object.assign(Error('Failed'),{status});}});await f.run();assert.equal(f.calls.filter(c=>c[0]==='save').length,1);assert.equal(f.state.tasks[0].status,'inprogress');assert.equal(f.state.tasks[0].homologador,undefined);
}
{
 let resolve;const f=controllerFixture({update:()=>new Promise(r=>resolve=r)});const pending=f.run();await new Promise(setImmediate);await f.run();assert.equal(f.calls.filter(c=>c[0]==='save').length,1);assert.equal(f.state.tasks[0].status,'inprogress');
 const newer={...task,status:'publication',_etag:'v3'};f.state.tasks[0]=newer;resolve({...task,status:'homologation',homologador:{email:'first@example.test'},_etag:'v2'});await pending;assert.equal(f.state.tasks[0],newer);
}
// Editor asks before upload/write and keeps its opening snapshot for the transition.
const submit=main.slice(main.indexOf("    taskForm.addEventListener('submit'"),main.indexOf("    document.getElementById('cancelBtn').addEventListener"));
function editorFixture(selection){
 let callback;const calls=[];const snapshot=structuredClone(task),btn={disabled:false,textContent:'Salvar'};
 const state={editingTaskId:task.id,tasks:[structuredClone(task)],users};
 const context={...helpers,state,editingTaskSnapshot:snapshot,editingFormSnapshot:{},localFiles:[],filesToDelete:[],File:class File{},console:{error(){}},setTimeout:()=>{},taskForm:{querySelector:()=>btn,addEventListener:(_,fn)=>callback=fn},taskFormDraft:()=>({title:'Changed',status:'homologation'}),selectHomologador:async()=>selection,ui:{updateActiveView(){},showToast(){}},taskModal:{classList:{remove(){},add(){}}},api:{fetchUsers:async()=>users,updateTask:async(id,payload)=>{calls.push(payload);return {...task,...payload,_etag:'v2'};}}};
 vm.createContext(context);vm.runInContext(submit,context);
 return {context,calls,state,run:()=>callback({preventDefault(){}})};
}
{const f=editorFixture(null);await f.run();assert.equal(f.calls.length,0);assert.equal(f.state.tasks[0].status,'inprogress');}
{const f=editorFixture('second@example.test');await f.run();assert.equal(f.calls.length,1);assert.equal(f.calls[0].homologador.email,'second@example.test');assert.equal(f.calls[0].expectedStatus,'inprogress');assert.equal(f.calls[0].expectedEtag,'v1');assert.equal(f.calls[0].title,'Changed');}
console.log('PASS TC473 UI: registered email identity, orphan recovery authorization, native dialog cancel/repeat/empty options, guarded controller entry/recovery, no optimistic mutation, conflicts/no retry, double submit, SignalR race, editor transition and cancel. Mocked DOM/API; live browser QA remains.');
