// TC-449: exercise actual task and AI handlers with isolated DOM/API fixtures.
// This does not render CSS and never sends requests to production or AI services.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const main = read('../app/js/main.js');
const uiSource = read('../app/js/ui.js');
const homologationHelpers = await import('data:text/javascript;base64,' + Buffer.from(read('../app/js/homologation-v2.js')).toString('base64'));
const html = read('../app/index.html');
const slice = (s,a,b) => s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const normalize = value => JSON.parse(JSON.stringify(value));
const results = [];
function fixture() {
  const nodes = new Map(); const writes = []; const notices = []; const history = []; let selected = [];
  class Element {
    constructor(id='') {this.id=id;this.value='';this.textContent='';this._html='';this.disabled=false;this.checked=false;this.style={};this.attrs={};this.events={};this.classes=new Set(); this.classList={add:(...cs)=>cs.forEach(c=>this.classes.add(c)),remove:(...cs)=>cs.forEach(c=>this.classes.delete(c)),contains:c=>this.classes.has(c),toggle:c=>this.classes.has(c)?this.classes.delete(c):this.classes.add(c)};}
    set innerHTML(s){this._html=s; if(this.id==='progressUpdateModal'){
      for(const m of s.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){
        const el=new Element(m[2]); const v=m[0].match(/\bvalue="([^"]*)"/);if(v)el.value=v[1];
        if(m[1]==='textarea'){const t=s.slice(m.index+m[0].length);el.value=t.slice(0,t.indexOf('</textarea>'));}
        nodes.set(el.id,el);
      }
    }}
    get innerHTML(){return this._html;}
    addEventListener(type, fn){(this.events[type]??=[]).push(fn);}
    async fire(type,extra={}) {const e={target:this,preventDefault(){},stopPropagation(){},...extra}; for(const fn of this.events[type]||[])await fn(e);if(type==='click'&&this.onclick)await this.onclick(e);}
    setAttribute(key,value){this.attrs[key]=value;}
    querySelector(selector){if(this.id==='taskForm'&&selector==='button[type="submit"]')return nodes.get('fixture-submit');return null;}
    reset(){for(const id of ['taskTitle','taskDescription','taskProject','taskAzureLink','taskDueDate'])nodes.get(id).value='';nodes.get('taskProjectColor').value='#526D82';nodes.get('taskPriority').value='Média';}
    remove(){nodes.delete(this.id);if(this.id==='progressUpdateModal')for(const id of ['progressModalContent','progressInput','missingInput','missingTextContainer','cancelProgressBtn','saveProgressBtn'])nodes.delete(id);}
  }
  for(const m of html.matchAll(/\bid="([^"]+)"/g))nodes.set(m[1],new Element(m[1]));
  nodes.set('fixture-submit',new Element('fixture-submit'));nodes.get('fixture-submit').textContent='Salvar Tarefa';
  for(const id of ['taskModal','aiTitleModal','taskHistoryModal'])nodes.get(id).classList.add('hidden');
  const document={getElementById:id=>nodes.get(id)||null,createElement:()=>new Element(),body:{appendChild:n=>nodes.set(n.id,n)},querySelectorAll:selector=>selector==='#responsible-input-container > div span'?selected.map(name=>({textContent:name})):[]};
  const state={users:[{name:'Pessoa Á Fixture',email:'a@example.invalid'},{name:'Pessoa B Fixture',email:'b@example.invalid'}],tasks:[],editingTaskId:null,lastInteractedTaskId:null};
  let failSave=false;
  const api={createTask:async payload=>{if(failSave)throw Error('fixture failure');writes.push({method:'createTask',payload:normalize(payload)});},updateTask:async(id,payload)=>{if(failSave)throw Error('fixture failure');writes.push({method:'updateTask',id,payload:normalize(payload)});return {...state.tasks.find(task=>task.id===id),...normalize(payload),id};},improveTitle:async(title,instruction)=>({title:`Revisar: ${title}`}),uploadAttachment:()=>{throw Error('Upload outside fixture scope');},deleteAttachment:()=>{throw Error('Deletion outside fixture scope');}};
  const ui={updateActiveView(){},renderModalAttachments(){},setupResponsibleInput:users=>selected=users.map(u=>typeof u==='object'?u.name:u),setupProjectSuggestions(){},setupCustomColorPicker(){},renderTaskHistory:id=>history.push(id),showToast:(text,type)=>notices.push({text,type})};
  const context={...homologationHelpers,editingTaskSnapshot:null,editingFormSnapshot:null,document,state,api,ui,localFiles:[],filesToDelete:[],File:class{},window:{lucide:{createIcons(){}}},lucide:{createIcons(){}},console:{error(){}},requestAnimationFrame:fn=>fn(),setTimeout:fn=>{fn();return 0;},showToast:ui.showToast,updateActiveView(){},importFixtureApi:async()=>api};
  vm.createContext(context);
  const snippets = [
    slice(main,'function taskFormDraft(', '// One in-flight decision'),
    slice(main,"    const addTaskBtn = document.getElementById('addTaskBtn');","    document.getElementById('main-content').addEventListener"),
    slice(main,"    taskForm.addEventListener('submit'","    document.getElementById('closeHistoryBtn').addEventListener"),
    slice(main,"    document.getElementById('editTaskBtn').addEventListener","    // Evento para o botão de sinalização"),
    slice(main,"    const aiModal = document.getElementById('aiTitleModal');","    const notifBtn = document.getElementById('orb-notif-btn');"),
    uiSource.slice(uiSource.indexOf('export function openProgressUpdateModal(')).replace('export function','function').replace("await import('./api.js')",'await importFixtureApi()')
  ];
  vm.runInContext(snippets.join('\n'),context);
  return {nodes,state,writes,notices,history,context,api,select:names=>{selected=names},fail:()=>{failSave=true;}};
}
{
  const f=fixture(); const n=id=>f.nodes.get(id);
  await n('addTaskBtn').fire('click');assert.equal(n('taskModal').classList.contains('hidden'),false);assert.equal(n('status-container').classList.contains('hidden'),true);
  n('taskTitle').value='Título longo: ação e revisão';n('taskDescription').value='Descrição fixture\nSegunda linha';n('taskProject').value='Projeto novo';n('taskProjectColor').value='#EF4444';n('taskPriority').value='Alta';n('taskDueDate').value='';f.select(['Pessoa Á Fixture','Pessoa B Fixture']);
  await n('taskForm').fire('submit');assert.equal(f.writes.length,1);const p=f.writes[0].payload;
  assert.equal(p.status,'todo');assert.equal(p.dueDate,null);assert.equal(p.projectColor,'#EF4444');assert.equal(p.azureLink,'');assert.deepEqual(p.responsible,normalize(f.state.users));assert.equal(n('taskModal').classList.contains('hidden'),true);assert.equal(n('fixture-submit').disabled,false);
  results.push('Create fixture retains payload, two responsible people, project color, priority, empty deadline/link and closes after success');
}
{
  const f=fixture();const n=id=>f.nodes.get(id);const task={id:'FIX-1',title:'Editar',description:'Fixture',project:'Projeto',projectColor:'#14B8A6',priority:'Baixa',azureLink:'https://example.invalid/item',dueDate:null,status:'inprogress',responsible:f.state.users,attachments:[]};f.state.tasks=[task];f.state.lastInteractedTaskId=task.id;
  await n('editTaskBtn').fire('click');assert.equal(n('no-due-date-checkbox').checked,true);assert.equal(n('taskProjectColor').value,task.projectColor);assert.equal(n('taskStatus').value,'inprogress');assert.equal(n('taskHistoryModal').classList.contains('hidden'),true);
  n('taskTitle').value='Edição não salva';await n('cancelBtn').fire('click');assert.equal(f.writes.length,0);assert.deepEqual(f.history,['FIX-1']);assert.equal(f.state.editingTaskId,null);
  await n('editTaskBtn').fire('click');n('taskTitle').value='Edição aprovada na fixture';await n('taskForm').fire('submit');assert.equal(f.writes[0].method,'updateTask');assert.equal(f.writes[0].id,'FIX-1');assert.equal(f.writes[0].payload.status,'inprogress');
  results.push('Edit/cancel returns to detail without submit; edit/save preserves update target and existing status');
}
{
  const f=fixture();const n=id=>f.nodes.get(id);await n('addTaskBtn').fire('click');n('taskTitle').value='Preservar após erro';n('taskDescription').value='Fixture';f.fail();await n('taskForm').fire('submit');assert.equal(f.writes.length,0);assert.equal(n('taskModal').classList.contains('hidden'),false);assert.equal(n('fixture-submit').disabled,false);assert.equal(n('taskTitle').value,'Preservar após erro');assert.equal(f.notices.at(-1).type,'error');
  results.push('Isolated save failure leaves the existing form open and reenables save (not a realtime/draft-recovery guarantee)');
}
{
  const f=fixture();const n=id=>f.nodes.get(id);n('taskTitle').value='Título original';n('ai-instruction').value='Resumir';
  await n('openAiModalBtn').fire('click');await n('generateAiBtn').fire('click');assert.equal(n('taskTitle').value,'Título original');assert.equal(n('ai-result-text').value,'Revisar: Título original');assert.equal(n('applyAiBtn').classList.contains('hidden'),false);
  await n('cancelAiBtn').fire('click');assert.equal(n('taskTitle').value,'Título original');assert.equal(n('aiTitleModal').classList.contains('hidden'),true);
  await n('openAiModalBtn').fire('click');assert.equal(n('ai-result-container').classList.contains('hidden'),true);await n('generateAiBtn').fire('click');n('ai-result-text').value='Título revisado manualmente';await n('applyAiBtn').fire('click');assert.equal(n('taskTitle').value,'Título revisado manualmente');assert.equal(f.writes.length,0);
  for(let i=0;i<3;i++){await n('openAiModalBtn').fire('click');await n('closeAiModalBtn').fire('click');assert.equal(n('aiTitleModal').classList.contains('hidden'),true);}
  results.push('AI generate/review/cancel/apply and repeated open/close: only explicit Apply changes the form; nothing saves a task');
}
{
  const f=fixture();const n=id=>f.nodes.get(id);await n('addTaskBtn').fire('click');n('taskTitle').value='Sem data fixture';n('taskDescription').value='Fixture';n('taskDueDate').value='2027-01-15';n('no-due-date-checkbox').checked=true;
  await n('no-due-date-checkbox').fire('change');await n('taskForm').fire('submit');assert.equal(f.writes[0].payload.dueDate,'2027-01-15');
  results.push('Characterization only: legacy Sem data checkbox does not clear an entered deadline; functional acceptance remains blocked in PF-08/PF-09');
}
for(const progress of [0,99,100]){
  const f=fixture();const task={id:'FIX-P',progress,missingToComplete:''};f.context.openProgressUpdateModal(task);const initial=f.nodes.get('progressUpdateModal');assert.equal(initial.attrs.role,'dialog');assert.equal(initial.attrs['aria-modal'],undefined);f.context.openProgressUpdateModal(task);assert.equal(f.nodes.get('progressUpdateModal'),initial);
  const n=id=>f.nodes.get(id);n('progressInput').value=String(progress);await n('progressInput').fire('input');
  if(progress<100){await n('saveProgressBtn').fire('click');assert.equal(f.writes.length,0);assert.equal(f.notices.at(-1).type,'error');n('missingInput').value='Validar a fixture';}
  else {assert.equal(n('missingInput').disabled,true);assert.equal(n('missingInput').value,'Progresso informado: 100%');}
  await n('saveProgressBtn').fire('click');assert.deepEqual(f.writes[0],{method:'updateTask',id:'FIX-P',payload:{progress,missingToComplete:progress===100?'':'Validar a fixture'}});assert.equal(f.nodes.has('progressUpdateModal'),false);
  results.push(`Progress ${progress}: duplicate-open guard, existing missing-work validation and exact update payload`);
}
{
  const f=fixture();f.context.openProgressUpdateModal({id:'FIX-P',progress:99,missingToComplete:'Não enviado'});await f.nodes.get('cancelProgressBtn').fire('click');assert.equal(f.writes.length,0);assert.equal(f.nodes.has('progressUpdateModal'),false);results.push('Cancel progress removes the fixture dialog without an API write');
}
{
  const f=fixture();const task={id:'FIX-TRANSITION',progress:99,missingToComplete:'Validar a fixture'};f.context.openProgressUpdateModal(task);const n=id=>f.nodes.get(id);
  n('progressInput').value='100';await n('progressInput').fire('input');assert.equal(n('missingInput').value,'Progresso informado: 100%');assert.equal(n('missingInput').disabled,true);
  n('progressInput').value='99';await n('progressInput').fire('input');assert.equal(n('missingInput').value,'');assert.equal(n('missingInput').disabled,false);
  await n('saveProgressBtn').fire('click');assert.equal(f.writes.length,0);assert.equal(f.notices.at(-1).type,'error');n('missingInput').value='Revisar depois do retorno';await n('saveProgressBtn').fire('click');assert.deepEqual(f.writes[0].payload,{progress:99,missingToComplete:'Revisar depois do retorno'});
  results.push('Progress 99 → 100 → 99 keeps the same disabled/clear/validation transition using the neutral display literal; payload stays unchanged');
}
console.log(JSON.stringify({status:'passed',tests:results,known_unchanged_limits:['Sem data checkbox has no binding that clears/disables taskDueDate; only an empty date submits null (PF-08/PF-09).','Progress save mutates the local task before awaiting backend success, and has no in-flight click guard (PF-13/PF-58).','No end-to-end realtime, focus restoration, draft recovery, keyboard selector, physical keyboard or upload claims.'],scope:'Actual callback bodies with minimal DOM and fake APIs; no rendering, external network or production mutation.'},null,2));

