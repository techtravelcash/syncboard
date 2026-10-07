// TC-447 controlled renderer/action fixture tests. No browser, network, or backend.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(ROOT+'app/js/ui.js','utf8');
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const renderer=section(source,'export const createTaskElement =','// --- LOGICA DE FILTRO ---').replace('export const','const');
const dates=section(source,'export const formatDate =','// --- EFEITO VISUAL').replaceAll('export const','const');
const nodes=[];const calls=[];
class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.dataset={};this.attrs={};this.style={};this.listeners={};this.matches={};this.children=[];this.className='';this.innerHTML='';}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(name,fn){this.listeners[name]=fn;}
  querySelector(selector){
    if(this.matches[selector])return this.matches[selector];
    const cls=selector.slice(1);
    const pattern=new RegExp('<([a-z]+)([^>]*class="[^"]*\\b'+cls+'\\b[^>]*?)>');
    const match=this.innerHTML.match(pattern);if(!match)return null;
    const child=new Element(match[1]);child.markup=match[0];this.matches[selector]=child;return child;
  }
}
const {canDecideHomologation}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(ROOT+'app/js/homologation-v2.js','utf8')).toString('base64'));
const context={canDecideHomologation,document:{createElement(tag){const el=new Element(tag);nodes.push(el);return el;}},state:{currentUser:{userDetails:'ana@example.invalid',userRoles:['travelcash_user']},users:[{name:'Ana Exemplo',picture:'https://example.invalid/ana.png'}]},renderTaskHistory:id=>calls.push(['details',id]),openProgressUpdateModal:task=>calls.push(['progress',task.id]),showDestructiveConfirmModal:(title,text,fn)=>calls.push(['delete-confirm',title,text,typeof fn]),Date,console};
vm.createContext(context);vm.runInContext(dates+'\n'+renderer+'\nglobalThis.makeCard=createTaskElement;',context);
const tasks=[
 {id:'FIX-1',status:'todo',title:'Ausente',responsible:[]},
 {id:'FIX-2',status:'stopped',title:'Muito longo <escopo> & "aspas" '.repeat(10),project:'Projeto extenso',projectColor:'#E11D48',priority:'Urgente',responsible:['Ana Exemplo','Bruno Exemplo','Carla Exemplo','Diego Exemplo'],progress:0,missingToComplete:'Revisar <evidências> & definir conclusão',dueDate:'2025-01-10',attachments:[{},{}],comments:[{}]},
 {id:'FIX-3',status:'inprogress',title:'Andamento',progress:48,responsible:[{name:'Ana Exemplo',picture:'https://example.invalid/fallback.png'}]},
 {id:'FIX-4',status:'homologation',title:'Homologação',progress:100,homologador:{email:'ana@example.invalid',name:'Homologador Nome Completo',picture:'https://example.invalid/homologator.png'}},
 {id:'FIX-5',status:'publication',title:'Publicação',progress:100,homologador:'Homologador Nome Completo'},
];
const before=JSON.stringify(tasks);const cards=tasks.map(t=>context.makeCard(t));
assert.equal(JSON.stringify(tasks),before,'Rendering must never mutate task data');
assert.equal(cards[0].dataset.taskId,'FIX-1');assert.equal(cards[0].dataset.status,'todo');
assert.match(cards[0].innerHTML,/Não informado/);assert.match(cards[0].innerHTML,/Sem prazo/);assert.match(cards[0].innerHTML,/Responsável não definido/);
assert.match(cards[1].innerHTML,/0%/);assert.doesNotMatch(cards[1].innerHTML,/<escopo>/);assert.match(cards[1].innerHTML,/&lt;escopo&gt;/);assert.match(cards[1].innerHTML,/Urgente/);assert.match(cards[1].innerHTML,/Diego Exemplo/);assert.match(cards[1].innerHTML,/Corresponsáveis/);assert.match(cards[1].innerHTML,/Revisar &lt;evidências&gt;/);
assert.equal(cards[1].querySelector('.sb-kanban-project-swatch').style.backgroundColor,'#E11D48');
assert.match(cards[2].innerHTML,/48%/);assert.match(cards[2].innerHTML,/https:\/\/example.invalid\/ana.png/);
assert.match(cards[3].innerHTML,/100%/);assert.match(cards[3].innerHTML,/Homologador Nome Completo/);assert.ok(cards[3].querySelector('.approve-btn'));assert.equal(cards[3].querySelector('.publish-btn'),null);
assert.ok(cards[4].querySelector('.publish-btn'));assert.equal(cards[4].querySelector('.approve-btn'),null);assert.match(cards[4].innerHTML,/enviar para Arquivados/);
for(const card of cards){
 assert.equal(card.querySelector('.progress-update-btn').tagName,'BUTTON');
 assert.equal(card.querySelector('.expand-btn').tagName,'BUTTON');
 assert.equal(card.querySelector('.delete-task-btn').tagName,'BUTTON');
 const e={stopPropagation(){calls.push(['stop']);}};
 for(let repeat=0;repeat<2;repeat++)card.querySelector('.expand-btn').listeners.click(e);
 card.querySelector('.progress-update-btn').listeners.click(e);
 card.querySelector('.delete-task-btn').listeners.click(e);
}
assert.equal(calls.filter(x=>x[0]==='details').length,10);
assert.equal(calls.filter(x=>x[0]==='progress').length,5);
assert.equal(calls.filter(x=>x[0]==='delete-confirm').length,5);
assert.equal(calls.filter(x=>x[0]==='stop').length,20);
const missingNames=context.makeCard({id:'FIX-MISSING',status:'homologation',title:'Nomes ausentes',responsible:[{email:'provided@example.invalid'},null],homologador:{email:'validator@example.invalid'}});
assert.match(missingNames.innerHTML,/provided@example.invalid/);assert.match(missingNames.innerHTML,/Nome não informado/);assert.match(missingNames.innerHTML,/validator@example.invalid/);
for(const cls of ['.approve-btn','.reject-btn','.forward-btn'])assert.ok(cards[3].querySelector(cls));
context.state.currentUser={userDetails:'other@example.invalid',userRoles:['travelcash_user','admin']};
const wrongReviewer=context.makeCard(tasks[3]);
for(const cls of ['.approve-btn','.reject-btn','.forward-btn'])assert.equal(wrongReviewer.querySelector(cls),null,'Even admin cannot see another homologator decisions');
const unassigned=context.makeCard({...tasks[3],homologador:null});
for(const cls of ['.approve-btn','.reject-btn','.forward-btn'])assert.equal(unassigned.querySelector(cls),null);
const result={status:'passed',checks:['No rendering mutation','Absent, zero, partial and 100 percent progress','Long titles and text escaping','Priority, due date, project color, all owner names and supplied-email/unknown-name fallbacks','Current user photo override and homologator full name','Status-specific action classes/IDs','Native keyboard controls','Repeated details clicks preserve same callback','Progress callback and delete confirmation preserved'],scope:'Real card renderer with lightweight DOM mocks; does not prove browser layout or backend behavior'};
if(process.env.KANBAN_RENDER_OUTPUT)writeFileSync(process.env.KANBAN_RENDER_OUTPUT,JSON.stringify(cards.map((card,i)=>({task:tasks[i],dataset:card.dataset,attrs:card.attrs,html:card.innerHTML})),null,2));
console.log(JSON.stringify(result,null,2));
