// TC-455: presentation functions for the isolated approved-v2 preview only.
// Inputs are already selected/sorted by the existing renderers. Never write app state.
export const escapeFidelityText = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const esc = escapeFidelityText;
const labels = {todo:'Fila', stopped:'Parado', inprogress:'Andamento', homologation:'Homologação', publication:'Publicação'};
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const taskCount = count => `${count} ${count === 1 ? 'tarefa' : 'tarefas'}`;

export function setFidelitySecondaryHeading(title, subtitle) {
    const titleElement = document.getElementById('fidelity-page-title');
    const subtitleElement = document.getElementById('fidelity-page-subtitle');
    if (titleElement) titleElement.textContent = title;
    if (subtitleElement) subtitleElement.textContent = subtitle;
}

export function renderFidelityHomeShell({myActiveTasks, counts, myHomologationsPending, views}) {
    const summaries = [
        ['Tarefas ativas', myActiveTasks.length, 'No seu recorte pessoal', 'layout-dashboard'],
        ['Parado', counts.stopped, 'Estado registrado na tarefa', 'pause-circle'],
        ['Em homologação', counts.homologation, 'Aguardam validação', 'shield-check'],
        ['Em publicação', counts.publication, 'Ainda não concluídas', 'upload']
    ];
    const attention = [
        {count:counts.stopped, filter:'stopped', icon:'pause-circle', title:'Tarefas paradas', copy:'Consulte o motivo registrado antes de retomar.', action:'Ver tarefas paradas'},
        {count:myHomologationsPending, filter:'homologation', icon:'shield-check', title:'Aguardando sua homologação', copy:'Sua validação está pendente nestas tarefas.', action:'Ver homologação'},
        {count:counts.overdue, filter:'overdue', icon:'calendar-clock', title:'Prazos atrasados', copy:'Revise os prazos e o contexto das tarefas.', action:'Ver tarefas atrasadas'}
    ].filter(item => item.count > 0);
    const unknownCount = myActiveTasks.length - Object.keys(labels).reduce((sum, key) => sum + counts[key], 0);
    const distribution = Object.entries(labels).map(([key,label]) => ({key,label,count:counts[key]}));
    if (unknownCount > 0) distribution.push({key:'unknown',label:'Estado não identificado',count:unknownCount});
    const projectCounts = new Map();
    myActiveTasks.forEach(task => {
        const project = task.project || 'Sem projeto';
        projectCounts.set(project, (projectCounts.get(project) || 0) + 1);
    });
    return `<section class="sb-home fidelity-home" aria-labelledby="fidelity-page-title">
        <div class="fidelity-summary-strip" aria-label="Resumo pessoal" aria-describedby="home-scope-note">${summaries.map(([label,count,foot,ico]) => `<div class="fidelity-summary-item"><span class="fidelity-summary-label">${icon(ico)}${label}</span><strong>${count}</strong><span class="fidelity-summary-foot">${foot}</span></div>`).join('')}</div>
        <p id="home-scope-note" class="sb-home-scope">Resumo das tarefas carregadas em que você é responsável ou homologador pendente. Os números não representam um total global.</p>
        <div class="fidelity-home-grid"><div class="fidelity-home-main">
            <section class="sb-home-list-section" aria-labelledby="home-list-title">
                <div class="sb-home-list-heading"><h2 id="home-list-title"><i id="home-list-icon" data-lucide="play-circle" aria-hidden="true"></i><span>Tarefas em Andamento</span></h2><p id="home-list-count" class="sb-home-meta" aria-live="polite"></p></div>
                <div id="home-metric-cards" class="fidelity-home-tabs" aria-label="Selecionar etapa do resumo pessoal" aria-describedby="home-scope-note">${views.map(view => `<button type="button" class="metric-card fidelity-home-tab" data-filter="${view.key}" aria-pressed="false" aria-controls="home-dynamic-list">${view.label}<span>${counts[view.key]}</span></button>`).join('')}</div>
                <p id="home-selection-note" class="sb-home-meta"></p><div id="home-dynamic-list" class="sb-home-list"></div>
            </section>
            <section class="fidelity-home-panel fidelity-distribution" aria-labelledby="fidelity-distribution-title"><div class="fidelity-section-heading"><h2 id="fidelity-distribution-title">Distribuição do trabalho</h2><span>${taskCount(myActiveTasks.length)} no recorte</span></div><div class="fidelity-flow-bar" aria-hidden="true">${distribution.filter(item => item.count > 0).map(item => `<span data-status="${item.key}" style="flex-grow:${item.count}"></span>`).join('')}</div><ul class="fidelity-flow-key">${distribution.map(item => `<li><span class="fidelity-flow-dot" data-status="${item.key}" aria-hidden="true"></span>${item.label} <strong>${item.count}</strong></li>`).join('')}</ul></section>
        </div><aside class="fidelity-home-aside" aria-labelledby="fidelity-attention-title"><section><div class="fidelity-section-heading"><h2 id="fidelity-attention-title">Precisa de atenção</h2></div><div class="fidelity-home-panel">${attention.length ? attention.map(item => `<div class="fidelity-attention-item"><span class="fidelity-attention-icon" data-status="${item.filter}">${icon(item.icon)}</span><div><strong>${item.count} · ${item.title}</strong><p>${item.copy}</p><button type="button" ${item.filter === 'homologation' ? 'id="home-homologation-alert" ' : ''}class="fidelity-text-button" data-filter="${item.filter}">${item.action}</button></div></div>`).join('') : '<p class="fidelity-attention-empty">Nenhuma tarefa parada, atrasada ou aguardando sua homologação neste recorte.</p>'}</div></section>
            <section class="fidelity-home-panel fidelity-personal-projects" aria-labelledby="fidelity-personal-projects-title"><div class="fidelity-section-heading"><h2 id="fidelity-personal-projects-title">Seus projetos</h2></div>${projectCounts.size ? `<ul>${[...projectCounts].map(([project,count]) => `<li><span>${esc(project)}</span><strong>${count}</strong></li>`).join('')}</ul>` : '<p>Nenhum projeto nas tarefas pessoais carregadas.</p>'}<p class="fidelity-project-scope">Participação nas tarefas deste recorte.</p></section>
        </aside></div>
    </section>`;
}

