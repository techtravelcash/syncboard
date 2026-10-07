"""TC455 default activation gate: actual entry + separately labeled legacy evidence.

Read-only application checks. Temporary historical snapshot is automatically
removed. No browser, deployment, remote writes, or visual approval is performed.
Run: python tests/check_fidelity_activation.py
"""
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
PREVIEW_REF = 'd717428ecba55f7fd9752d30a13390462e725a0b'
LEGACY_REF = '20c48df793c91dd303abdfb0229701b64a905914'
PREVIEW_MARKER = b'tc455-fidelity-preview-3'
ACTIVE_MARKER = b'tc455-fidelity-1'
PREVIEW_SHA256 = '9231073c8d4bd8aa54504f7e4e950b6ca09a7708cfe120571fc0c35f3cb89897'
ACTIVE_SHA256 = '715617be6ff1c746eb053856e10273c5e5f60565e9404493b0bbfb290c8d6bdf'
ADDITIONS = {
    'tests/check_fidelity_activation.py',
    'tests/check_fidelity_active_entry.mjs',
    'tests/fixtures/tc455-active-entry-adaptations.json',
    'docs/tc455-default-activation.md',
}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def pinned(path, revision=PREVIEW_REF):
    return git('show', f'{revision}:{path}')


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def run(label, args, cwd=ROOT, env=None):
    print(f'\n--- {label} ---', flush=True)
    subprocess.run(args, cwd=cwd, env=env, check=True)


assert git('rev-parse', f'{PREVIEW_REF}^{{commit}}').decode().strip() == PREVIEW_REF
files = git('ls-tree', '-r', '--name-only', '-z', PREVIEW_REF).decode().rstrip('\0').split('\0')
current_files = set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').decode().rstrip('\0').split('\0'))
assert current_files == set(files) | ADDITIONS, {
    'unexpected': sorted(current_files - set(files) - ADDITIONS),
    'missing': sorted((set(files) | ADDITIONS) - current_files),
}
# Freeze every approved file, including original test/assertion/audit bytes,
# configuration, login, original brand assets, API/auth/models and preview HTML.
for path in files:
    assert not (ROOT / path).is_symlink(), f'Unexpected symlink: {path}'
    if path != 'app/index.html':
        assert (ROOT / path).read_bytes() == pinned(path), f'Approved file changed: {path}'

preview = pinned('app/ui-v2-fidelity-preview.html')
active = (ROOT / 'app/index.html').read_bytes()
assert sha256(preview) == PREVIEW_SHA256
assert preview.count(PREVIEW_MARKER) == 16 and ACTIVE_MARKER not in preview
assert active.count(ACTIVE_MARKER) == 16 and PREVIEW_MARKER not in active
assert active == preview.replace(PREVIEW_MARKER, ACTIVE_MARKER), 'Only exact marker/cache literal substitution is allowed'
assert sha256(active) == ACTIVE_SHA256
normalized = active.replace(ACTIVE_MARKER, PREVIEW_MARKER)
assert normalized == preview, 'Pinned byte equality after exact release normalization'

# Explicit active head/body/import/ID/class contracts supplement whole-byte parity.
expected_tree = html.fromstring(preview)
active_tree = html.fromstring(active)
normalized_tree = html.fromstring(normalized)
for tag in ['head', 'body']:
    expected = expected_tree.xpath(f'//{tag}')
    actual = normalized_tree.xpath(f'//{tag}')
    assert len(expected) == len(actual) == 1
    assert html.tostring(actual[0]) == html.tostring(expected[0]), f'Exact active {tag}'
assert active_tree.xpath('//meta[@name="syncboard-ui-release"]/@content') == [ACTIVE_MARKER.decode()]
assert active_tree.xpath('//body/@data-ui-release') == [ACTIVE_MARKER.decode()]
assert active_tree.xpath('//body/@class') == ['sb-scope sb-app sb-fidelity-v2 antialiased font-sans']
ids = active_tree.xpath('//@id')
assert ids == expected_tree.xpath('//@id') and all(count == 1 for count in Counter(ids).values())
assert active_tree.xpath('//@class') == expected_tree.xpath('//@class'), 'Exact full class sequence'
for selector in ['//link', '//script']:
    assert [html.tostring(node) for node in normalized_tree.xpath(selector)] == [html.tostring(node) for node in expected_tree.xpath(selector)], f'Exact active imports/configuration: {selector}'
modules = active_tree.xpath('//script[@type="module"]/@src')
assert modules == ['js/main.js?v=tc455-fidelity-1', 'js/task-fidelity-v2.js?v=tc455-task-1']
for tag in ['head', 'body']:
    assert len(re.findall(fr'<{tag}\b'.encode(), active, re.I)) == 1
immutable_app = [path for path in files if path.startswith(('app/', 'api/')) and path != 'app/index.html']
print(json.dumps({
    'status': 'passed', 'evidence': 'actual-active-entry-pinned-source-contract',
    'entry': 'app/index.html', 'entrySha256': sha256(active),
    'previewCommit': PREVIEW_REF, 'previewSha256': sha256(preview),
    'exactMarkerSubstitutions': 16, 'exactActiveIds': len(ids),
    'unchangedApprovedFiles': len(files) - 1,
    'unchangedApplicationBackendAssetFiles': len(immutable_app),
    'checks': ['Normalized byte equality', 'Exact head and body', 'Exact imports, inline configuration, IDs and classes', 'All original tests and audits unchanged', 'Runtime, optional-profile recovery, backend, auth, configuration and assets unchanged'],
    'limits': 'Source contracts only; the independent live visual prerequisite is not established by this gate.',
}, indent=2), flush=True)

