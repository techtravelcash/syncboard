// TC-451: archive presentation only. No data, action or permission changes.
export const escapeArchiveText = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export function archiveResponsibleNames(responsible) {
    if (!Array.isArray(responsible)) return 'Sem responsável';
    const names = responsible.map(person => {
        if (!person) return '';
        const source = typeof person === 'object' ? person : { name: person };
        return source.displayName || source.name || source.email || '';
    }).filter(Boolean);
    return names.join(', ') || 'Sem responsável';
}

export function archiveUpdatedLabel(updatedAt) {
    if (typeof updatedAt !== 'string' || !updatedAt.trim()) return 'Não informada';
    const date = new Date(updatedAt);
    if (!Number.isFinite(date.getTime())) return 'Não informada';
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

export function applyArchiveProjectColors(container) {
    container.querySelectorAll('.sb-archive-project-dot').forEach(dot => {
        // Assign one CSS color property, never concatenate user data into a style declaration.
        dot.style.backgroundColor = dot.dataset.projectColor;
    });
}

export function renderArchiveShell(content) {
    return `<section class="sb-archive" aria-labelledby="sb-archive-title">
        <header class="sb-archive-header">
            <p class="sb-archive-eyebrow">Tarefas concluídas</p>
            <h2 id="sb-archive-title">Arquivados</h2>
            <p>Tarefas concluídas ficam separadas do fluxo ativo. Restaurar envia a tarefa para Fila.</p>
        </header>
        ${content}
    </section>`;
}

export function renderArchiveRows(tasks) {
    if (!Array.isArray(tasks)) throw new Error('Resposta do arquivo inválida.');
    if (!tasks.length) return renderArchiveShell(`<div class="sb-empty sb-archive-state" role="status">
        <i data-lucide="archive" aria-hidden="true"></i><h3>Nenhuma tarefa arquivada</h3>
        <p>Esta consulta não retornou tarefas concluídas.</p>
    </div>`);
    const escape = escapeArchiveText;
    const rows = tasks.map(task => {
        const id = escape(task.id);
        const title = escape(task.title || 'Título não informado');
        const project = escape(task.project || 'Sem projeto');
        const people = escape(archiveResponsibleNames(task.responsible));
        const statusLabels = { todo: 'Fila', stopped: 'Parado', inprogress: 'Andamento', homologation: 'Homologação', publication: 'Publicação' };
        const completed = task.status === 'done';
        const statusLabel = completed ? 'Arquivado · Concluída' : `${statusLabels[task.status] || task.status || 'Estado não informado'} · Estado divergente`;
        return `<li class="task-list-row list-row sb-archive-row" data-task-id="${id}">
            <div class="sb-archive-main">
                <div class="sb-archive-row-meta">
                    <span class="sb-archive-task-id">${id}</span>
                    <span class="sb-badge sb-archive-status${completed ? '' : ' sb-archive-status--uncertain'}" data-status="${escape(task.status)}"><i data-lucide="${completed ? 'archive' : 'triangle-alert'}" aria-hidden="true"></i>${escape(statusLabel)}</span>
                </div>
                <h3>${title}</h3>
                <p class="sb-archive-project"><span class="sb-archive-project-dot" data-project-color="${escape(task.projectColor)}" aria-hidden="true"></span>${project}</p>
                <p class="sb-archive-people"><span>Responsáveis:</span> ${people}</p>
            </div>
            <div class="sb-archive-updated"><span>Última atualização</span><strong>${archiveUpdatedLabel(task.updatedAt)}</strong></div>
            <div class="sb-archive-actions">
                <button type="button" class="restore-btn sb-button" data-task-id="${id}" title="Restaurar para Fila" aria-label="Restaurar para Fila: ${id} — ${title}"><i data-lucide="undo-2" aria-hidden="true"></i><span>Restaurar para Fila</span></button>
                <button type="button" class="delete-btn sb-button sb-archive-delete" data-task-id="${id}" title="Excluir Permanentemente" aria-label="Excluir Permanentemente: ${id} — ${title}"><i data-lucide="trash-2" aria-hidden="true"></i><span>Excluir Permanentemente</span></button>
            </div>
        </li>`;
    }).join('');
    const contractNotice = tasks.some(task => task.status !== 'done') ? '<p class="sb-notice sb-notice--error sb-archive-contract-note" role="alert">A consulta retornou itens sem estado concluído. Eles estão sinalizados como estado divergente; o conteúdo do arquivo precisa ser verificado.</p>' : '';
    return renderArchiveShell(`${contractNotice}<div class="sb-archive-summary"><p>${tasks.length} ${tasks.length === 1 ? 'tarefa nesta consulta' : 'tarefas nesta consulta'}</p><p>A data exibida é a última atualização registrada, não a data de conclusão.</p></div><ul class="sb-archive-list" aria-label="Resultados da consulta de arquivo">${rows}</ul>`);
}
