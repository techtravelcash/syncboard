#!/usr/bin/env python3
"""TC-449 presentation boundary checks. No app/API/network writes.
Usage: python tests/check_task_space_v2.py [--baseline-root /path/to/parent-checkout]
The optional baseline checkout is read-only; otherwise reads the baseline via git show.
"""
import argparse
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASELINE = 'a5d3bcfdc9af1a63b5d579a7ee03d8f3c9e4dfd9'
p = argparse.ArgumentParser(); p.add_argument('--baseline-root', type=Path); args = p.parse_args()
def original(path):
    return subprocess.check_output(['git', 'show', f'{BASELINE}:{path}'], cwd=args.baseline_root or ROOT, text=True)
class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.ids = {}; self.contracts = []; self.labels = []; self.refs = []; self.feed(text)
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            assert a['id'] not in self.ids, f'Duplicate ID: {a["id"]}'
            self.ids[a['id']] = (tag, a)
        if tag == 'label': self.labels.append(a.get('for'))
        for key, value in attrs:
            if key.startswith('data-') or key in ('oninput', 'onclick') or (tag in ('input','textarea','select','option','form','button') and key in ('name','type','value','required','multiple','min','max','checked','selected')):
                self.contracts.append((tag, key, value))
            if key in ('src','href') and value and not value.startswith(('http','/','#','data:')):
                self.refs.append(value.split('?')[0])
def between(s, start, end):
    return s[s.index(start):s.index(end, s.index(start))]
html = (ROOT/'app/index.html').read_text(); old_html = original('app/index.html')
a, b = Page(old_html), Page(html)
assert set(a.ids) <= set(b.ids)
# Tag, data attributes, values and event contracts remain unchanged for existing IDs.
protected_attrs = ('name','type','value','required','multiple','min','max','checked','selected','rows','oninput','onclick','href','target')
for id, (tag, attrs) in a.ids.items():
    next_tag, next_attrs = b.ids[id]
    assert tag == next_tag, id
    for key in protected_attrs:
        assert attrs.get(key) == next_attrs.get(key), (id,key)
    for key, value in attrs.items():
        if key.startswith('data-') and key != 'data-ui-release': assert next_attrs.get(key) == value, (id,key)
old_modals=Page(old_html[old_html.index('<div id="taskModal"'):]); new_modals=Page(html[html.index('<div id="taskModal"'):])
assert Counter(old_modals.contracts) == Counter(new_modals.contracts), 'Modal field/data/event contract changed'
for field in ('taskTitle','taskDescription','taskResponsible','taskStatus','taskProject','taskPriority','taskDueDate','taskAzureLink','no-due-date-checkbox','ai-instruction','ai-result-text','homologadorSelect'):
    assert field in b.labels, f'Missing explicit field label: {field}'
assert b.ids['cancelBtn'][1]['type'] == 'button'
assert 'sb-task-form-footer' in html and 'As alterações só são enviadas ao salvar.' in html
assert 'Rascunho Calendar' in html and 'Agendar Reunião no Google Calendar' not in html
for dialog, title in (('taskModal','modalTitle'),('taskHistoryModal','modal-info-title'),('aiTitleModal','ai-title-heading'),('homologadorModal','homologadorTitle')):
    assert b.ids[dialog][1].get('role') == 'dialog'
    assert 'aria-modal' not in b.ids[dialog][1]
    assert b.ids[dialog][1].get('aria-labelledby') == title
assert b.ids['homologadorModal'][1].get('aria-describedby') == 'homologadorDescription'
assert 'homologadorDescription' in b.ids and 'homologador-heading' not in b.ids
for ref in b.refs: assert (ROOT/'app'/ref).is_file(), ref
# No changes to backend, integration adapters, state, upload, realtime, existing CSS or brand assets.
protected = ['app/js/api.js','app/js/state.js','app/js/signalr.js','app/staticwebapp.config.json','app/css/custom.css','app/css/detail-compat-v2.css','app/css/fluxo-v2.css','app/css/shell-v2.css','app/css/home-v2.css','app/css/kanban-v2.css','app/css/list-filters-v2.css','app/js/home-v2.js','app/js/shell-v2.js']
protected += subprocess.check_output(['git','ls-tree','-r','--name-only',BASELINE,'api','.github','app/assets/brand-v2'], cwd=args.baseline_root or ROOT, text=True).splitlines()
for path in protected: assert (ROOT/path).read_bytes() == subprocess.check_output(['git','show',f'{BASELINE}:{path}'],cwd=args.baseline_root or ROOT), path
main=(ROOT/'app/js/main.js').read_text(); old_main=original('app/js/main.js')
assert main == old_main, 'Task/form/AI/payload/permission handlers must remain untouched in this isolated candidate'
ui=(ROOT/'app/js/ui.js').read_text(); old_ui=original('app/js/ui.js')
assert ui[:ui.index('export function renderTaskHistory(')] == old_ui[:old_ui.index('export function renderTaskHistory(')], 'Home/board/list renderers outside this slice changed'
for start,end in [('export function setupResponsibleInput(', 'export function setupProjectSuggestions('),('export function setupProjectSuggestions(', 'export function setupCustomColorPicker('),('export function closeTaskHistory(', '// --- SETUP DO RICH TEXT EDITOR COM MENÇÕES'),('export function setupRichTextEditor(', 'export function showConfirmModal(')]:
    assert between(ui,start,end) == between(old_ui,start,end), start
