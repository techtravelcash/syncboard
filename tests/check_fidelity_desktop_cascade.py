"""TC455 desktop correction gate: current source/behavior + isolated historical gate.

All existing tests/audits stay byte-identical. Four exact runtime files may change.
No browser, network, remote writes, deployment, or visual approval is performed.
Run: python tests/check_fidelity_desktop_cascade.py
"""
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
BASELINE = 'a965230833cde7882e42a30443f4c37f21aeeb1b'
PREVIEW_REF = 'd717428ecba55f7fd9752d30a13390462e725a0b'
AUDIT_PATH = 'tests/fixtures/tc455-desktop-cascade-changes.json'
AUDIT_SHA256 = '2e8da00f00660bd940c0558745a1efdf4d8aa7c800bd13db7b6441fa9047a042'
CHANGED = {
    'app/css/fidelity-v2.css',
    'app/css/fidelity-secondary-v2.css',
    'app/index.html',
    'app/ui-v2-fidelity-preview.html',
}
ADDITIONS = {
    AUDIT_PATH,
    'tests/check_fidelity_desktop_cascade.py',
    'tests/check_fidelity_desktop_active_entry.mjs',
    'docs/tc455-desktop-cascade-correction.md',
}


def git(*args, cwd=ROOT, env=None):
    return subprocess.check_output(['git', *args], cwd=cwd, env=env)


def pinned(path, revision=BASELINE):
    return git('show', f'{revision}:{path}')


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def run(label, args, cwd=ROOT, env=None):
    print(f'\n--- {label} ---', flush=True)
    subprocess.run(args, cwd=cwd, env=env, check=True)


assert git('rev-parse', f'{BASELINE}^{{commit}}').decode().strip() == BASELINE
files = git('ls-tree', '-r', '--name-only', '-z', BASELINE).decode().rstrip('\0').split('\0')
current_files = set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').decode().rstrip('\0').split('\0'))
assert current_files == set(files) | ADDITIONS, {
    'unexpected': sorted(current_files - set(files) - ADDITIONS),
    'missing': sorted((set(files) | ADDITIONS) - current_files),
}
for path in sorted(current_files):
    assert not (ROOT / path).is_symlink(), f'Unexpected symlink: {path}'
    if path in files and path not in CHANGED:
        assert (ROOT / path).read_bytes() == pinned(path), f'Frozen approved file changed: {path}'
audit_bytes = (ROOT / AUDIT_PATH).read_bytes()
assert sha256(audit_bytes) == AUDIT_SHA256
manifest = json.loads(audit_bytes)
assert manifest['baselineCommit'] == BASELINE
assert set(manifest['runtimeChanges']) == CHANGED
for path, contract in manifest['runtimeChanges'].items():
    expected = pinned(path)
    assert sha256(expected) == contract['beforeSha256'], path
    for change in contract['replacements']:
        before, after = change['before'].encode(), change['after'].encode()
        assert before and before != after, (path, 'Empty or ineffective change')
        assert sha256(before) == change['beforeSha256']
        assert sha256(after) == change['afterSha256']
        assert expected.count(before) == change['count'], (path, change['reason'])
        expected = expected.replace(before, after)
    assert sha256(expected) == contract['afterSha256'], path
    assert (ROOT / path).read_bytes() == expected, f'Exact audited literal change map: {path}'

active = (ROOT / 'app/index.html').read_bytes()
preview = (ROOT / 'app/ui-v2-fidelity-preview.html').read_bytes()
for path, old_marker, new_marker in [
    ('app/index.html', b'tc455-fidelity-1', b'tc455-fidelity-2'),
    ('app/ui-v2-fidelity-preview.html', b'tc455-fidelity-preview-3', b'tc455-fidelity-preview-4'),
]:
    old, current = pinned(path), (ROOT / path).read_bytes()
    assert old.count(old_marker) == current.count(new_marker) == 16
    assert new_marker not in old and old_marker not in current
    assert current == old.replace(old_marker, new_marker)
    assert current.replace(new_marker, old_marker) == old, f'Byte-identical HTML after literal marker normalization: {path}'
    expected_tree, current_tree = html.fromstring(old), html.fromstring(current.replace(new_marker, old_marker))
    for tag in ['head', 'body']:
        assert len(re.findall(fr'<{tag}\b'.encode(), current, re.I)) == 1
        assert html.tostring(current_tree.xpath(f'//{tag}')[0]) == html.tostring(expected_tree.xpath(f'//{tag}')[0])
    assert current_tree.xpath('//@id') == expected_tree.xpath('//@id')
    assert current_tree.xpath('//@class') == expected_tree.xpath('//@class')
    for selector in ['//link', '//script']:
        assert [html.tostring(n) for n in current_tree.xpath(selector)] == [html.tostring(n) for n in expected_tree.xpath(selector)]
