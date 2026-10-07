#!/usr/bin/env python3
import json,re,subprocess
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='7ba90c52e3221554c6bf1ec8bc82a72701913814'
def original(p):return subprocess.check_output(['git','show',BASE+':'+p],cwd=ROOT)
protected=['app/js/main.js','app/js/api.js','app/js/state.js','app/js/signalr.js','app/staticwebapp.config.json','app/login.html','app/css/custom.css','app/css/shell-v2.css','app/css/detail-compat-v2.css']
protected+=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE,'api','.github'],cwd=ROOT,text=True).splitlines()
for p in protected:assert (ROOT/p).read_bytes()==original(p),p
old=original('app/js/ui.js').decode();new=(ROOT/'app/js/ui.js').read_text()
def outside_home(s):
 a=s.index('export function renderHomeView() {');b=s.index('// --- RENDERIZAÇÃO: KANBAN ---',a)
 return s[:a]+s[b:]
new_without_import=re.sub(r"^import \{[^\n]+\} from './home-v2.js';\n",'',new,flags=re.M)
new_without_import=new_without_import.replace("    const restoreHomeFocus = () => {\n        if (state.currentView === 'home' && !state.returnToNotifications) {\n            restoreHomeTaskFocus(document.getElementById('homeView'), taskId);\n        }\n    };\n",'')
new_without_import=re.sub(r'^ +restoreHomeFocus\(\);\n','',new_without_import,flags=re.M)
new_without_import=new_without_import.replace("    // Preserve only the focused Home metric before hiding the view detaches focus.\n    const focusedHomeMetric = state.currentView === 'home' && home?.contains(document.activeElement)\n        ? document.activeElement.closest('.metric-card')?.dataset.filter : undefined;\n\n",'')
new_without_import=new_without_import.replace("            if (focusedHomeMetric) [...home.querySelectorAll('.metric-card')].find(button => button.dataset.filter === focusedHomeMetric)?.focus({preventScroll: true});\n",'')
assert outside_home(old)==outside_home(new_without_import),'Non-Home renderer/handler changed'
model=(ROOT/'app/js/home-v2.js').read_text()
assert not re.search(r'\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b',model)
for key in ('todo','stopped','inprogress','homologation','publication','overdue'):assert "key: '"+key+"'" in new
for id in ('home-metric-cards','home-list-title','home-list-icon','home-dynamic-list'):assert 'id="'+id+'"' in new
assert 'aria-pressed' in new and 'container.dataset.homeFilter' in new
assert 'renderTaskHistory(taskId)' in new and 'highlightTask(taskId, false)' in new
assert "myActiveTasks.length ? 'Nenhuma tarefa nesta seleção' : 'Nenhuma tarefa pessoal carregada'" in new
class Page(HTMLParser):
 def __init__(self,s):super().__init__();self.ids=[];self.refs=[];self.feed(s)
 def handle_starttag(self,t,a):
  d=dict(a)
  if 'id'in d:self.ids.append(d['id'])
  for k in ('src','href'):
   v=d.get(k,'')
   if v and not v.startswith(('http','/','#','data:')):self.refs.append(v.split('?')[0])
a=Page(original('app/index.html').decode());b=Page((ROOT/'app/index.html').read_text());assert a.ids==b.ids
for ref in b.refs:assert (ROOT/'app'/ref).is_file(),ref
for js in (ROOT/'app/js').glob('*.js'):subprocess.run(['node','--check',str(js)],check=True,capture_output=True)
print(json.dumps({'status':'passed','protected_files':len(protected),'checks':['Home renderer/import plus scoped Home focus hooks changed in existing ui.js','All static index IDs preserved','No API/state/storage changes','Six native metric selectors with pressed state','Existing task-opening callbacks preserved','Honest loaded-subset and empty-selection presentation','All local resources and frontend syntax valid']},indent=2))
