#!/usr/bin/env python3
"""Dependency-free TC-444 asset, DOM, isolation and contrast regression checks."""
import hashlib
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '92159b05e81ad9ef6841e2a8efd0d9462e9f6da0'

class Elements(HTMLParser):
    def __init__(self, content):
        super().__init__()
        self.ids, self.contracts, self.local_assets = [], [], []
        self.feed(content)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key, value in attrs.items():
            if key.startswith('data-') or key in ('id', 'onclick', 'oninput') or (tag in ('input', 'select', 'textarea', 'button', 'form', 'option') and key in ('name', 'type', 'required', 'value')):
                self.contracts.append((tag, key, value))
            if key in ('href', 'src') and value and not value.startswith(('http', '#', '/', 'data:')):
                self.local_assets.append(value.split('?')[0])

def original(path):
    return subprocess.check_output(['git', 'show', f'{BASELINE}:{path}'], cwd=ROOT)

def luminance(h):
    rgb = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    return sum(v*w for v,w in zip(linear, (.2126,.7152,.0722)))

def contrast(a,b):
    hi,lo=sorted((luminance(a),luminance(b)),reverse=True)
    return round((hi+.05)/(lo+.05),2)

def main():
    results = []
    protected = ['app/js/api.js', 'app/js/main.js', 'app/js/signalr.js', 'app/js/state.js', 'app/js/ui.js', 'app/css/custom.css', 'app/login.html', 'app/staticwebapp.config.json']
    protected += subprocess.check_output(['git','ls-tree','-r','--name-only',BASELINE,'api','.github'],cwd=ROOT,text=True).splitlines()
    for path in protected:
        assert (ROOT/path).read_bytes() == original(path), f'Protected file changed: {path}'
    results.append(f'{len(protected)} protected files byte-identical to baseline')
    before = Elements(original('app/index.html').decode())
    after = Elements((ROOT/'app/index.html').read_text())
    assert Counter(before.ids) == Counter(after.ids), 'Existing element IDs changed'
    assert Counter(before.contracts) == Counter(after.contracts), 'Original handler/field/data contracts changed'
    assert '<script src="js/ui-v2-pilot.js' not in (ROOT/'app/index.html').read_text(), 'Pilot script loaded on board'
    results.append(f'{len(before.ids)} original IDs and all existing field/data contracts preserved')
    for page in ['index.html','ui-v2.html']:
        parsed=Elements((ROOT/'app'/page).read_text())
        assert len(parsed.ids)==len(set(parsed.ids)), f'Duplicate ID in {page}'
        for path in parsed.local_assets:
            assert (ROOT/'app'/path).is_file(), f'Missing asset {path}'
    results.append('No duplicate IDs or broken local asset references')
    asset_dir=ROOT/'app/assets/brand-v2'
    manifest=json.loads((asset_dir/'manifest.json').read_text())
    assert manifest['version']==2 and manifest['source_sha256']=='15de4adc74dadb15730b5b1bec2eb1daecfb9aa11f7a2ab49a9cd713814b9a72'
    for name,sha in manifest['assets'].items():
        assert hashlib.sha256((asset_dir/name).read_bytes()).hexdigest()==sha, f'Asset hash mismatch: {name}'
    results.append(f"{len(manifest['assets'])} approved V2 assets match SHA-256 manifest")
    tokens=json.loads((asset_dir/'brand-tokens.json').read_text())
    status_ratios={name:contrast(v['text'],v['background']) for name,v in tokens['interface']['status'].items()}
    for name,ratio in status_ratios.items():
        assert ratio>=4.5, f'Status contrast: {name} {ratio}'
    pairs={'action white':contrast('#FFFFFF','#244FDB'),'accent ink':contrast('#111827','#D6F46A'),'muted on white':contrast('#526174','#FFFFFF'),'dark muted':contrast('#B5C1D0','#1B2536')}
    assert all(v>=4.5 for v in pairs.values())
    results.append({'status_contrast':status_ratios,'text_contrast':pairs})
    code=(ROOT/'app/js/ui-v2-pilot.js').read_text()
    assert not re.search(r'\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b',code), 'Pilot must stay isolated from network/storage'
    results.append('Pilot makes no API, websocket, or preference-storage calls')
    css=(ROOT/'app/css/fluxo-v2.css').read_text()
    assert 'prefers-reduced-motion: reduce' in css and 'outline: 3px solid var(--sb-focus)' in css
    assert not re.search(r'Space Mono|Caveat|Hello Baby',css)
    results.append('V2 typography, visible focus and reduced-motion primitives present')
    for path in (ROOT/'app/js').glob('*.js'):
        subprocess.run(['node','--check',str(path)],check=True,capture_output=True)
    results.append('Syntax check passed for all frontend JavaScript files')
    print(json.dumps({'status':'passed','checks':results},ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