assert active == preview.replace(b'tc455-fidelity-preview-4', b'tc455-fidelity-2')
active_tree = html.fromstring(active)
assert active_tree.xpath('//meta[@name="syncboard-ui-release"]/@content') == ['tc455-fidelity-2']
assert active_tree.xpath('//body/@data-ui-release') == ['tc455-fidelity-2']
assert active_tree.xpath('//body/@class') == ['sb-scope sb-app sb-fidelity-v2 antialiased font-sans']
ids = active_tree.xpath('//@id')
assert all(count == 1 for count in Counter(ids).values())
assert active_tree.xpath('//script[@type="module"]/@src') == ['js/main.js?v=tc455-fidelity-2', 'js/task-fidelity-v2.js?v=tc455-task-1']
styles = [href.split('?')[0] for href in active_tree.xpath('//link[@rel="stylesheet"]/@href')]
assert styles[-3:] == ['css/fidelity-v2.css', 'css/fidelity-secondary-v2.css', 'css/task-fidelity-v2.css']
assert styles.index('css/kanban-v2.css') < styles.index('css/fidelity-v2.css')
assert styles.index('css/fluxo-v2.css') < styles.index('css/fidelity-v2.css')
immutable_app = [path for path in files if path.startswith(('app/', 'api/')) and path not in CHANGED]
print(json.dumps({
    'status': 'passed', 'evidence': 'current-desktop-cascade-pinned-source-contract',
    'baselineCommit': BASELINE, 'runtimeChanges': {path: contract['afterSha256'] for path, contract in manifest['runtimeChanges'].items()},
    'exactMarkerSubstitutionsPerHtml': 16, 'exactActiveIds': len(ids),
    'unchangedBaselineFiles': len(files) - len(CHANGED),
    'unchangedApplicationBackendAssetFiles': len(immutable_app),
    'checks': ['Four-file exact literal map', 'Normalized byte-equal HTML/head/body/imports/IDs/classes', 'All old tests/audits preserved', 'Actual cascade import order', 'JavaScript/API/backend/auth/configuration/brand assets unchanged'],
    'limits': 'Source proof only; computed cascade and pixel fidelity require browser review.',
}, indent=2), flush=True)

current_env = {**os.environ, 'TZ': 'UTC', 'SYNCBOARD_BASELINE_ROOT': str(ROOT), 'SYNCBOARD_FIDELITY_FIXTURE': ''}
run('CURRENT CANDIDATE: audited original actual-active-entry composed scenario', ['node', 'tests/check_fidelity_desktop_active_entry.mjs'], env=current_env)
run('CURRENT CANDIDATE: unmodified copy/progress/card/filter/drag regression; unchanged CSS assertions', ['node', 'tests/check_fidelity_copy.mjs'], env=current_env)

# The old aggregate pins preview3 CSS/markers. Its unmodified pass is useful
# historical evidence only, never evidence for corrected pixels or current CSS.
# A private read-tree index prevents staged new test files from leaking into its
# exact git ls-files assertion or altering the real worktree/index.
git_dir = git('rev-parse', '--absolute-git-dir').decode().strip()
current_hashes = {path: sha256((ROOT / path).read_bytes()) for path in files}
with tempfile.TemporaryDirectory(prefix='tc455-desktop-historical-') as directory:
    container = Path(directory)
    snapshot = container / 'snapshot'
    snapshot.mkdir()
    for path in files:
        target = snapshot / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(pinned(path))
        assert target.read_bytes() == pinned(path), f'Historical a965 snapshot drift: {path}'
    historical_env = {**current_env, 'GIT_DIR': git_dir, 'GIT_WORK_TREE': str(snapshot), 'GIT_INDEX_FILE': str(container / 'historical.index'), 'SYNCBOARD_BASELINE_ROOT': str(snapshot)}
    git('read-tree', BASELINE, cwd=snapshot, env=historical_env)
    assert set(git('ls-files', '-z', cwd=snapshot, env=historical_env).decode().rstrip('\0').split('\0')) == set(files)
    print(f'\nHISTORICAL EVIDENCE ONLY: all files in this temporary snapshot are {BASELINE}. The original activation aggregate restores an even earlier index for its nested legacy suites. None of the following historical passes tests the current corrected CSS or marker2 entry.', flush=True)
    run('HISTORICAL a965 SNAPSHOT ONLY: unmodified check_fidelity_activation.py', [sys.executable, 'tests/check_fidelity_activation.py'], cwd=snapshot, env=historical_env)
