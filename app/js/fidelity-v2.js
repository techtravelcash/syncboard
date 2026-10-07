/* TC-455: opt-in V2 presentation. No API, auth, storage or backend state changes.
 * Hooks: syncFidelityShell runs before the view renderer, allowing a view-specific
 * hero override. Extra filters apply to the existing loaded-data filter result.
 * initializeFidelityControls routes project/responsible/navigation back through
 * existing controls; sb:fidelity-view-updated refreshes Sortable after rendering.
 */
export const isFidelityV2 = () => Boolean(document.body?.classList.contains('sb-fidelity-v2'));
const localFilters = { priority: 'all', status: 'all' };
export const fidelityFilterCount = () => Number(localFilters.priority !== 'all') + Number(localFilters.status !== 'all');
export const resetFidelityFilters = () => { localFilters.priority = 'all'; localFilters.status = 'all'; };
export const hasFidelityFilters = state => Boolean(
  (state.selectedProject && state.selectedProject !== 'all') ||
  (state.selectedResponsible && state.selectedResponsible !== 'all') ||
  state.searchQuery || fidelityFilterCount()
);
export function applyFidelityFilters(tasks) {
  return tasks.filter(task => (localFilters.priority === 'all' || task.priority === localFilters.priority) && (localFilters.status === 'all' || task.status === localFilters.status));
}
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const setText = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
const normalized = value => String(value ?? '').trim().toLowerCase();
const viewCopy = {
  home: ['Home', 'Visão geral', 'O que precisa da sua atenção, em cada etapa.'],
  kanban: ['Quadro', 'Quadro de trabalho', 'Da fila à publicação, com cada etapa à vista.'],
  list: ['Lista', 'Lista de tarefas', 'Todas as tarefas ativas, organizadas em uma só visão.'],
  archived: ['Arquivados', 'Tarefas arquivadas', 'Consulte as entregas que já passaram pela publicação.'],
  users: ['Utilizadores', 'Utilizadores', 'As pessoas que fazem parte deste espaço de trabalho.']
};
function syncSelect(id, values, selected, allLabel) {
  const node = document.getElementById(id);
  if (!node) return;
  const choices = [...new Set([...values, ...(selected && selected !== 'all' ? [selected] : [])].filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt'));
  const markup = `<option value="all">${allLabel}</option>` + choices.map(value => `<option value="${escapeText(value)}">${escapeText(value)}</option>`).join('');
  if (node.innerHTML !== markup) node.innerHTML = markup;
  node.value = selected || 'all';
}
export function syncFidelityShell(state, filteredTasks) {
  if (!isFidelityV2()) return;
  const [label, title, subtitle] = viewCopy[state.currentView] || viewCopy.home;
  setText('current-view-label', label);
  setText('fidelity-page-eyebrow', 'SyncBoard NT');
  setText('fidelity-page-title', title);
  setText('fidelity-page-subtitle', subtitle);
  document.body.dataset.fidelityView = state.currentView;
  document.querySelectorAll('button[data-fidelity-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.fidelityView === state.currentView));
    if (button.dataset.fidelityView === state.currentView) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelectorAll('#view-switcher-orb [data-view]').forEach(button => {
    if (button.dataset.view === state.currentView) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const active = state.tasks.filter(task => task.status !== 'done');
  setText('fidelity-nav-task-count', active.length);
  setText('fidelity-result-count', `${filteredTasks.length} ${filteredTasks.length === 1 ? 'tarefa encontrada' : 'tarefas encontradas'}`);
  const dragNote = document.getElementById('fidelity-filter-drag-note');
  if (dragNote) dragNote.hidden = state.currentView !== 'kanban' || !hasFidelityFilters(state);
  const add = document.getElementById('addTaskBtn');
  if (add) add.hidden = state.currentView === 'users';
  syncSelect('fidelity-project-filter', state.tasks.map(task => task.project), state.selectedProject, 'Todos os projetos');
  syncSelect('fidelity-responsible-filter', state.tasks.flatMap(task => Array.isArray(task.responsible) ? task.responsible.map(person => typeof person === 'object' ? person?.name : person) : []), state.selectedResponsible, 'Todos os responsáveis');
  syncSelect('fidelity-priority-filter', active.map(task => task.priority), localFilters.priority, 'Todas as prioridades');
  const status = document.getElementById('fidelity-status-filter');
  if (status) status.value = localFilters.status;
  const projects = new Map();
  state.tasks.forEach(task => {
    if (!task.project) return;
    if (!projects.has(task.project)) projects.set(task.project, { count: 0, color: task.projectColor || '#97B5FB' });
    if (task.status !== 'done') projects.get(task.project).count++;
  });
  const links = document.getElementById('fidelity-project-links');
  if (links) {
    // Preserve focus on a project link across loaded-data refreshes.
    const focusedProject = links.contains(document.activeElement) ? document.activeElement.dataset.fidelityProject : undefined;
    links.innerHTML = [...projects].sort(([a], [b]) => a.localeCompare(b, 'pt')).map(([name, data]) => `<button type="button" class="fidelity-project-link" data-fidelity-project="${escapeText(name)}" aria-label="Filtrar projeto ${escapeText(name)}: ${data.count} tarefas ativas carregadas" aria-pressed="${normalized(state.selectedProject) === normalized(name)}"><span class="fidelity-project-dot" aria-hidden="true"></span><span class="fidelity-project-name">${escapeText(name)}</span><span class="fidelity-project-count">${data.count}</span></button>`).join('') || '<p class="fidelity-project-empty">Nenhum projeto carregado.</p>';
    [...links.querySelectorAll('[data-fidelity-project]')].forEach(button => {
      button.querySelector('.fidelity-project-dot').style.backgroundColor = projects.get(button.dataset.fidelityProject).color;
      if (button.dataset.fidelityProject === focusedProject) button.focus({preventScroll: true});
    });
  }
  // Use exactly the resolved production profile, including the guarded photo fallback.
  setText('fidelity-profile-name', document.getElementById('user-name-display')?.textContent || 'Utilizador');
  setText('fidelity-profile-role', document.getElementById('user-role-display')?.textContent || '');
  const avatar = document.getElementById('fidelity-profile-avatar');
  const source = document.getElementById('user-avatar-menu');
  if (avatar && source && avatar.innerHTML !== source.innerHTML) avatar.innerHTML = source.innerHTML;
}
export function finishFidelityView(state) {
  setText('current-view-label', (viewCopy[state.currentView] || viewCopy.home)[0]);
  document.dispatchEvent(new Event('sb:fidelity-view-updated'));
}
let controlsReady = false;
export function initializeFidelityControls(state, {refresh}) {
  if (!isFidelityV2() || controlsReady) return;
  controlsReady = true;
  const selectExisting = (type, value) => {
    const current = type === 'project' ? state.selectedProject : state.selectedResponsible;
    if (current === value) return;
    const option = [...document.querySelectorAll(`#orb-${type}-filters .filter-chip`)].find(chip => chip.dataset.value === value);
    option?.click();
  };
  for (const type of ['project', 'responsible']) {
    document.getElementById(`fidelity-${type}-filter`)?.addEventListener('change', event => selectExisting(type, event.target.value));
  }
  for (const type of ['priority', 'status']) {
    document.getElementById(`fidelity-${type}-filter`)?.addEventListener('change', event => {
      localFilters[type] = event.target.value;
      refresh();
    });
  }
  document.getElementById('fidelity-project-links')?.addEventListener('click', event => {
    const button = event.target.closest('[data-fidelity-project]');
    if (!button) return;
    selectExisting('project', button.dataset.fidelityProject);
    document.querySelector('#view-switcher-orb [data-view="kanban"]')?.click();
  });
  document.querySelectorAll('button[data-fidelity-view]').forEach(button => button.addEventListener('click', () => document.querySelector(`#view-switcher-orb [data-view="${button.dataset.fidelityView}"]`)?.click()));
  document.getElementById('fidelity-notifications-toggle')?.addEventListener('click', () => document.getElementById('orb-notif-btn')?.click());
  // Native details controls stay keyboard accessible; only one action disclosure is open.
  document.addEventListener('toggle', event => {
    if (event.target.matches?.('.fidelity-card-menu[open]')) document.querySelectorAll('.fidelity-card-menu[open]').forEach(menu => { if (menu !== event.target) menu.open = false; });
  }, true);
  document.addEventListener('pointerdown', event => document.querySelectorAll('.fidelity-card-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const menu = event.target.closest?.('.fidelity-card-menu[open]');
    if (menu) { menu.open = false; menu.querySelector('summary')?.focus(); event.preventDefault(); }
  });
}
export function renderFidelityCardMarkup(task, {escape: esc, avatars, responsibleNames, projectStrip, progressBarHtml, actionButtons, isOverdue}) {
  const date = task.dueDate ? new Date(task.dueDate) : null;
  const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short', timeZone: 'UTC'}).replace('.', '') : 'Sem prazo';
  const fullDate = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem prazo';
  const commentCount = Array.isArray(task.comments) ? task.comments.length : 0;
  const progressMarkup = task.progress === null || task.progress === undefined || task.progress === ''
    ? progressBarHtml.replace('<span>Progresso informado</span><strong>Não informado</strong>', '<span>Progresso não informado</span>')
    : progressBarHtml;
  return `<div class="sb-kanban-card-head"><span class="sb-kanban-id">${esc(task.id)}</span><span class="fidelity-card-head-end"><span class="sb-kanban-priority${['Urgente', 'Alta'].includes(task.priority) ? ' fidelity-priority-high' : ''}"><i data-lucide="flag" aria-hidden="true"></i>${esc(task.priority || 'Não informada')}</span><details class="fidelity-card-menu"><summary aria-label="Ações da tarefa ${esc(task.id)}" title="Ações da tarefa"><i data-lucide="ellipsis" aria-hidden="true"></i></summary><div class="fidelity-card-menu-panel"><button type="button" class="info-btn sb-kanban-action" data-task-id="${esc(task.id)}"><i data-lucide="maximize-2" aria-hidden="true"></i>Detalhes</button>${actionButtons}<button type="button" class="delete-task-btn sb-kanban-action sb-kanban-action--danger" data-task-id="${esc(task.id)}" aria-label="Excluir ${esc(task.id)}"><i data-lucide="trash-2" aria-hidden="true"></i>Excluir tarefa</button></div></details></span></div>
    <div class="task-body"><h3 class="sb-kanban-title"><button type="button" class="expand-btn fidelity-task-open" data-task-id="${esc(task.id)}" aria-label="Abrir detalhes de ${esc(task.id)}: ${esc(task.title)}">${esc(task.title)}</button></h3>${projectStrip}${progressMarkup}
    <div class="sb-kanban-metadata"><div class="sb-kanban-avatars" role="img" aria-label="${esc(responsibleNames.length ? 'Responsáveis: ' + responsibleNames.join(', ') : 'Responsável não definido')}">${avatars || '<span class="fidelity-no-owner" aria-hidden="true">—</span>'}</div><span class="sb-kanban-counts"><span class="sb-kanban-count" title="${commentCount} comentários"><i data-lucide="message-circle" aria-hidden="true"></i>${commentCount}<span class="fidelity-sr-only"> comentários</span></span><span aria-hidden="true">·</span><span class="sb-kanban-date${isOverdue ? ' sb-kanban-date--overdue' : ''}" title="${esc((isOverdue ? 'Atrasada · ' : '') + fullDate)}">${isOverdue ? '<i data-lucide="calendar-clock" aria-hidden="true"></i><span class="fidelity-sr-only">Atrasada: </span>' : ''}${esc(dateLabel)}</span></span></div></div>`;
}
