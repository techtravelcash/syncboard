import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const helpers=await import('data:text/javascript;base64,'+Buffer.from(read('app/js/homologation-v2.js')).toString('base64'));
const {canEditHomologationResponsible,canDecideHomologation,homologationEditPayload}=helpers;
const admin={userDetails:'admin@example.test',userRoles:['travelcash_user','admin']};
const reviewer={userDetails:'qa@example.test',userRoles:['travelcash_user']};
const task={id:'TC471',status:'homologation',_etag:'v1',title:'Title',description:'Description',progress:63,homologador:{email:reviewer.userDetails},responsible:[{name:'Old',email:'old@example.test'}],attachments:[],history:[{description:'Prior'}]};
const next={name:'Same Name',email:'next@example.test'};
assert.equal(canEditHomologationResponsible(task,admin),true);
for(const user of [null,reviewer,{...admin,userRoles:['admin']},{...admin,userRoles:['travelcash_user']},{...admin,userDetails:'Name'}])assert.equal(canEditHomologationResponsible(task,user),false);
for(const status of ['todo','stopped','inprogress','publication','done'])assert.equal(canEditHomologationResponsible({...task,status},admin),false);
assert.equal(canDecideHomologation(task,admin),false);assert.equal(canDecideHomologation(task,reviewer),true);
const draft={...task,responsible:[next]};
assert.deepEqual(homologationEditPayload(task,draft,admin),{expectedStatus:'homologation',expectedEtag:'v1',responsible:[{email:next.email}]});
assert.deepEqual(homologationEditPayload(task,draft,reviewer),{expectedStatus:'homologation',expectedEtag:'v1'});
for(const responsible of [[],[{email:'bad'}],[next,next]])assert.throws(()=>homologationEditPayload(task,{...draft,responsible},admin));
const defaults={...task,project:'',projectColor:'#526D82',priority:'Média',dueDate:null,azureLink:''};
assert.deepEqual(homologationEditPayload(task,{...defaults,responsible:[next]},admin,defaults),{expectedStatus:'homologation',expectedEtag:'v1',responsible:[{email:next.email}]},'UI defaults cannot overwrite absent/legacy persisted fields');
assert.deepEqual(homologationEditPayload(task,{...draft,title:'Changed',progress:100,status:'todo',homologador:null},admin),{expectedStatus:'homologation',expectedEtag:'v1',title:'Changed',responsible:[{email:next.email}]});
const main=read('app/js/main.js');
const draftSource=main.slice(main.indexOf('function taskFormDraft('),main.indexOf('// One in-flight decision'));
const submitSource=main.slice(main.indexOf("    taskForm.addEventListener('submit'"),main.indexOf("    document.getElementById('closeHistoryBtn')"));
function fixture({update,files=[],deletes=[]}={}) {
 const calls=[],timers=[],handlers={},nodes={};
 const state={editingTaskId:task.id,tasks:[structuredClone(task)],currentUser:structuredClone(admin),users:[next]};
 const classList={values:new Set(['show']),add(x){this.values.add(x);},remove(x){this.values.delete(x);},contains(x){return this.values.has(x);}};
 const taskModal={classList};
 const btn={disabled:false,textContent:'Salvar'};
 const values={taskTitle:'Title',taskDescription:'Description',taskProject:'',taskProjectColor:'#526D82',taskPriority:'Média',taskDueDate:'',taskAzureLink:'',taskStatus:'homologation'};
 for(const [key,value] of Object.entries(values))nodes[key]={value};
 nodes['responsible-input-container']={getResponsibles:()=>[next]};
 nodes.cancelBtn={addEventListener:(type,callback)=>handlers.cancel=callback};
 const context={state,editingTaskSnapshot:structuredClone(task),editingFormSnapshot:{...defaults},localFiles:files,filesToDelete:deletes,homologationEditPayload,document:{querySelectorAll:()=>[],getElementById:id=>nodes[id]},taskModal,taskForm:{querySelector:()=>btn,addEventListener:(type,callback)=>handlers.submit=callback},File:class File{},console:{error(){}},setTimeout:fn=>timers.push(fn),api:{updateTask:async(id,payload)=>{calls.push(['save',id,structuredClone(payload)]);if(update)return update(id,payload);return {...task,responsible:[next],_etag:'v2',history:[...task.history,{description:'Server audit'}]};},deleteAttachment:async blob=>calls.push(['delete',blob]),uploadAttachment:async file=>{calls.push(['upload']);return {name:'uploaded'};}},ui:{showToast:(...args)=>calls.push(['toast',...args]),updateActiveView:()=>calls.push(['view']),renderTaskHistory:id=>calls.push(['detail',id])}};
 vm.createContext(context);vm.runInContext(draftSource+submitSource,context);
 return {context,state,calls,btn,nodes,taskModal,submit:()=>handlers.submit({preventDefault(){}}),cancel:()=>handlers.cancel(),timers};
}
{
 const f=fixture();await f.submit();assert.deepEqual(f.calls[0],['save',task.id,{expectedStatus:'homologation',expectedEtag:'v1',responsible:[{email:next.email}]}]);assert.equal(f.state.tasks[0]._etag,'v2');assert.equal(f.state.tasks[0].status,'homologation');assert.equal(f.state.tasks[0].history.length,2);assert.equal(f.taskModal.classList.contains('show'),false);assert.equal(f.btn.disabled,false);
}
{
 const f=fixture();f.cancel();f.timers.forEach(fn=>fn());assert.equal(f.calls.some(c=>c[0]==='save'),false);assert.equal(f.state.tasks[0].responsible[0].email,'old@example.test');assert.equal(f.context.editingTaskSnapshot,null);
}
{
 const f=fixture({update:async()=>{throw Object.assign(Error('Conflict'),{status:409});},deletes:['keep-blob']});f.state.tasks[0]._etag='v2';await f.submit();assert.equal(f.calls[0][2].expectedEtag,'v1');assert.equal(f.calls.filter(c=>c[0]==='save').length,1);assert.equal(f.calls.some(c=>c[0]==='delete'),false);assert.equal(f.taskModal.classList.contains('show'),true);assert.equal(f.btn.disabled,false);assert.match(f.calls.find(c=>c[0]==='toast')[1],/Cancele e reabra/);
}
{
 let resolve;const f=fixture({update:()=>new Promise(r=>resolve=r)});const pending=f.submit();await f.submit();assert.equal(f.calls.filter(c=>c[0]==='save').length,1);f.state.editingTaskId='OTHER';f.context.editingTaskSnapshot={id:'OTHER'};resolve({...task,responsible:[next],_etag:'v2'});await pending;assert.equal(f.taskModal.classList.contains('show'),true);
}
{
 const f=fixture();f.context.localFiles=[new f.context.File()];let resolve;f.context.api.uploadAttachment=()=>new Promise(r=>resolve=r);const pending=f.submit();f.cancel();resolve({name:'uploaded'});await pending;assert.equal(f.calls.some(c=>c[0]==='save'),false);
}
{
 const f=fixture({deletes:['old-blob']});await f.submit();assert.ok(f.calls.findIndex(c=>c[0]==='delete')>f.calls.findIndex(c=>c[0]==='save'));
}
{
 const f=fixture();f.context.api.uploadAttachment=async()=>{throw Error('Upload failed');};f.context.localFiles=[new f.context.File()];await f.submit();assert.equal(f.calls.some(c=>c[0]==='save'),false);assert.equal(f.taskModal.classList.contains('show'),true);
}
{
 let resolve;const f=fixture({update:()=>new Promise(r=>resolve=r)});const pending=f.submit();
 const newer={...task,status:'publication',progress:100,_etag:'v3',history:[...task.history,{description:'Approved later'}]};
 f.state.tasks[0]=newer;resolve({...task,responsible:[next],_etag:'v2'});await pending;
 assert.equal(f.state.tasks[0],newer);assert.equal(f.state.tasks[0].status,'publication');assert.equal(f.state.tasks[0].history[1].description,'Approved later');
}
// Real edit event sets permission lock, captures starting ETag and rendered defaults.
const edit=main.slice(main.indexOf("    document.getElementById('editTaskBtn').addEventListener"),main.indexOf('    // Evento para o botão de sinalização'));
for(const user of [admin,reviewer]){
 const f=fixture();let click;f.context.state.currentUser=user;f.context.state.lastInteractedTaskId=task.id;f.nodes.editTaskBtn={addEventListener:(type,fn)=>click=fn};
 for(const id of ['taskHistoryModal','status-container'])f.nodes[id]={classList:{add(){},remove(){}}};
 f.nodes.modalTitle={};f.nodes['color-picker-button']={style:{}};f.nodes['no-due-date-checkbox']={};
 Object.assign(f.context.ui,{renderModalAttachments(){},setupResponsibleInput(){},setupProjectSuggestions(){},setupCustomColorPicker(){}});f.context.requestAnimationFrame=fn=>fn();f.context.canEditHomologationResponsible=canEditHomologationResponsible;
 vm.runInContext(edit,f.context);click();assert.equal(f.nodes['responsible-input-container'].inert,user===reviewer);assert.equal(f.nodes.taskStatus.disabled,true);assert.equal(f.context.editingTaskSnapshot._etag,'v1');assert.equal(f.context.editingFormSnapshot.projectColor,'#526D82');
}
console.log('PASS TC471 UI: admin-only editor, unchanged decision authority, email identity, partial diff without defaults reset, opening ETag, persisted server result, double submit, conflict stays open/no retry/no blob deletion, cancel and late/newer navigation, upload interruption. Isolated DOM/API mocks; live browser not run.');
