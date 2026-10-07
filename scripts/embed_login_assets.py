#!/usr/bin/env python3
"""Keep public /login self-contained while preserving the protected /* route."""
import argparse
import base64
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--check',action='store_true',help='Fail on generated asset drift without writing')
args=parser.parse_args()
page=ROOT/'app/login.html'
original=page.read_text()
text=original
for path in ('css/fluxo-v2.css','css/login-v2.css'):
    css=(ROOT/'app'/path).read_text().rstrip()
    style=f'<style data-inline-source="{path}">\n{css}\n    </style>'
    pattern=rf'<style data-inline-source="{re.escape(path)}">.*?</style>'
    if re.search(pattern,text,re.S):text=re.sub(pattern,lambda _:style,text,flags=re.S)
    else:
        link=rf'<link rel="stylesheet" href="{re.escape(path)}(?:\?[^"]*)?">'
        assert re.search(link,text), f'Missing login style marker: {path}'
        text=re.sub(link,lambda _:style,text)
assets=ROOT/'app/assets/brand-v2'
manifest=json.loads((assets/'manifest.json').read_text())['assets']
for name in ('favicon.svg','logo-primary-dark.svg','logo-primary-light.svg','mark-primary.svg'):
    assert name in manifest
    encoded=base64.b64encode((assets/name).read_bytes()).decode()
    # Add markers on first generation; later runs update bytes through those markers.
    text=text.replace(f'href="assets/brand-v2/{name}"',f'data-brand-source="{name}" href="assets/brand-v2/{name}"')
    text=text.replace(f'src="assets/brand-v2/{name}"',f'data-brand-source="{name}" src="assets/brand-v2/{name}"')
    pattern=rf'(<(?:img|link)\b[^>]*data-brand-source="{re.escape(name)}"[^>]*?(?:src|href)=")[^"]*(")'
    text,count=re.subn(pattern,lambda m:m.group(1)+'data:image/svg+xml;base64,'+encoded+m.group(2),text)
    assert count>0,f'Missing login brand marker: {name}'
if args.check:
    assert text==original,'Login asset drift: run python scripts/embed_login_assets.py'
    print('PASS: public login embeds current approved CSS and SVG assets; no protected asset URLs required.')
else:
    page.write_text(text)
    print('Updated public login with exact local CSS and approved SVG bytes.')
