// Existing flow regression in controlled mocks. No network or production mutation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app/js/main.js',import.meta.url),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const dragSource=slice('function updateDragAndDropState() {','// Gerencia o modal de seleção do homologador');
const modalSource=slice('function openHomologadorModal(','// --- EVENT LISTENERS ---');
function classes(initial=[]){const set=new Set(initial);return{add(...xs){xs.forEach(x=>set.add(x))},remove(...xs){xs.forEach(x=>set.delete(x))},contains(x){return set.has(x)}};}
function list(status,children=[]){return{dataset:{columnId:status},children,parentElement:{querySelector(){return{textContent:String(children.length)}}},insertBefore(item,anchor){this.children=this.children.filter(x=>x!==item);this.children.splice(this.children.indexOf(anchor),0,item)},appendChild(item){this.children=this.children.filter(x=>x!==item);this.children.push(item)}};}
async function dragCase(oldStatus,newStatus,{fail=false,same=false}={}){
 const task={id:'FIX-1',status:oldStatus,progress:37,homologador:oldStatus==='homologation'?{name:'Ana Exemplo'}:undefined};
 const other={id:'FIX-2',status:oldStatus,progress:0};
 const card={dataset:{taskId:'FIX-1'},classList:classes()},otherCard={dataset:{taskId:'FIX-2'},classList:classes()};
 const from=list(oldStatus,[otherCard]),to=same?from:list(newStatus,[card]);if(same)from.children.push(card);
 const lists=same?[from]:[from,to];const calls=[],instances=[];
 const state={tasks:[task,other],currentView:'kanban'};
 const context={state,kanbanSortableInstances:[],document:{querySelectorAll:()=>lists},Sortable:function(el,options){this.destroy=()=>{};this.options=options;instances.push(this)},api:{async updateTask(id,payload){calls.push(['update',id,JSON.parse(JSON.stringify(payload))]);if(fail)throw new Error('Fixture failure');},async updateOrder(payload){calls.push(['order',JSON.parse(JSON.stringify(payload))]);if(fail)throw new Error('Fixture failure');}},ui:{showToast:(text,type)=>calls.push(['toast',text,type]),renderKanbanView:()=>calls.push(['render'])},openHomologadorModal:(...args)=>calls.push(['modal',...args]),console:{error(){}}};
 vm.createContext(context);vm.runInContext(dragSource,context);context.updateDragAndDropState();
 assert.equal(instances[0].options.group,'kanban');assert.equal(instances[0].options.ghostClass,'opacity-50');assert.equal(instances[0].options.dragClass,'rotate-2');
 await instances[0].options.onEnd({item:card,from,to,oldIndex:0,newIndex:same?1:0});return{calls,task,from,to};
}
let result=await dragCase('todo','todo',{same:true});assert.equal(result.calls.filter(x=>x[0]==='update').length,0);assert.deepEqual(result.calls.find(x=>x[0]==='order')[1],[{id:'FIX-2',order:0},{id:'FIX-1',order:1}]);
result=await dragCase('todo','inprogress');assert.deepEqual(result.calls.find(x=>x[0]==='update').slice(1),['FIX-1',{status:'inprogress',oldStatus:'todo'}]);assert.equal(result.task.progress,37);
result=await dragCase('inprogress','publication');assert.equal(result.task.progress,100);assert.deepEqual(result.calls.find(x=>x[0]==='update')[2],{status:'publication',oldStatus:'inprogress',progress:100});
result=await dragCase('inprogress','homologation');assert.equal(result.calls.filter(x=>['update','order'].includes(x[0])).length,0);assert.equal(result.calls[0][0],'modal');assert.equal(result.task.status,'inprogress');assert.equal(result.from.children[0].dataset.taskId,'FIX-1');
result=await dragCase('homologation','inprogress');assert.equal(result.task.status,'homologation');assert.ok(result.task.homologador);assert.equal(result.calls.filter(x=>x[0]==='update'||x[0]==='order').length,0);assert.equal(result.calls.filter(x=>x[0]==='render').length,1);
result=await dragCase('todo','inprogress',{fail:true});assert.ok(result.calls.some(x=>x[0]==='toast'&&x[2]==='error'));assert.ok(!result.calls.some(x=>x[0]==='toast'&&x[2]==='success'));assert.equal(result.task.status,'inprogress','Known baseline: failed save does not roll optimistic state back');
async function modalCase(action,fail=false){
 const registry={},calls=[];const task={id:'FIX-1',status:'inprogress',progress:50};
 function element(id){const el={id,innerHTML:'',value:'',disabled:false,classList:classes(id==='homologadorModal'?['hidden']:[]),cloneNode(){return element(id)},parentNode:{replaceChild(next,old){registry[old.id]=next}}};return el;}
 ['homologadorModal','homologadorSelect','confirmHomologadorBtn','cancelHomologadorBtn'].forEach(id=>registry[id]=element(id));
 const state={users:[{name:'Ana Exemplo',email:'ana@example.invalid',picture:'fixture.png'},{name:'DEFINIR'}],tasks:[task]};
 const context={state,document:{getElementById:id=>registry[id]},ui:{showToast:(text,type)=>calls.push(['toast',text,type]),renderKanbanView:()=>calls.push(['render'])},api:{async updateTask(id,payload){calls.push(['update',id,JSON.parse(JSON.stringify(payload))]);if(fail)throw new Error('Fixture failure')}},requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn(),lucide:{createIcons(){}},updateDragAndDropState(){calls.push(['sortable'])},console:{error(){}}};
 vm.createContext(context);vm.runInContext(modalSource,context);context.openHomologadorModal(task,'inprogress','homologation');
 assert.equal(registry.homologadorModal.classList.contains('hidden'),false);assert.doesNotMatch(registry.homologadorSelect.innerHTML,/>DEFINIR</);
 if(action==='cancel')registry.cancelHomologadorBtn.onclick();
 else {registry.homologadorSelect.value=action==='confirm'?'Ana Exemplo':'';await registry.confirmHomologadorBtn.onclick();}
 return{task,registry,calls};
}
result=await modalCase('cancel');assert.equal(result.task.status,'inprogress');assert.equal(result.calls.length,0);assert.ok(result.registry.homologadorModal.classList.contains('hidden'));
result=await modalCase('empty');assert.equal(result.calls[0][2],'info');assert.equal(result.task.status,'inprogress');
result=await modalCase('confirm');assert.deepEqual(result.calls.find(x=>x[0]==='update')[2],{status:'homologation',oldStatus:'inprogress',homologador:{name:'Ana Exemplo',picture:'fixture.png',email:'ana@example.invalid'}});assert.ok(result.registry.homologadorModal.classList.contains('hidden'));
result=await modalCase('confirm',true);assert.ok(result.calls.some(x=>x[0]==='toast'&&x[2]==='error'));assert.ok(!result.calls.some(x=>x[0]==='toast'&&x[2]==='success'));assert.equal(result.registry.confirmHomologadorBtn.disabled,false);assert.equal(result.registry.homologadorModal.classList.contains('hidden'),false);
console.log(JSON.stringify({status:'passed',checks:['Same-lane reorder payload','Cross-lane transition payload','Publication preserves existing 100 percent assignment','Homologation intercept retains original lane until selection','Leaving homologation requires explicit decision, drag cannot bypass','Drag save error remains error','Dialog cancel performs no mutation','Missing selection does not save','Homologator payload and success close','Homologator save error enables retry without success styling'],knownGap:'Existing optimistic state is not rolled back after API failure; no backend transaction semantics changed',scope:'Real main.js functions in isolated DOM/API mocks; browser drag and server behavior not proven'},null,2));
