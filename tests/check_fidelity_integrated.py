"""TC455 composed preview source contracts. Does not assess pixels or deployment."""
from pathlib import Path
from collections import Counter
import hashlib, json, re, subprocess, tempfile
from lxml import html
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'tests/fixtures/tc455/reviewed-composition.json').read_text())
REF=manifest['baseline']
def original(path):return subprocess.check_output(['git','show',f'{REF}:{path}'],cwd=ROOT)
def text(path):return (ROOT/path).read_text()
def digest(raw):return hashlib.sha256(raw).hexdigest()
def section(s,a,b):
 i=s.index(a);return s[i:s.index(b,i)]
changed={'app/js/main.js','app/js/ui.js','app/js/shell-v2.js'}
files=subprocess.check_output(['git','ls-tree','-r','--name-only',REF],cwd=ROOT,text=True).splitlines()
for p in files:
 if p not in changed:assert (ROOT/p).read_bytes()==original(p),p
for p,sha in manifest['owned_runtime_hashes'].items():assert digest((ROOT/p).read_bytes())==sha,p
ui=text('app/js/ui.js'); old_ui=original('app/js/ui.js').decode()
for part in manifest['ui_slices']:assert digest(section(ui,part['start'],part['end']).encode())==part['sha256'],part['name']
assert ui[ui.index('// --- MODAL: DETALHES ---'):]==old_ui[old_ui.index('// --- MODAL: DETALHES ---'):]
assert section(ui,'// --- EVENT LISTENERS ---','// --- LOGICA DE FILTRO ---')==section(old_ui,'// --- EVENT LISTENERS ---','// --- LOGICA DE FILTRO ---')
main=text('app/js/main.js'); old_main=original('app/js/main.js').decode()
for a,b in [("document.addEventListener('DOMContentLoaded'",'// --- ATUALIZA PERFIL'),('function updateUserProfileUI()','// --- DRAG AND DROP'),('function openHomologadorModal(','// --- EVENT LISTENERS ---'),('                    const itemEl = evt.item;','// Gerencia o modal de seleção do homologador')]:assert section(main,a,b)==section(old_main,a,b),a
assert main[main.index('    // Shell presentation owns panel state'):]==old_main[old_main.index('    // Shell presentation owns panel state'):]
base=html.fromstring(original('app/index.html')); preview_source=text('app/ui-v2-fidelity-preview.html');preview=html.fromstring(preview_source)
ids=Counter(preview.xpath('//@id'));assert all(n==1 for n in ids.values())
assert set(base.xpath('//@id'))<=set(ids)
assert 'sb-fidelity-v2' in preview.xpath('//body/@class')[0]
assert 'sb-fidelity-v2' not in base.xpath('//body/@class')[0]
protected=('name','type','value','required','multiple','min','max','checked','selected','rows','oninput','onclick','href','target','rel')
for old in base.xpath('//*[@id]'):
 new=preview.get_element_by_id(old.get('id'))
 if old.get('id')=='current-view-label':assert (old.tag,new.tag)==('h1','span') # breadcrumb label; new page hero supplies h1
 else:assert old.tag==new.tag,old.get('id')
 for attr in protected:
  if attr in old.attrib:assert attr in new.attrib and old.get(attr)==new.get(attr),(old.get('id'),attr)
 for attr,value in old.items():
  if attr.startswith('data-'):assert new.get(attr)==value,(old.get('id'),attr)
for field in base.xpath('//input|//textarea|//select'):
 if not field.get('id'):continue
 new=preview.get_element_by_id(field.get('id'))
 assert [dict(x.attrib) for x in field.xpath('.//option')]==[dict(x.attrib) for x in new.xpath('.//option')]
for key in ['taskModal','taskHistoryModal']:
 expected=html.fromstring(text(f'app/fragments/{key}-fidelity-v2.html'))
 assert html.tostring(preview.get_element_by_id(key),with_tail=False)==html.tostring(expected,with_tail=False),key
