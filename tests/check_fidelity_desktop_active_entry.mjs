// TC455 desktop-cascade correction: original active-entry scenario, new source guards.
// Read-only synthetic DOM/API fixtures. No browser, network, or remote writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = 'a965230833cde7882e42a30443f4c37f21aeeb1b';
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(root + path, 'utf8');
const pinned = path => execFileSync('git', ['show', `${baseline}:${path}`], {cwd:root, maxBuffer:16*1024*1024});
const auditPath = 'tests/fixtures/tc455-desktop-cascade-changes.json';
const auditBytes = read(auditPath);
assert.equal(hash(auditBytes), '2e8da00f00660bd940c0558745a1efdf4d8aa7c800bd13db7b6441fa9047a042');
const audit = JSON.parse(auditBytes);
assert.equal(audit.baselineCommit, baseline);
assert.equal(audit.activeEntry, 'app/index.html');
assert.deepEqual(Object.keys(audit.runtimeChanges).sort(), ['app/css/fidelity-secondary-v2.css', 'app/css/fidelity-v2.css', 'app/index.html', 'app/ui-v2-fidelity-preview.html']);
// Exact complete-file reconstructions replace the obsolete preview3 CSS freeze.
// Every allowed change is a literal, count-checked, individually hashed map item.
for (const [path, contract] of Object.entries(audit.runtimeChanges)) {
  let expected = pinned(path).toString('utf8');
  assert.equal(hash(expected), contract.beforeSha256, `Pinned old file: ${path}`);
  for (const change of contract.replacements) {
    assert.equal(hash(change.before), change.beforeSha256);
    assert.equal(hash(change.after), change.afterSha256);
    assert.equal(expected.split(change.before).length - 1, change.count, `Exact literal count: ${path}: ${change.reason}`);
    expected = expected.split(change.before).join(change.after);
  }
  assert.equal(hash(expected), contract.afterSha256, `Audited reconstructed file: ${path}`);
  assert.equal(read(path), expected, `Only audited literal corrections: ${path}`);
}
for (const path of execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, 'app', 'api'], {cwd:root, encoding:'utf8'}).trim().split('\n')) {
  if (!(path in audit.runtimeChanges)) assert.deepEqual(readFileSync(root + path), pinned(path), `Unchanged runtime/backend/assets: ${path}`);
}
const originalPath = 'tests/check_fidelity_active_entry.mjs';
let adapted = read(originalPath);
assert.equal(adapted, pinned(originalPath).toString('utf8'));
assert.equal(hash(adapted), audit.activeRunnerOriginalSha256);
for (const change of audit.activeRunnerAdaptations) {
  assert.equal(hash(change.before), change.beforeSha256);
  assert.equal(hash(change.after), change.afterSha256);
  assert.equal(adapted.split(change.before).length, 2, `Exact audited runner adaptation: ${change.reason}`);
  adapted = adapted.replace(change.before, change.after);
}
assert.equal(hash(adapted), audit.activeRunnerAdaptedSha256);
// The inherited runner itself verifies the original audit, original fixtures,
// and byte identity/hash of the complete production execution/assertion body.
const originalURL = new URL('./check_fidelity_active_entry.mjs', import.meta.url).href;
const runnable = adapted;
console.log('CURRENT DESKTOP CANDIDATE: original active-entry composed scenario runs directly against app/index.html, release tc455-fidelity-2. No historical entry alias.');
const result = spawnSync(process.execPath, ['--input-type=module', '--eval', runnable], {cwd:root, encoding:'utf8', maxBuffer:8*1024*1024, env:{...process.env, TZ:'UTC', SYNCBOARD_BASELINE_ROOT:root, SYNCBOARD_FIDELITY_FIXTURE:'', SYNCBOARD_DESKTOP_RUNNER_URL:originalURL}});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.error) throw result.error;
assert.equal(result.status, 0, `Current desktop active-entry scenario failed (${result.signal || 'no signal'})`);
console.log(JSON.stringify({status:'passed', evidence:'current-desktop-cascade-actual-active-entry-synthetic-composed', entry:'app/index.html', entrySha256:hash(read('app/index.html')), baselineCommit:baseline, audit:auditPath, unchangedComposedBehaviorSha256:audit.unchangedComposedBehaviorSha256, limits:'Synthetic DOM/events/API and exact source contracts only. No computed layout, screenshots, high-resolution browser validation, live API writes, deployment or human acceptance.'}, null, 2));