assert "modal.setAttribute('aria-modal'" not in ui[ui.index('export function openProgressUpdateModal('):]
assert ui.count("'Progresso informado: 100%'") == 2
assert "'Tarefa Concluída!'" not in ui
progress_tail = ui[ui.index("    const progressInput = document.getElementById('progressInput');"):].replace("'Progresso informado: 100%'", "'Tarefa Concluída!'")
assert progress_tail == old_ui[old_ui.index("    const progressInput = document.getElementById('progressInput');"):], 'Progress callbacks/payload changed beyond presentation literal'
assert "api.updateTask(task.id, { \n                progress: task.progress, \n                missingToComplete: task.missingToComplete \n            });" in ui
for snippet in ("modalApproveBtn.dataset.taskId = task.id", "task.status === 'homologation'", "action=TEMPLATE&text=${encodeURIComponent(task.title)}", "hexToRgba(task.projectColor || '#94A3B8', 0.2)"):
    assert ui.count(snippet) == old_ui.count(snippet) > 0, snippet
css=(ROOT/'app/css/task-space-v2.css').read_text()
assert css.count('{') == css.count('}'), 'CSS braces'
assert 'font-size: 11px' not in css
assert '.sb-app #modal-info-homologador .sb-task-validation-status { font-size: 12px' in css
assert 'sb-task-validation-status text-[9px]' in ui
# CSS is app-scoped, never a blanket recolor of persisted content or project swatches.
assert not re.search(r'#[\w-]*(?:comments-feed|history-feed|comment-input-rich)\s+(?:\*|\[|\.|a\b|b\b|strong\b)',css)
assert '#current-color-bg {' not in css
assert not re.search(r'#modal-info-project\s*\{[^}]*\b(?:background|color)\s*:',css)
assert "#modal-approve-btn" in css and 'var(--sb-action)' in css
assert '.dark .sb-app .sb-task-detail-actions > button:not(#modal-approve-btn),' in css
assert '.dark .sb-app #modal-info-azure-link { color: var(--sb-focus); }' in css
assert '.dark .sb-app #responsible-input-container > div > button { color: #FFB6AD; }' in css
assert '.sb-app .sb-task-detail-actions #modal-approve-btn { background: var(--sb-action); color: #FFFFFF;' in css
from check_ui_v2 import contrast
contrast_pairs = {'dark detail actions':contrast('#9BB3FF','#1B2536'),'dark responsible removal on canvas':contrast('#FFB6AD','#111827'),'dark responsible removal on surface':contrast('#FFB6AD','#1B2536'),'primary approval':contrast('#FFFFFF','#244FDB')}
assert min(contrast_pairs.values()) >= 4.5
assert '#confirmDeleteBtn' not in css, 'Shared destructive intent must stay owned by existing shell policy'
for f in (ROOT/'app/js').glob('*.js'): subprocess.run(['node','--check',str(f)],check=True,capture_output=True)
print(json.dumps({'status':'passed','baseline':BASELINE,'original_ids':len(a.ids),'modal_contracts':len(old_modals.contracts),'protected_files':len(protected),'review_contrast':contrast_pairs,'checks':['all original IDs, field values, data attributes and callbacks retained','explicit labels, dialog names, truthful Calendar and draft copy','main.js byte-identical; progress callbacks, state/payload and approval conditions preserved','existing detail-compat and stored-rich-content styles preserved','all frontend JavaScript parses'],'limits':'Static checks do not establish rendered layout, focus trapping/restoration, keyboard selector navigation, physical mobile or backend behavior.'},indent=2,ensure_ascii=False))
