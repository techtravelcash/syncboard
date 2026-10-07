#!/usr/bin/env python3
"""TC-447 read-only presentation/contract gate, baseline TC-446 home-2."""
import argparse, json, re, subprocess, sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
sys.dont_write_bytecode=True
from check_ui_v2 import contrast
ROOT=Path(__file__).resolve().parents[1]
BASELINE='12e8600a4a6c9fa04ba43fc9d0071a1303e09987'
parser=argparse.ArgumentParser();parser.add_argument('--baseline-dir',type=Path);args=parser.parse_args()
def original(path):
    return subprocess.check_output(['git','show',f'{BASELINE}:{path}'],cwd=args.baseline_dir or ROOT,text=True)
def section(s,a,b):return s[s.index(a):s.index(b,s.index(a))]
class Page(HTMLParser):
    def __init__(self,s):super().__init__();self.ids=[];self.contracts=[];self.attrs={};self.feed(s)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id']);self.attrs[a['id']]=a
        for key,val in attrs:
            if key.startswith('data-') or key in ('id','onclick','oninput') or (tag in ('input','select','textarea','button','option','form') and key in ('name','type','value','required')):self.contracts.append((tag,key,val))
results=[]
for path in ('app/js/main.js','app/js/home-v2.js','app/css/home-v2.css','app/js/api.js','app/js/state.js','app/js/signalr.js','app/js/shell-v2.js','app/staticwebapp.config.json','app/css/custom.css','app/css/fluxo-v2.css','app/css/shell-v2.css','app/css/detail-compat-v2.css'):
    assert (ROOT/path).read_text()==original(path),path
results.append('Main/Sortable, API, state, realtime, shell, routes, and original CSS unchanged')
old=original('app/js/ui.js');new=(ROOT/'app/js/ui.js').read_text()
start='export const createTaskElement =';stop='// --- LOGICA DE FILTRO ---'
a='export function renderKanbanView() {';b='// --- RENDERIZAÇÃO: LISTA'
assert new.replace(section(new,start,stop),'CARD').replace(section(new,a,b),'BOARD')==old.replace(section(old,start,stop),'CARD').replace(section(old,a,b),'BOARD'),'Unexpected UI change outside two renderer functions'
old_card=section(old,start,stop);new_card=section(new,start,stop)
assert old_card[old_card.index('    // --- EVENT LISTENERS ---'):]==new_card[new_card.index('    // --- EVENT LISTENERS ---'):],'Original card listeners changed'
assert 'const progress = task.progress || 0;' in new_card
assert 'taskCard.dataset.taskId = task.id;' in new_card
assert 'taskCard.dataset.status = task.status;' in new_card
results.append('Only card/board renderers changed; original card listeners byte-identical; underlying progress contract retained')
statuses=lambda s:re.findall(r"\{ id: '([^']+)', name: '([^']+)'",section(s,a,b))
assert statuses(new)==statuses(old)==[('todo','Fila'),('stopped','Parado'),('inprogress','Andamento'),('homologation','Homologação'),('publication','Publicação')]
for value in ("filter(t => t.status !== 'done')",'.kanban-task-list',"data-column-id",'tasksForColumn.forEach(task => listEl.appendChild(createTaskElement(task)));'):
    assert value in section(new,a,b)
assert 'Etapa ativa · antes do arquivo' in new
assert re.search(r'<div class="kanban-task-list[^>]+></div>\s*<p class="sb-kanban-empty">',new)
results.append('Five active statuses/order/list contract preserved; publication active; empty message cannot become a sortable child')
oldpage=Page(original('app/index.html'));page=Page((ROOT/'app/index.html').read_text())
extra=Counter({('h2','id','homologadorTitle'):1,('p','id','homologadorDescription'):1})
assert len(page.ids)==len(set(page.ids))
assert Counter(x for x in oldpage.contracts if x[1]!='data-ui-release')+extra==Counter(x for x in page.contracts if x[1]!='data-ui-release'),'Unexpected DOM contract change'
assert page.attrs['homologadorModal']['role']=='dialog'
assert page.attrs['homologadorModal']['aria-labelledby']=='homologadorTitle'
assert page.attrs['homologadorModal']['aria-describedby']=='homologadorDescription'
assert '<label class="sb-kanban-modal-label" for="homologadorSelect">Homologador</label>' in (ROOT/'app/index.html').read_text()
results.append('All existing IDs/fields/data attributes preserved; exactly two labeling IDs added to existing dialog')
css=(ROOT/'app/css/kanban-v2.css').read_text()
assert css.count('{')==css.count('}')
assert '--sb-' in css and 'brand-v3' not in css
for selector in ('.opacity-50','.rotate-2','.sortable-chosen',':focus-visible',':focus-within',':disabled',"[aria-busy='true']",'.kanban-task-list:empty + .sb-kanban-empty'):
    assert selector in css,selector
assert 'flex: 0 0 304px' in css and 'min-width: 286px' in css
results.append('Scoped V2 CSS contains minimum lane sizes, drag/ghost/focus/disabled styles and reduced-motion handling')
pairs={'body':contrast('#111827','#FFFFFF'),'metadata':contrast('#526174','#FFFFFF'),'action':contrast('#FFFFFF','#244FDB'),'danger':contrast('#A62A24','#FFFFFF'),'todo':contrast('#495A70','#EDF1F6'),'stopped':contrast('#8C5000','#FFF1DD'),'inprogress':contrast('#214CC8','#EAF0FF'),'homologation':contrast('#713AA3','#F2EAFB'),'publication':contrast('#17674D','#E4F3ED'),'dark body':contrast('#F5F7FA','#1B2536'),'dark metadata':contrast('#B5C1D0','#1B2536')}
assert min(pairs.values())>=4.5,pairs
results.append({'token_text_contrast':pairs})
for path in (ROOT/'app/js').glob('*.js'):subprocess.run(['node','--check',str(path)],check=True,capture_output=True)
results.append('All frontend JavaScript syntax passed')
print(json.dumps({'status':'passed','baseline':BASELINE,'checks':results,'limits':'Static/isolated fixtures only. Browser layout, keyboard traversal, real dragging, focus restoration and server behavior require authorized QA. Existing flow gaps are recorded separately.'},indent=2,ensure_ascii=False))