export function renderFidelityHomeRow(task, {status, pending, overdue, formatDate}) {
    return `<button type="button" class="list-row sb-home-row${pending ? ' sb-home-row--validation' : ''}" data-task-id="${esc(task.id)}" aria-label="Abrir tarefa ${esc(task.id)}: ${esc(task.title)}. Estado: ${esc(status?.label || 'não identificado')}.${pending ? ' Sua homologação pendente.' : ''}">
        <span class="sb-home-row-main"><span class="sb-home-row-meta"><span class="sb-home-task-id">${esc(task.id)}</span><span aria-hidden="true">·</span><span class="sb-home-project"><span class="sb-home-project-dot" data-project-color="${esc(task.projectColor || '#94A3B8')}" aria-hidden="true"></span>${esc(task.project || 'Geral')}</span></span><span class="sb-home-task-title">${esc(task.title)}</span><span class="fidelity-home-row-note">Prioridade: ${esc(task.priority || 'não informada')}${pending ? ' · Sua homologação pendente' : ''}</span></span>
        <span class="sb-badge fidelity-home-row-status" data-status="${esc(task.status)}">${esc(status?.label || 'Estado não identificado')}</span>
        <span class="sb-home-deadline${overdue ? ' sb-home-deadline--overdue' : ''}">${task.dueDate ? `${esc(formatDate(task.dueDate))}${overdue ? ' · Atrasada' : ''}` : 'Sem prazo'}</span>
    </button>`;
}

