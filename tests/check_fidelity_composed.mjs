// TC-455 integrated preview gate. Synthetic DOM/API fixtures only; no browser or network.
// Run: node tests/check_fidelity_composed.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const revision = '20c48df793c91dd303abdfb0229701b64a905914';
const read = path => readFileSync(root + path, 'utf8');
const hash = source => createHash('sha256').update(source).digest('hex');
const baseline = path => execFileSync('git', ['show', `${revision}:${path}`], {cwd:process.env.SYNCBOARD_BASELINE_ROOT || root, encoding:'utf8'});
const between = (source, start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Missing exact source boundary: ${start}`);
  return source.slice(a, b);
};
// These are the reviewed candidate test bytes, not hashes of application output.
// Changing any original assertion requires a separately reviewed hash update.
const reviewed = {
  'tests/check_fidelity_v2.mjs': 'e7cfdeaa7a4554ace4d9bf0ac5e73ffacf6a74499fc2708f0a1de06aa8e23290',
  'tests/check_fidelity_secondary_v2.mjs': 'e8ef086c50b9e1df017cc2e17dca14e3fc493ff8c5840ebe757690b476116314',
  'tests/check_task_fidelity_adapter.mjs': '2c528a4f92185bbfd9b455d1bc120f12099f66368744c6aa4c5d5aa1293b42a2',
  'tests/check_task_fidelity_flows.mjs': '3f7dfc63dba6edb5d973a1e5f92849cf34271ad3c49a6c382c5aec4abc0f5546',
  'tests/check_startup_v2.mjs': 'ac5fd4748517824980a68a836c9a544e52398ed5440b33ffb22e08ac4709be47',
  'tests/check_profile_claims_recovery.mjs': '30af67829f7e990874ce29138dad15aa7fdbfe6efdc95a00334b64a7a5fd9310',
  'tests/check_home_focus_v2.mjs': 'd06519713e572dead3189396cf8839767d71fa082e079e85ebcc6602ddf38a17'
};
for (const [path, expected] of Object.entries(reviewed)) assert.equal(hash(read(path)), expected, `Reviewed test changed: ${path}`);
// Their helper is part of the audited baseline too: modal runner cannot silently
// inherit a weakened task/create/edit/cancel/progress/AI assertion body.
assert.equal(read('tests/check_task_space_flows.mjs'), baseline('tests/check_task_space_flows.mjs'));
assert.equal(read('app/index.html'), baseline('app/index.html'), 'Default entry remains exact 20c');
const main = read('app/js/main.js'), oldMain = baseline('app/js/main.js');
const exactRecovery = [
  ["document.addEventListener('DOMContentLoaded', async () => {", '// --- ATUALIZA PERFIL NO ORB'],
  ['function updateUserProfileUI()', '// --- DRAG AND DROP']
].map(([a,b]) => {
  const actual = between(main,a,b), expected = between(oldMain,a,b);
  assert.equal(actual, expected, `Exact baseline startup/photo recovery: ${a}`);
  return {start:a, sha256:hash(actual)};
});

const secondaryPath = 'tests/check_fidelity_secondary_v2.mjs';
const originalSecondary = read(secondaryPath);
let secondary = originalSecondary;
const adaptations = [];
function replaceOnce(before, after, reason, kind) {
  assert.equal(secondary.split(before).length, 2, `Audited adaptation must match once: ${reason}`);
  secondary = secondary.replace(before, after);
  adaptations.push({kind, reason, before, after, beforeSha256:hash(before), afterSha256:hash(after)});
}
// ONLY these obsolete sibling-freeze assertions are omitted. All remaining
// protected paths, sorts, identity contracts, callbacks and after-modal equality stay.
replaceOnce("['app/index.html','app/js/main.js','app/js/state.js'", "['app/index.html','app/js/state.js'", 'Allow reviewed shell integration in main.js; startup/profile and existing handlers are separately frozen', 'obsolete sibling freeze');
replaceOnce(" ['function filterTasks(tasks)','// --- RENDERIZAÇÃO: HOME'],\n", '', 'Allow reviewed opt-in filter tail; the composed case exercises its real five-filter intersection', 'obsolete sibling freeze');
replaceOnce(" ['export function updateActiveView()','// --- MODAL: DETALHES ---']\n", '', 'Allow reviewed router, badge and clear-filter integration; composed navigation executes these functions', 'obsolete sibling freeze');
replaceOnce(' vm.createContext(context);\n', " vm.createContext(context);\n vm.runInContext(strip(read('app/js/fidelity-v2.js')),context);\n", 'Load the real sibling helper in the existing secondary fixture context; no replacement functions or assertions', 'fixture dependency');
const assertionMarker = '// Exercise the actual default branches against the baseline, byte-for-byte.';
const assertionBody = originalSecondary.slice(originalSecondary.indexOf(assertionMarker));
assert.equal(secondary.slice(secondary.indexOf(assertionMarker)), assertionBody, 'Entire secondary behavioral assertion body must remain unchanged');
const audit = {
  baseline:revision,
  reviewedTestSha256:reviewed,
  secondaryOriginalSha256:hash(originalSecondary),
  secondaryAdaptedSha256:hash(secondary),
  secondaryUnchangedBehavioralBodySha256:hash(assertionBody),
  exactStartupProfile:exactRecovery,
  adaptations
};
const auditPath = 'tests/fixtures/tc455-composed-adaptations.json';
assert.deepEqual(JSON.parse(read(auditPath)), audit, 'Stored adaptation audit must match exact runnable transformations');

const results = [];
function run(name, sourceOrPath, inline = false) {
  const args = inline ? ['--input-type=module', '--eval', sourceOrPath] : [root + sourceOrPath];
  const result = spawnSync(process.execPath, args, {cwd:root, encoding:'utf8', maxBuffer:8*1024*1024, env:{...process.env, TZ:'UTC', SYNCBOARD_FIDELITY_FIXTURE:''}});
  process.stdout.write(`\n--- ${name} ---\n`);
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${name} failed (signal ${result.signal || 'none'})`);
  results.push(name);
}
const secondaryURL = new URL('./check_fidelity_secondary_v2.mjs', import.meta.url).href;
const anchorModuleURL = text => text.replaceAll('import.meta.url', JSON.stringify(secondaryURL));
run('Reviewed shell/card/filter/empty-lane/drag fixture', 'tests/check_fidelity_v2.mjs');
run('Reviewed secondary defaults + Home/List/Archive/People behavioral assertions', anchorModuleURL(secondary), true);
run('Reviewed modal presentation and strict ID identity', 'tests/check_task_fidelity_adapter.mjs');
run('Reviewed preview create/edit/cancel/AI/progress actual handlers', 'tests/check_task_fidelity_flows.mjs');
run('Original startup recovery scenarios', 'tests/check_startup_v2.mjs');
run('Original profile/photo recovery scenarios', 'tests/check_profile_claims_recovery.mjs');
run('Original detail-close/Home-focus and real view-controller scenarios', 'tests/check_home_focus_v2.mjs');
const sharedFixture = secondary.slice(0, secondary.indexOf(assertionMarker));
run('True composed five-filter/List/navigation/Home-focus/empty-lane flow', anchorModuleURL(sharedFixture + '\n' + read('tests/fixtures/fidelity-composed-case.mjs')), true);
console.log(JSON.stringify({status:'passed', baseline:revision, suites:results, audit:auditPath, preservedSecondaryBehavioralBodySha256:hash(assertionBody), inheritedSummaryClarification:'main.js contains reviewed opt-in shell/listener/drag hooks. The inherited secondary summary does not mean whole-file main.js equality: protected startup/profile/callback slices remain unchanged; the separate integrated source gate verifies the callback slice allowlist.', scope:'Exact default rendering + unchanged real-function assertion suites + shared-DOM composed interaction. No browser, pixels, native validation, live writes, SSO, or backend acceptance.'}, null, 2));
