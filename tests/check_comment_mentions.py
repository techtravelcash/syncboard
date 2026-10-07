"""TC458 release gate: pinned scope, current focused behavior, syntax and regressions."""
from pathlib import Path
import hashlib, json, subprocess
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'tests/fixtures/tc458-mention-changes.json').read_text())
def run(args, **kwargs): return subprocess.run(args,cwd=ROOT,check=True,**kwargs)
for p,sha in m['blobs'].items():
 raw=(ROOT/p).read_bytes()
 if p in m['changes']:
  assert hashlib.sha256(raw).hexdigest()==m['changes'][p]['afterSha256'],p
 else:
  assert hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()==sha,p
for p in m['blobs']:
 if p.startswith('app/js/') and p.endswith('.js'):run(['node','--input-type=module','--check'],input=(ROOT/p).read_bytes())
for test in ['check_comment_mentions.mjs','check_profile_claims_recovery.mjs','check_startup_v2.mjs']:
 run(['node','tests/'+test])
# Only the obsolete entry cache marker is adapted; all drag assertions are literal-original.
p=ROOT/'tests/check_drag_restore.mjs';s=p.read_text()
assert s.count('tc457-drag-1')==1
s=s.replace('tc457-drag-1','tc458-mentions-1').replace('import.meta.url',json.dumps(p.as_uri()))
run(['node','--input-type=module','--eval',s])
run(['git','diff','--check'])
print('PASS TC458 gate: all pre-existing files unchanged except ui.js insertion/dismissal and two entry cache markers; current mention/startup/profile/drag suites and frontend syntax passed. Historical composed freeze gates are not claimed against this intentional editor change. Browser QA separate.')
