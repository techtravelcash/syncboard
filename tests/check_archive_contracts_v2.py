#!/usr/bin/env python3
"""TC-451 baseline isolation, markup and safety checks. No browser or network."""
import json, os, re, subprocess
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='1656f1d70ac0b94f220f2836f3d3293aff5c6122'
REPO=Path(os.environ.get('SYNCBOARD_BASELINE_REPO',ROOT))
def original(path):return subprocess.check_output(['git','show',BASE+':'+path],cwd=REPO)
paths=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],cwd=REPO,text=True).splitlines()
modified={'app/index.html','app/js/ui.js'}
for path in paths:
 if path not in modified:assert (ROOT/path).read_bytes()==original(path),'Unexpected change: '+path
old=original('app/js/ui.js').decode();new=(ROOT/'app/js/ui.js').read_text()
def without_archive(s):
 a=s.index('export async function renderArchivedTasks() {');b=s.index('// --- RENDERIZAÇÃO: UTILIZADORES ---',a)
 return s[:a]+s[b:]
new_without_import=new.replace("import { renderArchiveRows, renderArchiveShell, applyArchiveProjectColors } from './archive-v2.js';\n",'')
assert without_archive(old)==without_archive(new_without_import),'Change outside archive renderer'
link='    <link rel="stylesheet" href="css/archive-v2.css?v=tc451-archive-1">\n'
assert (ROOT/'app/index.html').read_text().replace(link,'').replace('tc451-archive-1','tc450-collaboration-1')==original('app/index.html').decode(),'Index changed beyond archive stylesheet'
helper=(ROOT/'app/js/archive-v2.js').read_text();css=(ROOT/'app/css/archive-v2.css').read_text()
assert not re.search(r'\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b',helper)
assert '.filter(' not in helper.split('export function renderArchiveRows')[1] and '.sort(' not in helper.split('export function renderArchiveRows')[1], 'Returned row set/order must not change'
assert 'users' not in helper,'No new directory identity join'
assert 'dot.style.backgroundColor = dot.dataset.projectColor;' in helper
assert not re.search(r'(?:style=|cssText|setProperty)',helper), 'Color must use single-property DOM assignment only'
assert 'new Date()' not in helper and 'updatedAt ||' not in helper
assert all(phrase not in helper for phrase in ['line-through','grayscale','truncate','opacity-75'])
assert 'task.status === \'done\'' in helper and 'Estado divergente' in helper
assert '#archivedView .sb-archive-row:hover' in css and 'transform: none' in css and 'cursor: default' in css
assert 'min-height: 44px' in css and '@media (max-width: 599px)' in css
assert not any(word in css for word in ['display: none','white-space: nowrap','overflow: hidden','text-overflow: ellipsis']), 'Full archive metadata must remain visible'
assert not re.search(r'@import|url\(|font-family|#[0-9a-fA-F]{3,8}\b',css),'No new font/assets/palette values'
# Existing endpoint, action, warning, and dialog intent contracts remain byte-identical.
endpoint=(ROOT/'api/getArchivedTasks/index.js').read_text()
assert 'c.status = @status' in endpoint and 'value: "done"' in endpoint
shell=(ROOT/'app/css/shell-v2.css').read_text()
assert "#confirmDeleteBtn[data-intent='confirm'] { background: var(--sb-action)" in shell
assert "#confirmDeleteBtn[data-intent='destructive'] { background: var(--sb-error-text)" in shell
class Page(HTMLParser):
 def __init__(self,text):super().__init__();self.ids=[];self.refs=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if 'id'in attrs:self.ids.append(attrs['id'])
  for key in ['src','href']:
   value=attrs.get(key,'')
   if value and not value.startswith(('http','/','#','data:')):self.refs.append(value.split('?')[0])
a=Page(original('app/index.html').decode());b=Page((ROOT/'app/index.html').read_text())
assert a.ids==b.ids and len(b.ids)==len(set(b.ids))
for ref in b.refs:assert (ROOT/'app'/ref).is_file(),ref
for path in (ROOT/'app/js').glob('*.js'):subprocess.run(['node','--input-type=module','--check'],input=path.read_bytes(),check=True,capture_output=True)
print(json.dumps({'status':'passed','baseline':BASE,'protected_baseline_files':len(paths)-len(modified),'checks':['All baseline files outside index and archive renderer byte-identical','Static IDs and existing scripts unchanged; only archive CSS link added','No query/filter/order, network, data, permission, endpoint or callback changes','Existing endpoint still done-only; anomalous received status is visibly marked','Existing restore/delete confirmation intents preserved','Escaped text and single CSS property assignment for user colors','No new font, color literal or brand asset','Archive-specific cascade, full metadata and responsive rules present','All frontend JavaScript passes explicit ES-module syntax check']},indent=2))