for key in ['homologadorModal','notificationsModal','confirmModal','signalModal','alertModal','aiTitleModal']:
 old=base.xpath(f'//*[@id="{key}"]')
 if old:assert html.tostring(old[0],with_tail=False)==html.tostring(preview.get_element_by_id(key),with_tail=False),key
for node in preview.xpath('//label[@for]'):assert node.get('for') in ids
for node in preview.xpath('//*[@aria-controls]'):
 for name in node.get('aria-controls').split():assert name in ids
old_css=[p.split('?')[0] for p in base.xpath('//link[@rel="stylesheet"]/@href')]
new_css=[p.split('?')[0] for p in preview.xpath('//link[@rel="stylesheet"]/@href')]
assert new_css==old_css+['css/fidelity-v2.css','css/fidelity-secondary-v2.css','css/task-fidelity-v2.css']
modules=preview.xpath('//script[@type="module"]/@src')
assert [x.split('?')[0] for x in modules]==['js/main.js','js/task-fidelity-v2.js']
assert preview_source.index('id="fidelity-panel-comments"')<preview_source.index('src="js/main.js')<preview_source.index('src="js/task-fidelity-v2.js')
assert preview.get_element_by_id('notification-orb-badge').getparent().get('id')=='fidelity-notifications-toggle'
assert preview.get_element_by_id('addTaskBtn').getparent().get('id')=='fidelity-page-actions'
assert preview.get_element_by_id('orb-filter').getparent().get('id')=='main-content'
assert preview.get_element_by_id('shell-filter-panel').getparent().get('hidden') is not None
# Original rich-editor mount contract survives the static fragment replacement.
mount=preview.get_element_by_id('fidelity-panel-comments');assert 'glass-separator-v' in mount.get('class').split()
assert mount.xpath('.//*[contains(concat(" ",@class," ")," p-6 ") and contains(concat(" ",@class," ")," mt-auto ")]')
assert preview.get_element_by_id('comments-feed') in mount.iterdescendants()
assert not preview.get_element_by_id('taskHistoryModal').xpath('descendant-or-self::*[@aria-modal="true"]')
for name in ['comments','attachments','history']:
 tab=preview.get_element_by_id('fidelity-tab-'+name);pane=preview.get_element_by_id(tab.get('aria-controls'))
 assert tab.get('role')=='tab' and pane.get('role')=='tabpanel' and pane.get('aria-labelledby')==tab.get('id')
css=text('app/css/fidelity-v2.css'); shell=text('app/js/shell-v2.js')
assert '--sb-font: Arial, Helvetica, sans-serif' in css
assert "? '(max-width: 680px)' : '(max-width: 767px)'" in shell
assert '@media (min-width: 681px) and (max-width: 767px)' in css
assert '--sb-sidebar-width: 185px' in css
assert 'grid-template-columns: repeat(5, minmax(214px, 1fr))' in css
assert css.count('grid-column: 1; grid-row: 2')==2
assert 'min-height: 104px' in css and 'fidelity-filter-drag-note' in preview_source
for p in ['app/js/fidelity-v2.js','app/js/fidelity-secondary-v2.js','app/js/task-fidelity-v2.js']:
 assert not re.search(r'\b(?:fetch\s*\(|api\.)',text(p)),p
print(json.dumps({'status':'passed','baseline':REF,'unchanged_baseline_files':len(files)-len(changed),'original_static_ids':len(base.xpath('//@id')),'current_preview_ids':len(ids),'exact_reviewed_runtime_files':len(manifest['owned_runtime_hashes']),'exact_reviewed_ui_slices':len(manifest['ui_slices']),'checks':['Full real cascade and static modal-before-handlers composition','Default entry/API/auth/backend/assets untouched; guarded shared paths separately exercised','Exact startup/profile recovery, callback and payload sections','All prior ID/native form/data contracts retained','Approved shell and secondary renderer slices composed without overwrites','Canonical Arial typography and680px preview breakpoint; default767px retained','Real empty Sortable regions and explicit filtered-drag explanation'],'limits':'Source/markup checks only. No screenshot fidelity, native browser validity, deployment, physical device or human acceptance claim.'},ensure_ascii=False,indent=2))