export function renderFidelityListRow(task, {respNames, statusLabel, projectColor, progress, homologadorName, formatDate}) {
    const reviewer = homologadorName && ['homologation','publication'].includes(task.status) ? `<small class="fidelity-table-reviewer">Homologador: ${esc(homologadorName)}</small>` : '';
    return `<tr class="task-list-row list-row fidelity-table-row" data-task-id="${esc(task.id)}">
        <td class="fidelity-table-task"><button type="button" class="info-btn fidelity-task-link" data-task-id="${esc(task.id)}" aria-label="Abrir detalhes de ${esc(task.id)}: ${esc(task.title)}"><span class="fidelity-table-task-meta"><span class="sb-list-task-id">${esc(task.id)}</span><span aria-hidden="true">·</span><span class="sb-list-project"><span class="sb-list-project-dot" data-project-color="${esc(projectColor)}" aria-hidden="true"></span>${esc(task.project || 'Geral')}</span></span><strong>${esc(task.title)}</strong></button><span class="fidelity-table-task-extra">Criação: ${esc(formatDate(task.createdAt) || 'Não informada')}${task.attachments?.length ? ` · ${task.attachments.length} ${task.attachments.length === 1 ? 'anexo' : 'anexos'}` : ''}</span></td>
        <td><span class="sb-badge" data-status="${esc(task.status)}">${esc(statusLabel)}</span>${reviewer}</td><td class="fidelity-table-owners">${esc(respNames || 'Sem responsável')}</td>
        <td><span class="fidelity-table-priority" data-priority="${esc(task.priority)}">${icon('flag')}${esc(task.priority || 'Não informada')}</span></td><td class="fidelity-table-date">${task.dueDate ? esc(formatDate(task.dueDate)) : 'Sem prazo'}</td>
        <td class="fidelity-table-progress">${progress === null ? 'Não informado' : `<span>${esc(task.progress)}%${progress < 0 || progress > 100 ? ' (fora da faixa)' : ''}</span><progress max="100" value="${Math.max(0, Math.min(100, progress))}" aria-label="Progresso de ${esc(task.id)}">${esc(task.progress)}%</progress>`}</td>
        <td class="fidelity-table-actions"><button type="button" class="delete-list-btn sb-shell-icon-button" data-task-id="${esc(task.id)}" title="Excluir ${esc(task.id)}" aria-label="Excluir ${esc(task.id)}">${icon('trash-2')}</button></td>
    </tr>`;
}

export function renderFidelityListShell(rows, count) {
    return `<section class="sb-list-results fidelity-list-results" aria-label="Tarefas ativas"><div class="fidelity-table-scroll" tabindex="0" role="region" aria-label="${taskCount(count)}. Role horizontalmente para ver todas as colunas"><table class="fidelity-task-table"><caption class="fidelity-sr-only">Tarefas ativas, na ordem selecionada</caption><thead><tr><th scope="col">Tarefa</th><th scope="col">Estado</th><th scope="col">Responsáveis</th><th scope="col">Prioridade</th><th scope="col">Prazo</th><th scope="col">Progresso</th><th scope="col"><span class="fidelity-sr-only">Ações</span></th></tr></thead><tbody>${rows}</tbody></table></div><p class="fidelity-table-note">A mesma tarefa e os mesmos filtros, em uma leitura orientada a comparação.</p></section>`;
}

export function renderFidelityArchiveShell(content) {
    return `<section class="sb-archive fidelity-archive" aria-labelledby="fidelity-page-title">${content}</section>`;
}