assert {path: sha256((ROOT / path).read_bytes()) for path in files} == current_hashes, 'Gate changed the candidate worktree'

syntax_files = [path for path in files if path.endswith('.js') and path.startswith(('app/js/', 'api/'))]
for path in syntax_files:
    command = ['node', '--input-type=module', '--check'] if path.startswith('app/js/') else ['node', '--check', path]
    subprocess.run(command, input=(ROOT / path).read_bytes() if path.startswith('app/js/') else None, cwd=ROOT, check=True)
run('Current active-entry runner syntax', ['node', '--check', 'tests/check_fidelity_desktop_active_entry.mjs'])
compile((ROOT / 'tests/check_fidelity_desktop_cascade.py').read_bytes(), 'check_fidelity_desktop_cascade.py', 'exec')
whitespace_args = ['git', '-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab', 'diff', '--check']
current_whitespace = subprocess.run([*whitespace_args, BASELINE, '--'], cwd=ROOT, capture_output=True, text=True)
assert (current_whitespace.returncode, current_whitespace.stdout, current_whitespace.stderr) == (0, '', ''), ('New correction whitespace', current_whitespace.returncode, current_whitespace.stdout, current_whitespace.stderr)
inherited_line = 417
assert active.splitlines()[inherited_line - 1] == pinned('app/index.html').splitlines()[inherited_line - 1] == b' ' * 20
assert pinned('app/ui-v2-fidelity-preview.html', PREVIEW_REF).splitlines()[inherited_line - 1] == b' ' * 20
historical_whitespace = subprocess.run([*whitespace_args, PREVIEW_REF, '--'], cwd=ROOT, capture_output=True, text=True)
expected_diagnostic = 'app/index.html:417: trailing whitespace.\n+' + ' ' * 20 + '\n'
assert (historical_whitespace.returncode, historical_whitespace.stdout, historical_whitespace.stderr) == (2, expected_diagnostic, ''), ('Only source-proven inherited diagnostic allowed', historical_whitespace.returncode, historical_whitespace.stdout, historical_whitespace.stderr)
for path in sorted(ADDITIONS):
    raw = (ROOT / path).read_bytes()
    assert raw.endswith(b'\n') and not raw.endswith(b'\n\n'), f'New-file EOF whitespace: {path}'
    assert all(line == line.rstrip(b' \t') for line in raw.splitlines()), f'New-file trailing whitespace: {path}'
print('WHITESPACE: correction versus a965 has no diagnostics; versus d717 only exact inherited app/index.html:417 (20 spaces) is allowed. All new files checked independently.', flush=True)
print(json.dumps({
    'status': 'passed', 'gate': 'TC455 desktop-cascade technical candidate',
    'baselineCommit': BASELINE, 'activeEntry': 'app/index.html', 'entrySha256': sha256(active),
    'currentEvidence': ['Exact CSS change map and HTML normalization', 'Original actual-active-entry scenario with unchanged behavioral assertion body', 'Unmodified current copy/progress regression'],
    'historicalEvidenceOnly': ['Unmodified old activation aggregate and its nested old integrated/eight-suite composed gates in isolated a965 snapshot'],
    'javascriptSyntaxFiles': len(syntax_files), 'newRunnerSyntax': 'passed',
    'remoteWrites': False, 'deploymentPerformed': False, 'liveVisualGateEstablished': False,
    'limits': 'No high-resolution or 100%-fidelity claim. Current-viewport, dark/reflow, form/menu and actual 1440/1920/2560 browser review remain separate, as do publication authorization and human validation.',
}, indent=2), flush=True)
