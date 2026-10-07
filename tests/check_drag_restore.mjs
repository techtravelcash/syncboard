// TC457: actual controller functions with isolated DOM/API fixtures. No remote writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const main = read('app/js/main.js');
const drag = main.slice(main.indexOf('function updateDragAndDropState() {'), main.indexOf('// Gerencia o modal de seleção do homologador'));
const baseline = execFileSync('git', ['show', 'a191109:app/js/main.js'], {cwd:root, encoding:'utf8'});
assert.equal(main.slice(main.indexOf('// Gerencia o modal de seleção do homologador')), baseline.slice(baseline.indexOf('// Gerencia o modal de seleção do homologador')), 'Modal and every unrelated handler preserved');
function setup(filtered=true, old='todo', next='inprogress') {
 const task={id:'MOVE',status:old,order:12,progress:37,homologador:old==='homologation'?{name:'Tester'}:null};
 const hidden=[{id:'HIDDEN-SOURCE',status:old,order:9},{id:'HIDDEN-TARGET',status:next,order:12},{id:'HIDDEN-OTHER',status:'publication',order:4}];
 const before=JSON.stringify(hidden); const calls=[];
 const card={dataset:{taskId:task.id},classList:{remove(){}}};
 const list=(status,children)=>({dataset:{columnId:status},children,parentElement:{querySelector:()=>({textContent:'1'})},insertBefore(item){this.children.unshift(item)},appendChild(item){this.children.push(item)}});
 const from=list(old,[]),to=old===next?from:list(next,[card]);if(old===next)from.children=[card];
 const ctx={state:{currentView:'kanban',tasks:[task,...hidden]},kanbanSortableInstances:[],isFidelityV2:()=>true,hasFidelityFilters:()=>filtered,document:{querySelectorAll:()=>old===next?[from]:[from,to]},Sortable:function(list,options){this.options=options;this.destroy=()=>{this.destroyed=true}},api:{async updateTask(id,data){calls.push(['task',id,JSON.parse(JSON.stringify(data))])},async updateOrder(data){calls.push(['order',JSON.parse(JSON.stringify(data))])}},ui:{renderKanbanView(){calls.push(['render'])},updateActiveView(){calls.push(['refresh'])},showToast(){}},openHomologadorModal(...args){calls.push(['modal',...args])},console};
 vm.createContext(ctx);vm.runInContext(drag,ctx);ctx.updateDragAndDropState();
 return {ctx,task,hidden,before,calls,from,to,card,setFilter(value){filtered=value},async move(){await ctx.kanbanSortableInstances[0].options.onEnd({item:card,from,to,oldIndex:0,newIndex:0})}};
}
for(const [old,next] of [['todo','inprogress'],['inprogress','stopped'],['homologation','inprogress'],['inprogress','publication']]) {
 const t=setup(true,old,next);assert.equal(t.ctx.kanbanSortableInstances[0].options.sort,false);await t.move();
 assert.equal(t.task.status,next);assert.equal(t.task.order,12);assert.equal(JSON.stringify(t.hidden),t.before);assert.equal(t.calls.filter(c=>c[0]==='order').length,0);
 const expected={status:next,oldStatus:old,...(next==='publication'?{progress:100}:{}),...(old==='homologation'?{homologador:null}:{})};
 assert.deepEqual(t.calls.find(c=>c[0]==='task'),['task','MOVE',expected]);assert.ok(t.calls.some(c=>c[0]==='refresh'));
}
for(const old of ['todo','publication','homologation']) {const t=setup(true,old,old);const before=JSON.stringify(t.ctx.state.tasks);await t.move();assert.equal(JSON.stringify(t.ctx.state.tasks),before);assert.equal(t.calls.filter(c=>['task','order','modal'].includes(c[0])).length,0);}
const hom=setup(true,'inprogress','homologation');await hom.move();assert.equal(hom.task.status,'inprogress');assert.equal(hom.calls.filter(c=>c[0]==='modal').length,1);assert.equal(hom.calls.filter(c=>['task','order'].includes(c[0])).length,0);
for(const initial of [false,true]) {const t=setup(initial);const old=t.ctx.kanbanSortableInstances[0];t.ctx.updateDragAndDropState();assert.ok(old.destroyed);await old.options.onEnd({});assert.equal(t.calls.filter(c=>['task','order'].includes(c[0])).length,0);}
const race=setup(false);const instance=race.ctx.kanbanSortableInstances[0];race.setFilter(true);await instance.options.onEnd({});assert.equal(race.calls.filter(c=>['task','order'].includes(c[0])).length,0);
const unfiltered=setup(false);assert.equal(unfiltered.ctx.kanbanSortableInstances[0].options.sort,true);await unfiltered.move();assert.equal(unfiltered.calls.filter(c=>c[0]==='order').length,1);
const options=setup().ctx.kanbanSortableInstances[0].options;assert.equal(options.filter,'button:not(.fidelity-task-open), summary, details, input, select, a');assert.equal(options.preventOnFilter,false);
assert.match(read('app/js/fidelity-v2.js'),/<button type="button" class="expand-btn fidelity-task-open"/);
for(const path of ['app/index.html','app/ui-v2-fidelity-preview.html']) {assert.match(read(path),/Com filtros, arraste entre colunas para mudar a etapa\. Para reordenar, limpe os filtros\./);assert.match(read(path),/js\/main.js\?v=tc457-drag-1/);}
console.log('PASS TC457: filtered status-only moves, hidden orders unchanged, filtered same-lane no-op, homologation interception, destroyed-instance/filter races, unfiltered order, title-only drag exception, unchanged modal/handlers. Native pointer behavior is separate browser QA.');
