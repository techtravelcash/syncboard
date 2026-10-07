import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const classes = (...names) => { const s = new Set(names); return { contains: n => s.has(n), add: n => s.add(n), remove: n => s.delete(n) }; };
const main = read('app/js/main.js');
const handler = main.slice(main.indexOf('    const modalApproveBtn ='), main.indexOf("    document.getElementById('editTaskBtn')"));
const ui = read('app/js/ui.js');
const closer = ui.slice(ui.indexOf('export function closeApprovedTaskHistory'), ui.indexOf('export function closeTaskHistory')).replace('export function', 'function');
const dialogCode = read('app/js/approval-success.js').replace('export function', 'function');
function setup() {
    let active = null, callback, resolve, writes = 0, renders = 0, focused = null;
    const button = { dataset: { taskId: 'A' }, addEventListener(type, fn) { callback = fn; } };
    const content = { style: {}, classList: classes('animating-morph') };
    const modal = { classList: classes('show'), querySelector: () => content };
    const target = { dataset: { taskId: 'A' }, closest: () => null, getClientRects: () => [1], querySelectorAll: () => [], hasAttribute: () => false, matches: () => false, focus() { focused = 'A'; } };
    const board = { querySelectorAll: () => [target], hasAttribute: () => false, matches: () => false, focus() { focused = 'board'; } };
    const document = {
        getElementById(id) { return id === 'approval-success-dialog' ? active : id === 'modal-approve-btn' ? button : id === 'taskHistoryModal' ? modal : board; },
        createElement() { const listeners = {}; const next = { addEventListener(n, fn) { this[n] = fn; } }; return { next, setAttribute() {}, querySelector: () => next, addEventListener(n, fn) { listeners[n] = fn; }, showModal() { this.open = true; }, close() { this.open = false; listeners.close(); }, remove() { active = null; } }; },
        body: { appendChild(dialog) { active = dialog; } }
    };
    const context = { document, state: { lastInteractedTaskId: 'A', tasks: [{ id: 'A', status: 'homologation' }] }, pendingApprovalFeedback: new Set(), activeOriginEl: { style: { opacity: '0' } }, activeOriginRect: {}, isAnimating: false, window: {}, console,
        api: { updateTask(id, data) { writes++; assert.equal(id, 'A'); assert.deepEqual(JSON.parse(JSON.stringify(data)), { status: 'publication', progress: 100 }); return new Promise(r => resolve = r); } },
        ui: { showToast() {}, updateActiveView() {}, renderTaskHistory(id) { renders++; assert.equal(id, 'A'); } } };
    vm.createContext(context); vm.runInContext(closer + '\n' + dialogCode, context); context.ui.closeApprovedTaskHistory = context.closeApprovedTaskHistory; vm.runInContext(handler, context);
    return { context, modal, target, content, callback: () => callback({ stopPropagation() {} }), resolve: () => resolve({ id: 'A', status: 'publication' }), get dialog() { return active; }, get writes() { return writes; }, get renders() { return renders; }, get focused() { return focused; } };
}
// Actual approval listener + actual native-dialog button listener + actual UI closer.
const t = setup(); const pending = t.callback(); await t.callback(); assert.equal(t.writes, 1); assert.equal(t.dialog, null); t.resolve(); await pending;
assert.equal(t.renders, 1); assert.equal(t.modal.classList.contains('hidden'), false);
const continueButton = t.dialog.next; continueButton.click(); continueButton.click();
assert.equal(t.dialog, null); assert.equal(t.modal.classList.contains('hidden'), true); assert.equal(t.focused, 'A'); assert.equal(t.writes, 1); assert.equal(t.context.activeOriginEl, null);
// Escape/ordinary close dismisses feedback only, preserving existing cancellation behavior.
const cancel = setup(); const p2 = cancel.callback(); cancel.resolve(); await p2; cancel.dialog.close(); assert.equal(cancel.modal.classList.contains('hidden'), false); assert.equal(cancel.focused, null);
// Response after newer navigation must neither render the old detail nor close the new one.
const race = setup(); const p3 = race.callback(); race.context.state.lastInteractedTaskId = 'B'; race.resolve(); await p3; assert.equal(race.renders, 0); race.dialog.next.click(); assert.equal(race.modal.classList.contains('hidden'), false); assert.equal(race.focused, null);
// A newer detail opened after the feedback appeared is protected too.
const late = setup(); const p4 = late.callback(); late.resolve(); await p4; late.context.state.lastInteractedTaskId = 'B'; late.dialog.next.click(); assert.equal(late.modal.classList.contains('hidden'), false);
// Already dismissed detail stays dismissed; hidden/filtered cards use board focus.
const closed = setup(); const p5 = closed.callback(); closed.modal.classList.add('hidden'); closed.resolve(); await p5; assert.equal(closed.renders, 0); closed.dialog.next.click(); assert.equal(closed.focused, null);
const filtered = setup(); const p6 = filtered.callback(); filtered.resolve(); await p6; filtered.target.getClientRects = () => []; filtered.dialog.next.click(); assert.equal(filtered.focused, 'board');
const detailFocus = setup(); const p8 = detailFocus.callback(); detailFocus.resolve(); await p8;
let requestedSelector, titleFocused = false, hiddenFocused = false;
const hiddenDetails = { closest: () => ({}), getClientRects: () => [], focus() { hiddenFocused = true; } };
const visibleTitle = { closest: () => null, getClientRects: () => [1], hasAttribute: () => false, matches: () => true, focus() { titleFocused = true; } };
detailFocus.target.querySelectorAll = selector => { requestedSelector = selector; return [hiddenDetails, visibleTitle]; };
detailFocus.dialog.next.click(); assert.equal(requestedSelector, '.fidelity-task-open:not([disabled]), .info-btn:not([disabled])'); assert.equal(titleFocused, true); assert.equal(hiddenFocused, false);
// Actual Kanban markup keeps .info-btn inside a closed disclosure and title outside.
assert.match(read('app/js/fidelity-v2.js'), /<details class="fidelity-card-menu">[\s\S]*?class="info-btn/);
assert.match(read('app/js/fidelity-v2.js'), /<\/details>[\s\S]*?class="expand-btn fidelity-task-open"/);

const closing = setup(); const p7 = closing.callback(); closing.modal.classList.remove('show'); closing.context.isAnimating = true; closing.resolve(); await p7; assert.equal(closing.renders, 0); closing.dialog.next.click(); assert.equal(closing.context.isAnimating, true); assert.equal(closing.focused, null);
console.log('PASS TC466 real handlers: Continue closes feedback/detail once, board focus fallback, deferred approval, duplicate click, new-task races, already closed detail, Escape unchanged, one mocked approval write. Native keyboard/layout require browser QA.');
