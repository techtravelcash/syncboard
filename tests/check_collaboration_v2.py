#!/usr/bin/env python3
"""TC-450 static scope/contracts. Read-only baseline; no git refs, network or API calls."""
import argparse, json, re, subprocess, sys
sys.dont_write_bytecode=True
from html.parser import HTMLParser
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]
BASELINE='2ddbabf398bd744d3509209ae8dbb6b452bd038d'
p=argparse.ArgumentParser(); p.add_argument('--baseline-repo',type=Path,default=ROOT); p.add_argument('--baseline-ref',default=BASELINE); args=p.parse_args(); BASELINE=args.baseline_ref
def old(path): return subprocess.check_output(['git','show',f'{BASELINE}:{path}'],cwd=args.baseline_repo).decode()
def segment(s,a,b): return s[s.index(a):s.index(b,s.index(a))]
class Page(HTMLParser):
 def __init__(self,s): super().__init__();self.ids={};self.contracts=[];self.feed(s)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:
   assert a['id'] not in self.ids, a['id'];self.ids[a['id']]=(tag,a)
  for k,v in attrs:
   if (k.startswith('data-') and k != 'data-ui-release') or k in ('onclick','oninput') or (tag in ('button','input','textarea','select','option','form') and k in ('type','name','value','required','multiple','min','max','checked','selected')):self.contracts.append((tag,k,v))
html=(ROOT/'app/index.html').read_text(); prior=old('app/index.html'); a,b=Page(prior),Page(html)
assert set(a.ids)<=set(b.ids)
assert Counter(a.contracts)==Counter(b.contracts)
for id,(tag,attrs) in a.ids.items():
 assert b.ids[id][0]==tag,id
 for k in ('name','type','value','required','multiple','min','max','rows','checked','selected','onclick','oninput','href','target'):
  assert attrs.get(k)==b.ids[id][1].get(k),(id,k)
assert b.ids['deleteConfirmModal'][1]['role']=='dialog'
assert b.ids['deleteConfirmModal'][1]['aria-labelledby']=='confirm-dialog-title'
assert b.ids['deleteConfirmModal'][1]['aria-describedby']=='confirm-dialog-description'
assert 'aria-modal' not in b.ids['deleteConfirmModal'][1]
assert b.ids['task-attachment-input'][1]['aria-describedby']=='attachment-selection-help'
assert 'hidden' not in b.ids['task-attachment-input'][1]['class'].split()
assert html.index('css/collaboration-v2.css')>html.index('css/detail-compat-v2.css')
paths=subprocess.check_output(['git','ls-tree','-r','--name-only',BASELINE],cwd=args.baseline_repo,text=True).splitlines()
protected=[p for p in paths if p.startswith(('api/','.github/','app/assets/','app/css/')) or p in ['app/js/main.js','app/js/api.js','app/js/state.js','app/js/signalr.js','app/staticwebapp.config.json','app/login.html']]
for path in protected:assert (ROOT/path).read_bytes()==subprocess.check_output(['git','show',f'{BASELINE}:{path}'],cwd=args.baseline_repo),path
ui=(ROOT/'app/js/ui.js').read_text();base=old('app/js/ui.js')
# Changes are confined to these renderer/chrome segments. Everything else remains byte-identical.
windows=[('export function showToast(', '// --- RENDERIZAÇÃO: CARD DE TAREFA ---'),('    // Histórico\n','    // =================================================================\n    // 3. ANIMAÇÃO'),('export function setupRichTextEditor(', '// --- UTILITÁRIOS ---')]
u0,b0=ui,base
for start,end in windows:
 u0=u0.replace(segment(u0,start,end),'__PRESENTATION_WINDOW__')
 b0=b0.replace(segment(b0,start,end),'__PRESENTATION_WINDOW__')
assert u0==b0,'Outside-scope renderer, callback or state code changed'
# Exact shared confirm callbacks, send callback, identities and persisted mention insertion remain unchanged.
for start,end in [('export function showDestructiveConfirmModal(', 'export async function updateNotificationBadge('),('    const sendBtn = document.getElementById(\'add-comment-btn\');','// --- FUNÇÃO AUXILIAR: FECHAR MODAL ---'),('            const normalize = (value)', '            if (isMe) {'),('    function insertMention(', '// --- UTILITÁRIOS ---')]:
 assert segment(ui,start,end)==segment(base,start,end),start
