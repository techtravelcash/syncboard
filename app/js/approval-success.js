// TC461: cosmetic feedback only. The caller must first confirm approval with the API.
export function showApprovalSuccess(onContinue) {
    if (document.getElementById('approval-success-dialog')) return;
    const dialog = document.createElement('dialog');
    if (typeof dialog.showModal !== 'function') return; // The success toast remains available.
    dialog.id = 'approval-success-dialog';
    dialog.className = 'sb-approval-success';
    dialog.setAttribute('aria-labelledby', 'approval-success-title');
    dialog.setAttribute('aria-describedby', 'approval-success-description');
    dialog.innerHTML = `<picture>
        <source media="(prefers-reduced-motion: reduce)" srcset="assets/cube-static-512.png">
        <img src="assets/cube-assembly-512.gif" width="224" height="224" alt="" class="sb-approval-success-cube">
    </picture>
    <h2 id="approval-success-title">Boa, mais um cubo resolvido!</h2>
    <p id="approval-success-description">Tarefa aprovada e enviada para Publicação.</p>
    <button type="button" autofocus>Continuar</button>`;
    dialog.querySelector('img').addEventListener('error', (event) => {
        const img = event.currentTarget;
        if (img.dataset.fallback) { img.hidden = true; return; }
        img.dataset.fallback = 'true';
        img.src = 'assets/cube-static-512.png';
    });
    let continued = false;
    dialog.querySelector('button').addEventListener('click', () => {
        if (continued) return;
        continued = true;
        dialog.close();
        if (typeof onContinue === 'function') onContinue();
    });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    document.body.appendChild(dialog);
    try { dialog.showModal(); } catch { dialog.remove(); }
}
