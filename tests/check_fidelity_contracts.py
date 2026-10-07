"""TC-455 opt-in preview contracts. Source/markup checks are not visual acceptance."""
from pathlib import Path
import os, re, subprocess, hashlib, json
from collections import Counter
from lxml import html
ROOT=Path(__file__).resolve().parents[1]
BASE='20c48df793c91dd303abdfb0229701b64a905914'
REPO=Path(os.environ.get('SYNCBOARD_BASELINE_ROOT','/workspace/shared/syncboard_ui_v2_fidelity'))
def original(path): return subprocess.check_output(['git','show',f'{BASE}:{path}'],cwd=REPO)
def read(path): return (ROOT/path).read_text()
def section(source,start,end): return source[source.index(start):source.index(end,source.index(start))]
paths=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],cwd=REPO,text=True).splitlines()
modified={'app/js/ui.js','app/js/main.js','app/js/shell-v2.js'}
for path in paths:
    if path not in modified: assert (ROOT/path).read_bytes()==original(path), f'Unexpected baseline mutation: {path}'
base=html.fromstring(original('app/index.html')); preview=html.fromstring(read('app/ui-v2-fidelity-preview.html'))
base_ids=Counter(base.xpath('//@id'));new_ids=Counter(preview.xpath('//@id'))
assert not [key for key,count in new_ids.items() if count>1], 'Duplicate preview IDs'
assert set(base_ids)<=set(new_ids), f'Lost IDs: {set(base_ids)-set(new_ids)}'
assert 'sb-fidelity-v2' in preview.xpath('//body/@class')[0]
assert 'sb-fidelity-v2' not in base.xpath('//body/@class')[0]
assert preview.get_element_by_id('addTaskBtn').getparent().get('id')=='fidelity-page-actions'
assert preview.get_element_by_id('orb-filter').getparent().get('id')=='main-content'
assert preview.get_element_by_id('notification-orb-badge').getparent().get('id')=='fidelity-notifications-toggle'
assert preview.get_element_by_id('shell-filter-panel').getparent().get('hidden') is not None
assert preview.get_element_by_id('main-content').xpath('./header')[0].get('id')=='fidelity-page-header'
for id in ['fidelity-project-filter','fidelity-responsible-filter','fidelity-priority-filter','fidelity-status-filter']:
    select=preview.get_element_by_id(id); assert select.tag=='select' and select.get('aria-label')
for node in preview.xpath('//label[@for]'): assert node.get('for') in new_ids
for node in preview.xpath('//*[@aria-controls]'):
    for id in node.get('aria-controls').split(): assert id in new_ids
base_css=[p.split('?')[0] for p in base.xpath('//link[@rel="stylesheet"]/@href')]
new_css=[p.split('?')[0] for p in preview.xpath('//link[@rel="stylesheet"]/@href')]
assert new_css[:len(base_css)]==base_css, 'Legacy CSS cascade/order changed'
assert new_css[-1]=='css/fidelity-v2.css'
assert preview.xpath('//script[@type="module"]/@src')[0].split('?')[0]=='js/main.js'
# No modal form or handler identities changed by shell work.
for id in ['taskModal','taskHistoryModal','homologadorModal','notificationsModal','userFormModal','confirmModal']:
    b=base.xpath(f'//*[@id="{id}"]');n=preview.xpath(f'//*[@id="{id}"]')
    if b: assert html.tostring(b[0])==html.tostring(n[0]),f'Modal changed: {id}'
ui=read('app/js/ui.js');main=read('app/js/main.js');old_ui=original('app/js/ui.js').decode();old_main=original('app/js/main.js').decode()
assert ui[ui.index('// --- MODAL: DETALHES ---'):]==old_ui[old_ui.index('// --- MODAL: DETALHES ---'):], 'Details, state actions, editor or payloads changed'
assert section(ui,'// --- EVENT LISTENERS ---','// --- LOGICA DE FILTRO ---')==section(old_ui,'// --- EVENT LISTENERS ---','// --- LOGICA DE FILTRO ---')
for begin,end in [('export function renderHomeView()', '// --- RENDERIZAÇÃO: KANBAN'),('export function renderListView()', '// --- ROTEADOR UI')]:
    assert section(ui,begin,end)==section(old_ui,begin,end),f'Sibling renderer modified: {begin}'
