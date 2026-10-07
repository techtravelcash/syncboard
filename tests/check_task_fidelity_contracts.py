#!/usr/bin/env python3
"""TC-455 preview boundaries and DOM contracts. No browser/layout assertions."""
from pathlib import Path
from collections import Counter
import hashlib, json, re, subprocess, tempfile
from lxml import html
ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/workspace/shared/syncboard_ui_v2_fidelity')
REF='20c48df793c91dd303abdfb0229701b64a905914'
source=subprocess.check_output(['git','-C',str(BASE),'show',f'{REF}:app/index.html'],text=True)
baseline=html.fromstring(source)
parts={key:html.fromstring((ROOT/f'app/fragments/{key}-fidelity-v2.html').read_text()) for key in ['taskModal','taskHistoryModal']}
protected=('name','type','value','required','multiple','min','max','checked','selected','rows','oninput','onclick','href','target','rel','aria-label','aria-describedby')
ids=0
for key,new in parts.items():
 old=baseline.get_element_by_id(key)
 assert len(new.xpath('descendant-or-self::*[@id]'))==len(set(new.xpath('descendant-or-self::*/@id')))
 for node in old.xpath('descendant-or-self::*[@id]'):
  ids+=1
  other=new.get_element_by_id(node.get('id'))
  assert node.tag==other.tag
  for attr in protected: assert node.get(attr)==other.get(attr),(node.get('id'),attr)
  for attr,value in node.items():
   if attr.startswith('data-'):assert other.get(attr)==value,(node.get('id'),attr)
 for field in old.xpath('.//input|.//textarea|.//select'):
  other=new.get_element_by_id(field.get('id'))
  assert field.tag==other.tag
  assert [dict(x.attrib) for x in field.xpath('.//option')]==[dict(x.attrib) for x in other.xpath('.//option')]
 assert Counter(old.xpath('.//@onclick'))==Counter(new.xpath('.//@onclick'))
 assert Counter(old.xpath('.//@oninput'))==Counter(new.xpath('.//@oninput'))
 assert not new.xpath('descendant-or-self::*[@aria-modal="true"]')
form=parts['taskModal'];detail=parts['taskHistoryModal']
assert form.get_element_by_id('taskTitle').get('required') is not None
assert form.get_element_by_id('taskDescription').get('required') is not None
assert form.get_element_by_id('taskAzureLink').get('type')=='url'
assert form.get_element_by_id('taskAzureLink').get('required') is None
assert form.get_element_by_id('cancelBtn').get('type')=='button'
assert form.get_element_by_id('taskAzureLink').getparent().get('class')=='sb-fidelity-reference-control'
assert form.xpath('.//label[@for="taskTitle"]') and form.xpath('.//label[@for="taskAzureLink"]')
# Source selector used by the actual renderTaskHistory must find the original composer after relocation.
mount=detail.xpath('.//*[contains(concat(" ",@class," ")," glass-separator-v ")]')
assert len(mount)==1
assert mount[0].get('id')=='fidelity-panel-comments'
assert mount[0].xpath('.//*[contains(concat(" ",@class," ")," p-6 ") and contains(concat(" ",@class," ")," mt-auto ")]')
assert detail.get_element_by_id('comments-feed') in mount[0].iterdescendants()
assert detail.get_element_by_id('modal-info-title').getparent().get('class')=='sb-task-detail-main'
assert detail.get_element_by_id('modal-info-project').getparent().getparent().tag=='aside'
for name in ['comments','attachments','history']:
 tab=detail.get_element_by_id('fidelity-tab-'+name);pane=detail.get_element_by_id(tab.get('aria-controls'))
 assert tab.get('role')=='tab' and pane.get('role')=='tabpanel'
 assert pane.get('aria-labelledby')==tab.get('id')
# Every baseline tracked file, including default entry, startup recovery, handlers, brand and backend, remains unchanged.
files=subprocess.check_output(['git','-C',str(BASE),'ls-tree','-r','--name-only',REF],text=True).splitlines()
for filename in files:
 expected=subprocess.check_output(['git','-C',str(BASE),'show',f'{REF}:{filename}'])
 assert (ROOT/filename).read_bytes()==expected,filename