mention=segment(ui,'export function setupRichTextEditor(','// --- UTILITÁRIOS ---')
# Native keyboard button is the only mention-menu markup change; event callbacks/data stay literal-identical.
mention=mention.replace('<button type="button" class="mention-item"','<div class="mention-item" ').replace('alt="" style="width: 24px; height: 24px;','style="width: 24px; height: 24px;').replace('                    </button>\n                `).join','                    </div>\n                `).join')
assert mention==segment(base,'export function setupRichTextEditor(','// --- UTILITÁRIOS ---')
for attr in ('data-task-id','data-comment-index','data-comment-key','data-comment-text','data-index','data-blob-name','data-cmd','data-email','data-name','data-pic'):
 assert re.findall(attr+r'="[^"]*"',ui)==re.findall(attr+r'="[^"]*"',base),attr
assert ui.count('${c.text}')==base.count('${c.text}')==2
assert "const displayAuthor = escapeHomeText(authorName || 'Autor não informado');" in ui
assert 'const displayFileName = escapeHomeText(fileName);' in ui
assert "${isLocalFile ? 'Selecionado neste formulário' : (containerId === 'modal-info-attachments' ? 'Vinculado à tarefa' : 'Arquivo com link')}" in ui
assert 'Editado em ${formatDateTime(c.editedAt)}' in ui
css=(ROOT/'app/css/collaboration-v2.css').read_text()
assert css.count('{')==css.count('}')
assert '11px' not in css and '400 12px/1.5' in css
assert '@import' not in css and 'url(' not in css,'No new fonts/assets/providers'
assert '#confirmDeleteBtn[data-intent=\'confirm\'] { background: var(--sb-action);' in css
assert '#confirmDeleteBtn[data-intent=\'destructive\'] { background: var(--sb-error-text);' in css
assert '#rich-mention-suggestions .mention-item' in css and 'color: var(--sb-text) !important' in css
assert '#comments-feed > .sb-collab-comment > .sb-collab-comment-main' in css and 'max-width: 100% !important' in css
assert 'padding: 12px !important' in css and 'overflow-wrap: anywhere !important' in css
assert 'html.dark body.sb-app #comments-feed .mention-tag' in css
assert '.dark .sb-app #comments-feed .delete-comment-btn { color: #FFB6AD; }' in css
assert 'display: none' not in segment(css,'.sb-app #rich-mention-suggestions,','.sb-app #rich-mention-suggestions .mention-item {')
from check_ui_v2 import contrast
pairs={'body on surface':contrast('#111827','#FFFFFF'),'metadata on canvas':contrast('#526174','#F5F7FA'),'primary':contrast('#FFFFFF','#244FDB'),'destructive':contrast('#FFFFFF','#A62A24'),'dark text':contrast('#F5F7FA','#1B2536'),'dark edit':contrast('#9BB3FF','#1B2536'),'dark delete':contrast('#FFB6AD','#1B2536'),'dark mention':contrast('#9BB3FF','#253550')}
assert min(pairs.values())>=4.5,pairs
for file in (ROOT/'app/js').glob('*.js'):subprocess.run(['node','--check',str(file)],check=True,capture_output=True)
print(json.dumps({'status':'passed','baseline':BASELINE,'ids_preserved':len(a.ids),'protected_files':len(protected),'contrast':pairs,'checks':['Existing IDs, types, datasets, values and inline events preserved','main.js/API/state/SignalR/backend/config/assets/styles unchanged','Shared confirmation/send/identity/mention insertion callbacks byte-identical','Local/existing-link/task-linked state labels do not infer upload or save success','Scoped cascade overrides account for legacy important widths, padding and light detail rules','All frontend JavaScript parses'],'limits':'Static contrast/specifier checks are not browser computed styles, layout, keyboard or end-to-end validation.'},ensure_ascii=False,indent=2))
