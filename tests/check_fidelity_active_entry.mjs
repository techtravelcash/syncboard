// TC455 active-entry synthetic regression. No browser, API, or remote writes.
// Every original reviewed suite/fixture remains untouched. Run the aggregate
// Python gate to also freeze the entire application and run the legacy suites.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const previewCommit = 'd717428ecba55f7fd9752d30a13390462e725a0b';
const read = path => readFileSync(root + path, 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const pinned = path => execFileSync('git', ['show', `${previewCommit}:${path}`], {cwd:root, encoding:'utf8'});
const preview = pinned('app/ui-v2-fidelity-preview.html');
assert.equal(hash(preview), '9231073c8d4bd8aa54504f7e4e950b6ca09a7708cfe120571fc0c35f3cb89897');
assert.equal(read('app/index.html'), preview.replaceAll('tc455-fidelity-preview-3', 'tc455-fidelity-1'), 'Final index is the exact pinned preview with only marker/cache literal changed');
for (const path of execFileSync('git', ['ls-tree', '-r', '--name-only', previewCommit, 'app', 'api'], {cwd:root, encoding:'utf8'}).trim().split('\n')) {
  if (path !== 'app/index.html') assert.deepEqual(readFileSync(root + path), execFileSync('git', ['show', `${previewCommit}:${path}`], {cwd:root, maxBuffer:16*1024*1024}), `Pinned runtime/backend/asset: ${path}`);
}

const auditPath = 'tests/fixtures/tc455-active-entry-adaptations.json';
const auditBytes = read(auditPath);
assert.equal(hash(auditBytes), 'ab20b330ce4a0ce5e0bce2d5a5a63365d8e261e871fac6e679accce1bd861b3e');
const audit = JSON.parse(auditBytes);
assert.equal(audit.previewCommit, previewCommit);
assert.equal(audit.activeEntry, 'app/index.html');
const originalSecondary = read('tests/check_fidelity_secondary_v2.mjs');
const originalCase = read('tests/fixtures/fidelity-composed-case.mjs');
assert.equal(originalSecondary, pinned('tests/check_fidelity_secondary_v2.mjs'));
assert.equal(originalCase, pinned('tests/fixtures/fidelity-composed-case.mjs'));
function adapt(source, name) {
  assert.equal(hash(source), audit[name + 'OriginalSha256']);
  for (const change of audit[name + 'Adaptations']) {
    assert.equal(hash(change.before), change.beforeSha256);
    assert.equal(hash(change.after), change.afterSha256);
    assert.equal(source.split(change.before).length, 2, `Exact adaptation: ${change.reason}`);
    source = source.replace(change.before, change.after);
  }
  assert.equal(hash(source), audit[name + 'AdaptedSha256']);
  return source;
}
const secondary = adapt(originalSecondary, 'secondary');
const activeCase = adapt(originalCase, 'case');
const behaviorStart = '// Only unchanged/merged production bodies are evaluated;';
assert.equal(activeCase.slice(activeCase.indexOf(behaviorStart)), originalCase.slice(originalCase.indexOf(behaviorStart)), 'All composed production-function execution and behavioral assertions remain byte-identical');
assert.equal(hash(activeCase.slice(activeCase.indexOf(behaviorStart))), audit.unchangedComposedBehaviorSha256);
assert.ok(!activeCase.includes("read('app/ui-v2-fidelity-preview.html')"), 'No preview-path fallback');
const assertionsMarker = '// Exercise the actual default branches against the baseline, byte-for-byte.';
assert.equal(secondary.split(assertionsMarker).length, 2);
const sharedFixture = secondary.slice(0, secondary.indexOf(assertionsMarker));
const helperURL = new URL('./check_fidelity_secondary_v2.mjs', import.meta.url).href;
const runnable = (sharedFixture + '\n' + activeCase).replaceAll('import.meta.url', JSON.stringify(helperURL));
console.log('ACTIVE ENTRY: executing the original composed assertions directly against app/index.html. Inherited preview labels describe shared assertion text, not the entry selected by this gate.');
const result = spawnSync(process.execPath, ['--input-type=module', '--eval', runnable], {cwd:root, encoding:'utf8', maxBuffer:8*1024*1024, env:{...process.env, TZ:'UTC', SYNCBOARD_BASELINE_ROOT:root, SYNCBOARD_FIDELITY_FIXTURE:''}});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.error) throw result.error;
assert.equal(result.status, 0, `Active-entry composed scenario failed (${result.signal || 'no signal'})`);
console.log(JSON.stringify({status:'passed', evidence:'actual-active-entry-synthetic-composed', entry:'app/index.html', entrySha256:hash(read('app/index.html')), pinnedPreviewCommit:previewCommit, audit:auditPath, unchangedComposedBehaviorSha256:audit.unchangedComposedBehaviorSha256, limits:'Synthetic DOM/events/API regression only. No screenshots, computed layout, native browser validation, live API writes, deployment or human acceptance.'}, null, 2));
