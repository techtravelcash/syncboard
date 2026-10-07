import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('app/index.html');
const nav=html.split('<nav id="view-switcher-orb"')[1].split('</nav>')[0];
assert.deepEqual([...nav.matchAll(/data-view="([^"]+)"/g)].map(x=>x[1]),['home','kanban','list','archived','workspace','boards','users']);
assert.ok(nav.indexOf('fidelity-project-links') > nav.indexOf('data-view="archived"'));
assert.ok(nav.indexOf('fidelity-project-links') < nav.indexOf('settings-menu-title'));
assert.match(nav,/data-view="users" id="user-management-btn" class="nav-item hidden"/);
assert.match(nav,/<span>Users<\/span>/);
assert.equal([...html.matchAll(/id="user-management-btn"/g)].length,1);
for(const view of ['workspace','boards']) {
 const block=html.split(`id="${view}View"`)[1].split('</section>')[0];
 assert.match(block,/Escopo futuro/); assert.match(block,/Nenhuma configuração/); assert.match(block,/data-fidelity-view="home"/);
 assert.doesNotMatch(block,/<(?:input|select|form)\b/);
}
const main=read('app/js/main.js');
const handler=main.split("document.getElementById('view-switcher-orb').addEventListener('click', (e) => {")[1].split('\n    });')[0];
let renders=0,closes=0;const state={currentView:'home'};
const context={state,ui:{updateActiveView(){renders++}},updateDragAndDropState(){},syncShellView(){},closeShellPanels(){closes++}};
vm.runInNewContext(`function click(e){${handler}}`,context);
context.click({target:{closest:selector=>{assert.equal(selector,'button[data-view]');return null}}});
assert.equal(state.currentView,'home'); assert.equal(renders,0);
for(const view of ['workspace','boards','home','workspace','boards']) {context.click({target:{closest:()=>({dataset:{view}})}});assert.equal(state.currentView,view)}
assert.equal(renders,5);assert.equal(closes,5);
const source=read('app/js/ui.js');
const controller=source.slice(source.indexOf('export function updateActiveView() {'),source.indexOf('// --- FILTROS NO ORB + BADGE ---')).replace('export function','function');
const nodes=new Map();
for(const id of ['homeView','kanbanView','listView','archivedView','userManagementView','workspaceView','boardsView','main-content','current-view-label','orb-sort','orb-filter']) {const classes=new Set();nodes.set(id,{classList:{add:(...x)=>x.forEach(y=>classes.add(y)),remove:(...x)=>x.forEach(y=>classes.delete(y)),contains:x=>classes.has(x)},contains:()=>false})}
const ctx={state,document:{getElementById:id=>nodes.get(id),querySelectorAll:()=>[]},updateFilterBadge(){},renderHomeView(){},renderKanbanView(){},renderListView(){},renderArchivedTasks(){},renderUserManagementView(){},setTimeout:()=>{}};
vm.runInNewContext(controller,ctx);
for(const view of ['workspace','boards','home','list','workspace','users','boards','archived','kanban']) {
 state.currentView=view;ctx.updateActiveView();
 const current={users:'userManagementView'}[view]||view+'View';
 for(const id of ['homeView','kanbanView','listView','archivedView','userManagementView','workspaceView','boardsView']) assert.equal(nodes.get(id).classList.contains('hidden'),id!==current,`${view}: ${id}`);
}
assert.match(read('app/js/fidelity-v2.js'),/\['users', 'workspace', 'boards'\]\.includes\(state.currentView\)/);
console.log('PASS: grouped menu, Users ID/visibility, honest placeholders, project-click guard, repeated navigation, all-view visibility, task action exclusion. Browser QA still required.');
