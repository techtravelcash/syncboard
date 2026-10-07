"""TC461 login/loading contract and current runtime regressions. No production writes."""
from pathlib import Path
from html.parser import HTMLParser
import base64, hashlib, subprocess, json
ROOT=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
 def __init__(self,text):super().__init__();self.nodes=[];self.feed(text)
 def handle_starttag(self,tag,attrs):self.nodes.append((tag,dict(attrs)))
login=Page((ROOT/'app/login.html').read_text())
for tag,a in login.nodes:
 for attr in ('src','srcset'):
  if attr in a:assert a[attr].startswith(('data:','https://')), (tag,attr)
 if 'data-cube-source' in a:
  uri=a.get('srcset',a.get('src'));assert base64.b64decode(uri.split(',',1)[1],validate=True)==(ROOT/'app/assets'/a['data-cube-source']).read_bytes()
assert len([a for _,a in login.nodes if 'data-cube-source' in a])==2
for entry in ('index.html','ui-v2-fidelity-preview.html'):
 text=(ROOT/'app'/entry).read_text();assert 'css/cube-feedback.css?v=tc461-1' in text
 assert 'sb-cube--startup' in text and 'sb-cube--inline' in text
 assert 'role="status" aria-live="polite"' in text
 assert '(prefers-reduced-motion: no-preference)' in text
ui=(ROOT/'app/js/ui.js').read_text();assert 'sb-cube--archive' in ui
# No changes to request handling, navigation, approval, auth or task updates.
base=json.loads((ROOT/'tests/fixtures/tc461-source.json').read_text())
for path,sha in base['unchanged'].items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==sha,path
for path,sha in base['assets'].items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==sha,path
for path in (ROOT/'app/js').glob('*.js'):subprocess.run(['node','--input-type=module','--check'],input=path.read_bytes(),check=True)
for name in ['startup_v2','archive_v2','archive_actions_v2','people_v2','ai_agent_users','comment_mentions','profile_claims_recovery','task_fidelity_flows','approval_success','approval_feedback_callbacks']:
 subprocess.run(['node','tests/check_'+name+'.mjs'],cwd=ROOT,check=True)
subprocess.run(['python','tests/check_login_assets.py'],cwd=ROOT,check=True)
subprocess.run(['git','diff','--check'],cwd=ROOT,check=True)
print('PASS TC461: exact embedded GIF/PNG, reduced-motion fallback, existing loading lifecycles, unchanged auth/API and approval destination, syntax and current runtime regressions. Browser QA separate.')
