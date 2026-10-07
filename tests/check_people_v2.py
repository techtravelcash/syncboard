#!/usr/bin/env python3
"""TC-452 read-only boundary gate. Baseline is the authorized parent snapshot.
Run: python tests/check_people_v2.py --baseline-repo /path/to/git/checkout
No browser/layout or real account/API assertion is implied by this static gate.
"""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import argparse
import json
import re
import subprocess
ROOT=Path(__file__).resolve().parents[1]
BASE='fe0c46a2d8efb47e5a7e6f4ab68ab058cd684d18'
p=argparse.ArgumentParser();p.add_argument('--baseline-repo',type=Path,default=ROOT);args=p.parse_args()
def original(path):return subprocess.check_output(['git','show',f'{BASE}:{path}'],cwd=args.baseline_repo,text=True)
def part(text,start,end):return text[text.index(start):text.index(end,text.index(start))]
class HTML(HTMLParser):
    def __init__(self,text):
        super().__init__();self.ids={};self.labels=[];self.refs=[];self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:
            assert a['id'] not in self.ids, a['id']
            self.ids[a['id']]=(tag,a)
        if tag=='label':self.labels.append(a.get('for'))
        for name,val in attrs:
            if name in ('href','src') and val and not val.startswith(('http','/','#','data:','${')):self.refs.append(val.split('?')[0])
checks=[]
old=HTML(original('app/index.html'));html=(ROOT/'app/index.html').read_text();new=HTML(html)
assert set(old.ids)<=set(new.ids)
for id,(tag,a) in old.ids.items():
    other,b=new.ids[id];assert tag==other,id
    for key,value in a.items():
        if (key.startswith('data-') and key != 'data-ui-release') or key in ('href','name','type','value','required','min','max','multiple','oninput','onclick','target'):
            assert b.get(key)==value,(id,key)
for ref in new.refs:assert (ROOT/'app'/ref).is_file(),ref
for id,title in [('signalConfirmModal','signal-confirm-title'),('alertModal','alert-modal-title'),('notificationsModal','notifications-title')]:
    assert new.ids[id][1]['role']=='dialog'
    assert new.ids[id][1]['aria-labelledby']==title
    assert 'aria-modal' not in new.ids[id][1]
assert new.ids['closeNotificationsBtn'][1]['aria-label']=='Fechar notificações'
assert html.index('css/custom.css')<html.index('css/fluxo-v2.css')<html.index('css/shell-v2.css')<html.index('css/people-v2.css')
assert html.index('css/detail-compat-v2.css')<html.index('css/people-v2.css')
checks.append('Existing HTML IDs, data attributes and field contracts preserved; named dialogs, close button and real stylesheet order verified')
main=(ROOT/'app/js/main.js').read_text();oldmain=original('app/js/main.js')
# Restore only the explicitly permitted presentation substitutions; all other bytes must match.
normalized=main.replace("import { escapePeopleText, peopleAvatar } from './people-v2.js';\n",'')
normalized=normalized.replace('const imgTag = peopleAvatar(displayName, photoUrl);','const imgTag = `<img src="${photoUrl}" class="w-full h-full object-cover">`;')
normalized=normalized.replace('        const placeholder = peopleAvatar(displayName, null);', '        const initial = displayName.charAt(0).toUpperCase();\n        const placeholder = `<div class="w-full h-full bg-custom-dark text-white flex items-center justify-center font-bold text-xl">${initial}</div>`;')
normalized=normalized.replace('? alertData.signaledBy\n',"? alertData.signaledBy.split(' ')[0] \n")
a='            // Renderiza os checkboxes dinamicamente';b='            if(window.lucide) lucide.createIcons();'
normalized=normalized.replace(part(normalized,a,b),part(oldmain,a,b))
normalized=normalized.replace("    const profileClaims = Array.isArray(state.currentUser.claims) ? state.currentUser.claims : [];\n    const picClaim = profileClaims.find(c => c?.typ === 'picture' || c?.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/picture');\n","    const picClaim = state.currentUser.claims.find(c => c.typ === 'picture' || c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/picture');\n")
assert normalized==oldmain,'Changes outside approved profile/recipient/sender presentation'
checks.append('Main is byte-identical after four presentation substitutions and the explicit optional-photo-claims guard: auth checks, admin writes, API arguments, queue identity/dedupe, callbacks and notifications remain unchanged')
ui=(ROOT/'app/js/ui.js').read_text();oldui=original('app/js/ui.js')
normalized=ui.replace("import { personCard, notificationCard } from './people-v2.js';\n",'')
for start,end in [('export function renderUserManagementView()','// --- ROTEADOR UI'),('export async function updateNotificationBadge()','// --- AUTOCOMPLETE E INPUTS')]:
    normalized=normalized.replace(part(normalized,start,end),part(oldui,start,end))
