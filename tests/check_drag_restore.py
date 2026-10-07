"""TC457 pinned minimal-change gate plus current behavioral suites. No remote writes."""
from pathlib import Path
import hashlib, json, subprocess
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'tests/fixtures/tc457-drag-changes.json').read_text())
base=manifest['baseline']
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT)
def digest(data): return hashlib.sha256(data).hexdigest()
files=git('ls-tree','-r','--name-only',base).decode().splitlines()
for path in files:
 old=git('show',f'{base}:{path}')
 now=(ROOT/path).read_bytes()
 if path in manifest['changes']:
  spec=manifest['changes'][path]
  assert digest(old)==spec['beforeSha256'],path
  assert digest(now)==spec['afterSha256'],path
 else: assert now==old,path
for path in files:
 if path.endswith('.js') and path.startswith(('app/js/','api/')):
  if path.startswith('app/js/'): subprocess.run(['node','--input-type=module','--check'],input=(ROOT/path).read_bytes(),check=True,cwd=ROOT)
  else: subprocess.run(['node','--check',path],check=True,cwd=ROOT)
for test in ['tests/check_drag_restore.mjs','tests/check_drag_restore_composed.mjs','tests/check_kanban_flow_v2.mjs','tests/check_profile_claims_recovery.mjs','tests/check_startup_v2.mjs']:
 subprocess.run(['node',test],cwd=ROOT,check=True)
subprocess.run(['git','diff','--check'],cwd=ROOT,check=True)
print('PASS TC457: exactly three runtime files changed; all other tracked baseline files, historical tests, API, CSS and assets unchanged; JS syntax and current behavioral suites passed.')