// Actual detail population prefix: display fallbacks do not resolve new identities or change valid Calendar guests.
const detailPrefix=slice(uiSource,'export function renderTaskHistory(', '    // Controle de Visibilidade do Botão de Aprovação').replace('export ','')+'}\n';
const homeModule=await import('data:text/javascript;base64,'+Buffer.from(read('../app/js/home-v2.js')).toString('base64'));
for(const people of [[],['Pessoa Completa'],[{name:'Nome Completo',email:'person@example.invalid'}],[{email:'legacy@example.invalid'},null],[{name:'<Nome & "literal">',email:'safe@example.invalid'}]]) {
 const nodes=new Map();
 const element=()=>({style:{},children:[],classList:{add(){},remove(){}},innerHTML:'',textContent:'',setAttribute(){},append(...v){this.children.push(...v)},appendChild(v){this.children.push(v)}});
 for(const id of ['modal-task-id-display','modal-info-title','modal-info-project','modal-info-description','sidebar-responsibles-container','modal-info-homologador-container','modal-info-homologador','modal-calendar-btn'])nodes.set(id,element());
 const task={id:'FIX-NAMES',title:'Fixture',description:'Texto',responsible:structuredClone(people),homologador:{email:'validator@example.invalid'},status:'homologation'};const before=JSON.stringify(task);
 const context={state:{tasks:[task],users:[]},document:{getElementById:id=>nodes.get(id),createElement:element},hexToRgba:()=>'',escapeHomeText:homeModule.escapeHomeText,encodeURIComponent};
 vm.runInNewContext(detailPrefix,context);context.renderTaskHistory(task.id);
 assert.equal(JSON.stringify(task),before);assert(nodes.get('modal-info-homologador').innerHTML.includes('validator@example.invalid'));
 const copy=nodes.get('sidebar-responsibles-container').children.map(person=>person.children[1].textContent).join('|');
 if(people.length)assert(copy.includes(people[0]?.name||people[0]?.email||people[0]||'Nome não informado'));
 if(people.includes(null))assert(copy.includes('Nome não informado'));
 const guests=people.map(r=>typeof r==='object'?r?.email:'').filter(Boolean).join(',');assert(nodes.get('modal-calendar-btn').href.endsWith('&add='+guests));
 for(const person of nodes.get('sidebar-responsibles-container').children)assert(!person.children[0].innerHTML.includes('><</span>'));
}
console.log('Passed five actual detail-prefix fixtures: full/string/email-only/null/literal labels, unchanged supplied Calendar guests and no task mutation.');
