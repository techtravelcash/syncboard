#!/usr/bin/env python3
"""Static markup/asset/CSS gate. Browser geometry and interactions are not proved here."""
import json, os, re, subprocess
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASELINE='688358589d48ac498030c0f8afadff8b6d7a0773'
BASELINE_ROOT=os.environ.get('SYNCBOARD_BASELINE_ROOT',str(ROOT))
class Page(HTMLParser):
    def __init__(self,txt):
        super().__init__();self.ids=[];self.attrs={};self.labels=[];self.refs=[];self.feed(txt)
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs:self.ids.append(attrs['id']);self.attrs[attrs['id']]=attrs
        if tag=='label':self.labels.append(attrs.get('for'))
        for k in ('src','href'):
            x=attrs.get(k,'')
            if x and not x.startswith(('http','/','#','data:')):self.refs.append(x.split('?')[0])
old=subprocess.check_output(['git','show',f'{BASELINE}:app/index.html'],cwd=BASELINE_ROOT,text=True)
new=(ROOT/'app/index.html').read_text();a,b=Page(old),Page(new)
assert set(a.ids)<=set(b.ids),'Removed existing element ID'
assert len(b.ids)==len(set(b.ids)),'Duplicate ID'
assert new[new.index('<div id="taskModal"'):new.index('<script type="module"')]==old[old.index('<div id="taskModal"'):old.index('<script type="module"')],'Task form or modal changed'
for p in b.refs:assert (ROOT/'app'/p).is_file(),p
assert 'search-input' in b.labels
for key in ('search-input','orb-project-filters','orb-responsible-filters','orb-sort-options','view-switcher-orb','main-content','listView','kanbanView'):
    assert b.ids.count(key)==1,key
for key,target in [('shell-filter-toggle','shell-filter-panel'),('shell-sort-toggle','shell-sort-panel')]:
    assert b.attrs[key]['aria-controls']==target
    assert b.attrs[key]['data-shell-toggle']==target
    assert b.attrs[key]['aria-expanded']=='false'
for key in ('selected-project-label','selected-responsible-label','selected-sort-label','task-filter-count','clear-task-filters'):
    assert key in b.ids
assert new.index('</header>')<new.index('<div id="orb-filter"')<new.index('<main id="main-content"')
shell=(ROOT/'app/js/shell-v2.js').read_text()
assert shell.count("['shell-topbar', 'orb-filter', 'main-content']")==2,'New band must be inert with the mobile drawer and restored on close'
assert 'new ResizeObserver(sizeFilterBand).observe(filterBand)' in shell
assert shell.count("document.addEventListener('keydown'")==1
assert shell.count("trigger.addEventListener('click'")==1
css=(ROOT/'app/css/list-filters-v2.css').read_text()
assert css.count('{')==css.count('}')
assert '.sb-app #orb-filter #orb-sort { z-index: auto; }' in css
assert '.sb-app #orb-filter .sb-shell-panel { z-index: 20; }' in css
assert '--sb-filter-height' in css and 'max-height: min(44dvh, 360px)' in css
assert 'overflow-wrap: anywhere' in css and 'prefers-reduced-motion: reduce' in css
assert 'text-overflow: ellipsis' not in css and 'line-clamp' not in css
assert 'Space Mono' not in css and 'Caveat' not in css and 'Hello Baby' not in css
assert 'var(--sb-' in css
for p in (ROOT/'app/js').glob('*.js'):subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
print(json.dumps({'status':'passed','baseline':BASELINE,'ids_preserved':len(a.ids),'unique_ids':len(b.ids),'checks':['all original IDs and modal HTML preserved','single search input with label','filter/sort controls still use existing shell toggles','selection descriptions and filter count','mobile drawer covers toolbar inertness','one existing keyboard and toggle handler','new responsive stylesheet and local references present','all frontend JavaScript syntax valid'],'not_proven':'CSS parsing/layout, popover positioning, scrolling, zoom, keyboard behavior, contrast in composed screenshots and actual resize behavior require browser QA.'},indent=2))
