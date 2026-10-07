// TC457 runs the audited active-entry fixture with only obsolete drag expectations changed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root = new URL('../',import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const baseline = path => execFileSync('git',['show',`a191109:${path}`],{cwd:root,encoding:'utf8'});
const audit=JSON.parse(read('tests/fixtures/tc455-active-entry-adaptations.json'));
function replaceOnce(source,before,after){assert.equal(source.split(before).length,2,before);return source.replace(before,after);}
function adapt(path,name){let source=read(path);assert.equal(source,baseline(path),'Historical fixture unchanged');for(const change of audit[name+'Adaptations'])source=replaceOnce(source,change.before,change.after);return source;}
let secondary=adapt('tests/check_fidelity_secondary_v2.mjs','secondary');
let scenario=adapt('tests/fixtures/fidelity-composed-case.mjs','case');
const replacements=[
 ["assert.equal(body.getAttribute('data-ui-release'), 'tc455-fidelity-1');", "assert.equal(body.getAttribute('data-ui-release'), 'tc455-fidelity-2');"],
 ["assert.equal(ctx.kanbanSortableInstances.length,0,'Filtered composed navigation cannot enable drag');", "assert.equal(ctx.kanbanSortableInstances.length,5,'Filtered composed navigation enables cross-column moves');assert.ok(ctx.kanbanSortableInstances.every(i=>i.options.sort===false));"],
 ["assert.equal(ctx.kanbanSortableInstances.length,0);assert.equal(n('fidelity-result-count')", "assert.equal(ctx.kanbanSortableInstances.length,5);assert.equal(n('fidelity-result-count')"],
 ["assert.equal(ctx.kanbanSortableInstances.length,0,'Actual priority callback and rendered event destroy all five drag instances');", "assert.equal(ctx.kanbanSortableInstances.length,5,'Actual priority callback replaces all five drag instances');assert.ok(ctx.kanbanSortableInstances.every(i=>i.options.sort===false));"],
 ["assert.equal(sortableHistory.filter(instance=>!instance.destroyed).length,0);", "assert.equal(sortableHistory.filter(instance=>!instance.destroyed).length,5);"]
];
for(const [before,after] of replacements)scenario=replaceOnce(scenario,before,after);
const marker='// Exercise the actual default branches against the baseline, byte-for-byte.';
const helper=new URL('./check_fidelity_secondary_v2.mjs',import.meta.url).href;
const runnable=(secondary.slice(0,secondary.indexOf(marker))+'\n'+scenario).replaceAll('import.meta.url',JSON.stringify(helper));
process.stdout.write(execFileSync(process.execPath,['--input-type=module','--eval',runnable],{cwd:root,encoding:'utf8',env:{...process.env,TZ:'UTC',SYNCBOARD_BASELINE_ROOT:root.pathname,SYNCBOARD_FIDELITY_FIXTURE:''}}));
// Preserve original card/action/filter tests, adapting only intentionally restored availability.
let cards=read('tests/check_fidelity_v2.mjs');assert.equal(cards,baseline('tests/check_fidelity_v2.mjs'));
cards=replaceOnce(cards,'assert.equal(instances.length,0,key);','assert.equal(instances.length,5,key);assert.ok(instances.every(i=>i.options.sort===false));');
cards=replaceOnce(cards,'assert.equal(instances.length,0,type);','assert.equal(instances.length,5,type);assert.ok(instances.every(i=>i.options.sort===false));');
cards=cards.replaceAll('import.meta.url',JSON.stringify(new URL('./check_fidelity_v2.mjs',import.meta.url).href));
process.stdout.write(execFileSync(process.execPath,['--input-type=module','--eval',cards],{cwd:root,encoding:'utf8'}));
console.log('PASS TC457 current active entry: audited real composed functions, navigation/filter lifecycle and unchanged card/detail/progress/action assertions. Four zero-instance expectations and two filter-availability assertions explicitly adapted; historical test files unmodified.');
