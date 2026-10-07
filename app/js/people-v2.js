// TC-452 presentation helpers only. No state, API or identity resolution.
export function escapePeopleText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function peopleAvatar(name, picture) {
    const initial = String(name || '').trim().charAt(0).toUpperCase() || '?';
    return `<span class="sb-person-avatar" aria-hidden="true">${picture
        ? `<img src="${escapePeopleText(picture)}" alt="" class="sb-person-photo">`
        : `<span class="sb-person-initial">${escapePeopleText(initial)}</span>`}</span>`;
}

export function personCard(user, activeTasksCount) {
    const name = user.displayName || user.name || user.email || 'Nome não informado';
    return `<div class="user-card-item sb-person-card">
        <div class="sb-person-identity">
            ${peopleAvatar(name, user.picture)}
            <div class="sb-person-details">
                <p class="sb-person-name">${escapePeopleText(name)}</p>
                <p class="sb-person-email">${escapePeopleText(user.email || 'Email não informado')}</p>
                <div class="sb-person-roles">
                    ${user.role ? `<span class="sb-person-role">Cargo: ${escapePeopleText(user.role)}</span>` : ''}
                    ${user.isAdmin ? '<span class="sb-person-admin"><i data-lucide="shield-check" aria-hidden="true"></i> Administrador do sistema</span>' : ''}
                </div>
            </div>
        </div>
        <div class="sb-person-actions">
            <div class="sb-person-count"><span>Tarefas ativas</span><strong>${activeTasksCount}</strong></div>
            <button type="button" class="edit-user-btn sb-button sb-button--secondary" data-user-email="${escapePeopleText(String(user.email))}" aria-label="Editar perfil de ${escapePeopleText(name)}"><i data-lucide="user-cog" aria-hidden="true"></i><span>Editar</span></button>
            <button type="button" class="delete-user-btn sb-button sb-button--danger" data-user-id="${escapePeopleText(String(user.id || user.email))}" aria-label="Remover acesso de ${escapePeopleText(name)}"><i data-lucide="user-x" aria-hidden="true"></i><span>Remover acesso</span></button>
        </div>
    </div>`;
}

export function notificationCard(notification, formattedDate) {
    const n = notification;
    // opacity-60 remains the legacy read-state hook used by the click handler.
    return `<div class="sb-notification-card ${n.isRead ? 'is-read opacity-60' : 'is-unread'}" role="button" tabindex="0" data-notif-id="${escapePeopleText(String(n.id))}" data-task-id="${escapePeopleText(String(n.taskId))}">
        <span class="sb-notification-icon" aria-hidden="true"><i data-lucide="${n.isRead ? 'check' : 'bell'}"></i></span>
        <div class="sb-notification-copy">
            <div class="sb-notification-meta"><span class="sb-notification-state">${n.isRead ? 'Lida' : 'Não lida'}</span><span>${escapePeopleText(formattedDate)}</span></div>
            <h3>${escapePeopleText(n.message)}</h3>
            ${n.commentPreview ? `<p class="sb-notification-preview">${escapePeopleText(n.commentPreview)}</p>` : ''}
            <span class="sb-notification-target">Abrir tarefa ${escapePeopleText(n.taskId)}</span>
        </div>
        <i data-lucide="arrow-up-right" class="sb-notification-arrow" aria-hidden="true"></i>
    </div>`;
}