export function renderFidelityArchiveRows(tasks, {archiveResponsibleNames, archiveUpdatedLabel}) {
    if (!Array.isArray(tasks)) throw new Error('Resposta do arquivo inválida.');
    if (!tasks.length) return renderFidelityArchiveShell('<div class="sb-empty sb-archive-state" role="status"><i data-lucide="archive" aria-hidden="true"></i><h3>Nenhuma tarefa arquivada</h3><p>Esta consulta não retornou tarefas concluídas.</p></div>');
    const contractNotice = tasks.some(task => task.status !== 'done') ? '<p class="sb-notice sb-notice--error sb-archive-contract-note" role="alert">A consulta retornou itens sem estado concluído. Eles estão sinalizados como estado divergente; o conteúdo do arquivo precisa ser verificado.</p>' : '';
    const rows = tasks.map(task => {
        const id = esc(task.id), title = esc(task.title || 'Título não informado');
        const completed = task.status === 'done';
        const status = completed ? 'Arquivado · Concluída' : `${labels[task.status] || task.status || 'Estado não informado'} · Estado divergente`;
        return `<tr class="task-list-row fidelity-table-row sb-archive-row" data-task-id="${id}"><td class="fidelity-table-task"><span class="fidelity-table-task-meta"><span class="sb-archive-task-id">${id}</span><span aria-hidden="true">·</span><span class="sb-archive-project"><span class="sb-archive-project-dot" data-project-color="${esc(task.projectColor)}" aria-hidden="true"></span>${esc(task.project || 'Sem projeto')}</span></span><strong>${title}</strong></td><td><span class="sb-badge sb-archive-status${completed ? '' : ' sb-archive-status--uncertain'}" data-status="${esc(task.status)}">${icon(completed ? 'archive' : 'triangle-alert')}${esc(status)}</span></td><td class="fidelity-table-owners">${esc(archiveResponsibleNames(task.responsible))}</td><td class="fidelity-table-date">${archiveUpdatedLabel(task.updatedAt)}</td><td class="fidelity-archive-actions"><button type="button" class="restore-btn sb-button sb-button--secondary" data-task-id="${id}" title="Restaurar para Fila" aria-label="Restaurar para Fila: ${id} — ${title}">${icon('undo-2')}<span>Restaurar</span></button><button type="button" class="delete-btn sb-shell-icon-button sb-archive-delete" data-task-id="${id}" title="Excluir Permanentemente" aria-label="Excluir Permanentemente: ${id} — ${title}">${icon('trash-2')}</button></td></tr>`;
    }).join('');
    return renderFidelityArchiveShell(`${contractNotice}<div class="sb-archive-summary"><p>${taskCount(tasks.length)} nesta consulta</p><p>A data exibida é a última atualização registrada, não a data de conclusão.</p></div><div class="fidelity-table-scroll" tabindex="0" role="region" aria-label="Resultados da consulta de arquivo; role horizontalmente para ver todas as colunas"><table class="fidelity-task-table fidelity-archive-table"><caption class="fidelity-sr-only">Tarefas retornadas pela consulta do arquivo</caption><thead><tr><th scope="col">Tarefa</th><th scope="col">Estado</th><th scope="col">Responsáveis</th><th scope="col">Última atualização</th><th scope="col">Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

export function renderFidelityPeopleDirectory(userCards, count) {
    return `<div class="sb-people-page fidelity-people-page"><div class="fidelity-people-toolbar"><div class="sb-people-search"><label for="userSearchInput" class="fidelity-sr-only">Procurar utilizador</label>${icon('search')}<input type="search" id="userSearchInput" class="sb-input" placeholder="Nome, email ou cargo…"></div><button type="button" id="openNewUserModalBtn" class="sb-button">${icon('plus')}<span>Novo Membro</span></button></div><section class="fidelity-people-panel" aria-labelledby="fidelity-people-title"><div class="fidelity-section-heading"><h2 id="fidelity-people-title">Equipe</h2><span>${count} ${count === 1 ? 'pessoa carregada' : 'pessoas carregadas'}</span></div><div id="user-list-container" class="sb-people-list">${userCards}${count === 0 ? '<div class="sb-empty"><h2>Nenhum membro disponível</h2><p>A lista de utilizadores está vazia.</p></div>' : ''}<div id="no-users-found" class="hidden sb-empty" role="status"><i data-lucide="users-2" aria-hidden="true"></i><p>Nenhum membro encontrado.</p></div></div><p class="fidelity-table-note">Tarefas ativas conforme os dados carregados. Cargo e permissão de administrador são informações distintas.</p></section></div>`;
}
