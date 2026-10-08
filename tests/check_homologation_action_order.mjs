// TC474: all shipped modal templates retain natural DOM/tab order and Calendar draft semantics.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const ids = ['modal-approve-btn', 'modal-forward-btn', 'modal-reject-btn', 'modal-calendar-btn'];
for (const path of ['app/index.html', 'app/ui-v2-fidelity-preview.html', 'app/fragments/taskHistoryModal-fidelity-v2.html']) {
 const source = read(path);
 const rail = source.slice(source.indexOf('<div class="sb-task-detail-actions sb-fidelity-rail-actions">'));
 const firstActions = [...rail.matchAll(/<(?:button|a)\b[^>]*id="([^"]+)"/g)].slice(0,4).map(match => match[1]);
 assert.deepEqual(firstActions, ids, `${path}: requested actions are adjacent, even with an external link`);
 let previous = -1;
 for (const id of ids) {
  assert.equal(source.split(`id="${id}"`).length, 2, `${path}: unique ${id}`);
  const position = source.indexOf(`id="${id}"`);
  assert.ok(position > previous, `${path}: ${id} follows previous action`); previous = position;
  const element = source.match(new RegExp(`<(?:button|a)\\b[^>]*id="${id}"[\\s\\S]*?<\\/(?:button|a)>`))[0];
  assert.doesNotMatch(element, /tabindex=/, 'No synthetic keyboard reordering');
  if (id === 'modal-calendar-btn') {
   assert.match(element, /<span>Marcar reunião<\/span>/);
   assert.match(element, /aria-label="Marcar reunião: abrir rascunho no Google Calendar em nova aba"/);
   assert.match(element, /target="_blank"/); assert.match(element, /rel="noopener noreferrer"/);
   assert.match(element, /title="Abrir rascunho no Google Calendar; confirme e salve no Calendar"/);
  }
 }
}
const ui = read('app/js/ui.js');
const permission = await import('data:text/javascript;base64,' + Buffer.from(read('app/js/homologation-v2.js')).toString('base64'));
const start = ui.indexOf('    const canDecide = canDecideHomologation(task, state.currentUser);', ui.indexOf('// Controle de Visibilidade do Botão de Aprovação'));
const end = ui.indexOf('    const signalBtn', start);
assert.ok(start >= 0 && end > start);
let scenarios = 0;
for (const status of ['homologation','inprogress','publication']) for (const email of ['felipe@example.test','other@example.test']) for (const pending of [false,true]) {
 const task = {id:'TC474',status,homologador:{email:'felipe@example.test'}};
 const buttons = Object.fromEntries(ids.slice(0,3).map(id => [id,{hidden:true,dataset:{},classList:{toggle(){}},setAttribute(){}}]));
 const state = {currentUser:{userDetails:email,userRoles:['authenticated','travelcash_user']},pendingHomologationDecisions:new Set(pending ? [task.id] : [])};
 vm.runInNewContext(ui.slice(start,end),{task,state,canDecideHomologation:permission.canDecideHomologation,document:{getElementById:id=>buttons[id]}});
 const visible = status === 'homologation' && email === 'felipe@example.test';
 for (const button of Object.values(buttons)) {
  assert.equal(button.hidden,!visible); assert.equal(button.dataset.taskId,visible ? task.id : ''); assert.equal(button.disabled,pending);
 }
 assert.match(buttons[ids[0]].innerHTML,/<span>Aprovar<\/span>/);
 assert.match(buttons[ids[1]].innerHTML,/<span>Encaminhar<\/span>/);
 assert.match(buttons[ids[2]].innerHTML,/<span>Reprovar<\/span>/);
 scenarios++;
}
const calendar = {href:''};
vm.runInNewContext(ui.slice(ui.indexOf('    const calendarBtn ='),ui.indexOf("    const recoveryBtn =",ui.indexOf('    const calendarBtn ='))),{document:{getElementById:()=>calendar},task:{title:'Reunião & QA',description:'Detalhes?',responsible:[{email:'test@example.test'}]}});
const url = new URL(calendar.href);
assert.equal(url.origin,'https://calendar.google.com'); assert.equal(url.searchParams.get('action'),'TEMPLATE');
assert.equal(url.searchParams.get('text'),'Reunião & QA'); assert.equal(url.searchParams.get('details'),'Detalhes?'); assert.equal(url.searchParams.get('add'),'test@example.test');
console.log(`PASS TC474: order/labels/accessibility in three templates, ${scenarios} authorization/pending scenarios and unchanged Calendar draft URL.`);
