#!/usr/bin/env python3
"""Light detail compatibility scope/contrast; does not rewrite task content."""
import json,re,sys
from pathlib import Path
sys.dont_write_bytecode=True
from check_ui_v2 import contrast
ROOT=Path(__file__).resolve().parents[1]
css=(ROOT/'app/css/detail-compat-v2.css').read_text()
plain=re.sub(r'/\*.*?\*/','',css,flags=re.S)
for block in plain.split('}'):
    if '{' not in block:continue
    selectors=block.split('{',1)[0]
    for selector in selectors.split(','):
        assert selector.strip().startswith('html:not(.dark) body.sb-app #'),selector
assert '#modal-info-project { color: var(--sb-text) !important; opacity: 1; }' in css
assert '#modal-info-project { background' not in css
for id in ('comments-feed','history-feed','comment-input-rich','modal-info-project'):
    assert '#'+id in css
pairs={'body on white':contrast('#111827','#FFFFFF'),'metadata on white':contrast('#526174','#FFFFFF'),'body on own-comment blue tint':contrast('#111827','#D3E0FB'),'mention':contrast('#244FDB','#EAF0FF'),'project text over darkest20percent tint':contrast('#111827','#CCCCCC')}
assert min(pairs.values())>=4.5
assert re.search(r'href="css/detail-compat-v2\.css(?:\?[^"]*)?"', (ROOT/'app/index.html').read_text())
print(json.dumps({'status':'passed','scope':'Light detail IDs only; no JavaScript, stored HTML or project background changes','contrast':pairs,'limits':'Requires live computed-color and readability confirmation'},indent=2))
