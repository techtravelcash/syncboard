// TC455 actual card-renderer regression for absent progress and desktop identity.
// Extends the unchanged reviewed fixture; no browser, network or task writes.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const sourceURL = new URL('./check_fidelity_v2.mjs', import.meta.url);
const source = readFileSync(sourceURL,'utf8').replaceAll('import.meta.url',JSON.stringify(sourceURL.href));
const assertions = `
fidelity=true;
for (const missing of [undefined,null,'']) {
  const card=ctx.makeCard({...fixtures[0],progress:missing});
  assert.match(card.innerHTML,/<span>Progresso não informado<\\/span>/);
  assert.doesNotMatch(card.innerHTML,/<span>Progresso informado<\\/span><strong>Não informado/);
  assert.match(card.innerHTML,/class="progress-update-btn sb-kanban-progress"/);
  assert.match(card.innerHTML,/data-task-id="REAL-1"/);
  assert.doesNotMatch(card.innerHTML,/>0%/);
}
for(const known of [0,38,100]) {
  const card=ctx.makeCard({...fixtures[0],progress:known});
  assert.match(card.innerHTML,new RegExp('>Progresso informado<\\\\/span><strong>'+known+'%'));
  assert.doesNotMatch(card.innerHTML,/>Progresso não informado</);
}
const css=read('app/css/fidelity-v2.css');
assert.match(css,/\\.fidelity-brand-lockup \\{ display: block; width: 147px; height: auto; \\}/);
assert.match(css,/\\.fidelity-brand-lockup \\{ display: block; width: 176px; \\}/);
assert.match(read('app/css/task-fidelity-v2.css'), /@supports \\(field-sizing: content\\) \\{\\s+body\\.sb-app\\.sb-fidelity-v2 #taskForm #taskTitle \\{ field-sizing: content; height: auto !important;/);
console.log('Passed actual absent/zero/known progress labels and retained progress action; desktop wordmark rules present. Browser geometry still pending.');
`;
process.stdout.write(execFileSync(process.execPath,['--input-type=module'],{input:source+'\n'+assertions,encoding:'utf8'}));
