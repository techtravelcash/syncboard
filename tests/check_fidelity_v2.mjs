// TC-455 preview isolation/interaction fixtures. No browser, network, or real API.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const baselineRepo = process.env.SYNCBOARD_BASELINE_ROOT || '/workspace/shared/syncboard_ui_v2_fidelity';
const baseline = path => execFileSync('git', ['show', `20c48df793c91dd303abdfb0229701b64a905914:${path}`], {cwd: baselineRepo, encoding:'utf8'});
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const ui = read('app/js/ui.js'), oldUi = baseline('app/js/ui.js'), main = read('app/js/main.js');
const helper = read('app/js/fidelity-v2.js').replaceAll('export ', '');
class Element {
  constructor(id='') { this.id=id; this.dataset={}; this.attrs={}; this.style={}; this.listeners={}; this.children=[]; this.matchesCache={}; this._html=''; this.textContent=''; this.value=''; }
  get innerHTML(){return this._html;} set innerHTML(value){this._html=value; this.matchesCache={};}
  setAttribute(k,v){this.attrs[k]=v;} removeAttribute(k){delete this.attrs[k];}
  addEventListener(type, fn){(this.listeners[type]??=[]).push(fn);}
  dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn({target:this,...event});}
  click(){this.onclick?.({stopPropagation(){}});this.dispatchEvent({type:'click'});}
  contains(){return false;} focus(){this.focused=true;}
  querySelectorAll(){return [];}
  querySelector(selector){
    if(this.matchesCache[selector])return this.matchesCache[selector];
    const cls=selector.slice(1),match=this.innerHTML.match(new RegExp('<([a-z]+)([^>]*class="[^"]*\\b'+cls+'\\b[^>]*?)>'));
    if(!match)return null;
    const child=new Element();child.tagName=match[1].toUpperCase();this.matchesCache[selector]=child;return child;
  }
}
const calls=[], elements=new Map(); let fidelity=true;
const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
const state={tasks:[],users:[{name:'Ana',picture:'https://example.invalid/ana.png'}],selectedProject:'all',selectedResponsible:'all',searchQuery:'',currentView:'kanban'};
const sourceChips={project:['all','Projeto real'],responsible:['all','Ana']};
const navigation=['home','kanban','list','archived'].map(view=>{const node=new Element();node.dataset.fidelityView=view;node.dataset.view=view;return node;});
const document={body:{classList:{contains:()=>fidelity},dataset:{}},activeElement:null,createElement:()=>new Element(),getElementById:el,addEventListener(){},dispatchEvent:event=>calls.push(['event',event.type]),querySelectorAll:selector=>{
 const type=selector.match(/^#orb-(project|responsible)-filters/);if(type)return sourceChips[type[1]].map(value=>({dataset:{value},click(){calls.push(['existing-filter',type[1],value]);state[type[1]==='project'?'selectedProject':'selectedResponsible']=value;}}));
 if(selector==='[data-fidelity-view]'||selector==='#view-switcher-orb [data-view]')return navigation;
 return [];
},querySelector:selector=>{const view=selector.match(/data-view="([^"]+)"/);return view?{click(){calls.push(['existing-navigation',view[1]])}}:null;}};
const ctx={document,state,Date,Event,console,renderTaskHistory:id=>calls.push(['detail',id]),openProgressUpdateModal:task=>calls.push(['progress',task.id]),showDestructiveConfirmModal:(title,text,cb)=>calls.push(['delete-confirm',title,text,typeof cb])};
vm.createContext(ctx);vm.runInContext(helper+"\nObject.assign(globalThis,{fidelityFilterCount,resetFidelityFilters,hasFidelityFilters});",ctx);
const cardSource=s=>between(s,'export const createTaskElement =','// --- LOGICA DE FILTRO ---').replace('export const','const');
const dates=between(ui,'export const formatDate =','// --- EFEITO VISUAL').replaceAll('export const','const');
vm.runInContext(dates+'\n'+cardSource(ui)+'\nglobalThis.makeCard=createTaskElement;',ctx);
const originalCtx={...ctx,document};vm.createContext(originalCtx);vm.runInContext(dates+'\n'+cardSource(oldUi)+'\nglobalThis.makeCard=createTaskElement;',originalCtx);
const fixtures=[
 {id:'REAL-1',title:'Título real <seguro> & "válido"',status:'todo',project:'Projeto real',priority:'Média',responsible:['Ana']},
 {id:'REAL-2',title:'Parada',status:'stopped',project:'Outro',priority:'Alta',progress:0,responsible:[{name:'Ana'},'Bia','Célia','Davi'],dueDate:'2025-01-01',comments:[{},{}]},
 {id:'REAL-3',title:'Em curso',status:'inprogress',priority:'Baixa',progress:38,missingToComplete:'Pendência real'},
 {id:'REAL-4',title:'Validar',status:'homologation',priority:'Urgente',progress:100,homologador:{name:'Validador real'}},
 {id:'REAL-5',title:'Publicar',status:'publication',progress:100},
 {id:'REAL-6',title:'Arquivo',status:'done',project:'Projeto real',responsible:['Ana']}
];
state.tasks=structuredClone(fixtures);const before=JSON.stringify(state.tasks);
// The existing, unflagged page renders exactly the same cards as baseline20c.
fidelity=false;for(const task of fixtures)assert.equal(ctx.makeCard(task).innerHTML,originalCtx.makeCard(task).innerHTML);
fidelity=true;
for(const task of fixtures){const card=ctx.makeCard(task);assert.equal(card.dataset.taskId,task.id);assert.equal(card.dataset.status,task.status);assert(card.innerHTML.includes('fidelity-card-menu'));assert(!card.innerHTML.includes('class="sb-kanban-actions"'));assert(!card.innerHTML.includes('sb-kanban-pending'));assert(!card.innerHTML.includes('sb-kanban-people-copy'));for(const selector of ['.expand-btn','.progress-update-btn','.delete-task-btn']){const button=card.querySelector(selector);assert.equal(button.tagName,'BUTTON');button.listeners.click[0]({stopPropagation(){}});}assert.equal(Boolean(card.querySelector('.approve-btn')),task.status==='homologation');assert.equal(Boolean(card.querySelector('.publish-btn')),task.status==='publication');}
assert.equal(JSON.stringify(state.tasks),before);assert.equal(calls.filter(c=>c[0]==='detail').length,6);assert.equal(calls.filter(c=>c[0]==='progress').length,6);assert.equal(calls.filter(c=>c[0]==='delete-confirm').length,6);
assert.match(ctx.makeCard(fixtures[0]).innerHTML,/Não informado/);assert.doesNotMatch(ctx.makeCard(fixtures[0]).innerHTML,/>0%/);assert.match(ctx.makeCard(fixtures[1]).innerHTML,/>0%/);assert.match(ctx.makeCard(fixtures[0]).innerHTML,/&lt;seguro&gt;/);assert.match(ctx.makeCard(fixtures[1]).innerHTML,/Responsáveis: Ana, Bia, Célia, Davi/);
// Existing project/owner callbacks are the sole writers of their state.
ctx.initializeFidelityControls(state,{refresh:()=>calls.push(['refresh'])});
el('fidelity-project-filter').value='Projeto real';el('fidelity-project-filter').dispatchEvent({type:'change'});assert.equal(state.selectedProject,'Projeto real');
el('fidelity-responsible-filter').value='Ana';el('fidelity-responsible-filter').dispatchEvent({type:'change'});assert.equal(state.selectedResponsible,'Ana');
assert(calls.some(c=>c[0]==='existing-filter'&&c[1]==='project'));assert(calls.some(c=>c[0]==='existing-filter'&&c[1]==='responsible'));
// Exercise real original project/responsible/search predicates plus local filters.
vm.runInContext(between(ui,'function filterTasks(tasks)','// --- RENDERIZAÇÃO: HOME'),ctx);
assert.deepEqual(Array.from(ctx.filterTasks(state.tasks),t=>t.id),['REAL-1','REAL-6']);
state.selectedProject='all';state.selectedResponsible='all';
el('fidelity-priority-filter').value='Alta';el('fidelity-priority-filter').dispatchEvent({type:'change'});assert.equal(ctx.fidelityFilterCount(),1);assert.deepEqual(Array.from(ctx.filterTasks(state.tasks),t=>t.id),['REAL-2']);
el('fidelity-status-filter').value='stopped';el('fidelity-status-filter').dispatchEvent({type:'change'});assert.equal(ctx.fidelityFilterCount(),2);assert.deepEqual(Array.from(ctx.filterTasks(state.tasks),t=>t.id),['REAL-2']);
el('fidelity-status-filter').value='todo';el('fidelity-status-filter').dispatchEvent({type:'change'});assert.deepEqual(Array.from(ctx.filterTasks(state.tasks)),[]);
ctx.resetFidelityFilters();assert.equal(ctx.fidelityFilterCount(),0);state.searchQuery='válido';assert.deepEqual(Array.from(ctx.filterTasks(state.tasks),t=>t.id),['REAL-1']);state.searchQuery='';
ctx.syncFidelityShell(state,state.tasks.filter(t=>t.status!=='done'));assert.equal(el('fidelity-result-count').textContent,'5 tarefas encontradas');assert.equal(el('fidelity-nav-task-count').textContent,5);assert.match(el('fidelity-project-links').innerHTML,/Projeto real: 1 tarefas ativas carregadas/);assert(!el('fidelity-project-links').innerHTML.includes('Operações'));
assert.equal(el('fidelity-filter-drag-note').hidden,true);state.selectedProject='Projeto real';ctx.syncFidelityShell(state,[]);assert.equal(el('fidelity-filter-drag-note').hidden,false);state.currentView='list';ctx.syncFidelityShell(state,[]);assert.equal(el('fidelity-filter-drag-note').hidden,true);state.currentView='kanban';state.selectedProject='all';
ctx.finishFidelityView(state);assert.equal(el('current-view-label').textContent,'Quadro');assert(calls.some(c=>c[0]==='event'&&c[1]==='sb:fidelity-view-updated'));
// All five real empty lists are initialized and use their actual status identities.
const statuses=['todo','stopped','inprogress','homologation','publication'];
const lists=statuses.map(status=>({dataset:{columnId:status},children:[]}));let instances=[],writes=[],rendered=0;
document.querySelectorAll=selector=>selector==='.kanban-task-list'?lists:[];
ctx.kanbanSortableInstances=[];ctx.Sortable=function(list,options){this.destroy=()=>{};this.options=options;this.list=list;instances.push(this);};ctx.ui={renderKanbanView(){rendered++;}};ctx.api={updateTask(){writes.push('task')},updateOrder(){writes.push('order')}};
vm.runInContext(between(main,'function updateDragAndDropState() {','// Gerencia o modal de seleção do homologador'),ctx);
ctx.updateDragAndDropState();assert.equal(instances.length,5);assert.deepEqual(instances.map(i=>i.list.dataset.columnId),statuses);assert(instances.every(i=>i.list.children.length===0));assert(instances.every(i=>i.options.filter.includes('summary')));
// A concrete drag event into each initially empty lane preserves original payload/intercept behavior.
ctx.openHomologadorModal=(task,from,to)=>calls.push(['homologator',task.id,from,to]);
ctx.api={async updateTask(id,payload){writes.push(['task',id,JSON.parse(JSON.stringify(payload))]);},async updateOrder(payload){writes.push(['order',JSON.parse(JSON.stringify(payload))]);}};
for(const status of statuses){
  lists.forEach(list=>{list.children=[];list.parentElement={querySelector:()=>({textContent:'0'})};list.appendChild=item=>list.children.push(item);list.insertBefore=(item,anchor)=>list.children.splice(Math.max(0,list.children.indexOf(anchor)),0,item);});
  const oldStatus=status==='todo'?'inprogress':'todo', from=lists.find(list=>list.dataset.columnId===oldStatus), to=lists.find(list=>list.dataset.columnId===status);
  assert.equal(to.children.length,0,'Destination starts as a true empty drop area');
  const task={id:'DROP-'+status,status:oldStatus,progress:37};state.tasks=[task];
  const card={dataset:{taskId:task.id},classList:{remove(){}}};to.children=[card];writes=[];instances=[];ctx.updateDragAndDropState();
  await instances[0].options.onEnd({item:card,from,to,oldIndex:0,newIndex:0});
  if(status==='homologation'){assert.equal(writes.length,0);assert.equal(task.status,oldStatus);assert(calls.some(call=>call[0]==='homologator'&&call[1]===task.id));}
  else {assert.deepEqual(writes.find(call=>call[0]==='task'),['task',task.id,{status,oldStatus,...(status==='publication'?{progress:100}:{})}]);assert.deepEqual(writes.find(call=>call[0]==='order'),['order',[{id:task.id,order:0}]]);}
}
writes=[];
for(const key of ['selectedProject','selectedResponsible','searchQuery']){state[key]='active-filter';instances=[];ctx.updateDragAndDropState();assert.equal(instances.length,0,key);state[key]=key==='searchQuery'?'':'all';}
for(const type of ['priority','status']){el(`fidelity-${type}-filter`).value=type==='priority'?'Alta':'todo';el(`fidelity-${type}-filter`).dispatchEvent({type:'change'});instances=[];ctx.updateDragAndDropState();assert.equal(instances.length,0,type);ctx.resetFidelityFilters();}
instances=[];ctx.updateDragAndDropState();const racing=instances[0];state.searchQuery='changed-during-drag';await racing.options.onEnd({});assert.equal(writes.length,0);assert.equal(rendered,1);state.searchQuery='';
// Default page keeps original Sortable availability/options even if its old filters are active.
fidelity=false;state.selectedProject='Projeto real';instances=[];ctx.updateDragAndDropState();assert.equal(instances.length,5);assert.equal(instances[0].options.filter,undefined);
console.log(JSON.stringify({status:'passed',checks:['Baseline20c default-card byte parity','Preview compact card anatomy, IDs, escaped real data and absent-progress truth','Original details/progress/delete callbacks and exact status action visibility','Native project/responsible controls route existing callbacks','Priority/status/search intersection and empty results','Real active/project counts; no demo data','All five empty Sortable destinations preserve actual move payloads/homologation intercept','Every filter disables drag/order and mid-drag filtering prevents writes','Default Sortable options remain unchanged'],scope:'Controlled real-function DOM/API fixtures and source contracts. Browser geometry, pointer dragging, screenshot fidelity and server behavior remain unverified.'},null,2));