# Static fragments are installed before module handlers bind; installation is idempotent and rejects default entry.
with tempfile.TemporaryDirectory(prefix='tc455-preview-') as tmp:
 preview=Path(tmp)/'ui-v2-fidelity-preview.html'
 preview.write_text(source.replace('class="sb-scope sb-app antialiased', 'class="sb-scope sb-app sb-fidelity-v2 antialiased'))
 subprocess.run(['python',str(ROOT/'scripts/apply_task_fidelity_preview.py'),str(preview)],check=True,capture_output=True)
 merged=preview.read_text();parsed=html.fromstring(merged)
 assert len(parsed.xpath('//*[@id]'))==len(set(parsed.xpath('//@id')))
 assert merged.index('id="fidelity-panel-comments"')<merged.index('src="js/main.js')
 assert merged.index('src="js/main.js')<merged.index('src="js/task-fidelity-v2.js')
 assert len(parsed.xpath('//link[contains(@href,"css/task-fidelity-v2.css")]'))==1
 subprocess.run(['python',str(ROOT/'scripts/apply_task_fidelity_preview.py'),str(preview)],check=True,capture_output=True)
 assert preview.read_text()==merged
 default=Path(tmp)/'index.html';default.write_text(source)
 rejected=subprocess.run(['python',str(ROOT/'scripts/apply_task_fidelity_preview.py'),str(default)],capture_output=True)
 assert rejected.returncode!=0 and default.read_text()==source
css=(ROOT/'app/css/task-fidelity-v2.css').read_text()
assert css.count('{')==css.count('}')
assert css.count('grid-template-columns: var(--sb-task-columns)')==2
assert '--sb-task-columns: minmax(0, 1fr) 260px' in css
assert '.sb-task-form-header,\nbody.sb-app.sb-fidelity-v2 #taskForm .sb-task-form-body' in css
assert 'padding: 24px var(--sb-task-rail-inset) 20px' in css
assert 'padding: 24px var(--sb-task-rail-inset) 28px' in css
assert '@media (max-width: 680px)' in css
assert not re.search(r'margin(?:-top|-left)?\s*:\s*-',css)
assert 'translate(' not in css
plain=re.sub(r'/\*.*?\*/','',css,flags=re.S)
# Every style selector has the opt-in preview root (including selectors inside media blocks).
for prefix in re.findall(r'([^{}]+)\{',plain):
 if prefix.strip().startswith('@'):continue
 for selector in re.split(r',(?=\s*(?:body|html))',prefix.strip()):
  assert selector.strip().startswith(('body.sb-app.sb-fidelity-v2','html.dark body.sb-app.sb-fidelity-v2')),selector
js=(ROOT/'app/js/task-fidelity-v2.js').read_text()
assert "classList.contains('sb-fidelity-v2')" in js
assert 'innerHTML' not in re.sub(r'/\*.*?\*/|//[^\n]*','',js,flags=re.S)
assert not re.search(r'\b(?:fetch|api)\s*[.(]',js)
print(json.dumps({'status':'passed','baseline':REF,'preserved_existing_modal_ids':ids,'unchanged_tracked_files':len(files),'checks':['Original field tags, required/type/options/values and event attributes remain exact','Default entry, startup/profile-claims recovery, shared ui/main handlers, API/backend and vector brand files byte-identical','Title/link header and metadata body share columns and rail inset; no negative margins','Legacy rich-editor selectors still find original relocated mount','Tab relationships and preview-only CSS/module gate present','Preview installation before handler scripts, duplicate-install idempotence and default-entry refusal'],'limits':'Source/DOM contract checks do not measure pixels or native browser validity/focus/layout. Required-title/description and malformed-URL rejection still need the HTTPS visual/interaction gate.'},ensure_ascii=False,indent=2))
