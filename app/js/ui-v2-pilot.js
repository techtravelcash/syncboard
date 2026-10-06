// Isolated, local-only component interactions. No API, task state or storage access.
(() => {
  const themeButton = document.getElementById('pilot-theme');
  const themeNote = document.getElementById('pilot-theme-note');
  const dialog = document.getElementById('pilot-dialog');
  const dialogOpener = document.getElementById('pilot-dialog-open');
  const toast = document.getElementById('pilot-toast');
  let toastTimeout;
  const showFeedback = message => {
    window.clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.hidden = false;
    toastTimeout = window.setTimeout(() => { toast.hidden = true; }, 6000);
  };
  themeButton.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark');
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.textContent = dark ? 'Testar tema claro' : 'Testar tema escuro';
    themeNote.hidden = !dark;
  });
  document.querySelectorAll('[data-pilot-chip]').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
    });
  });
  document.getElementById('pilot-feedback').addEventListener('click', () => showFeedback('Feedback de exemplo. Nenhuma alteração foi salva.'));
  dialogOpener.addEventListener('click', () => { if (!dialog.open) dialog.showModal(); });
  document.getElementById('pilot-dialog-cancel').addEventListener('click', () => dialog.close());
  document.getElementById('pilot-dialog-confirm').addEventListener('click', () => {
    dialog.close();
    showFeedback('Demonstração confirmada. Nenhum dado real foi alterado.');
  });
  dialog.addEventListener('close', () => dialogOpener.focus());
})();
