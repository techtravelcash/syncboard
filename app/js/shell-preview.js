import { initializeShell, closeShellPanels, syncShellView } from './shell-v2.js';
initializeShell();
window.lucide?.createIcons();
const toast = document.getElementById('preview-toast');
let timeout;
const explain = () => {
  window.clearTimeout(timeout);
  toast.textContent = 'Prévia de navegação. Nenhuma tarefa, notificação ou sessão foi alterada.';
  toast.hidden = false;
  timeout = window.setTimeout(() => { toast.hidden = true; }, 5000);
};
const labels = { home: 'Início', kanban: 'Quadro Kanban', list: 'Lista de Tarefas', archived: 'Arquivo', users: 'Utilizadores' };
document.getElementById('view-switcher-orb').addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  const view = button.dataset.view;
  syncShellView(view);
  document.getElementById('current-view-label').textContent = labels[view];
  document.getElementById('preview-heading').textContent = `${labels[view]}: navegação em foco.`;
  document.getElementById('orb-filter').classList.toggle('hidden', !['kanban', 'list'].includes(view));
  document.getElementById('orb-sort').classList.toggle('hidden', view !== 'list');
  closeShellPanels();
});
document.getElementById('preview-admin').addEventListener('click', event => {
  const active = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  event.currentTarget.setAttribute('aria-pressed', String(active));
  document.getElementById('user-management-btn').classList.toggle('hidden', !active);
});
document.getElementById('theme-toggle').addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  const icon = document.getElementById('theme-icon');
  icon.setAttribute('data-lucide', document.documentElement.classList.contains('dark') ? 'sun' : 'moon');
  window.lucide?.createIcons();
});
for (const id of ['addTaskBtn', 'orb-notif-btn']) document.getElementById(id).addEventListener('click', explain);
document.querySelector('[data-preview-only="logout"]').addEventListener('click', event => { event.preventDefault(); explain(); });
for (const id of ['orb-project-filters', 'orb-responsible-filters', 'orb-sort-options']) {
  const note = document.createElement('p'); note.className = 'sb-meta';
  note.textContent = 'As opções existentes serão preservadas na aplicação. Esta prévia não consulta dados.';
  document.getElementById(id).append(note);
}
