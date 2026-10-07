// Presentation only: no API, roles, task-state or persistence changes.
let shellReady = false;
let activePanel = null;
let lastTrigger = null;
let mobileQuery;
const panelIds = ['orb-nav', 'shell-account-panel', 'shell-filter-panel', 'shell-sort-panel'];
const focusable = container => [...container.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter(el => !el.closest('[hidden], .hidden, [inert]') && el.getClientRects().length);

export function closeShellPanels(restoreFocus = true) {
  const trigger = lastTrigger;
  panelIds.forEach(id => {
    const panel = document.getElementById(id);
    if (!panel) return;
    const sidebarVisible = id === 'orb-nav' && !mobileQuery?.matches;
    panel.hidden = !sidebarVisible;
    panel.inert = !sidebarVisible;
    panel.removeAttribute('aria-modal');
    if (id === 'orb-nav') panel.removeAttribute('role');
  });
  document.querySelectorAll('[data-shell-toggle]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  const backdrop = document.getElementById('shell-backdrop');
  if (backdrop) backdrop.hidden = true;
  for (const id of ['shell-topbar', 'main-content']) {
    const element = document.getElementById(id);
    if (element) element.inert = false;
  }
  activePanel = null;
  lastTrigger = null;
  if (restoreFocus && trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
}

function openPanel(panel, trigger) {
  if (activePanel === panel) { closeShellPanels(); return; }
  closeShellPanels(false);
  panel.hidden = false;
  panel.inert = false;
  activePanel = panel;
  lastTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  if (panel.id === 'orb-nav' && mobileQuery.matches) {
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    document.getElementById('shell-backdrop').hidden = false;
    for (const id of ['shell-topbar', 'main-content']) document.getElementById(id).inert = true;
  }
  focusable(panel)[0]?.focus();
}

export function syncShellView(view) {
  document.querySelectorAll('#view-switcher-orb [data-view]').forEach(button => {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

export function initializeShell() {
  if (shellReady) return;
  shellReady = true;
  mobileQuery = window.matchMedia('(max-width: 767px)');
  closeShellPanels(false);
  mobileQuery.addEventListener('change', () => closeShellPanels(false));
  syncShellView('home');
  document.querySelectorAll('[data-shell-toggle]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const panel = document.getElementById(trigger.dataset.shellToggle);
      if (panel) openPanel(panel, trigger);
    });
  });
  document.querySelectorAll('[data-shell-close]').forEach(button => button.addEventListener('click', () => closeShellPanels()));
  document.getElementById('shell-backdrop')?.addEventListener('click', () => closeShellPanels());
  document.addEventListener('pointerdown', event => {
    if (activePanel && !activePanel.contains(event.target) && !lastTrigger?.contains(event.target)) closeShellPanels(event.target.id === 'shell-backdrop');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activePanel) { event.preventDefault(); closeShellPanels(); return; }
    if (event.key === 'Tab' && activePanel?.id === 'orb-nav' && mobileQuery.matches) {
      const items = focusable(activePanel);
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }
    const option = event.target.closest('.filter-chip, .radial-content');
    if (option && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const container = option.closest('#orb-project-filters, #orb-responsible-filters, #orb-sort-options');
      const sort = option.dataset.sort;
      const value = option.dataset.value;
      const label = option.textContent;
      const index = container ? [...container.querySelectorAll('.filter-chip, .radial-content')].indexOf(option) : -1;
      option.click();
      queueMicrotask(() => {
        if (!container || !container.isConnected) return;
        const candidates = [...container.querySelectorAll('.filter-chip, .radial-content')];
        const replacement = option.isConnected ? option : candidates.find(el => sort ? el.dataset.sort === sort : value !== undefined ? el.dataset.value === value : el.textContent === label) || candidates[index];
        if (replacement && !replacement.closest('[hidden], .hidden, [inert]')) replacement.focus({preventScroll: true});
      });
    }
  });
  // Existing renderers produce div options. Supply keyboard semantics without replacing callbacks.
  const labelOptions = () => document.querySelectorAll('#orb-project-filters .filter-chip, #orb-responsible-filters .filter-chip, #orb-sort-options .radial-content').forEach(option => {
    option.setAttribute('role', 'button');
    option.tabIndex = 0;
    option.setAttribute('aria-pressed', String(option.classList.contains('active')));
    if (option.dataset.label) option.setAttribute('aria-label', option.dataset.label);
  });
  for (const id of ['orb-project-filters', 'orb-responsible-filters', 'orb-sort-options']) {
    const container = document.getElementById(id);
    if (container) new MutationObserver(labelOptions).observe(container, {childList: true, subtree: true});
  }
  labelOptions();
  for (const id of ['addTaskBtn', 'orb-notif-btn']) document.getElementById(id)?.addEventListener('click', () => closeShellPanels(false));
}

export function showStartupState(title, message, allowLogin = false) {
  const loader = document.getElementById('loader-container');
  if (!loader) return;
  loader.classList.remove('hidden');
  loader.style.opacity = '1';
  const card = document.createElement('section');
  card.className = 'sb-panel sb-startup-card';
  card.setAttribute('role', 'alert');
  const heading = document.createElement('h2');
  heading.textContent = title;
  const description = document.createElement('p');
  description.textContent = message;
  const retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'sb-button'; retry.textContent = 'Tentar novamente';
  retry.addEventListener('click', () => window.location.reload());
  card.append(heading, description, retry);
  if (allowLogin) {
    const login = document.createElement('a');
    login.className = 'sb-button sb-button--secondary'; login.href = '/login'; login.textContent = 'Ir para o acesso';
    card.append(login);
  }
  loader.replaceChildren(card);
  retry.focus();
}
