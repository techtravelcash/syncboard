// TC-455: default isolation plus actual preview renderer/data/callback contracts.
// Synthetic DOM only: not a browser layout, backend, or visual-acceptance result.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const baselineRoot=process.env.SYNCBOARD_BASELINE_ROOT || '/workspace/shared/syncboard_ui_v2_fidelity';
const revision='20c48df793c91dd303abdfb0229701b64a905914';
const read=p=>readFileSync(root+p,'utf8');
const before=p=>execFileSync('git',['show',`${revision}:${p}`],{cwd:baselineRoot,encoding:'utf8'});
const source=read('app/js/ui.js'), baseline=before('app/js/ui.js');
const between=(text,a,b)=>{const i=text.indexOf(a),j=text.indexOf(b,i);assert.ok(i>=0&&j>i,a);return text.slice(i,j);};
const strip=s=>s.replace(/^export /gm,'');
const snapshot=x=>JSON.parse(JSON.stringify(x));
const home=await import('data:text/javascript;base64,'+Buffer.from(read('app/js/home-v2.js')).toString('base64'));
const archive=await import('data:text/javascript;base64,'+Buffer.from(read('app/js/archive-v2.js')).toString('base64'));
const people=await import('data:text/javascript;base64,'+Buffer.from(read('app/js/people-v2.js')).toString('base64'));
for(const p of ['app/index.html','app/js/main.js','app/js/state.js','app/js/api.js','app/js/signalr.js','app/js/home-v2.js','app/js/people-v2.js','app/js/archive-v2.js']) assert.equal(read(p),before(p),`Protected ${p}`);
for(const [a,b] of [
 ['function filterTasks(tasks)','// --- RENDERIZAÇÃO: HOME'],
 ['    activeTasks.sort((a, b) => {','    // POPULAR O ORB'],
 ['    // POPULAR O ORB','    // Se não houver tarefas'],
 ['    // --- EVENTOS ---\n\n    // Clique na linha','// --- RENDERIZAÇÃO: ARQUIVADOS'],
 ['    // Filtra o utilizador de sistema','    container.innerHTML ='],
 ['    const searchInput = document.getElementById(\'userSearchInput\');','// --- ROTEADOR UI'],
 ['export function updateActiveView()','// --- MODAL: DETALHES ---']
])assert.equal(between(source,a,b),between(baseline,a,b),`Exact existing contract ${a}`);
const afterModal=s=>s.slice(s.indexOf('// --- MODAL: DETALHES ---'));
assert.equal(afterModal(source),afterModal(baseline),'Task forms, focus-close recovery, notification and other behavior unchanged');
assert.ok(!read('app/css/fidelity-secondary-v2.css').includes('!important'),'Preview avoids global-important resets');
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
class Element {
 constructor(tag='div', attrs={}) {this.tagName=tag;this.attrs={...attrs};this.children=[];this.parentNode=null;this.style={};this.listeners={};this.onscroll=null;this._html='';this._text='';this.isConnected=true;this.value='';}
 get id(){return this.attrs.id||'';} set id(v){this.attrs.id=v;}
 get className(){return this.attrs.class||'';} set className(v){this.attrs.class=v;}
 get classList(){return {contains:x=>this.className.split(/\s+/).includes(x),add:(...v)=>{this.className=[...new Set([...this.className.split(/\s+/),...v])].join(' ')},remove:(...v)=>{this.className=this.className.split(/\s+/).filter(x=>!v.includes(x)).join(' ')}};}
 get dataset(){const data={};for(const [k,v] of Object.entries(this.attrs))if(k.startsWith('data-'))data[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;return this._dataset || (this._dataset=data);}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('');} set textContent(v){this._text=String(v);this.children=[];this._html=String(v);}
 get innerHTML(){return this._html;} set innerHTML(value){this._html=value;this.children=[];this._text='';let current=this;const voids=new Set(['input','img','br','hr','meta','link']);for(const token of value.matchAll(/<\/[^>]+>|<[^>]+>|[^<]+/g)){const v=token[0];if(v.startsWith('</')){current=current.parentNode || this;}else if(v.startsWith('<')){const tag=v.match(/^<([a-z][a-z0-9-]*)/i)?.[1];if(!tag)continue;const attrs={};for(const m of v.matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)')?/g)){if(m.index===1)continue;attrs[m[1]]=decode(m[2]??m[3]??'');}const child=new Element(tag,attrs);current.appendChild(child);if(!voids.has(tag)&&!v.endsWith('/>'))current=child;}else current._text+=decode(v);}}
 appendChild(e){this.children.push(e);e.parentNode=this;return e;}
 setAttribute(k,v){this.attrs[k]=String(v);} getAttribute(k){return this.attrs[k]??null;}
 matches(selector){const attr=selector.match(/\[([\w-]+)(?:="([^"]*)")?\]/);if(attr && (!(attr[1] in this.attrs)||(attr[2]!==undefined && this.attrs[attr[1]]!==attr[2])))return false;const sel=selector.replace(/\[[^\]]+\]/g,'');if(sel.startsWith('.'))return this.classList.contains(sel.slice(1));if(sel.startsWith('#'))return this.id===sel.slice(1);return !sel || this.tagName===sel;}
 querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0] || null;}
 contains(node){return this===node||this.children.some(child=>child.contains(node));}
 closest(selector){return selector.split(',').some(s=>this.matches(s.trim())) ? this : this.parentNode?.closest(selector)||null;}
 addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
 focus(){this.focused=true;if(this.ownerDocument)this.ownerDocument.activeElement=this;}
 fire(type,event={}){const e={target:this,stopPropagation(){},preventDefault(){},...event};this['on'+type]?.(e);for(const handler of this.listeners[type]||[])handler(e);}
}
const fixtures=[
 {id:'FIX-1',title:'Ação & <tarefa>',project:'Operações',projectColor:'rgb(12, 34, 56)',responsible:['Ana'],priority:'Urgente',status:'todo',createdAt:'2026-09-01',dueDate:'2026-10-01',progress:30,order:1},
 {id:'FIX-2',title:'Parada',project:'Operações',responsible:[{name:'Ana',email:'ana@example.test'}],priority:'Baixa',status:'stopped',createdAt:'2026-09-02',dueDate:null,order:2},
 {id:'FIX-3',title:'Prazo próximo',project:'',responsible:['Ana'],priority:'Média',status:'inprogress',createdAt:'2026-08-01',dueDate:'2026-10-08',progress:60,order:5},
 {id:'FIX-4',title:'Validar pessoal',project:'Produto',responsible:[{name:'Outro'}],priority:'Alta',status:'homologation',createdAt:'2026-09-03',dueDate:'2026-09-10',progress:99,homologador:{email:'ana@example.test'},order:2},
 {id:'FIX-5',title:'Concluída',project:'Produto',responsible:['Ana'],status:'done',createdAt:'2026-09-05',progress:100,order:3,updatedAt:'2026-10-06T23:59:00Z'},
 {id:'FIX-6',title:'Título extenso '.repeat(12),project:'Projeto com nome muito longo '.repeat(6),responsible:['Ana',{email:'legacy@example.test'},null],priority:'Alta',status:'publication',createdAt:'2026-09-03',dueDate:null,progress:100,homologador:'Validador existente',attachments:[{}],order:2},
 {id:'FIX-7',title:'Outro estado',project:null,responsible:['Ana'],status:'future-state',progress:null},
 {id:'FIX-8',title:'Atrasada',project:'Produto',responsible:[{name:'Ana'}],status:'inprogress',dueDate:'2026-10-06',progress:150},
 {id:'FIX-9',title:'Progresso negativo',project:'Produto',responsible:['Other'],status:'inprogress',progress:-5},
 {id:'FIX-10',title:'Prazo ausente',project:'Produto',responsible:['Ana'],status:'inprogress',progress:''}
];
// Home's existing mixed-responsible model expects non-null objects, so preserve
// its existing valid-data contract; null identity fixture applies to List only.
const personalFixtures=fixtures.map(task=>({...task,responsible:task.responsible?.filter(Boolean)}));
const stateFixture=()=>({tasks:structuredClone(personalFixtures),users:[{id:'ana-id',name:'Ana',displayName:'Ana Nome Completo',email:'ana@example.test',role:'Coordenação',isAdmin:true},{name:'DEFINIR',email:'system@example.test'},{name:'Bia',email:'bia@example.test'}],currentUser:{userDetails:'ana@example.test',userId:'auth-id',claims:[]},selectedProject:'all',selectedResponsible:'all',searchQuery:'',sortBy:'createdAt',sortDirection:'desc',currentView:'home'});
function setup(code, fidelity=false) {
 const body=new Element('body',{class:fidelity?'sb-app sb-fidelity-v2':'sb-app'});
 for(const id of ['homeView','listView','archivedView','userManagementView','orb-sort-options','selected-sort-label','fidelity-page-title','fidelity-page-subtitle'])body.appendChild(new Element('div',{id}));
 const doc={body,activeElement:null,getElementById:id=>body.querySelector('#'+id),querySelectorAll:sel=>body.querySelectorAll(sel),createElement:tag=>new Element(tag)};
 const calls=[];let archiveResult=[];
 const context={document:doc,state:stateFixture(),...home,...archive,...people,console:{error(){}},lucide:{createIcons(){}},formatDate:value=>value?new Date(value).toLocaleDateString('pt-PT',{timeZone:'UTC'}):'',isTaskOverdue:t=>Boolean(t.dueDate&&['stopped','inprogress','homologation'].includes(t.status)&&new Date(t.dueDate)<new Date('2026-10-07T00:00:00Z')),highlightTask:(...args)=>calls.push(['highlight',...args]),renderTaskHistory:(...args)=>calls.push(['detail',...args]),showDestructiveConfirmModal:(...args)=>calls.push(['confirm',args[0],args[1]]),showToast(){},fetchArchivedTasks:async()=>{if(archiveResult instanceof Error)throw archiveResult;return archiveResult;}};
 vm.createContext(context);
 vm.runInContext(strip(read('app/js/fidelity-secondary-v2.js')),context);
 const chunks=[between(code,'function filterTasks(tasks)','// --- RENDERIZAÇÃO: HOME'),between(code,'function getGreeting()','// --- RENDERIZAÇÃO: KANBAN'),between(code,'function escapeListV2Text','// --- ROTEADOR UI')];
 vm.runInContext(strip(chunks.join('\n')),context);
 return {context,body,doc,calls,setArchive(value){archiveResult=value;}};
}
// Exercise the actual default branches against the baseline, byte-for-byte.
const legacy=setup(baseline),current=setup(source);
for(const name of ['renderHomeView','renderListView','renderUserManagementView']) {
 legacy.context[name]();current.context[name]();
 for(const id of ['homeView','listView','userManagementView','home-dynamic-list'])assert.equal(current.doc.getElementById(id)?.innerHTML,legacy.doc.getElementById(id)?.innerHTML,`Default HTML unchanged ${name}/${id}`);
}
for(const value of [[],[fixtures[5],fixtures[4]],new Error('fixture')]) {
 legacy.setArchive(value);current.setArchive(value);await legacy.context.renderArchivedTasks();await current.context.renderArchivedTasks();assert.equal(current.doc.getElementById('archivedView').innerHTML,legacy.doc.getElementById('archivedView').innerHTML,'Default archive exact loading/result/error markup');
}
// Actual preview Home: model, all six controls, selection/order, callbacks and focus.
const preview=setup(source,true);const snapshotBefore=snapshot(preview.context.state);preview.context.renderHomeView();
const model=home.buildHomeModel(preview.context.state,preview.context.isTaskOverdue);
assert.equal(preview.doc.querySelectorAll('.fidelity-summary-item').length,4);
assert.equal(preview.doc.querySelectorAll('.metric-card').length,6);
assert.equal(preview.doc.querySelectorAll('.fidelity-home-grid').length,1);
assert.ok(preview.doc.getElementById('homeView').innerHTML.includes('não representam um total global'));
assert.ok(preview.doc.getElementById('homeView').innerHTML.includes('Estado não identificado'));
assert.equal(preview.doc.querySelectorAll('.fidelity-summary-item')[0].querySelector('strong').textContent,String(model.myActiveTasks.length));
for(const filter of ['todo','stopped','inprogress','homologation','publication','overdue']) {
 const button=preview.doc.querySelectorAll('.metric-card').find(x=>x.dataset.filter===filter);button.fire('click');
 const selected=home.selectHomeTasks(model.myActiveTasks,filter,preview.context.isTaskOverdue);
 assert.deepEqual(preview.doc.querySelectorAll('.sb-home-row').map(x=>x.dataset.taskId),selected.map(x=>x.id),`Actual Home selection ${filter}`);
 assert.equal(button.getAttribute('aria-pressed'),'true');
 const row=preview.doc.querySelectorAll('.sb-home-row')[0];if(row){preview.calls.length=0;row.fire('click');assert.deepEqual(preview.calls,[['highlight',row.dataset.taskId,false],['detail',row.dataset.taskId]]);}
}
const focus=preview.doc.querySelectorAll('.metric-card').find(x=>x.dataset.filter==='publication');preview.doc.activeElement=focus;preview.context.renderHomeView();assert.ok(preview.doc.querySelectorAll('.metric-card').find(x=>x.dataset.filter==='publication').focused,'Rerender restores focused metric');
assert.equal(preview.doc.getElementById('homeView').dataset.homeFilter,'overdue','Selected category survives rerender independently of focused category');
assert.deepEqual(snapshot(preview.context.state),snapshotBefore,'Home rendering does not mutate model');
// List: exact existing sorts and callbacks with native table rows, including null names.
preview.context.state.tasks=structuredClone(fixtures);
for(const sortBy of ['createdAt','dueDate','title','status','order'])for(const sortDirection of ['asc','desc'])for(const selectedProject of ['all','Operações','Produto','missing'])for(const selectedResponsible of ['all','Ana','Other'])for(const searchQuery of ['','fix-1','Ação','none']) {
 const state={...stateFixture(),tasks:structuredClone(fixtures),sortBy,sortDirection,selectedProject,selectedResponsible,searchQuery};
 // Filters do not dereference null responsible unless a responsible filter is active.
 if(selectedResponsible!=='all')state.tasks=structuredClone(personalFixtures);
 legacy.context.state=snapshot(state);preview.context.state=snapshot(state);legacy.context.renderListView();preview.context.renderListView();
 assert.deepEqual(preview.doc.getElementById('listView').querySelectorAll('.list-row').map(x=>x.dataset.taskId),legacy.doc.getElementById('listView').querySelectorAll('.list-row').map(x=>x.dataset.taskId));assert.deepEqual(snapshot(preview.context.state),snapshot(state));
}
preview.context.state={...stateFixture(),tasks:structuredClone(fixtures)};preview.context.renderListView();
const list=preview.doc.getElementById('listView');assert.equal(list.querySelectorAll('table').length,1);assert.equal(list.querySelectorAll('tr').length,10);
for(const phrase of ['Não informado','150% (fora da faixa)','-5% (fora da faixa)','legacy@example.test','Nome não informado','Validador existente','1 anexo','Criação:','&lt;tarefa&gt;'])assert.ok(list.innerHTML.includes(phrase),phrase);
const listRow=list.querySelector('.list-row');preview.calls.length=0;listRow.fire('click',{target:listRow});assert.deepEqual(preview.calls,[['highlight',listRow.dataset.taskId,false],['detail',listRow.dataset.taskId]]);
preview.calls.length=0;listRow.fire('click',{target:listRow.querySelector('.info-btn')});assert.equal(preview.calls.length,0,'Buttons skip row handler');
list.querySelector('.delete-list-btn').fire('click');assert.equal(preview.calls[0][0],'confirm','Delete only opens original confirmation');
preview.calls.length=0;preview.context.ui={renderTaskHistory:id=>preview.calls.push(['detail',id])};vm.runInContext('async function directInfoClick(e) {'+between(read('app/js/main.js'),'        const infoBtn =','        const approveBtn =')+'}',preview.context);const directTitle=listRow.querySelector('.info-btn');listRow.fire('click',{target:directTitle});await preview.context.directInfoClick({target:directTitle,stopPropagation(){}});assert.deepEqual(preview.calls,[['detail',listRow.dataset.taskId]],'Direct title opens exactly once through unchanged main callback');
const sortButton=key=>preview.doc.getElementById('orb-sort-options').querySelectorAll('.radial-content').find(x=>x.dataset.sort===key);
sortButton('title').fire('click');assert.equal(preview.context.state.sortDirection,'asc');sortButton('title').fire('click');assert.equal(preview.context.state.sortDirection,'desc');
// Archive: no filtering/sorting, unknown statuses, updatedAt and exact IDs/actions.
const archived=[fixtures[5],fixtures[4],{id:'FIX-MISSING',status:'done'},{id:'FIX-UNKNOWN',status:'future-status',title:'<safe>',updatedAt:'invalid'}];
preview.setArchive(archived);const originalArchive=snapshot(archived);await preview.context.renderArchivedTasks();const archivedNode=preview.doc.getElementById('archivedView');
assert.deepEqual(archivedNode.querySelectorAll('.sb-archive-row').map(x=>x.dataset.taskId),archived.map(x=>x.id));
for(const phrase of ['Última atualização','não a data de conclusão','Publicação · Estado divergente','future-status · Estado divergente','Sem projeto','Sem responsável','Não informada','06/10/2026'])assert.ok(archivedNode.innerHTML.includes(phrase),phrase);
for(const klass of ['restore-btn','delete-btn'])assert.deepEqual(archivedNode.querySelectorAll('.'+klass).map(x=>x.dataset.taskId),archived.map(x=>x.id));assert.deepEqual(archived,originalArchive);
for(const result of [[],new Error('temporary'),archived]){preview.setArchive(result);await preview.context.renderArchivedTasks();assert.ok(archivedNode.innerHTML.includes(result instanceof Error?'Não foi possível carregar':result.length?'FIX-MISSING':'Nenhuma tarefa arquivada'));}
// People: original exclusion/sort/count, roles/form targets, search/reopen controls.
preview.context.state=stateFixture();preview.context.renderUserManagementView();const users=preview.doc.getElementById('userManagementView');
assert.ok(!users.innerHTML.includes('system@example.test'));assert.ok(users.innerHTML.includes('Administrador do sistema'));assert.ok(users.innerHTML.includes('Cargo: Coordenação'));
assert.deepEqual(users.querySelectorAll('.edit-user-btn').map(x=>x.dataset.userEmail),['ana@example.test','bia@example.test']);
assert.deepEqual(users.querySelectorAll('.delete-user-btn').map(x=>x.dataset.userId),['ana-id','bia@example.test']);
assert.equal(users.querySelectorAll('form').length,1);assert.equal(users.querySelectorAll('#openNewUserModalBtn').length,1);
const formFragment=s=>s.slice(s.indexOf('<div id="userFormModal"'));
legacy.context.state=stateFixture();legacy.context.renderUserManagementView();assert.equal(formFragment(users.innerHTML),formFragment(legacy.doc.getElementById('userManagementView').innerHTML),'People form exact default baseline markup');
preview.doc.getElementById('userSearchInput').fire('input',{target:{value:'missing'}});assert.ok(preview.doc.getElementById('no-users-found').classList.contains('flex'));
preview.doc.getElementById('userSearchInput').fire('input',{target:{value:'Ana'}});assert.equal(users.querySelectorAll('.user-card-item')[0].style.display,'flex');assert.equal(users.querySelectorAll('.user-card-item')[1].style.display,'none');
// Escaping all text/attribute surfaces; no fake values imported from prototype.
const helper=read('app/js/fidelity-secondary-v2.js');assert.ok(!/DEM-\d|Equipe de exemplo|dados de exemplo|Concluída em/.test(helper));
assert.equal(vm.runInContext(`escapeFidelityText('\"><img src=x onerror=alert(1)>')`,preview.context), '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
const fixturePath=process.env.SYNCBOARD_FIDELITY_FIXTURE;
if(fixturePath)writeFileSync(fixturePath,'<!doctype html><html lang="pt"><body class="sb-fidelity-v2">'+preview.body.children.map(x=>`<section id="${x.id}">${x.innerHTML}</section>`).join('')+'</body></html>');
console.log(JSON.stringify({status:'passed',checks:['Default Home/List/Archive/People HTML exact baseline parity','Protected main/API/state/model/auth/startup files unchanged','All six actual Home selections, ordering, detail/focus hooks and loaded counts','480 list sort/filter combinations with exact baseline returned ID order','Native table semantics and original row/delete/sort callbacks','Missing/null/unknown/out-of-range metadata remains honest and escaped','Archive returned set/order/update labels/action IDs and empty/failure/reopen','People exclusion/roles/identities/search and exact form targets/markup'],scope:'Synthetic DOM + source contracts only. Real HTTPS screenshots remain required.'},null,2));
