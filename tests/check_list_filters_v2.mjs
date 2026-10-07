/** Isolated UI-V2-05 contracts and fixtures. No network, DOM browser, or task mutations. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselineRoot=process.env.SYNCBOARD_BASELINE_ROOT || root;
const baseline='688358589d48ac498030c0f8afadff8b6d7a0773';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const before=p=>execFileSync('git',['show',`${baseline}:${p}`],{cwd:baselineRoot,encoding:'utf8'});
const original=before('app/js/ui.js'), current=read('app/js/ui.js');
const between=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
assert.equal(current.slice(0,current.indexOf('// --- RENDERIZAÇÃO: LISTA')),original.slice(0,original.indexOf('// --- RENDERIZAÇÃO: LISTA')),'Home, Kanban, attachments and imports preserved');
const filter=s=>between(s,'function filterTasks(tasks)', '// --- RENDERIZAÇÃO: HOME');
const comparator=s=>between(s,'    activeTasks.sort((a, b) => {','    // POPULAR O ORB');
assert.equal(filter(current),filter(original),'Filter predicates must be byte-identical');
assert.equal(comparator(current),comparator(original),'Sort comparator must be byte-identical');
assert.equal(between(current,'            actualBtn.onclick =','            orbOptions.appendChild'),between(original,'            actualBtn.onclick =','            orbOptions.appendChild'));
assert.equal(between(current,'    // --- EVENTOS ---\n\n    // Clique na linha','// --- RENDERIZAÇÃO: ARQUIVADOS'),between(original,'    // --- EVENTOS ---\n\n    // Clique na linha','// --- RENDERIZAÇÃO: ARQUIVADOS'));
assert.equal(current.slice(current.indexOf('// --- MODAL: DETALHES ---')),original.slice(original.indexOf('// --- MODAL: DETALHES ---')),'Task forms, commands and payloads unchanged');
assert.equal(between(current,'// --- RENDERIZAÇÃO: ARQUIVADOS ---','// --- ROTEADOR UI'),between(original,'// --- RENDERIZAÇÃO: ARQUIVADOS ---','// --- ROTEADOR UI'),'Archive and user renderers unchanged');
const protectedPaths=['app/js/api.js','app/js/main.js','app/js/state.js','app/js/signalr.js','app/css/custom.css','app/css/home-v2.css','app/css/kanban-v2.css','app/js/home-v2.js','app/staticwebapp.config.json','app/login.html',...execFileSync('git',['ls-tree','-r','--name-only',baseline,'api','.github','app/assets/brand-v2'],{cwd:baselineRoot,encoding:'utf8'}).trim().split('\n')];
for(const p of protectedPaths) assert.equal(read(p),before(p),`Protected file: ${p}`);
const fixtures=[
{id:'TC-1',title:'Ação longa & clara <exemplo>',project:'Operações',responsible:['José'],priority:'Urgente',status:'todo',createdAt:'2026-09-01T00:00:00Z',dueDate:'2026-10-01',progress:30,order:1},
{id:'TC-2',title:'ação longa & clara <exemplo>',project:'Operações',responsible:[{name:'José',email:'old@example.invalid'}],priority:'Baixa',status:'stopped',createdAt:'2026-09-01T00:00:00Z',dueDate:null,order:1},
{id:'TC-3',title:'Sem projeto e dono histórico',project:'',responsible:['Antigo Nome'],priority:'Média',status:'inprogress',createdAt:'2026-08-01T00:00:00Z',dueDate:'2026-09-10',progress:60,order:5},
{id:'TC-4',title:'Equipe projeto diferente',project:'Produto',responsible:[{name:'Ana'}],priority:'Alta',status:'homologation',createdAt:'2026-09-03T00:00:00Z',dueDate:'2026-09-10',progress:99,homologador:{name:'Felipe Nome Completo'},order:2},
{id:'TC-5',title:'Concluída',project:'Produto',responsible:['Ana','José'],status:'done',createdAt:'2026-09-05T00:00:00Z',progress:100,order:3},
{id:'TC-6',title:'Título de tarefa muito longo '.repeat(12),project:'Projeto com nome muito longo '.repeat(8),responsible:['Pessoa com nome muito extenso '.repeat(10)],priority:'Alta',status:'publication',createdAt:'2026-09-03T00:00:00Z',dueDate:null,progress:100,order:2}
];
function ordered(s,state){const ctx={state,document:{getElementById:()=>({})}};vm.createContext(ctx);const prefix=between(s,'export function renderListView()', '    // POPULAR O ORB').replace('export ','');return vm.runInContext(filter(s)+prefix+' return activeTasks.map(t => t.id); }\nrenderListView()',ctx);}
let combinations=0;
for(const selectedProject of ['all','Operações',' OPERAÇÕES ','Produto','Inexistente'])
for(const selectedResponsible of ['all','José',' JOSÉ ','Ana','Antigo Nome'])
for(const searchQuery of ['','ação','acao','tc-1','tarefa','<exemplo>'])
for(const sortBy of ['createdAt','dueDate','title','status','order'])
for(const sortDirection of ['asc','desc']){
const state={tasks:structuredClone(fixtures),selectedProject,selectedResponsible,searchQuery,sortBy,sortDirection};
assert.equal(JSON.stringify(ordered(current,state)),JSON.stringify(ordered(original,state)));assert.deepEqual(state.tasks,fixtures);combinations++;
}
// Small instrumented element fixture: executes renderer callbacks without a browser or API.
class Element {
 constructor(id=''){this.id=id;this.children=[];this.dataset={};this.style={};this.listeners={};this.className='';this.textContent='';this._html='';this.disabled=false;}
 get classList(){return {contains:x=>this.className.split(' ').includes(x),add:(...v)=>{this.className+=' '+v.join(' ')},remove:(...v)=>{this.className=this.className.split(' ').filter(x=>!v.includes(x)).join(' ')}};}
 set innerHTML(v){this._html=v;this.children=[];this.rows=[];this.buttons=[];if(this.id==='listView'){
 for(const m of v.matchAll(/<(?:article|div) class="[^\"]*\blist-row\b[^\"]*"[^>]*data-task-id="([^"]+)"/g)){const e=new Element();e.dataset.taskId=m[1];this.rows.push(e);}
 for(const m of v.matchAll(/<button[^>]*class="delete-list-btn[^\"]*"[^>]*data-task-id="([^"]+)"/g)){const e=new Element();e.dataset.taskId=m[1];this.buttons.push(e);}
 }}
 get innerHTML(){return this._html;}
 appendChild(x){this.children.push(x);return x;}
 querySelector(q){if(q==='.radial-content'){if(!this.actual){this.actual=new Element();this.actual.dataset.sort=this._html.match(/data-sort="([^"]+)"/)?.[1];this.actual.dataset.label=this._html.match(/data-label="([^"]+)"/)?.[1];this.actual.className=this._html.match(/class="(radial-content[^"]*)"/)?.[1];}return this.actual;}return null;}
 querySelectorAll(q){return q==='.list-row'?this.rows||[]:q==='.delete-list-btn'?this.buttons||[]:[];}
 addEventListener(t,f){(this.listeners[t]??=[]).push(f);}
 click(){this.onclick?.({stopPropagation(){}});for(const f of this.listeners.click||[])f({stopPropagation(){},target:{closest:()=>false}});}
 dispatchEvent(e){for(const f of this.listeners[e.type]||[])f({target:this});}
 focus(){this.focused=true;}
}
const ids=['listView','orb-sort-options','orb-filter','orb-project-filters','orb-responsible-filters','selected-sort-label','selected-project-label','selected-responsible-label','task-filter-count','clear-task-filters','search-input'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
const state={tasks:structuredClone(fixtures),selectedProject:'all',selectedResponsible:'all',searchQuery:'',sortBy:'createdAt',sortDirection:'desc'};
const calls=[];const context={state,Number,Event,document:{getElementById:id=>elements[id]||null,createElement:()=>new Element(),querySelector:q=>elements[q.split(' ')[0].slice(1)]?.children[0]},lucide:{createIcons(){}},formatDate:v=>v?new Date(v).toISOString().slice(0,10):'',highlightTask:(...a)=>calls.push(['highlight',...a]),renderTaskHistory:id=>calls.push(['detail',id]),showDestructiveConfirmModal:(...a)=>calls.push(['confirm',a[0],a[1]]),showToast(){},updateActiveView:()=>context.updateFilterBadge()};
vm.createContext(context);
const renderer=between(current,'function escapeListV2Text', '// --- RENDERIZAÇÃO: ARQUIVADOS');
const filters=between(current,'function updateFilterBadge()', '// --- MODAL: DETALHES ---');
vm.runInContext((filter(current)+renderer+filters).replaceAll('export function','function'),context);
elements['search-input'].addEventListener('input',e=>{state.searchQuery=e.target.value.toLowerCase();context.updateActiveView();});
context.renderListView();
assert.equal(elements.listView.rows.length,5);assert(!elements.listView.innerHTML.includes('data-task-id="TC-5"'));
for(const text of ['Prioridade','Urgente','Progresso','30%','Sem prazo','Responsáveis:','Antigo Nome','Felipe Nome Completo','Não informado','Prazo','Criação','&lt;exemplo&gt;']) assert(elements.listView.innerHTML.includes(text),text);
assert(!elements.listView.innerHTML.includes('truncate'));assert(!elements.listView.innerHTML.includes('hidden md:'));
const row=elements.listView.rows[0];row.listeners.click[0]({target:{closest:()=>false}});assert.deepEqual(calls,[['highlight',row.dataset.taskId,false],['detail',row.dataset.taskId]]);calls.length=0;
for(const closest of ['button','a'])row.listeners.click[0]({target:{closest:()=>closest}});assert.equal(calls.length,0);
elements.listView.buttons[0].click();assert.equal(calls.length,1);assert.equal(calls[0][0],'confirm');calls.length=0;
const sortButton=key=>elements['orb-sort-options'].children.map(x=>x.querySelector('.radial-content')).find(x=>x.dataset.sort===key);
sortButton('title').click();assert.equal(state.sortBy,'title');assert.equal(state.sortDirection,'asc');sortButton('title').click();assert.equal(state.sortDirection,'desc');assert(elements['selected-sort-label'].textContent.includes('decrescente'));sortButton('dueDate').click();assert.equal(state.sortDirection,'desc');
state.selectedProject='Operações';state.selectedResponsible='José';state.searchQuery='ação';context.populateProjectFilter();context.populateResponsibleFilter();context.updateFilterBadge();
assert.equal(elements['task-filter-count'].textContent,'3 filtros ativos');assert.equal(elements['selected-project-label'].textContent,'Operações');
assert(elements['orb-project-filters'].children.find(x=>x.dataset.value==='Operações').classList.contains('active'));
const historical='Responsável histórico fora dos dados';state.selectedResponsible=historical;context.populateResponsibleFilter();assert(elements['orb-responsible-filters'].children.find(x=>x.dataset.value===historical).classList.contains('active'));
elements['clear-task-filters'].click();assert.equal(state.selectedProject,'all');assert.equal(state.selectedResponsible,'all');assert.equal(state.searchQuery,'');assert(elements['clear-task-filters'].disabled);assert(elements['search-input'].focused);
state.tasks=[{...structuredClone(fixtures[0]),progress:150,projectColor:'rgb(12, 34, 56)'}];context.renderListView();assert(elements.listView.innerHTML.includes('150% (fora da faixa)'));assert(elements.listView.innerHTML.includes('max="100" value="100"'));assert(elements.listView.innerHTML.includes('data-project-color="rgb(12, 34, 56)"'));assert.equal(state.tasks[0].progress,150);
state.tasks=[{...structuredClone(fixtures[0]),responsible:[{email:'legacy@example.invalid'},null],homologador:{email:'validator@example.invalid'},status:'homologation'}];context.renderListView();assert(elements.listView.innerHTML.includes('legacy@example.invalid'));assert(elements.listView.innerHTML.includes('Nome não informado'));assert(elements.listView.innerHTML.includes('validator@example.invalid'));
state.tasks=[{...structuredClone(fixtures[0]),progress:-5}];context.renderListView();assert(elements.listView.innerHTML.includes('-5% (fora da faixa)'));assert(elements.listView.innerHTML.includes('max="100" value="0"'));state.tasks=structuredClone(fixtures);
state.searchQuery='inexistente';context.renderListView();assert(elements.listView.innerHTML.includes('Nenhuma tarefa corresponde aos filtros'));
state.tasks=[];context.renderListView();assert(elements.listView.innerHTML.includes('Nenhuma tarefa ativa'));state.tasks=[fixtures[4]];context.renderListView();assert(elements.listView.innerHTML.includes('Nenhuma tarefa ativa'));
// Exercise the real view switch/update function with read-only view stubs.
for (const id of ['homeView','kanbanView','archivedView','userManagementView','main-content','current-view-label','orb-sort']) elements[id]=new Element(id);
context.document.querySelectorAll=()=>[];
context.renderKanbanView=()=>{context.kanbanRefreshes=(context.kanbanRefreshes||0)+1;};
context.renderHomeView=()=>{};context.renderArchivedTasks=()=>{};context.renderUserManagementView=()=>{};
context.setTimeout=fn=>fn();
vm.runInContext(between(current,'export function updateActiveView()', '// --- FILTROS NO ORB').replace('export ',''),context);
state.tasks=structuredClone(fixtures);state.selectedProject='Operações';state.selectedResponsible='José';state.searchQuery='ação';state.sortBy='title';state.sortDirection='asc';state.currentView='list';elements['search-input'].value='ação';
context.updateActiveView();const originalListIds=elements.listView.rows.map(x=>x.dataset.taskId);
state.currentView='kanban';context.updateActiveView();assert.equal(context.kanbanRefreshes,1);assert(elements.listView.classList.contains('hidden'));
state.currentView='list';context.updateActiveView();assert.deepEqual(elements.listView.rows.map(x=>x.dataset.taskId),originalListIds);assert.equal(elements['search-input'].value,'ação');
state.tasks.push({...structuredClone(fixtures[0]),id:'TC-7',title:'Ação recebida durante busca'});context.updateActiveView();
assert(elements.listView.rows.some(x=>x.dataset.taskId==='TC-7'));assert.equal(state.searchQuery,'ação');assert.equal(state.selectedProject,'Operações');assert.equal(state.selectedResponsible,'José');assert.equal(state.sortDirection,'asc');assert.equal(elements['task-filter-count'].textContent,'3 filtros ativos');
console.log(JSON.stringify({status:'passed',baseline,ordered_id_comparisons:combinations,protected_files:protectedPaths.length,fixtures:['accent and ID search parity','combined project/responsible/search','all existing sort keys and directions including ties','selection re-render and historical identity preservation','existing sort toggle callbacks','clear through existing callbacks','row versus button/link separation','delete opens existing confirmation only','empty collection versus empty filtered result','long values and escaped task text','read-only priority/deadline/progress','real view switch preserves combined query and result order','data arrival rerender preserves active search and selected identities'],not_proven:'Browser layout, measured geometry, keyboard/screen reader behavior, live events and production role/SSO flows require parent HTTPS QA.'},null,2));