active_env = {**os.environ, 'TZ': 'UTC', 'SYNCBOARD_BASELINE_ROOT': str(ROOT), 'SYNCBOARD_FIDELITY_FIXTURE': ''}
run('ACTUAL ACTIVE ENTRY: original composed scenario against final app/index.html', ['node', 'tests/check_fidelity_active_entry.mjs'], env=active_env)
run('Unchanged preview-3 copy and progress rendering regression', ['node', 'tests/check_fidelity_copy.mjs'], env=active_env)

# Old preview gates intentionally assert that the default is still 20c. Keep
# those test files intact and run them only inside this isolated historical
# snapshot. Their pass is NEVER described as exercising the final active index.
git_dir = git('rev-parse', '--absolute-git-dir').decode().strip()
with tempfile.TemporaryDirectory(prefix='tc455-legacy-preservation-') as directory:
    snapshot = Path(directory)
    for path in files:
        target = snapshot / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / path, target)
    (snapshot / 'app/index.html').write_bytes(pinned('app/index.html', LEGACY_REF))
    for path in files:
        expected = pinned(path, LEGACY_REF) if path == 'app/index.html' else (ROOT / path).read_bytes()
        assert (snapshot / path).read_bytes() == expected, f'Historical snapshot drift: {path}'
    legacy_env = {**active_env, 'GIT_DIR': git_dir, 'GIT_WORK_TREE': str(snapshot), 'SYNCBOARD_BASELINE_ROOT': str(snapshot)}
    print(f'\nLEGACY/DEFAULT-PRESERVATION EVIDENCE ONLY: temporary snapshot has historical {LEGACY_REF} index; final active index is NOT used by the next two gates.', flush=True)
    run('LEGACY SNAPSHOT: unmodified integrated preview source gate', [sys.executable, 'tests/check_fidelity_integrated.py'], cwd=snapshot, env=legacy_env)
    run('LEGACY SNAPSHOT: unmodified eight-suite composed preview gate', ['node', 'tests/check_fidelity_composed.mjs'], cwd=snapshot, env=legacy_env)
# Verify the gate never replaced or restored the real candidate index.
assert (ROOT / 'app/index.html').read_bytes() == active

syntax_files = [path for path in files if path.endswith('.js') and path.startswith(('app/js/', 'api/'))]
for path in syntax_files:
    command = ['node', '--input-type=module', '--check'] if path.startswith('app/js/') else ['node', '--check']
    if path.startswith('app/js/'):
        subprocess.run(command, input=(ROOT / path).read_bytes(), cwd=ROOT, check=True)
    else:
        subprocess.run(command + [path], cwd=ROOT, check=True)
run('Activation runner syntax', ['node', '--check', 'tests/check_fidelity_active_entry.mjs'])
# The exact approved preview contains a whitespace-only line that is new relative
# to the legacy index. Do not silently alter accepted HTML or disable whitespace
# checks repository-wide. Permit only this precisely source-proven diagnostic.
whitespace = subprocess.run(['git', '-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab', 'diff', '--check', PREVIEW_REF, '--'], cwd=ROOT, capture_output=True, text=True)
inherited_line = 417
assert active.splitlines()[inherited_line - 1] == preview.splitlines()[inherited_line - 1] == b' ' * 20
expected_diagnostic = 'app/index.html:417: trailing whitespace.\n+' + ' ' * 20 + '\n'
assert whitespace.returncode == 2 and whitespace.stdout == expected_diagnostic and whitespace.stderr == '', (whitespace.returncode, whitespace.stdout, whitespace.stderr)
for path in sorted(ADDITIONS):
    raw = (ROOT / path).read_bytes()
    assert raw.endswith(b'\n') and not raw.endswith(b'\n\n'), f'New-file EOF whitespace: {path}'
    assert all(line == line.rstrip(b' \t') for line in raw.splitlines()), f'New-file trailing whitespace: {path}'
print('WHITESPACE: exact inherited preview3 blank line app/index.html:417 (20 spaces) is the sole diff-check diagnostic. No new whitespace diagnostics; all added files checked.', flush=True)
print(json.dumps({
    'status': 'passed', 'gate': 'TC455 default activation technical candidate',
    'entry': 'app/index.html', 'entrySha256': sha256(active),
    'previewCommit': PREVIEW_REF, 'historicalDefaultCommit': LEGACY_REF,
    'activeEvidence': ['Exact pinned source/head/body/imports/IDs/classes', 'Actual final index composed interaction with exact active BODY attributes'],
    'separateLegacyEvidence': ['Unmodified integrated preview gate', 'Unmodified eight-suite composed preview gate on temporary historical-index snapshot'],
    'javascriptSyntaxFiles': len(syntax_files),
    'inheritedWhitespaceException': 'app/index.html:417, exactly 20 spaces from pinned preview3; raw diff --check exits 2 and no other diagnostic is allowed',
    'remoteWrites': False, 'deploymentPerformed': False, 'liveVisualGateEstablished': False,
    'limits': 'Technical candidate only. Independent live screenshot/geometry and native-browser review, authorization, exact-commit deployment verification and human validation remain separate. Historical gate passes do not test the active entry.',
}, indent=2), flush=True)
