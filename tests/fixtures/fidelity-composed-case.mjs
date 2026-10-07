// Appended to the audited secondary suite's existing Element/setup fixture.
// This is deliberately one context and the actual merged preview markup. It
// adds DOM mechanics needed by real shell navigation, rather than alternate app
// predicates/renderers/callbacks. No CSS/layout/native validation is simulated.
const baseMatches = Element.prototype.matches;
Element.prototype.matches = function(selector) {
  const parts = selector.trim().split(/\s+(?![^\[]*\])/);
  if (!baseMatches.call(this, parts.pop())) return false;
  let ancestor = this.parentNode;
  while (parts.length) {
    const wanted = parts.pop();
    while (ancestor && !baseMatches.call(ancestor, wanted)) ancestor = ancestor.parentNode;
    if (!ancestor) return false;
    ancestor = ancestor.parentNode;
  }
  return true;
};
Element.prototype.removeAttribute = function(key) { delete this.attrs[key]; };
const baseAppend = Element.prototype.appendChild;
Element.prototype.appendChild = function(child) {
  if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(node => node !== child);
  const result = baseAppend.call(this, child);
  const adopt = node => { node.ownerDocument = this.ownerDocument; node.isConnected = true; node.children.forEach(adopt); };
  adopt(child);
  return result;
};
Object.defineProperty(Element.prototype, 'parentElement', {get(){return this.parentNode;}});
Element.prototype.insertBefore = function(child, anchor) {
  this.appendChild(child);
  this.children.splice(this.children.indexOf(child), 1);
  this.children.splice(Math.max(0, this.children.indexOf(anchor)), 0, child);
  return child;
};
const baseClasses = Object.getOwnPropertyDescriptor(Element.prototype, 'classList').get;
Object.defineProperty(Element.prototype, 'classList', {get(){
  const tokenList = baseClasses.call(this), add = tokenList.add;
  tokenList.add = (...values) => {
    add(...values);
    if (values.includes('hidden') && this.ownerDocument && this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = this.ownerDocument.body;
  };
  return tokenList;
}});
Element.prototype.focus = function() {
  for (let node = this; node; node = node.parentNode) if (node.classList.contains('hidden') || node.hidden) return;
  this.focused = true;
  this.ownerDocument.activeElement = this;
};
Element.prototype.dispatchEvent = function(event) {
  let stopped = false;
  const payload = {type:event.type, target:this, ...event, stopPropagation(){stopped=true;}, preventDefault(){}};
  for (let node = this; node; node = event.bubbles ? node.parentNode : null) {
    payload.currentTarget = node;
    node['on' + event.type]?.(payload);
    for (const listener of node.listeners[event.type] || []) listener(payload);
    if (stopped) break;
  }
  return true;
};
Element.prototype.click = function() { this.dispatchEvent({type:'click', bubbles:true}); };

const composed = setup(source, true);
const {context:ctx, doc:document, body, calls} = composed;
body.ownerDocument = document;
const actualPreview = read('app/ui-v2-fidelity-preview.html');
const bodyMarkup = actualPreview.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
assert.ok(bodyMarkup, 'Use the real merged preview body');
body.innerHTML = bodyMarkup[1].replace(/<script\b[\s\S]*?<\/script>/gi, '');
document.querySelector = selector => body.querySelector(selector);
document.createElement = tag => { const node = new Element(tag); node.ownerDocument = document; return node; };
const docListeners = new Map(), dispatched = [];
document.addEventListener = (type, callback) => { if (!docListeners.has(type)) docListeners.set(type, []); docListeners.get(type).push(callback); };
document.dispatchEvent = event => { dispatched.push(event.type); for (const callback of docListeners.get(event.type) || []) callback(event); return true; };
const n = id => { const node=document.getElementById(id); assert.ok(node, `Actual preview ID ${id}`); return node; };
const timers = [], writes = [], sortableHistory = [];
Object.assign(ctx, {
  Event,
  setTimeout(callback){ timers.push(callback); return timers.length; },
  requestAnimationFrame: callback => callback(),
  syncShellView:view => calls.push(['shell-view',view]),
  closeShellPanels:() => calls.push(['close-shell']),
  openProgressUpdateModal:task => calls.push(['progress',task.id]),
  kanbanSortableInstances:[],
  isAnimating:false, activeOriginRect:null, activeOriginEl:null,
  Sortable:function(list, options){ this.list=list;this.options=options;this.destroyed=false;this.destroy=()=>{this.destroyed=true;};sortableHistory.push(this); },
  api:{async updateTask(...args){writes.push(['task',snapshot(args)]);},async updateOrder(...args){writes.push(['order',snapshot(args)]);}}
});
// Only unchanged/merged production bodies are evaluated; state setters, filters,
// renderers, event callbacks, navigation and drag protection are never stubbed.
vm.runInContext(strip([
  between(source, 'export const createTaskElement =', '// --- LOGICA DE FILTRO ---'),
  between(source, 'export function renderKanbanView()', '// --- RENDERIZAÇÃO: LISTA'),
  between(source, 'export function updateActiveView()', '// --- MODAL: DETALHES ---'),
  between(source, 'export function closeTaskHistory(taskId)', '// --- SETUP DO RICH TEXT EDITOR'),
  between(read('app/js/main.js'), 'function updateDragAndDropState() {', '// Gerencia o modal de seleção do homologador')
].join('\n')), ctx);
ctx.ui = Object.fromEntries(['updateActiveView','populateProjectFilter','populateResponsibleFilter','renderKanbanView','showToast'].map(key => [key,ctx[key]]));
const task = (id, extra={}) => ({id,title:'Needle composição',project:'Operações',responsible:['Ana'],priority:'Alta',status:'todo',createdAt:'2026-09-01',dueDate:null,order:10,...extra});
const data = [
  task('C-KEEP-2',{order:2}), task('C-KEEP-1',{order:1,responsible:[{name:'Ana',email:'ana@example.test'}]}),
  task('C-SEARCH',{title:'Texto diferente',order:3}), task('C-PROJECT',{project:'Produto',order:4}),
  task('C-OWNER',{responsible:['Bia'],order:5}), task('C-PRIORITY',{priority:'Baixa',order:6}),
  task('C-STATUS',{status:'stopped',order:7}), task('C-DONE',{status:'done',order:0})
];
Object.assign(ctx.state,{tasks:structuredClone(data),currentView:'list',sortBy:'order',sortDirection:'asc'});
const dataBefore = snapshot(ctx.state.tasks);
ctx.populateProjectFilter();ctx.populateResponsibleFilter();
const mainSource = read('app/js/main.js');
vm.runInContext('function installComposedListeners() {\n' + between(mainSource, 'function initializeEventListeners() {', "    const kanbanView = document.getElementById('kanbanView');").slice('function initializeEventListeners() {'.length) + '\n}',ctx);
ctx.installComposedListeners();ctx.updateActiveView();
const listIds = () => n('listView').querySelectorAll('.list-row').map(row => row.dataset.taskId);
const laneIds = () => n('kanbanView').querySelectorAll('.kanban-task-list').map(lane => [lane.dataset.columnId, lane.children.map(card => card.dataset.taskId)]);
const change = (type, value) => { const control=n(`fidelity-${type}-filter`);control.value=value;control.dispatchEvent({type:'change'}); };
const search = value => { n('search-input').value=value;n('search-input').dispatchEvent({type:'input'}); };
const navigate = view => {
  const previewButton=document.querySelectorAll('[data-fidelity-view]').find(button=>button.dataset.fidelityView===view);
  assert.ok(previewButton, `Actual preview navigation ${view}`);
  previewButton.click();
  assert.equal(ctx.state.currentView,view, 'Preview navigation routes through real original handler');
  assert.equal(body.dataset.fidelityView,view);
};
const keep = ['C-KEEP-1','C-KEEP-2'];
assert.deepEqual(listIds(),['C-KEEP-1','C-KEEP-2','C-SEARCH','C-PROJECT','C-OWNER','C-PRIORITY','C-STATUS']);
change('project','Operações');assert.equal(ctx.state.selectedProject,'Operações');
change('responsible','Ana');assert.equal(ctx.state.selectedResponsible,'Ana');
search('NEEDLE');assert.equal(ctx.state.searchQuery,'needle', 'Real search handler normalizes case');
change('priority','Alta');change('status','todo');
assert.deepEqual(listIds(),keep, 'All five filters feed actual native secondary List in exact existing order');
assert.equal(n('fidelity-result-count').textContent,'2 tarefas encontradas');
assert.equal(n('task-filter-count').textContent,'5 filtros ativos');
assert.equal(n('listView').querySelectorAll('table').length,1);
// Each predicate is observably effective while all four other predicates remain.
for (const [type,value,expected,restore] of [
  ['project','Produto',['C-PROJECT'],'Operações'],
  ['responsible','Bia',['C-OWNER'],'Ana'],
  ['priority','Baixa',['C-PRIORITY'],'Alta'],
  ['status','stopped',['C-STATUS'],'todo']
]) {
  change(type,value);assert.deepEqual(listIds(),expected,`${type} independently changes the composed result`);
  change(type,restore);assert.deepEqual(listIds(),keep);
}
search('DIFERENTE');assert.deepEqual(listIds(),['C-SEARCH']);search('NEEDLE');assert.deepEqual(listIds(),keep);
change('status','publication');assert.deepEqual(listIds(),[]);assert.equal(n('fidelity-result-count').textContent,'0 tarefas encontradas');
change('status','todo');assert.deepEqual(listIds(),keep);
const retainedRow = n('listView').querySelector('.list-row');calls.length=0;retainedRow.click();
assert.deepEqual(calls,[['highlight','C-KEEP-1',false],['detail','C-KEEP-1']], 'Real filtered List preserves exact detail target and callback order');

navigate('kanban');
assert.deepEqual(laneIds(),[['todo',keep],['stopped',[]],['inprogress',[]],['homologation',[]],['publication',[]]], 'Same five-filter set/order reaches actual card lanes');
assert.equal(ctx.kanbanSortableInstances.length,0,'Filtered composed navigation cannot enable drag');
assert.equal(n('fidelity-filter-drag-note').hidden,false);
navigate('list');assert.deepEqual(listIds(),keep);assert.equal(n('fidelity-filter-drag-note').hidden,true);
// Home owns its personal model independently of the active List filters.
navigate('home');
assert.match(n('fidelity-page-title').textContent, /Ana!/,'Home title survives shell finish');
assert.equal(n('current-view-label').textContent,'Home');
let metric=n('homeView').querySelectorAll('.metric-card').find(button=>button.dataset.filter==='todo');
metric.click();metric.focus();assert.equal(document.activeElement,metric);
const expectedHome = home.selectHomeTasks(home.buildHomeModel(ctx.state,ctx.isTaskOverdue).myActiveTasks,'todo',ctx.isTaskOverdue).map(item=>item.id);
assert.deepEqual(n('homeView').querySelectorAll('.sb-home-row').map(row=>row.dataset.taskId),expectedHome);
assert.ok(expectedHome.includes('C-PROJECT') && expectedHome.includes('C-PRIORITY'),'Home is not silently narrowed by List filters');
for(let count=0;count<2;count++) {
  const previous=metric;ctx.updateActiveView();metric=n('homeView').querySelectorAll('.metric-card').find(button=>button.dataset.filter==='todo');
  assert.notEqual(metric,previous);assert.equal(document.activeElement,metric,'Real router restores fresh Home metric after hidden-view blur');
  assert.equal(n('homeView').classList.contains('hidden'),false);
  assert.equal(metric.getAttribute('aria-pressed'),'true');
}
let homeRow=n('homeView').querySelector('.sb-home-row');calls.length=0;homeRow.click();
assert.deepEqual(calls,[['highlight',homeRow.dataset.taskId,false],['detail',homeRow.dataset.taskId]]);
n('taskHistoryModal').classList.remove('hidden');ctx.closeTaskHistory(homeRow.dataset.taskId);
assert.equal(document.activeElement,homeRow,'Real detail-close recovery focuses the current composed Home row');
ctx.closeTaskHistory('absent-row');assert.equal(document.activeElement,metric,'Removed-row recovery uses selected current metric');
// Rapid navigation must not let old sort-exit timers hide a returned List.
navigate('list');for(const callback of timers.splice(0))callback();
assert.equal(n('orb-sort').classList.contains('hidden'),false);assert.deepEqual(listIds(),keep);
const outside=n('search-input');outside.focus();ctx.updateActiveView();assert.equal(document.activeElement,outside,'List refresh cannot steal focus into hidden Home');
assert.deepEqual(snapshot(ctx.state.tasks),dataBefore,'Composed controls, renderers and detail close never mutate task data');

// Clear routes through actual existing filter/search callbacks and clears both
// local filters. No manually reset app state or substitute predicate is used.
n('clear-task-filters').click();
assert.equal(ctx.state.selectedProject,'all');assert.equal(ctx.state.selectedResponsible,'all');assert.equal(ctx.state.searchQuery,'');
assert.equal(vm.runInContext('fidelityFilterCount()',ctx),0);assert.equal(n('task-filter-count').textContent,'Sem filtros ativos');
assert.deepEqual(listIds(),['C-KEEP-1','C-KEEP-2','C-SEARCH','C-PROJECT','C-OWNER','C-PRIORITY','C-STATUS']);
// Empty results still produce five true empty Sortable target nodes, with
// explanatory placeholders as siblings, never draggable task children.
search('no-match-anywhere');navigate('kanban');
const statuses=['todo','stopped','inprogress','homologation','publication'];
assert.deepEqual(laneIds(),statuses.map(status=>[status,[]]));
for(const lane of n('kanbanView').querySelectorAll('.kanban-task-list')) assert.ok(lane.parentNode.querySelector('.sb-kanban-empty'));
assert.equal(ctx.kanbanSortableInstances.length,0);assert.equal(n('fidelity-result-count').textContent,'0 tarefas encontradas');
n('clear-task-filters').click();
assert.equal(ctx.kanbanSortableInstances.length,5);assert.deepEqual(Array.from(ctx.kanbanSortableInstances,instance=>instance.list.dataset.columnId),statuses);
assert.equal(ctx.kanbanSortableInstances.filter(instance=>instance.list.children.length===0).length,3,'Real empty active lanes remain initialized after clear');
assert.ok(ctx.kanbanSortableInstances.every(instance=>instance.options.filter.includes('summary')));
const retainedDrag=ctx.kanbanSortableInstances[0];
change('priority','Alta');assert.equal(ctx.kanbanSortableInstances.length,0,'Actual priority callback and rendered event destroy all five drag instances');
assert.ok(retainedDrag.destroyed);await retainedDrag.options.onEnd({});
assert.deepEqual(writes,[],'Stale actual drag callback detects new filter before reading event or submitting any task/order');
assert.deepEqual(snapshot(ctx.state.tasks),dataBefore);
assert.ok(dispatched.filter(type=>type==='sb:fidelity-view-updated').length>10);
assert.equal(sortableHistory.filter(instance=>!instance.destroyed).length,0);
console.log(JSON.stringify({status:'passed',checks:[
  'One context: actual merged preview DOM plus real shell filters, original search/project/responsible/navigation callbacks, secondary List, Home, Kanban and drag controller',
  'Five-filter intersection and each independent exclusion retain exact IDs/order and detail callback order; zero-result and restore paths',
  'View switching retains filters/results; Home personal model and heading survive shell integration',
  'Repeated real Home-controller blur/focus recovery; real modal close returns to current row or selected metric; quick List return keeps sort visible',
  'Real clear-filter callbacks reset every filter; five empty lane nodes keep placeholders outside targets; empty unfiltered lanes initialize Sortable',
  'Priority change destroys drag instances; stale onEnd detects filter before any model/API/order mutation'
],limits:'Synthetic parser/events/Sortable API. No native pointer drag, computed layout, native validation, screenshots, browser accessibility or backend test.'},null,2));
