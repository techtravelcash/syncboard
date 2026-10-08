// Email is the identity anchor. Display names and admin roles never grant decisions.
export function normalizeHomologationEmail(value) {
    const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}
export function homologationUserEmail(user) {
    const detail = normalizeHomologationEmail(user?.userDetails);
    if (detail) return detail;
    const emailTypes = ['email', 'emails', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
    for (const claim of user?.claims || []) {
        if (!emailTypes.includes(claim.typ)) continue;
        const email = normalizeHomologationEmail(claim.val);
        if (email) return email;
    }
    return '';
}
export function canDecideHomologation(task, user) {
    const assignee = normalizeHomologationEmail(typeof task?.homologador === 'object' ? task.homologador?.email : task?.homologador);
    return task?.status === 'homologation' && !!assignee &&
        Array.isArray(user?.userRoles) && user.userRoles.includes('travelcash_user') &&
        assignee === homologationUserEmail(user);
}
export function forwardCandidates(task, users) {
    const current = task.responsible?.length === 1 ? task.responsible[0] : null;
    const previousEmail = normalizeHomologationEmail(typeof current === 'object' ? current?.email : current);
    const seen = new Set();
    return (users || []).filter(user => {
        const email = normalizeHomologationEmail(user?.email);
        if (!email || seen.has(email) || email === previousEmail) return false;
        seen.add(email);
        return true;
    }).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR'));
}
export function openForwardDialog(task, users, submit, onSuccess = () => {}) {
    if (document.getElementById('homologation-forward-dialog')) return;
    const dialog = document.createElement('dialog');
    if (typeof dialog.showModal !== 'function') return false;
    dialog.id = 'homologation-forward-dialog';
    dialog.className = 'sb-homologation-forward';
    dialog.setAttribute('aria-labelledby', 'homologation-forward-title');
    dialog.setAttribute('aria-describedby', 'homologation-forward-help');
    dialog.innerHTML = `<form>
        <h2 id="homologation-forward-title">Encaminhar tarefa</h2>
        <p id="homologation-forward-help">Escolha um novo responsável. A tarefa volta para Fila e os responsáveis atuais serão substituídos pela pessoa selecionada.</p>
        <label for="homologation-forward-person">Novo responsável</label>
        <select id="homologation-forward-person" required autofocus><option value="">Selecione uma pessoa</option></select>
        <p class="sb-forward-error" role="status" aria-live="polite"></p>
        <div class="sb-forward-actions"><button type="button">Cancelar</button><button type="submit">Encaminhar para Fila</button></div>
    </form>`;
    const select = dialog.querySelector('select');
    const buttons = [...dialog.querySelectorAll('button')];
    const error = dialog.querySelector('.sb-forward-error');
    for (const user of forwardCandidates(task, users)) {
        const option = document.createElement('option');
        option.value = normalizeHomologationEmail(user.email);
        option.textContent = `${user.name || user.email} (${user.email})`;
        select.appendChild(option);
    }
    if (select.options.length === 1) {
        error.textContent = 'Nenhum novo responsável disponível.';
        buttons[1].disabled = true;
    }
    let busy = false;
    buttons[0].addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.querySelector('form').addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !select.value) return;
        busy = true;
        select.disabled = true;
        buttons.forEach(button => { button.disabled = true; });
        error.textContent = 'Encaminhando…';
        try {
            if (await submit(select.value)) { dialog.close(); onSuccess(); return; }
            error.textContent = 'Não foi possível encaminhar. Confira a mensagem e tente novamente.';
        } catch { error.textContent = 'Não foi possível encaminhar. Tente novamente.'; }
        finally {
            busy = false;
            select.disabled = false;
            buttons.forEach(button => { button.disabled = false; });
        }
    });
    document.body.appendChild(dialog);
    try { dialog.showModal(); } catch { dialog.remove(); return false; }
    return true;
}
