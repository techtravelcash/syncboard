// TC-450: actual isolated renderer/callback bodies, baseline/candidate parity and synthetic markup.
// No browser launch, network, production upload or deletion. DOM/CSS geometry is NOT simulated.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const repo=process.argv.includes('--baseline-repo')?process.argv[process.argv.indexOf('--baseline-repo')+1]:root;
const baseline=process.argv.includes('--baseline-ref')?process.argv[process.argv.indexOf('--baseline-ref')+1]:'2ddbabf398bd744d3509209ae8dbb6b452bd038d';
const homeSource=readFileSync(root+'app/js/home-v2.js','utf8');
const {escapeHomeText}=await import('data:text/javascript;base64,'+Buffer.from(homeSource).toString('base64'));
const source=readFileSync(root+'app/js/ui.js','utf8'), main=readFileSync(root+'app/js/main.js','utf8');
const original=execFileSync('git',['show',baseline+':app/js/ui.js'],{cwd:repo,encoding:'utf8'});
const oldMain=execFileSync('git',['show',baseline+':app/js/main.js'],{cwd:repo,encoding:'utf8'});
const slice=(s,a,b)=>{assert(s.includes(a)&&s.includes(b),a);return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));};
const plain=x=>JSON.parse(JSON.stringify(x));
const checks=[],limits=[];
function fixture(src=source, handler=main) {
 const nodes=new Map(),timers=[],writes=[],toasts=[],rerenders=[],commands=[];let selection=null,promptValue=null,fail=null,hold=null;
 class Element {
  constructor(tag='div',id=''){this.tagName=tag;this.id=id;this.children=[];this.style={};this.attrs={};this.dataset={};this.events={};this.classes=new Set();this.value='';this.disabled=false;this._html='';this.innerText='';this.textContent='';this.parentElement=null;this.scrollHeight=100;this.classList={add:(...c)=>c.forEach(x=>this.classes.add(x)),remove:(...c)=>c.forEach(x=>this.classes.delete(x)),contains:c=>this.classes.has(c),toggle:c=>this.classes.has(c)?this.classes.delete(c):this.classes.add(c)};}
  set className(v){this._className=v;this.classes=new Set(v.split(/\s+/));}get className(){return this._className||'';}
  set innerHTML(v){this._html=v;this.children=[];
   if(this.id==='composer'){for(const id of ['comment-input-rich','add-comment-btn']){const n=new Element(id==='add-comment-btn'?'button':'div',id);nodes.set(id,n);}nodes.get('comment-input-rich').innerText='';}
   if(this.id==='rich-mention-suggestions'){
    this.children=[...v.matchAll(/<(button|div)[^>]*class="mention-item"[\s\S]*?data-pic="([^"]*)">/g)].map(m=>{const el=new Element(m[1]);el.className='mention-item';for(const a of m[0].matchAll(/data-([\w-]+)="([^"]*)"/g))el.dataset[a[1]]=a[2];return el;});
   }
  }get innerHTML(){return this._html;}
  appendChild(el){this.children.push(el);el.parentNode=el.parentElement=this;if(el.id)nodes.set(el.id,el);return el;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
  async fire(type,props={}){const e={target:this,key:'',shiftKey:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...props};const pending=[];for(const fn of this.events[type]||[])pending.push(fn(e));if(type==='click'&&this.onclick)pending.push(this.onclick(e));await Promise.all(pending);return e;}
  click(){return this.fire('click');}focus(){this.focused=true;}
  closest(sel){return sel.startsWith('.')&&this.classes.has(sel.slice(1))?this:null;}
  contains(el){return this===el||this.children.includes(el);}
  cloneNode(){const n=new Element(this.tagName,this.id);n._html=this._html;n.textContent=this.textContent;n.className=this.className;n.dataset={...this.dataset};n.parentElement=n.parentNode=this.parentElement;return n;}
  replaceChild(next,old){this.children=this.children.map(n=>n===old?next:n);nodes.set(next.id,next);next.parentNode=next.parentElement=this;}
  remove(){if(this.id)nodes.delete(this.id);}
  querySelector(sel){if(this.id==='taskForm')return nodes.get('submit');if(this.id==='deleteConfirmModal'&&sel==='h2')return nodes.get('confirm-title');if(this.id==='deleteConfirmModal'&&sel==='p')return nodes.get('confirm-description');if(sel==='.p-6.mt-auto')return nodes.get('composer');if(sel==='.mention-item')return this.children[0]||null;return null;}
  querySelectorAll(sel){return sel==='.mention-item'?this.children:[];}
  getBoundingClientRect(){return {bottom:120,left:16};}
 }
 const add=(id,tag='div')=>{const n=new Element(tag,id);nodes.set(id,n);return n;};
 for(const id of ['comments-feed','history-feed','attachment-list','modal-info-attachments','composer','right-column','taskHistoryModal','comment-input','comment-input-rich','taskForm','taskModal','cancelBtn','taskTitle','taskDescription','taskProject','taskProjectColor','taskPriority','taskDueDate','taskAzureLink','taskStatus','toast-container'])add(id);
 const submit=add('submit','button');submit.textContent='Salvar Tarefa';add('add-comment-btn','button');add('task-attachment-input','input');
 const modal=add('deleteConfirmModal');modal.classList.add('hidden');add('confirm-title','h2');add('confirm-description','p');
 const row=add('confirm-row');row.appendChild(add('confirmDeleteBtn','button'));row.appendChild(add('cancelDeleteBtn','button'));const iconWrap=add('icon-wrap');iconWrap.appendChild(add('modal-icon','i'));
 const toolbar=['bold','italic','underline','insertUnorderedList'].map(cmd=>{const el=new Element('button');el.dataset.cmd=cmd;return el;});
 const docEvents={};
 const document={getElementById:id=>nodes.get(id)||null,createElement:t=>new Element(t),body:{appendChild:n=>nodes.set(n.id,n)},querySelector:sel=>sel==='#taskHistoryModal .glass-separator-v'?nodes.get('right-column'):null,querySelectorAll:sel=>sel==='.editor-tool-btn'?toolbar:sel==='#responsible-input-container > div span'?[]:[],addEventListener:(type,fn)=>(docEvents[type]??=[]).push(fn),execCommand:(...a)=>commands.push(a),createTextNode:s=>({textContent:s}),createRange:()=>({createContextualFragment:html=>({html,lastChild:{textContent:' '},children:[],appendChild(n){this.children.push(n);}}),setStartAfter(){},collapse(){}})};
 const state={tasks:[],users:[{name:'Ana Á Fixture',email:'ana@example.invalid'},{name:'Pessoa Sem Foto',email:'outro@example.invalid'}],currentUser:{email:'ana@example.invalid',userDetails:'ana@example.invalid',userId:'auth-id',claims:[]},lastInteractedTaskId:'FIX-450',editingTaskId:null};
 async function request(method,args){writes.push({method,args:plain(args)});if(fail===method)throw new Error('Synthetic '+method+' failure');if(hold)await hold;return method==='uploadAttachment'?{name:args[0].name,url:'https://example.invalid/fixture-upload'}:undefined;}
 const api=Object.fromEntries(['addComment','editComment','deleteComment','uploadAttachment','deleteAttachment','createTask','updateTask'].map(m=>[m,(...args)=>request(m,args)]));
 const ui={renderTaskHistory:id=>rerenders.push(id),showToast:(text,type)=>toasts.push({text,type}),renderModalAttachments:()=>{}};
 class LocalFile{constructor(name){this.name=name;}}
 const context={escapeHomeText,document,state,api,ui,File:LocalFile,localFiles:[],filesToDelete:[],taskForm:nodes.get('taskForm'),window:{lucide:{createIcons(){}},prompt:()=>promptValue,getSelection:()=>selection},lucide:{createIcons(){}},console:{error(){}},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},requestAnimationFrame:fn=>fn(),Node:{TEXT_NODE:3},importFixtureApi:async()=>api,renderTaskHistory:ui.renderTaskHistory};
 vm.createContext(context);
 let snippets=[src.match(/export const formatDateTime =[\s\S]*?\n};/)[0],slice(src,'export function showToast(','// --- RENDERIZAÇÃO: CARD DE TAREFA ---'),slice(src,'export function setupRichTextEditor(','// --- UTILITÁRIOS ---'),slice(src,'export function showDestructiveConfirmModal(','export async function updateNotificationBadge(')];
 // Only the small date formatter is needed; preserve its actual code, no other utility dependencies.

 for(const snippet of snippets)vm.runInContext(snippet.replaceAll('export ',''),context);
 context.formatDateTime=vm.runInContext('formatDateTime',context);
 const render=slice(src,'    // Histórico\n','    // =================================================================\n    // 3. ANIMAÇÃO');
 context.renderCollaboration=(task)=>{state.tasks=[task];context.task=task;context.taskId=task.id;vm.runInContext(`(()=>{${render}})()`,context);};
 const send=slice(src,"    const sendBtn = document.getElementById('add-comment-btn');",'// --- FUNÇÃO AUXILIAR: FECHAR MODAL ---').trim().slice(0,-1);
 context.installRichSend=()=>vm.runInContext(`(()=>{${send.replace("await import('./api.js')",'await importFixtureApi()')}})()`,context);
 vm.runInContext(slice(handler,"    document.getElementById('add-comment-btn').addEventListener",'    const aiModal = document.getElementById(\'aiTitleModal\');'),context);
 ui.showDestructiveConfirmModal=context.showDestructiveConfirmModal;
 vm.runInContext(slice(handler,"    const fileInput = document.getElementById('task-attachment-input');","    document.getElementById('closeHistoryBtn').addEventListener"),context);
 return {nodes,state,context,writes,toasts,rerenders,toolbar,commands,docEvents,File:LocalFile,Element,flush:()=>{while(timers.length)timers.shift().fn();},prompt:v=>promptValue=v,fail:v=>fail=v,hold:v=>hold=v,selection:v=>selection=v};
}
const rich='<p>Ação com <strong>ênfase</strong>, <a href="https://example.invalid/revisão">link</a> e acentos.</p><ul><li>Primeira linha</li><li>Segunda linha</li></ul><span class="mention-tag" contenteditable="false" data-email="outro@example.invalid" style="color: #38BDF8">@Pessoa Sem Foto</span>';
const task={id:'FIX-450',history:[{action:'created',description:'Criada por <strong>Fixture</strong>',timestamp:'2026-10-01T08:00:00Z'},{action:'edited',description:'Alteração longa '.repeat(15)}],comments:[{id:'comment-1',author:'ana@example.invalid',timestamp:'2026-10-02T10:00:00Z',editedAt:'2026-10-03T11:00:00Z',text:rich},{author:{name:'Pessoa Sem Foto',email:'outro@example.invalid'},timestamp:'2026-10-01T09:00:00Z',text:'Linha 1\nLinha 2\n'+'Texto extenso '.repeat(40)},{text:'Sem metadados'}]};
const rendered={};
for(const [label,src,handler] of [['baseline',original,oldMain],['candidate',source,main]]){
 const f=fixture(src,handler);const before=JSON.stringify(task.comments);f.context.renderCollaboration(plain(task));
 const comments=f.nodes.get('comments-feed').innerHTML, history=f.nodes.get('history-feed').innerHTML;
 assert.equal(JSON.stringify(task.comments),before);assert(comments.includes(rich));assert(comments.includes('Texto extenso '.repeat(40)));
 assert.equal((comments.match(/class="edit-comment-btn /g)||[]).length,1);
 const contracts=[...comments.matchAll(/data-(task-id|comment-index|comment-key|comment-text)="([^"]*)"/g)].map(m=>[m[1],m[2]]);
 const attachments=[new f.File('Seleção com acentos '+'muito-longa-'.repeat(18)+'.pdf'),{name:'Referência existente.pdf',url:'https://example.invalid/anexo%20existente.pdf'}];
 f.context.renderModalAttachments(attachments);let files=f.nodes.get('attachment-list').children;assert.equal(files.length,2);
 const attachContracts=files.map(x=>[...x.innerHTML.matchAll(/data-(index|blob-name)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
 f.context.renderAttachmentList('modal-info-attachments',attachments.slice(1),false);assert(!f.nodes.get('modal-info-attachments').children[0].innerHTML.includes('remove-attachment-btn'));
 rendered[label]={comments,history,contracts,attachContracts,files:files.map(x=>x.innerHTML),detailFile:f.nodes.get('modal-info-attachments').children[0].innerHTML,composer:f.nodes.get('composer').innerHTML};
 f.context.renderModalAttachments([]);assert.equal(f.nodes.get('attachment-list').children.length,0);
 f.context.renderCollaboration({id:'FIX-0',comments:[],history:[]});assert(f.nodes.get('comments-feed').innerHTML.includes('Nenhum comentário'));assert(f.nodes.get('history-feed').innerHTML.includes('Nenhuma alteração'));
 f.context.renderCollaboration({id:'FIX-many',comments:Array.from({length:80},(_,i)=>({author:'Pessoa Sem Foto',text:'Comentário '+i,timestamp:'2026-10-01T00:00:00Z'}))});assert.equal((f.nodes.get('comments-feed').innerHTML.match(/Comentário \d+/g)||[]).length,80);
}
assert.deepEqual(rendered.candidate.contracts,rendered.baseline.contracts);assert.deepEqual(rendered.candidate.attachContracts,rendered.baseline.attachContracts);
assert(rendered.candidate.comments.includes('Data não informada'));assert(rendered.candidate.comments.includes('Autor não informado'));assert(rendered.candidate.comments.includes('Editado em'));
assert(rendered.candidate.files[0].includes('Selecionado neste formulário'));assert(rendered.candidate.files[1].includes('Arquivo com link'));assert(rendered.candidate.detailFile.includes('Vinculado à tarefa'));
checks.push('Actual baseline/candidate comment/history/attachment renderers: rich HTML byte-preserved, 0/3/80 comments, missing metadata, supplied edited date, author action visibility, chronological original indexes, long names and exact handler datasets.');
for (const src of [original,source]) {const f=fixture(src,main);assert.throws(()=>f.context.renderCollaboration({id:'FIX-NULL',comments:[{author:null,text:'Null author fixture'}]}));}
limits.push('PF-24/PF-26: absent author/date values have display fallbacks, but a null author object still fails in the original identity resolver; invalid dates are not newly validated.');
{
 const f=fixture();const label='<Pessoa & \"Aspas\">';const filename='<arquivo \"x\"> & revisão.pdf';
 f.context.renderCollaboration({id:'FIX-LITERAL',comments:[{author:label,text:rich}]});const output=f.nodes.get('comments-feed').innerHTML;
 assert(output.includes('title="'+escapeHomeText(label)+'"'));assert(output.includes('>'+escapeHomeText(label)+'</span>'));assert(!output.includes(label));assert(output.includes(rich));
 f.context.renderModalAttachments([new f.File(filename)]);assert(f.nodes.get('attachment-list').children[0].innerHTML.includes('>'+escapeHomeText(filename)+'</span>'));assert(!f.nodes.get('attachment-list').children[0].innerHTML.includes(filename));
 checks.push('Display-only author names, initials and filenames with quotes, ampersands and angle brackets remain literal metadata using the existing escaping helper; stored rich HTML is untouched.');
}
const outcomes=[];
for(const [src,handler] of [[original,oldMain],[source,main]]){
 const result={};
 {const f=fixture(src,handler);let confirmed=0,canceled=0;f.context.showConfirmModal('Confirmar fixture','Ação sobre FIX-450',()=>confirmed++,()=>canceled++);assert.equal(f.nodes.get('confirmDeleteBtn').dataset.intent,'confirm');await f.nodes.get('cancelDeleteBtn').click();f.flush();assert.equal(confirmed,0);assert.equal(canceled,1);assert(f.nodes.get('deleteConfirmModal').classList.contains('hidden'));
 f.context.showDestructiveConfirmModal('Excluir fixture','Remover comentário de FIX-450',()=>confirmed++);assert.equal(f.nodes.get('confirmDeleteBtn').dataset.intent,'destructive');await f.nodes.get('confirmDeleteBtn').click();f.flush();assert.equal(confirmed,1);
 f.context.showConfirmModal('Nova fixture','Alvo 2',()=>confirmed+=10);await f.nodes.get('confirmDeleteBtn').click();f.flush();assert.equal(confirmed,11);result.confirm={confirmed,canceled,title:f.nodes.get('confirm-title').textContent};}
 {const f=fixture(src,handler);f.context.renderCollaboration(plain(task));f.context.installRichSend();let n=f.nodes.get('comment-input-rich');n.innerHTML=rich;n.innerText='Texto com menção';await f.nodes.get('add-comment-btn').click();assert.equal(f.writes[0].method,'addComment');assert.deepEqual(f.writes[0].args,['FIX-450',{text:rich,author:'ana@example.invalid'}]);assert.equal(n.innerHTML,'');result.send=f.writes;}
 {const f=fixture(src,handler);f.context.renderCollaboration(plain(task));f.context.installRichSend();let n=f.nodes.get('comment-input-rich');n.innerHTML=rich;n.innerText='Rascunho';f.fail('addComment');await assert.rejects(f.nodes.get('add-comment-btn').click(),/Synthetic addComment failure/);assert.equal(n.innerHTML,rich);assert.equal(f.toasts.length,0);result.sendFailure={retained:n.innerHTML,notices:f.toasts.length};}
 {const f=fixture(src,handler);f.context.renderCollaboration(plain(task));f.context.installRichSend();let n=f.nodes.get('comment-input-rich');n.innerHTML='Repetido';n.innerText='Repetido';let resolve;f.hold(new Promise(r=>resolve=r));const one=f.nodes.get('add-comment-btn').click(),two=f.nodes.get('add-comment-btn').click();await new Promise(r=>setImmediate(r));assert.equal(f.writes.length,2);resolve();await Promise.all([one,two]);result.doubleSend=f.writes.length;}
 {const f=fixture(src,handler);f.context.renderCollaboration(plain(task));f.nodes.get('comment-input-rich').innerHTML='Texto ainda não enviado';f.context.renderCollaboration(plain(task));assert.equal(f.nodes.get('comment-input-rich').innerHTML,'');result.rerenderDraft='cleared';}
 {const f=fixture(src,handler);f.state.tasks=[plain(task)];const edit=new f.Element('button');edit.className='edit-comment-btn';edit.dataset={taskId:'FIX-450',commentIndex:'0',commentKey:'comment-1',commentText:encodeURIComponent(rich)};
 f.prompt(null);await f.nodes.get('taskHistoryModal').fire('click',{target:edit});assert.equal(f.writes.length,0);f.prompt('  Texto editado á  ');await f.nodes.get('taskHistoryModal').fire('click',{target:edit});await new Promise(r=>setImmediate(r));assert.deepEqual(f.writes[0],{method:'editComment',args:['FIX-450','comment-1','Texto editado á','auth-id']});assert.equal(f.state.tasks[0].comments[0].text,'Texto editado á');result.edit=f.writes[0];
 const del=new f.Element('button');del.className='delete-comment-btn';del.dataset={taskId:'FIX-450',commentIndex:'0'};await f.nodes.get('taskHistoryModal').fire('click',{target:del});await f.nodes.get('cancelDeleteBtn').click();f.flush();assert.equal(f.writes.length,1);await f.nodes.get('taskHistoryModal').fire('click',{target:del});await f.nodes.get('confirmDeleteBtn').click();f.flush();await new Promise(r=>setImmediate(r));assert.deepEqual(f.writes[1],{method:'deleteComment',args:['FIX-450',0]});assert.equal(f.state.tasks[0].comments.length,2);result.delete=f.writes[1];}
 {const f=fixture(src,handler);const n=f.nodes.get('task-attachment-input');await n.fire('change',{target:{files:[new f.File('falha.pdf')]}});assert.equal(f.context.localFiles.length,1);f.fail('uploadAttachment');await f.nodes.get('taskForm').fire('submit');assert.equal(f.writes[0].method,'uploadAttachment');assert.equal(f.writes[1].method,'createTask');assert.deepEqual(f.writes[1].args[0].attachments,[]);result.uploadFailure={methods:f.writes.map(x=>x.method),attachments:f.writes[1].args[0].attachments,toasts:f.toasts};}
 {const f=fixture(src,handler);const file=new f.File('enviado-mas-tarefa-falhou.pdf');await f.nodes.get('task-attachment-input').fire('change',{target:{files:[file]}});f.fail('createTask');await f.nodes.get('taskForm').fire('submit');assert.equal(f.writes[0].method,'uploadAttachment');assert.equal(f.writes[1].method,'createTask');assert.equal(f.context.localFiles[0],file);assert.equal(f.toasts.at(-1).type,'error');result.failedTaskSaveAfterUpload={methods:f.writes.map(x=>x.method),localSelectionRetained:true,notice:f.toasts.at(-1)};}
 {const f=fixture(src,handler);f.context.localFiles.push({name:'Anexo',url:'https://example.invalid/arquivo.pdf'});const remove=new f.Element('button');remove.className='remove-attachment-btn';remove.dataset={index:'0',blobName:'arquivo.pdf'};await f.nodes.get('attachment-list').fire('click',{target:remove});assert.equal(f.context.localFiles.length,0);assert.deepEqual(Array.from(f.context.filesToDelete),['arquivo.pdf']);assert.equal(f.writes.length,0);await f.nodes.get('taskForm').fire('submit');assert.equal(f.writes[0].method,'deleteAttachment');result.removal=f.writes.map(x=>x.method);}
 {const f=fixture(src,handler);f.context.setupRichTextEditor();await f.toolbar[0].click();assert.deepEqual(f.commands,[['bold',false,null]]);let sends=0;f.nodes.get('add-comment-btn').onclick=()=>sends++;const editor=f.nodes.get('comment-input-rich');await editor.fire('keydown',{key:'Enter',shiftKey:true});assert.equal(sends,0);await editor.fire('keydown',{key:'Enter'});assert.equal(sends,1);
 const parent={inserted:null,appendChild(x){this.inserted=x;}};const textNode={nodeType:3,textContent:'Olá @Ana',parentNode:parent,nextSibling:null};f.selection({rangeCount:1,getRangeAt:()=>({startContainer:textNode,startOffset:8,getBoundingClientRect:()=>({bottom:120,left:20})}),removeAllRanges(){},addRange(){}});await editor.fire('keyup',{key:'a'});const menu=f.nodes.get('rich-mention-suggestions');assert.equal(menu.style.display,'flex');assert.equal(menu.children.length,1);await editor.fire('keydown',{key:'Enter'});assert.equal(sends,1);assert.equal(textNode.textContent,'Olá ');assert(parent.inserted.html.includes('data-email="ana@example.invalid"'));assert.equal(menu.style.display,'none');result.mention={html:parent.inserted.html,sends,commands:f.commands};menu.style.display='flex';await editor.fire('keydown',{key:'Escape'});assert.equal(menu.style.display,'none');}
 outcomes.push(result);
}
assert.deepEqual(outcomes[1],outcomes[0]);
checks.push('Actual confirmation cancel/confirm/reopen callbacks retain targets, cloned-handler behavior and ordinary/destructive intent.');
checks.push('Actual rich send retains HTML/author payload; failure, rapid double-send and event-like renderer replacement are baseline-equivalent.');
checks.push('Actual edit prompt/cancel/save and delete confirm/cancel retain index/key/author payloads and source mutations.');
checks.push('Actual file select/remove/save handlers preserve deferred deletion, characterize failed upload being skipped before task save, and prove a File can remain after upload succeeds but task saving fails; selection labels do not claim transmission state.');
checks.push('Actual rich toolbar/Enter/Shift+Enter/Escape/mention click use unchanged commands, target email, stored mention HTML and one existing selection callback. Native keyboard focus geometry is not simulated.');
limits.push('PF-24/PF-58: rich send rejects without local error feedback or in-flight guard; two rapid sends still produce two requests.');
limits.push('PF-58: actual collaboration re-render replaces an unsent editor; this slice adds a truthful warning, no recovery claim.');
limits.push('PF-25/PF-26: comment editing remains window.prompt; index fallback and identity matching are unchanged, not authorization/security validation.');
limits.push('PF-28/PF-29: upload failures are caught/skipped and task save continues; existing-link objects do not reveal upload/save progress or per-file failure; deletion queue semantics unchanged.');
limits.push('PF-27: mention names/filtering/target resolution and legacy popup positioning remain unchanged; no delivery, roving-keyboard or viewport-clamping claim.');
limits.push('No browser computed CSS, screenshots, mobile, focus trap/restore, live events, server security or end-to-end checks were run.');
{
 const f=fixture();f.context.showToast('Falha sintética do comentário','error');const toast=f.nodes.get('toast-container').children[0];assert.equal(toast.dataset.kind,'error');assert.equal(toast.attrs.role,'alert');assert(toast.innerHTML.includes('Falha sintética do comentário'));
 f.context.showToast('Informação sintética','info');assert.equal(f.nodes.get('toast-container').children[1].attrs.role,'status');
 checks.push('Actual toast helper retains supplied text/type, exposes error as alert and neutral feedback as status; no new success state is synthesized.');
}
const fixtureDir=root+'tests/fixtures/collaboration-v2/';mkdirSync(fixtureDir,{recursive:true});
const generated=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TC-450 • synthetic renderer review</title><link rel="stylesheet" href="../../../app/css/custom.css"><link rel="stylesheet" href="../../../app/css/fluxo-v2.css"><link rel="stylesheet" href="../../../app/css/shell-v2.css"><link rel="stylesheet" href="../../../app/css/detail-compat-v2.css"><link rel="stylesheet" href="../../../app/css/collaboration-v2.css"><style>body.sb-app{height:auto;overflow:auto;padding:24px;font-family:var(--sb-font)}main{max-width:720px;margin:auto}.fixture-note{padding:16px;background:var(--sb-canvas);border:1px solid var(--sb-border);margin:16px 0}.sb-collab-comment-avatar{flex-shrink:0}.sb-collab-comment-main{display:flex;flex-direction:column}.rich-editor-wrapper{display:flex;flex-direction:column}#history-feed{display:block}#attachment-list{display:grid}.sb-collab-file-info,.sb-collab-file-actions{display:flex;gap:8px;align-items:center}#taskHistoryModal{position:static;display:block;opacity:1;pointer-events:auto}h2{margin:24px 0 12px}</style><body class="sb-scope sb-app"><main><h1>TC-450: conteúdo sintético</h1><p class="fixture-note">Fixtures locais, sem dados reais, API, fontes remotas ou ações de gravação. Não é uma captura nem prova de renderização no produto. Para contraste escuro, adicione class="dark" no elemento html usando ferramentas locais autorizadas.</p><h2>Anexos no formulário</h2><div id="attachment-list">${rendered.candidate.files.map(x=>'<div class="sb-collab-attachment">'+x+'</div>').join('')}</div><h2>Anexo da tarefa</h2><div id="modal-info-attachments"><div class="sb-collab-attachment">${rendered.candidate.detailFile}</div></div><h2>Comentários</h2><div id="taskHistoryModal"><div id="comments-feed">${rendered.candidate.comments}</div>${rendered.candidate.composer}</div><h2>Eventos do histórico</h2><div id="history-feed">${rendered.candidate.history}</div></main></body></html>`;
writeFileSync(fixtureDir+'generated-renderers.html',generated.replace(/[ \t]+\n/g,'\n'));
console.log(JSON.stringify({status:'passed',baseline,checks,baseline_equivalent_outcomes:outcomes[1],limits,synthetic_fixture:'tests/fixtures/collaboration-v2/generated-renderers.html'},null,2));
