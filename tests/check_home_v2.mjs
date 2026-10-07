// TC-446 model fixtures and legacy membership parity. No network or production data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(new URL('../app/js/home-v2.js',import.meta.url),'utf8');
const {buildHomeModel,selectHomeTasks,isPendingHomeValidation,escapeHomeText}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const legacy=execFileSync('git',['show','7ba90c52e3221554c6bf1ec8bc82a72701913814:app/js/ui.js'],{cwd:root,encoding:'utf8'});
const section=legacy.slice(legacy.indexOf('export function renderHomeView()'));
const membership=section.slice(section.indexOf('    // 1. Identificar'),section.indexOf('    // 3. Calcular Métricas'));
const overdue=t=>Boolean(t.dueDate&&['stopped','inprogress','homologation'].includes(t.status)&&new Date(t.dueDate)<new Date('2026-10-07T00:00:00Z'));
const tasks=[
 {id:'a',title:'Fila',status:'todo',responsible:['Ana'],dueDate:null},
 {id:'b',title:'Pausa sem atraso',status:'stopped',responsible:[{name:'Other'},{email:'ana@example.test'}],progress:0},
 {id:'c',title:'Andamento anterior',status:'inprogress',responsible:[{name:' Ana '}],dueDate:'2026-10-08',progress:99},
 {id:'d',title:'Só homologadora',status:'homologation',responsible:['Other'],homologador:{email:'ANA@example.test'},dueDate:'2026-10-09'},
 {id:'e',title:'Publicação ativa',status:'publication',responsible:[{email:'ana@example.test'}],homologador:'Ana',progress:100,dueDate:'2026-10-01'},
 {id:'f',title:'Arquivo',status:'done',responsible:['Ana'],progress:100},
 {id:'g',title:'Sem participação',status:'inprogress',responsible:['Other'],dueDate:'2026-10-01'},
 {id:'h',title:'Homologação não atribuída',status:'homologation',responsible:['Ana'],homologador:'Other',dueDate:'2026-10-02'},
 {id:'i',title:'Homologador antigo não inclui publicação',status:'publication',responsible:['Other'],homologador:'Ana',progress:100},
 {id:'j',title:'Sem progresso nem prazo',status:'inprogress',responsible:[{name:'Ana'}]},
 {id:'k',title:'Andamento mais cedo',status:'inprogress',responsible:['Ana'],dueDate:'2026-10-06'},
 {id:'l',title:'Múltiplos responsáveis',status:'todo',responsible:['Other',{email:'ana@example.test'}]},
];
const state={currentUser:{userDetails:'ana@example.test',userId:'provider-id',claims:[]},users:[{name:'Ana',email:'ana@example.test'}],tasks};
const before=JSON.stringify(state);
const model=buildHomeModel(state,overdue);
const old=vm.runInNewContext(`(()=>{${membership};return myActiveTasks.map(t=>t.id)})()`,{state});
assert.deepEqual(model.myActiveTasks.map(t=>t.id),Array.from(old));
assert.deepEqual(model.counts,{todo:2,stopped:1,inprogress:3,homologation:2,publication:1,overdue:2});
assert.equal(model.myHomologationsPending,1);
assert.equal(isPendingHomeValidation(tasks[3],model.myIdentifiers),true);
assert.equal(isPendingHomeValidation(tasks[4],model.myIdentifiers),false);
assert.deepEqual(selectHomeTasks(model.myActiveTasks,'inprogress',overdue).map(t=>t.id),['k','c','j']);
assert.deepEqual(selectHomeTasks(model.myActiveTasks,'publication',overdue).map(t=>t.id),['e']);
assert.deepEqual(selectHomeTasks(model.myActiveTasks,'overdue',overdue).map(t=>t.id),['h','k']);
assert.equal(JSON.stringify(state),before,'Read-only model must not mutate tasks, progress or order');
for(const user of [state.currentUser,{userDetails:'unknown',claims:[{typ:'email',val:'ana@example.test'}]},{userDetails:'ANA',claims:[]},{userDetails:'nobody',claims:[]}]){
 const sample={...state,currentUser:user};const expected=vm.runInNewContext(`(()=>{${membership};return myActiveTasks.map(t=>t.id)})()`,{state:sample});
 assert.deepEqual(buildHomeModel(sample,overdue).myActiveTasks.map(t=>t.id),Array.from(expected));
}
const empty=buildHomeModel({...state,tasks:[]},overdue);
assert.deepEqual(empty.counts,{todo:0,stopped:0,inprogress:0,homologation:0,publication:0,overdue:0});
assert.deepEqual(selectHomeTasks([], 'stopped',overdue),[]);
assert.equal(escapeHomeText(`Ação <tarefa> & "teste" 'x'`),'Ação &lt;tarefa&gt; &amp; &quot;teste&quot; &#39;x&#39;');
console.log(JSON.stringify({status:'passed',fixtures:12,checks:['Legacy personal-membership parity for four identity variants','Mixed string/object/co-responsibles and pending homologator','All five active states; archive excluded; publication100 remains active','Stopped without deadline is not labelled overdue','Deadline ordering and missing-date fallback unchanged','Empty selections and empty personal set','No task/order/progress mutation','Literal label escaping'],scope:'Pure presentation model and legacy parity, not backend or browser end-to-end'},null,2));
