// Run the existing actual-handler fixtures against the recomposed preview fragments.
// This adds no alternate handlers and does not simulate native browser validation/layout.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const testURL = new URL('./check_task_space_flows.mjs', import.meta.url);
let source = readFileSync(testURL, 'utf8');
source = source.replace("new URL(rel, import.meta.url)", `new URL(rel, ${JSON.stringify(testURL.href)})`);
source = source.replace("const html = read('../app/index.html');", `const html = read('../app/index.html').replace(/<div id="taskModal"[\\s\\S]*?(?=<div id="taskHistoryModal")/, read('../app/fragments/taskModal-fidelity-v2.html')).replace(/<div id="taskHistoryModal"[\\s\\S]*?(?=<div id="aiTitleModal")/, read('../app/fragments/taskHistoryModal-fidelity-v2.html'));`);
if (!source.includes('app/fragments/taskModal-fidelity-v2.html')) throw Error('Fixture adaptation failed');
const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], { encoding: 'utf8' });
process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.status ?? 1;
