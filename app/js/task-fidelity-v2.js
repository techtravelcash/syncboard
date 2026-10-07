/* TC-455 preview-only presentation adapter. No API calls, model mutation, stored HTML,
   links, form handlers, approval logic or editor commands are replaced here. */
import { state } from './state.js';
import { openProgressUpdateModal } from './ui.js';

const stages = { todo: 'Fila', stopped: 'Parado', inprogress: 'Andamento', homologation: 'Homologação', publication: 'Publicação', done: 'Concluída' };
export function taskDetailPresentation(task) {
  const raw = task.progress;
  const known = raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw));
  const progress = known ? Number(raw) : null;
  return {
    status: stages[task.status] || 'Estado não informado', statusKey: stages[task.status] ? task.status : '',
    priority: task.priority || 'Não informada',
    progressLabel: known ? `${raw}%${progress < 0 || progress > 100 ? ' (fora da faixa)' : ''}` : 'Não informado',
    progressWidth: known ? Math.max(0, Math.min(100, progress)) : 0,
    missing: task.missingToComplete || 'Pendência não informada.',
    comments: Array.isArray(task.comments) ? task.comments.length : 0,
    attachments: Array.isArray(task.attachments) ? task.attachments.length : 0,
    noDueDate: !task.dueDate,
    noValidator: !task.homologador || !['homologation', 'publication'].includes(task.status),
    validatorFallback: task.homologador ? 'Não exibido nesta etapa.' : 'Não informado'
  };
}

export function installTaskFidelityPresentation(doc = document, store = state, openProgress = openProgressUpdateModal) {
  if (!doc.body.classList.contains('sb-fidelity-v2')) return null;
  const modal = doc.getElementById('taskHistoryModal');
  if (!modal || modal.dataset.fidelityTaskMounted) return null;
  modal.dataset.fidelityTaskMounted = 'true';
  const byId = id => doc.getElementById(id);
  const tabs = [...modal.querySelectorAll('[data-fidelity-tab]')];
  let lastTask = null;
  let lastVisible = false;
  // renderTaskHistory assigns this exact key before populating the detail. Keep its strict identity match.
  const selectedTask = () => store.tasks.find(task => task.id === store.lastInteractedTaskId);
  function selectTab(key, focus = false) {
    for (const tab of tabs) {
      const active = tab.dataset.fidelityTab === key;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      byId(tab.getAttribute('aria-controls')).hidden = !active;
      if (active && focus) tab.focus();
    }
    // The old expansion control is retained in markup; the tab now exposes its real feed.
    if (key === 'history') byId('history-feed').classList.remove('hidden');
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab.dataset.fidelityTab));
    tab.addEventListener('keydown', event => {
      const index = tabs.indexOf(tab);
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); selectTab(tabs[next].dataset.fidelityTab, true);
    });
  }
  modal.querySelector('[data-fidelity-close-detail]').addEventListener('click', () => byId('closeHistoryBtn').click());
  byId('fidelity-detail-progress').addEventListener('click', () => { const task = selectedTask(); if (task) openProgress(task); });
  function sync() {
    const visible = !modal.classList.contains('hidden');
    const task = selectedTask();
    if (task) {
      const model = taskDetailPresentation(task);
      if (lastTask !== task.id || (visible && !lastVisible)) selectTab('comments');
      lastTask = task.id;
      byId('fidelity-detail-status').textContent = model.status;
      byId('fidelity-detail-status').dataset.status = model.statusKey;
      byId('fidelity-detail-priority').textContent = model.priority;
      byId('fidelity-detail-missing').textContent = model.missing;
      byId('fidelity-detail-progress-value').textContent = model.progressLabel;
      byId('fidelity-detail-progress-fill').style.width = `${model.progressWidth}%`;
      byId('fidelity-detail-progress').setAttribute('aria-label', `Atualizar progresso. ${model.progressLabel}`);
      byId('fidelity-tab-comments').textContent = `Comentários (${model.comments})`;
      byId('fidelity-tab-attachments').textContent = `Anexos (${model.attachments})`;
      byId('fidelity-attachments-empty').hidden = model.attachments > 0;
      byId('fidelity-no-due-date').hidden = !model.noDueDate;
      byId('fidelity-no-validator').hidden = !model.noValidator;
      byId('fidelity-no-validator').querySelector('p').textContent = model.validatorFallback;
    }
    lastVisible = visible;
  }
  // Observe only legacy render anchors, never rich HTML/editor nodes or our own output.
  const observer = new MutationObserver(sync);
  observer.observe(byId('modal-task-id-display'), { childList: true, characterData: true, subtree: true });
  observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  // The existing progress overlay removes itself after save/cancel. Refresh only this presentation.
  const overlayObserver = new MutationObserver(records => {
    if (records.some(record => [...record.removedNodes].some(node => node.id === 'progressUpdateModal'))) sync();
  });
  overlayObserver.observe(doc.body, { childList: true });
  sync();
  return { sync, selectTab, disconnect: () => { observer.disconnect(); overlayObserver.disconnect(); } };
}
if (typeof document !== 'undefined') installTaskFidelityPresentation();
