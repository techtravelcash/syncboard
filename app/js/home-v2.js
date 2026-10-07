// Personal Home presentation model. Existing membership semantics are preserved.
export function buildHomeModel(state, isTaskOverdue) {
    // 1. Identificar o usuário logado com precisão (Azure Auth)
    const normalize = (val) => (val || '').toString().trim().toLowerCase();
    
    const emailClaim = (state.currentUser?.claims || []).find(c =>
        c.typ === 'emails' ||
        c.typ === 'email' ||
        c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    )?.val;

    const myIdentifiers = new Set([
        state.currentUser?.userDetails,
        state.currentUser?.userId,
        emailClaim
    ].map(normalize).filter(Boolean));

    const dbUser = state.users.find(u => myIdentifiers.has(normalize(u.email)) || myIdentifiers.has(normalize(u.name)));
    if (dbUser) {
        if (dbUser.name) myIdentifiers.add(normalize(dbUser.name));
        if (dbUser.email) myIdentifiers.add(normalize(dbUser.email));
    }

    // 2. Filtrar apenas tarefas ativas ONDE o usuário é um dos responsáveis OU o homologador
    const myActiveTasks = state.tasks.filter(t => {
        if (t.status === 'done') return false;
        
        // Verifica se é o responsável
        const isResponsible = Array.isArray(t.responsible) && t.responsible.some(r => {
            const rName = normalize(typeof r === 'object' ? r.name : r);
            const rEmail = normalize(typeof r === 'object' ? r.email : null);
            return myIdentifiers.has(rName) || myIdentifiers.has(rEmail);
        });

        // Verifica se é o homologador pendente
        let isHomologador = false;
        if (t.homologador && t.status === 'homologation') {
            const hName = normalize(typeof t.homologador === 'object' ? t.homologador.name : t.homologador);
            const hEmail = normalize(typeof t.homologador === 'object' ? t.homologador.email : null);
            isHomologador = myIdentifiers.has(hName) || myIdentifiers.has(hEmail);
        }

        return isResponsible || isHomologador;
    });

    const counts = Object.fromEntries(['todo', 'stopped', 'inprogress', 'homologation', 'publication'].map(status => [status, myActiveTasks.filter(task => task.status === status).length]));
    counts.overdue = myActiveTasks.filter(isTaskOverdue).length;
    const myHomologationsPending = myActiveTasks.filter(task => isPendingHomeValidation(task, myIdentifiers)).length;
    return {myActiveTasks, myIdentifiers, dbUser, counts, myHomologationsPending};
}

export function isPendingHomeValidation(task, identifiers) {
    if (task.status !== 'homologation' || !task.homologador) return false;
    const normalize = value => (value || '').toString().trim().toLowerCase();
    const name = normalize(typeof task.homologador === 'object' ? task.homologador.name : task.homologador);
    const email = normalize(typeof task.homologador === 'object' ? task.homologador.email : null);
    return identifiers.has(name) || identifiers.has(email);
}

export function selectHomeTasks(tasks, filter, isTaskOverdue) {
    const selected = tasks.filter(task => filter === 'overdue' ? isTaskOverdue(task) : task.status === filter);
    // Same deadline ordering as the previous Home; missing dates stay at the end.
    return selected.sort((a, b) => {
        const dA = a.dueDate ? new Date(a.dueDate) : new Date(8640000000000000);
        const dB = b.dueDate ? new Date(b.dueDate) : new Date(8640000000000000);
        return dA - dB;
    });
}

export const escapeHomeText = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
