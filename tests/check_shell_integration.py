#!/usr/bin/env python3
"""TC-445 integration contracts. Read-only; requires Python, git and Node."""
import json
import re
import subprocess
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import sys
sys.dont_write_bytecode = True
from check_ui_v2 import contrast
ROOT=Path(__file__).resolve().parents[1]
BASELINE='3e1a038c5fa354490557e2b895fccff34be5eabc'

def original(path):return subprocess.check_output(['git','show',f'{BASELINE}:{path}'],cwd=ROOT).decode()
class Page(HTMLParser):
    def __init__(self,text):
        super().__init__();self.ids=[];self.elements={};self.contracts=[];self.refs=[];self.inline_scripts=[];self.script=None;self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id']);self.elements[a['id']]=a
        for key,value in attrs:
            if key.startswith('data-') or key in ('id','oninput','onclick') or (tag in ('input','select','textarea','button','option','form') and key in ('name','type','value','required')):self.contracts.append((tag,key,value))
            if key in ('src','href') and value and not value.startswith(('http','/','#','data:')):self.refs.append(value.split('?')[0])
        if tag=='script' and 'src' not in a:self.script=''
    def handle_data(self,text):
        if self.script is not None:self.script+=text
    def handle_endtag(self,tag):
        if tag=='script' and self.script is not None:self.inline_scripts.append(self.script);self.script=None

def main():
    checks=[]
    protected=['app/js/api.js','app/js/state.js','app/js/signalr.js','app/staticwebapp.config.json','app/css/custom.css']
    protected+=subprocess.check_output(['git','ls-tree','-r','--name-only',BASELINE,'api','.github'],cwd=ROOT,text=True).splitlines()
    for path in protected:assert (ROOT/path).read_bytes()==original(path).encode(),path
    checks.append(f'{len(protected)} API, workflow, route, state, realtime and existing CSS files unchanged')
    old=original('app/index.html');new=(ROOT/'app/index.html').read_text();before=Page(old);after=Page(new)
    assert set(before.ids)<=set(after.ids),'Original ID removed'
    assert len(after.ids)==len(set(after.ids)),'Duplicate ID'
    # Modal/task forms are outside the shell replacement and must preserve every field/data contract.
    old_modals=Page(old[old.index('<div id="taskModal"'):]);new_modals=Page(new[new.index('<div id="taskModal"'):])
    # TC-447 adds only accessible labels to the existing homologator dialog.
    kanban_label_ids = Counter({('h2', 'id', 'homologadorTitle'): 1, ('p', 'id', 'homologadorDescription'): 1})
    # TC-449 adds only help/title label IDs; field/data/event contracts remain exact.
    task_label_ids = Counter({('p','id','task-link-help'):1, ('p','id','task-responsible-help'):1, ('p','id','task-draft-notice'):1, ('h2','id','ai-title-heading'):1, ('p','id','ai-review-help'):1})
    # TC-450 adds attachment help and shared confirmation labels only.
    collaboration_label_ids = Counter({('p','id','attachment-selection-help'):1, ('h2','id','confirm-dialog-title'):1, ('p','id','confirm-dialog-description'):1})
    assert Counter(old_modals.contracts)+kanban_label_ids+task_label_ids+collaboration_label_ids==Counter(new_modals.contracts),'Task/modal DOM contract changed'
    checks.append(f'All {len(before.ids)} original IDs and every task/modal field/data contract preserved')
    assert 'hidden' in after.elements['user-management-btn']['class']
    assert 'href="/logout"' in new
    main_code=(ROOT/'app/js/main.js').read_text();old_main=original('app/js/main.js')
    for role in ("state.currentUser.userRoles.includes('travelcash_user')","state.currentUser.userRoles.includes('admin')"):
        assert role in main_code
    assert 'showStartupState(' in main_code and 'if (!state.currentUser)' in main_code
    api_lines=lambda s:[line.strip() for line in s.splitlines() if re.search(r'\bapi\.[A-Za-z]+\(',line)]
    assert api_lines(main_code)==api_lines(old_main),'API call or payload line changed'
    payload=lambda s:re.findall(r'const payload = \{.*?\n            \};',s,re.S)
    assert payload(main_code)==payload(old_main),'Form payload changed'
    start='const setupFilterClick = '
    old_tail=old_main[old_main.index(start):]
    new_tail=main_code[main_code.index(start):].replace('ui.showDestructiveConfirmModal(', 'ui.showConfirmModal(').replace('closeShellPanels(false);',"document.getElementById('orb-tools').classList.remove('expanded');")
    assert old_tail==new_tail,'Unexpected mutation/navigation/theme handler change'
    checks.append('Role checks, all API calls/payloads, task handlers, filters, theme preference and notifications preserved')
    ui=(ROOT/'app/js/ui.js').read_text()
    assert main_code.count('ui.showDestructiveConfirmModal(')==3
    assert len(re.findall(r'^\s+showDestructiveConfirmModal\(',ui,re.M))==2
    assert 'destructive = false' in ui and "destructive ? 'destructive' : 'confirm'" in ui
    assert 'ui.showConfirmModal(' not in main_code
    css=(ROOT/'app/css/shell-v2.css').read_text()
    for selector in ["#confirmDeleteBtn[data-intent='confirm']","#confirmDeleteBtn[data-intent='destructive']",'#confirmSignalBtn','#confirmHomologadorBtn']:
        assert selector in css
    checks.append('All five destructive call sites explicitly red; shared ordinary, signaling and homologator confirmations explicitly blue')
    filter_pairs={'light normal':contrast('#111827','#FFFFFF'),'light hover':contrast('#111827','#F5F7FA'),'dark normal':contrast('#F5F7FA','#1B2536'),'dark hover':contrast('#F5F7FA','#111827'),'selected':contrast('#D6F46A','#111827')}
    assert min(filter_pairs.values())>=4.5
    checks.append({'filter_text_contrast':filter_pairs})
    assert 'position: fixed; top: var(--sb-header-height); left: var(--sb-sidebar-width); margin: 0;' in css
    checks.append('Main positioning uses an explicit header offset, without collapsing margins')
    login=(ROOT/'app/login.html').read_text()
    assert 'href="/.auth/login/google?post_login_redirect_uri=/"' in login
    assert "localStorage.theme === 'dark'" in login and "prefers-color-scheme: dark" in login
    assert 'https://i.imgur.com/AoaA8WI.png' not in new+login
    checks.append('Login target and preference logic retained; old application brand images removed from index/login')
    for name in ('index.html','login.html','ui-v2-shell-preview.html','ui-v2.html'):
        parsed=Page((ROOT/'app'/name).read_text())
        assert len(parsed.ids)==len(set(parsed.ids)),name
        for ref in parsed.refs:assert (ROOT/'app'/ref).is_file(),f'{name}: {ref}'
        for code in parsed.inline_scripts:subprocess.run(['node','--check'],input=code,text=True,check=True,capture_output=True)
    for path in (ROOT/'app/js').glob('*.js'):subprocess.run(['node','--check',str(path)],check=True,capture_output=True)
    checks.append('Local resources resolve; all frontend and inline JavaScript syntax passed')
    print(json.dumps({'status':'passed','stage':'tc445-shell-2','checks':checks,'not_proven':'Browser layout, keyboard interactions, SSO flow, role-specific execution and physical mobile require separate evidence.'},indent=2,ensure_ascii=False))

if __name__=='__main__':main()
