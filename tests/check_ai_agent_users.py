"""TC459 gate: pinned source scope, API/UI fixtures, current regressions and syntax."""
from pathlib import Path
import hashlib, json, subprocess
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'tests/fixtures/tc459-ai-agent-changes.json').read_text())
def run(args, **kwargs):return subprocess.run(args,cwd=ROOT,check=True,**kwargs)
for p,sha in m['blobs'].items():
 raw=(ROOT/p).read_bytes()
 if p in m['changes']:assert hashlib.sha256(raw).hexdigest()==m['changes'][p],p
 else:assert hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()==sha,p
css=(ROOT/'app/css/people-v2.css').read_text()
assert '.sb-app #userFormModal { top: var(--sb-header-height, 66px); }' in css
assert 'max-height: calc(100dvh - var(--sb-header-height, 66px) - 32px)' in css
for entry in ['app/index.html','app/ui-v2-fidelity-preview.html']:
 assert 'css/people-v2.css?v=tc459-ai-agent-2' in (ROOT/entry).read_text()
for p in (ROOT/'app/js').glob('*.js'):run(['node','--input-type=module','--check'],input=p.read_bytes())
for p in (ROOT/'api').rglob('*.js'):run(['node','--check',str(p)])
for name in ['ai_agent_users','people_v2','comment_mentions','profile_claims_recovery','startup_v2','task_fidelity_flows']:
 run(['node','tests/check_'+name+'.mjs'])
run(['git','diff','--check'])
print('PASS TC459: pinned additive scope; API strict defaults, 60 update combinations and auth independence; actual user form callbacks including cancel/reset; mention/profile/startup/task regressions; all frontend/backend JS syntax. Browser QA and live persistence separate.')
