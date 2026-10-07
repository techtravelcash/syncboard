#!/usr/bin/env python3
"""Merge TC-455 task fragments into the opt-in preview entry only. Never touch index.html."""
from pathlib import Path
import argparse,re
p=argparse.ArgumentParser();p.add_argument('preview',type=Path);args=p.parse_args()
preview=args.preview
if preview.name!='ui-v2-fidelity-preview.html':raise SystemExit('Only ui-v2-fidelity-preview.html may be updated.')
text=preview.read_text()
body=re.search(r'<body\b[^>]*\bclass=[\"\']([^\"\']+)',text)
if not body or 'sb-fidelity-v2' not in body.group(1).split():raise SystemExit('Preview opt-in body class sb-fidelity-v2 is required.')
root=Path(__file__).resolve().parents[1]
for ident,following in [('taskModal','taskHistoryModal'),('taskHistoryModal','aiTitleModal')]:
 replacement=(root/f'app/fragments/{ident}-fidelity-v2.html').read_text().rstrip()+'\n\n    '
 pattern=rf'<div id="{ident}"[\s\S]*?(?=<div id="{following}")'
 text,count=re.subn(pattern,lambda _:replacement,text)
 if count!=1:raise SystemExit(f'Expected exactly one {ident} replacement; got {count}. No write performed.')
if 'css/task-fidelity-v2.css' not in text:text=text.replace('</head>','    <link rel="stylesheet" href="css/task-fidelity-v2.css?v=tc455-task-1">\n</head>')
if 'js/task-fidelity-v2.js' not in text:text=text.replace('</body>','    <script type="module" src="js/task-fidelity-v2.js?v=tc455-task-1"></script>\n</body>')
preview.write_text(text)
print(f'Updated preview fragments, stylesheet and presentation module: {preview}')
