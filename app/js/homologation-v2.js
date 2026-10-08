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

// Assignment editing is separate from approval/rejection/forwarding authority.
export function canEditHomologationResponsible(task, user) {
    return task?.status === 'homologation' && !!homologationUserEmail(user) &&
        Array.isArray(user?.userRoles) && user.userRoles.includes('travelcash_user') && user.userRoles.includes('admin');
}
export function homologationEditPayload(snapshot, draft, user, initialDraft = snapshot) {
    if (snapshot?.status !== 'homologation' || !snapshot._etag) throw new Error('Reabra a edição da tarefa.');
    const payload = {expectedStatus: 'homologation', expectedEtag: snapshot._etag};
    // Omitted fields stay server-owned/current. Never resend a whole task snapshot.
    for (const key of ['title', 'description', 'project', 'projectColor', 'priority', 'dueDate', 'azureLink', 'attachments']) {
        if (draft[key] !== undefined && JSON.stringify(draft[key]) !== JSON.stringify(initialDraft[key])) payload[key] = draft[key];
    }
    if (canEditHomologationResponsible(snapshot, user) && JSON.stringify(draft.responsible) !== JSON.stringify(snapshot.responsible)) {
        const addresses = (draft.responsible || []).map(value => normalizeHomologationEmail(typeof value === 'object' ? value.email : value));
        if (!addresses.length || addresses.some(value => !value) || new Set(addresses).size !== addresses.length) throw new Error('Selecione responsáveis válidos, sem duplicação.');
        payload.responsible = addresses.map(email => ({email}));
    }
    return payload;
}

// Registered email, never a display name, is the assignment identity.
export function homologationCandidates(users) {
    const seen = new Set();
    return (users || []).filter(user => {
        const email = normalizeHomologationEmail(user?.email);
        if (!email || seen.has(email)) return false;
        seen.add(email);
        return true;
    }).sort((a, b) => normalizeHomologationEmail(a.email).localeCompare(normalizeHomologationEmail(b.email)));
}
export function hasRegisteredHomologador(task, users) {
    const email = normalizeHomologationEmail(typeof task?.homologador === 'object' ? task.homologador?.email : task?.homologador);
    return !!email && homologationCandidates(users).some(user => normalizeHomologationEmail(user.email) === email);
}
export function canRecoverHomologador(task, user, users) {
    return canEditHomologationResponsible(task, user) &&
        (users || []).some(profile => normalizeHomologationEmail(profile?.email) === homologationUserEmail(user) && profile.isAdmin === true) &&
        !hasRegisteredHomologador(task, users);
}
export function homologationAssignmentPayload(snapshot, email, users, recovery = false) {
    const normalized = normalizeHomologationEmail(email);
    if (!normalized || !homologationCandidates(users).some(user => normalizeHomologationEmail(user.email) === normalized)) throw new Error('Selecione um homologador cadastrado com e-mail válido.');
    if (!snapshot?._etag || !snapshot.status || (recovery ? snapshot.status !== 'homologation' : snapshot.status === 'homologation')) throw new Error('A tarefa mudou. Reabra a tarefa antes de atribuir o homologador.');
    return {
        ...(recovery ? {homologationRecovery: true} : {status: 'homologation'}),
        homologador: {email: normalized}, expectedStatus: snapshot.status, expectedEtag: snapshot._etag
    };
}

// One selection dialog; cancel/escape resolves without writing or changing the task.
export function selectHomologador(users, recovery = false) {
    if (document.getElementById('homologation-assignment-dialog')) return Promise.resolve(null);
    return new Promise(resolve => {
        const dialog = document.createElement('dialog');
        if (typeof dialog.showModal !== 'function') { resolve(null); return; }
        dialog.id = 'homologation-assignment-dialog';
        dialog.className = 'sb-homologation-forward';
        dialog.setAttribute('aria-labelledby', 'homologation-assignment-title');
        dialog.setAttribute('aria-describedby', 'homologation-assignment-help');
        dialog.innerHTML = `<form><h2 id="homologation-assignment-title">${recovery ? 'Recuperar homologador' : 'Enviar para Homologação'}</h2>
            <p id="homologation-assignment-help">${recovery ? 'Atribua um homologador cadastrado. A tarefa permanece em Homologação, sem aprovação ou alteração dos responsáveis.' : 'Escolha por e-mail quem deverá validar a tarefa.'}</p>
            <label for="homologation-assignment-person">Homologador</label>
            <select id="homologation-assignment-person" required autofocus><option value="">Selecione um e-mail</option></select>
            <p role="status" aria-live="polite"></p>
            <div class="sb-forward-actions"><button type="button">Cancelar</button><button type="submit">${recovery ? 'Atribuir homologador' : 'Confirmar homologador'}</button></div></form>`;
        const select = dialog.querySelector('select');
        const buttons = [...dialog.querySelectorAll('button')];
        for (const user of homologationCandidates(users)) {
            const option = document.createElement('option');
            option.value = normalizeHomologationEmail(user.email);
            option.textContent = option.value;
            select.appendChild(option);
        }
        if (select.options.length === 1) {
            dialog.querySelector('[role="status"]').textContent = 'Nenhum homologador com e-mail válido disponível. Cadastre um usuário antes de continuar.';
            buttons[1].disabled = true;
        }
        let selection = null;
        buttons[0].addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => { dialog.remove(); resolve(selection); }, {once: true});
        dialog.querySelector('form').addEventListener('submit', event => {
            event.preventDefault();
            if (!select.value || buttons[1].disabled) return;
            selection = select.value;
            buttons[1].disabled = true;
            dialog.close();
        });
        document.body.appendChild(dialog);
        try { dialog.showModal(); } catch { dialog.remove(); resolve(null); }
    });
}
