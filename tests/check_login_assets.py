#!/usr/bin/env python3
"""Verify anonymous login assets without authentication, network or route changes."""
import base64
import hashlib
import json
import subprocess
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class Login(HTMLParser):
    def __init__(self,text):
        super().__init__();self.resources=[];self.brands=[];self.styles={};self.current=None;self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('script','img','link'):
            value=a.get('src',a.get('href',''))
            if value:self.resources.append(value)
        if 'data-brand-source' in a:self.brands.append((a['data-brand-source'],a.get('src',a.get('href'))))
        if tag=='style' and 'data-inline-source' in a:self.current=a['data-inline-source'];self.styles[self.current]=''
    def handle_data(self,data):
        if self.current:self.styles[self.current]+=data
    def handle_endtag(self,tag):
        if tag=='style':self.current=None

def main():
    html=(ROOT/'app/login.html').read_text();p=Login(html)
    assert all(url.startswith(('https://','data:')) for url in p.resources), 'Protected local subresource on public login'
    for path in ('css/fluxo-v2.css','css/login-v2.css'):
        assert p.styles[path].strip()==(ROOT/'app'/path).read_text().strip(),f'Style drift: {path}'
    manifest=json.loads((ROOT/'app/assets/brand-v2/manifest.json').read_text())['assets']
    assert len(p.brands)==5
    for name,uri in p.brands:
        assert uri.startswith('data:image/svg+xml;base64,')
        raw=base64.b64decode(uri.split(',',1)[1],validate=True)
        assert raw==(ROOT/'app/assets/brand-v2'/name).read_bytes()
        assert hashlib.sha256(raw).hexdigest()==manifest[name]
    assert 'href="/.auth/login/google?post_login_redirect_uri=/"' in html
    assert 'tc445-login-2' in html
    config=json.loads((ROOT/'app/staticwebapp.config.json').read_text())
    assert next(r for r in config['routes'] if r['route']=='/*')['allowedRoles']==['travelcash_user']
    assert 'anonymous' in next(r for r in config['routes'] if r['route']=='/login')['allowedRoles']
    subprocess.run(['python','scripts/embed_login_assets.py','--check'],cwd=ROOT,check=True,capture_output=True)
    print(json.dumps({'status':'passed','checks':['No protected local login subresources','Both embedded CSS sources match checked-in originals','Five embedded SVG instances match exact approved v2 hashes','Google login target unchanged','Public login and protected catch-all role rules unchanged','Asset generation is reproducible'],'limits':'Static public-route compatibility; no SSO sign-in, sign-out, anonymous browser session or provider availability claim'},indent=2))

if __name__=='__main__':main()
