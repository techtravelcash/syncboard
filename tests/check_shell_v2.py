#!/usr/bin/env python3
"""Focused static gate for the isolated TC-445 shell preview."""
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = 'ffb117cf04b3df386001f20a0c02a2ff3ecbba26'
class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.ids=[]; self.refs=[]; self.views=[]; self.attrs={}; self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id']);self.attrs[a['id']]=a
        if 'data-view' in a:self.views.append(a['data-view'])
        for attr in ('src','href'):
            value=a.get(attr,'')
            if value and not value.startswith(('http','/','#','data:')):self.refs.append(value.split('?')[0])

def main():
    results=[]
    if '--isolation-only' not in sys.argv:
        protected=['app/index.html','app/login.html','app/css/custom.css','app/js/main.js','app/js/ui.js','app/js/api.js','app/js/signalr.js','app/js/state.js','app/staticwebapp.config.json']
        for p in protected:
            assert (ROOT/p).read_bytes()==subprocess.check_output(['git','show',f'{BASELINE}:{p}'],cwd=ROOT),p
        results.append('Existing app, login, runtime, routes and CSS unchanged in preview stage')
    else:
        results.append('Isolation-only mode: live application preservation is checked by check_shell_integration.py')
    p=Page((ROOT/'app/ui-v2-shell-preview.html').read_text())
    assert len(p.ids)==len(set(p.ids)), 'Duplicate preview ID'
    assert p.views==['home','kanban','list','archived','users']
    assert 'hidden' in p.attrs['user-management-btn']['class']
    for ref in p.refs: assert (ROOT/'app'/ref).is_file(),ref
    for id in ['orb-nav','shell-account-panel','shell-filter-panel','shell-sort-panel','main-content','addTaskBtn']:
        assert id in p.ids,id
    for id,target in [('shell-nav-toggle','orb-nav'),('shell-account-toggle','shell-account-panel'),('shell-filter-toggle','shell-filter-panel'),('shell-sort-toggle','shell-sort-panel')]:
        assert p.attrs[id]['aria-controls']==target and p.attrs[id]['aria-expanded']=='false'
    results.append('All five views, unique IDs, default-hidden administrator entry and menu controls preserved')
    preview=(ROOT/'app/ui-v2-shell-preview.html').read_text()
    assert preview.index('css/custom.css') < preview.index('css/fluxo-v2.css') < preview.index('css/shell-v2.css')
    css=(ROOT/'app/css/shell-v2.css').read_text()
    assert css.count('.sb-app #orb-nav.sb-shell-sidebar {')==2
    results.append('Preview mirrors the live legacy-first cascade; both sidebar breakpoints use ID-qualified geometry')
    script=(ROOT/'app/js/shell-preview.js').read_text()
    shell=(ROOT/'app/js/shell-v2.js').read_text()
    assert not re.search(r'\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b',script+shell)
    assert not re.search(r"from\s+['\"].*(?:api|state|main)\.js",script+shell)
    assert 'href="/logout"' not in (ROOT/'app/ui-v2-shell-preview.html').read_text()
    results.append('Preview has no API, production state, storage or logout action')
    for token in ["event.key === 'Escape'","event.key === 'Tab'","panel.inert", "trigger.focus()", "aria-modal", "aria-current", "shellReady"]:
        assert token in shell,token
    results.append('Escape, drawer focus containment, close/focus return and idempotent initialization hooks present')
    pilot=(ROOT/'app/js/ui-v2-pilot.js').read_text()
    assert "openExample(dialogOpener, false)" in pilot and "openExample(dangerOpener, true)" in pilot
    assert "classList.toggle('sb-button--danger', destructive)" in pilot
    results.append('Ordinary and destructive pilot confirmations have explicit blue/red intent')
    for file in (ROOT/'app/js').glob('*.js'):subprocess.run(['node','--check',str(file)],check=True,capture_output=True)
    results.append('All frontend JavaScript syntax passed; browser interaction verification still required')
    print(json.dumps({'status':'passed','stage':'tc445-shell-preview-3','checks':results},indent=2,ensure_ascii=False))

if __name__=='__main__':main()