assert section(main,'function updateUserProfileUI()', '// --- DRAG AND DROP')==section(old_main,'function updateUserProfileUI()', '// --- DRAG AND DROP'), 'Photo claims guard changed'
assert section(main,"document.addEventListener('DOMContentLoaded'",'// --- ATUALIZA PERFIL')==section(old_main,"document.addEventListener('DOMContentLoaded'",'// --- ATUALIZA PERFIL'), 'Startup changed'
assert section(main,'function openHomologadorModal(', '// --- EVENT LISTENERS ---')==section(old_main,'function openHomologadorModal(', '// --- EVENT LISTENERS ---')
assert main[main.index('    // Shell presentation owns panel state'):]==old_main[old_main.index('    // Shell presentation owns panel state'):], 'Existing handlers changed'
assert section(main,'                    const itemEl = evt.item;', '// Gerencia o modal de seleção do homologador')==section(old_main,'                    const itemEl = evt.item;', '// Gerencia o modal de seleção do homologador'), 'Drag/order payload changed'
assert section(ui,'function filterTasks(tasks)', '    return (typeof isFidelityV2')==section(old_ui,'function filterTasks(tasks)', '    return filtered;'), 'Existing filter semantics changed'
css=read('app/css/fidelity-v2.css')
for selector in re.findall(r'([^{}]+)\{',re.sub(r'/\*.*?\*/','',css,flags=re.S)):
    if selector.strip().startswith('@'): continue
    for item in selector.split(','):
        assert 'body.sb-fidelity-v2' in item, f'Unscoped CSS: {item}'
for rule in ['--sb-sidebar-width: 212px','--sb-header-height: 67px','--fidelity-gutter: 34px','--fidelity-top: 31px','grid-template-columns: repeat(5, minmax(214px, 1fr))','@media (min-width: 1650px)','@media (max-width: 1000px)','--sb-sidebar-width: 185px','@media (max-width: 680px)','flex: 0 0 220px','flex-basis: 258px','min-height: 104px','position: static; top: auto; left: auto; right: auto','grid-column: 1; grid-row: 2','pointer-events: none','height: 4px']:
    assert rule in css,rule
assert "document.body?.classList.contains('sb-fidelity-v2') ? '(max-width: 680px)' : '(max-width: 767px)'" in read('app/js/shell-v2.js'), 'Preview680/default767 drawer breakpoints must match their CSS'
assert '@media (min-width: 681px) and (max-width: 767px)' in css, 'Neutralize legacy compact rules between681–767'
assert '.sb-shell-mobile-only { display: none; }' in css[css.index('@media (min-width: 681px)'):]
assert '#shell-account-panel { position: absolute;' in css[css.index('@media (min-width: 681px)'):]
assert '--sb-sidebar-width: 0px' in css[css.index('@media (max-width: 680px)'):], 'Mobile layout cannot keep desktop gutter'
assert css.count('grid-column: 1; grid-row: 2')==2, 'Empty placeholder and Sortable target must share the same lane region'
assert 'fidelity-mobile-nav' in read('app/js/shell-v2.js'), 'Mobile modal drawer must inert new navigation'
assert "if (element) element.inert = true" in read('app/js/shell-v2.js'), 'Default page has no new nav; null-check required'
helper=read('app/js/fidelity-v2.js')
assert not re.search(r'fetch\(|localStorage|sessionStorage|api\.',helper)
assert not re.search(r'DEM-\d|dados de exemplo|review-bar|prototype\.js|DM</',read('app/ui-v2-fidelity-preview.html')+helper)
print(json.dumps({'status':'passed','checks':['All unowned baseline20c files byte-identical','Default index unchanged; real preview inherits full CSS cascade/API/bootstrap','All existing IDs and modal structures preserved','CTA moved to hero; filters inside main; existing unread badge moved to bell','Native labels and targets valid','Existing callback/state/drag payloads byte-identical; guarded photo startup intact','All new CSS scoped; five flexible columns and intentional responsive widths','Empty real Sortable area min104px; sibling placeholder shares grid row without draggable children','Mobile nav included in modal drawer inertness','No helper API/storage writes or demo data'],'limits':'Static geometry contracts and DOM structure only; browser visual and pointer QA still required'},indent=2))
