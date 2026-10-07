/* TC-464: presentation-only disclosure of the current, single-board context.
 * No data loading, switching, persistence or backend changes. */
export function initializeContextSelector(root = document.getElementById('fidelity-context')) {
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const triggers = [...root.querySelectorAll('.fidelity-context-trigger')];
  let active = null;
  const close = (restoreFocus = false) => {
    const previous = active;
    triggers.forEach(trigger => {
      trigger.setAttribute('aria-expanded', 'false');
      document.getElementById(trigger.getAttribute('aria-controls')).hidden = true;
    });
    active = null;
    if (restoreFocus) previous?.focus();
  };
  triggers.forEach(trigger => trigger.addEventListener('click', () => {
    const opening = active !== trigger;
    close();
    if (opening) {
      active = trigger;
      trigger.setAttribute('aria-expanded', 'true');
      document.getElementById(trigger.getAttribute('aria-controls')).hidden = false;
    }
  }));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  });
  document.addEventListener('click', event => {
    if (!root.contains(event.target)) close();
  });
  root.addEventListener('focusout', event => {
    if (!root.contains(event.relatedTarget)) close();
  });
}
initializeContextSelector();