assert normalized==oldui,'Unrelated renderer modified'
start="            el.addEventListener('click', (e) => {";end='// --- AUTOCOMPLETE E INPUTS'
assert part(ui,start,end)==part(oldui,start,end),'Notification click/write/navigation behavior changed'
start='export async function updateNotificationBadge()';end='    // 2. Renderiza a lista'
assert part(ui,start,end)==part(oldui,start,end),'Badge count behavior changed'
start="    const searchInput = document.getElementById('userSearchInput');";end='// --- ROTEADOR UI'
assert part(ui,start,end)==part(oldui,start,end),'Search callback changed'
form=HTML(part(ui,'        <div id="userFormModal"','    lucide.createIcons();'))
for id in ['newUserName','newUserEmail','newUserRole','newUserIsAdmin']:assert id in form.labels,id
for id in ['userFormModal','userFormModalContent','user-form-title','user-form-subtitle','addUserForm','editUserId','submitUserBtn']:assert id in form.ids,id
assert form.ids['newUserName'][1].get('required') is None and 'required' in form.ids['newUserName'][1]
assert form.ids['newUserEmail'][1]['type']=='email'
assert form.ids['newUserIsAdmin'][1]['type']=='checkbox'
assert form.ids['submitUserBtn'][1]['type']=='submit'
checks.append('Unrelated UI unchanged; actual search, badge and notification click handlers byte-identical; administrative IDs, labels and input types retained')
protected=['app/js/api.js','app/js/state.js','app/js/signalr.js','app/js/shell-v2.js','app/staticwebapp.config.json','app/css/custom.css','app/css/fluxo-v2.css','app/css/shell-v2.css','app/css/detail-compat-v2.css','app/css/home-v2.css','app/css/kanban-v2.css','app/css/list-filters-v2.css','app/css/task-space-v2.css','app/css/collaboration-v2.css','app/css/archive-v2.css','app/js/home-v2.js','app/js/archive-v2.js']
protected+=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE,'api','.github','app/assets/brand-v2'],cwd=args.baseline_repo,text=True).splitlines()
for path in protected:assert (ROOT/path).read_text()==original(path),path
checks.append(f'{len(protected)} backend, authentication, state, realtime, legacy CSS and brand files unchanged')
helper=(ROOT/'app/js/people-v2.js').read_text();css=(ROOT/'app/css/people-v2.css').read_text()
assert not re.search(r'\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b',helper)
assert "is-read opacity-60" in helper
for expr in ['String(user.email)','String(user.id || user.email)','String(n.id)','String(n.taskId)']:assert expr in helper,expr
assert 'escapePeopleText(String(name))' in main
assert 'name || \'Nome não informado\'' in main
assert 'class="sb-person-email"' in helper and 'line-clamp' not in helper
assert 'class="sb-signal-name"' in main and 'truncate' not in part(main,a,b)
assert css.count('{')==css.count('}')
assert '.sb-app .sb-people-dialog .sb-people-panel' in css and 'backdrop-filter: none;' in css
assert '.sb-app .sb-notification-card.is-read { opacity: 1; }' in css
assert 'prefers-reduced-motion: reduce' in css and 'overflow-wrap: anywhere' in css and 'outline: 3px solid var(--sb-focus)' in css
assert '.sb-app #dismissAlertBtn { width: 100%; background: var(--sb-action)' in css
assert 'sb-button--danger' in helper
assert 'var(--sb-font)' in css and not re.search(r'Space Mono|Caveat|Hello Baby|#[0-9A-Fa-f]{6}',css.replace('#FFFFFF',''))
# The light dialog selector (three classes) is more specific than the legacy .dark .orb-glass-unified (two).
assert '.dark .orb-glass-unified {' in original('app/css/custom.css')
assert 'background: var(--sb-surface)' in css
checks.append('Scoped cascade overrides checked statically against actual legacy/shell source; v2 tokens, normal/destructive colors, full labels, scroll bounds and reduced motion present (not a computed layout test)')
for path in (ROOT/'app/js').glob('*.js'):
    subprocess.run(['node','--input-type=module','--check'],input=path.read_text(),text=True,capture_output=True,check=True)
checks.append('All frontend JavaScript module syntax passes')
print(json.dumps({'status':'passed','baseline':BASE,'checks':checks,'not_verified':'Browser layout/focus/keyboard/mobile/zoom, real auth and API delivery. Known error-as-empty/retry limits remain linked in the report.'},ensure_ascii=False,indent=2))
