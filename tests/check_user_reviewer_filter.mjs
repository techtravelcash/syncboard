// TC-465: synthetic data and DOM only; never changes live tasks.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const userFilter = await import('data:text/javascript;base64,'+Buffer.from(read('app/js/task-user-filter.js')).toString('base64'));
const {taskMatchesUser,taskUserFilterOptions}=userFilter;
const users=[{name:'Felipe',email:'felipe@example.test'}];
const rows=[
 ['responsible', {responsible:['Felipe']}],
 ['reviewer', {responsible:['Outro'],homologador:{name:'Felipe'}}],
 ['both', {responsible:[{name:'Felipe'},'Outro'],homologador:'Felipe'}],
 ['neither', {responsible:['Outro'],homologador:'Outra'}],
 ['nulls', {responsible:[null,{}],homologador:null}],
 ['email', {responsible:[],homologador:{email:' FELIPE@EXAMPLE.TEST '}}],
 ['case', {responsible:[{name:' FELIPE '}]}],
 ['missing', {}],
 ['multi', {responsible:['Outro',{email:'felipe@example.test'}]}],
 ['other-project', {project:'Outro',homologador:'Felipe'}],
 ['done', {status:'done',homologador:'Felipe'}],
 ['unique-reviewer', {homologador:'Somente Homologador'}]
].map(([id,props])=>({id,title:'Entrega '+id,project:'Syncboard',priority:'Alta',status:'homologation',createdAt:'2026-10-07',...props}));
const original=structuredClone(rows);
for(const selected of ['Felipe',' FELIPE ','felipe@example.test']) {
 assert.deepEqual(rows.filter(t=>taskMatchesUser(t,selected,users)).map(t=>t.id),['responsible','reviewer','both','email','case','multi','other-project','done']);
}
assert.equal(taskMatchesUser(rows[1],'Felipe'),true);
assert.equal(taskMatchesUser(rows[4],'undefined'),false);
assert.equal(taskMatchesUser(rows[4],'null'),false);
assert.equal(taskMatchesUser(rows[7],'all'),true);
assert(taskUserFilterOptions(rows).includes('Somente Homologador'));
assert(taskUserFilterOptions(rows).some(x=>x.toLowerCase()==='felipe@example.test'));
assert.equal(taskUserFilterOptions(rows).filter(x=>x.toLowerCase()==='felipe').length,1);
assert(taskUserFilterOptions(rows,'Felipe').includes('Felipe'));
assert.deepEqual(rows,original);
const between=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i);return s.slice(i,j)};
// Reuse only the established synthetic DOM class, without historical freeze assertions.
const fixture=read('tests/check_fidelity_secondary_v2.mjs');
const dom=between(fixture,'const decode=', 'const fixtures=');
const ui=read('app/js/ui.js');
const ctx={...userFilter,console,Event,state:{tasks:rows,users,selectedProject:'all',selectedResponsible:'all',searchQuery:'',currentView:'kanban',sortBy:'title',sortDirection:'asc'},lucide:{createIcons(){}},formatDate:()=>'',renderTaskHistory(){},highlightTask(){},showDestructiveConfirmModal(){},showToast(){},setTimeout:fn=>fn()};
vm.createContext(ctx);
vm.runInContext(dom+'\nglobalThis.Element=Element;',ctx);
const body=new ctx.Element('body',{class:'sb-fidelity-v2'});
for(const id of ['kanbanView','listView','homeView','archivedView','userManagementView','workspaceView','boardsView','main-content','current-view-label','orb-sort','orb-filter','orb-project-filters','orb-responsible-filters','search-input','selected-project-label','selected-responsible-label','task-filter-count','clear-task-filters','fidelity-responsible-filter','fidelity-project-filter','fidelity-result-count','fidelity-nav-task-count','fidelity-priority-filter','fidelity-status-filter'])body.appendChild(new ctx.Element('div',{id}));
const node=id=>body.querySelector('#'+id);
ctx.document={body,getElementById:node,createElement:tag=>new ctx.Element(tag),querySelectorAll:selector=>selector.includes(" ")?(node(selector.split(" ")[0].slice(1))?.querySelectorAll(selector.split(" ")[1])||[]):body.querySelectorAll(selector),querySelector:selector=>selector.includes(' ')?node(selector.split(' ')[0].slice(1))?.querySelector(selector.split(' ')[1]):body.querySelector(selector),dispatchEvent(){},addEventListener(){}};
ctx.Element.prototype.click=function(){this.fire('click')};
ctx.Element.prototype.dispatchEvent=function(event){this.fire(event.type)};
ctx.Element.prototype.removeAttribute=function(key){delete this.attrs[key]};
ctx.createTaskElement=task=>{const e=new ctx.Element('article',{'data-task-id':task.id});return e};
ctx.renderHomeView=ctx.renderArchivedTasks=ctx.renderUserManagementView=()=>{};
const strip=s=>s.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
vm.runInContext(strip(read('app/js/fidelity-v2.js'))+'\n'+strip(read('app/js/fidelity-secondary-v2.js')),ctx);
for(const [a,b] of [['function filterTasks(tasks)','// --- RENDERIZAÇÃO: HOME'],['export function renderKanbanView()','// --- RENDERIZAÇÃO: LISTA'],['function escapeListV2Text','// --- RENDERIZAÇÃO: ARQUIVADOS'],['export function updateActiveView()','// --- MODAL: DETALHES ---']])vm.runInContext(strip(between(ui,a,b)),ctx);
node('search-input').addEventListener('input',e=>{ctx.state.searchQuery=e.target.value.toLowerCase();ctx.updateActiveView()});
ctx.initializeFidelityControls(ctx.state,{refresh:()=>ctx.updateActiveView()});
const boardIds=()=>node('kanbanView').querySelectorAll('[data-task-id]').map(e=>e.dataset.taskId).sort();
const listIds=()=>node('listView').querySelectorAll('.list-row').map(e=>e.dataset.taskId).sort();
function renderBoth(expected){
 for(const view of ['kanban','list']) {
  ctx.state.currentView=view;ctx.updateActiveView();
  assert.deepEqual(Array.from(view==='kanban'?boardIds():listIds()),[...expected].sort());
  assert.equal(node('fidelity-result-count').textContent,`${expected.length} ${expected.length===1?'tarefa encontrada':'tarefas encontradas'}`);
  if(view==='kanban')assert.equal(node('kanbanView').querySelectorAll('.column-count').reduce((n,e)=>n+Number(e.textContent),0),expected.length);
 }
}
ctx.populateProjectFilter();ctx.populateResponsibleFilter();ctx.updateActiveView();
assert(node('fidelity-responsible-filter').innerHTML.includes('Somente Homologador'));
node('fidelity-responsible-filter').value='Somente Homologador';node('fidelity-responsible-filter').fire('change');
assert.equal(ctx.state.selectedResponsible,'Somente Homologador');renderBoth(['unique-reviewer']);
ctx.state.selectedResponsible='Felipe';ctx.populateResponsibleFilter();
renderBoth(['responsible','reviewer','both','email','case','multi','other-project']);
ctx.state.selectedProject='Syncboard';ctx.state.searchQuery='reviewer';renderBoth(['reviewer']);
node('fidelity-status-filter').value='todo';node('fidelity-status-filter').fire('change');renderBoth([]);
assert.match(node('listView').innerHTML,/Nenhuma tarefa/);
for(const view of ['kanban','list']) {
 ctx.state.currentView=view;ctx.updateActiveView();
 node('clear-task-filters').click();
 assert.equal(ctx.state.selectedResponsible,'all');assert.equal(ctx.state.selectedProject,'all');assert.equal(ctx.state.searchQuery,'');
 renderBoth(rows.filter(t=>t.status!=='done').map(t=>t.id));
 ctx.state.selectedResponsible='Felipe';ctx.state.selectedProject='Syncboard';ctx.state.searchQuery='Entrega';ctx.populateResponsibleFilter();ctx.populateProjectFilter();
 node('fidelity-priority-filter').value='Baixa';node('fidelity-priority-filter').fire('change');renderBoth([]);
}
assert.deepEqual(rows,original);
console.log('PASS TC-465: responsible/reviewer OR, both once, null and mixed identities, directory email aliases, reviewer-only dropdown, project/search/status/priority AND, real Kanban/list renderers, counts, empty results, both-view clear callbacks, immutable fixtures. Browser layout/live QA remains separate.');
