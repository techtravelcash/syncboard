import { isFidelityV2, applyFidelityFilters, fidelityFilterCount, resetFidelityFilters, syncFidelityShell, finishFidelityView, renderFidelityCardMarkup } from './fidelity-v2.js';
import { state } from './state.js';
import { setFidelitySecondaryHeading, renderFidelityHomeShell, renderFidelityHomeRow, renderFidelityListRow, renderFidelityListShell, renderFidelityArchiveShell, renderFidelityArchiveRows, renderFidelityPeopleDirectory } from './fidelity-secondary-v2.js';
import { renderArchiveRows, renderArchiveShell, applyArchiveProjectColors, archiveResponsibleNames, archiveUpdatedLabel } from './archive-v2.js';
import { personCard, notificationCard } from './people-v2.js';
import { buildHomeModel, selectHomeTasks, isPendingHomeValidation, escapeHomeText, restoreHomeTaskFocus } from './home-v2.js';
import { markNotificationRead, fetchNotifications, fetchArchivedTasks } from './api.js';


// --- HELPERS E FORMATAÇÃO ---

function hexToRgba(hex, alpha) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
    }
    return hex; 
}

function lightenColor(hex, percent) {
    const num = parseInt(hex.replace("#",""), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
}

export const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

export const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const isTaskOverdue = (task) => {
    if (!task.dueDate || !['stopped', 'inprogress', 'homologation'].includes(task.status)) {
        return false;
    }
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dueDate = new Date(task.dueDate);
    return dueDate < todayUTC;
};

// --- EFEITO VISUAL DE ROLAGEM (LISTA) ---
function updateListScrollEffect() {
    const container = document.getElementById('listView');
    if (!container) return;

    // Selecionamos apenas os elementos internos que sofrem o efeito GoPro
    const rows = container.querySelectorAll('.list-row');
    const containerRect = container.getBoundingClientRect();
    
    if (containerRect.height < 50) return;

    const containerCenterY = containerRect.top + (containerRect.height / 2);
    const maxDist = (containerRect.height / 2); 

    rows.forEach(row => {
        const rowRect = row.getBoundingClientRect();
        const rowCenterY = rowRect.top + (rowRect.height / 2);
        const dist = Math.abs(containerCenterY - rowCenterY);
        
        let percent = dist / maxDist;
        if (percent > 1) percent = 1;

        const curve = Math.pow(percent, 6); 

        const scale = 1 - (curve * 0.05);   
        const opacity = 1 - (curve * 0.4);  

        row.style.transition = 'transform 0s, opacity 0.15s ease-out'; 
        row.style.transform = `scale(${scale})`;
        row.style.opacity = opacity;
    });
}

// --- TOASTS ---

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const styles = {
        success: 'bg-custom-darkest text-white border-l-4 border-green-500',
        error:   'bg-red-600 text-white border-l-4 border-white',
        info:    'bg-white text-custom-darkest border-l-4 border-custom-dark shadow-xl'
    };

    toast.className = `sb-collab-toast min-w-[300px] p-4 rounded-r-xl shadow-2xl flex items-center gap-3 toast-enter ${styles[type]}`;
    
    toast.dataset.kind = type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    let icon = '';
    if(type === 'success') icon = 'check-circle-2';
    if(type === 'error') icon = 'alert-circle';
    if(type === 'info') icon = 'info';

    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i>
        <span class="text-sm font-semibold">${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(100%)';
        toast.style.transition = 'all 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- ANEXOS ---

// Adicionamos o parâmetro 'isEditable' que por padrão é falso
function renderAttachmentList(containerId, attachments, isEditable = false) {
    const container = document.getElementById(containerId);
    if (!container) return; // Segurança extra
    container.innerHTML = '';
    
    if (attachments && attachments.length > 0) {
        attachments.forEach((file, index) => {
            const isLocalFile = file instanceof File;
            const fileName = isLocalFile ? file.name : (file.name || 'documento');
            const displayFileName = escapeHomeText(fileName);
            const blobName = !isLocalFile && file.url ? decodeURIComponent(file.url.split('/').pop()) : '';

            const item = document.createElement('div');
            item.className = 'sb-collab-attachment flex items-center justify-between p-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-lg group hover:border-custom-medium/50 transition-colors';
            
            const downloadLink = !isLocalFile ? `
                <a href="${file.url}" target="_blank" class="sb-collab-attachment-link text-blue-500 hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Abrir anexo" aria-label="Abrir anexo">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                </a>
            ` : '';

            // Renderiza o botão de lixeira APENAS se isEditable for verdadeiro
            const removeBtnHtml = isEditable ? `
                <button type="button" class="remove-attachment-btn text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" data-index="${index}" data-blob-name="${blobName}" title="Remover anexo do formulário" aria-label="Remover anexo do formulário">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            ` : '';

            item.innerHTML = `
                <div class="sb-collab-file-info flex items-center gap-3 overflow-hidden">
                    <div class="sb-collab-file-icon bg-gray-100 dark:bg-gray-700 p-1.5 rounded-md text-gray-500 dark:text-gray-300">
                        <i data-lucide="file-text" class="w-4 h-4"></i>
                    </div>
                    <div class="sb-collab-file-copy">
                        <span class="sb-collab-file-name text-xs font-medium text-custom-darkest dark:text-gray-200">${displayFileName}</span>
                        <span class="sb-collab-file-state">${isLocalFile ? 'Selecionado neste formulário' : (containerId === 'modal-info-attachments' ? 'Vinculado à tarefa' : 'Arquivo com link')}</span>
                    </div>
                </div>
                <div class="sb-collab-file-actions flex items-center gap-1">
                    ${downloadLink}
                    ${removeBtnHtml}
                </div>
            `;
            container.appendChild(item);
        });
        if(window.lucide) lucide.createIcons();
    }
}

export function renderModalAttachments(files) {
    // Quando estamos no formulário de Adicionar/Editar, passamos 'true' para mostrar a lixeira
    renderAttachmentList('attachment-list', files, true);
}

// --- RENDERIZAÇÃO: CARD DE TAREFA ---

export const createTaskElement = (task) => {
    // Presentation only: the original listeners below still own every action.
    const escapeCardText = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const taskCard = document.createElement('div');
    const isOverdue = isTaskOverdue(task);
    const isPop = task.priority === 'Urgente' || task.status === 'done';
    let cardClasses = 'task-card group sb-kanban-card';
    if (isOverdue) cardClasses += ' border-l-[4px] border-l-red-500 sb-kanban-card--overdue';
    if (isPop) cardClasses += ' card-pop';
    taskCard.className = cardClasses;
    taskCard.dataset.taskId = task.id;
    taskCard.dataset.status = task.status;
    taskCard.setAttribute('role', 'article');
    taskCard.setAttribute('aria-label', `${task.id}: ${task.title}`);

    // Project colors are retained as project metadata, separate from lane/status color.
    const pColor = task.projectColor || '#94A3B8';
    const projectStrip = `<div class="project-strip sb-kanban-project"><span class="sb-kanban-project-swatch" aria-hidden="true"></span><span>${escapeCardText(task.project || 'Geral')}</span></div>`;
    const responsible = Array.isArray(task.responsible) ? task.responsible : [];
    const responsibleNames = responsible.map(r => (r && typeof r === 'object' ? (r.name || r.email) : r) || 'Nome não informado');
    const avatars = responsible.slice(0, 3).map(r => {
        const name = String((r && typeof r === 'object' ? r.name : r) || '');
        const pic = r && typeof r === 'object' ? r.picture : null;
        const userState = state.users.find(u => u.name === name);
        const finalPic = userState?.picture || pic;
        return finalPic
            ? `<img src="${escapeCardText(finalPic)}" class="sb-kanban-avatar" alt="" title="${escapeCardText(name)}">`
            : `<span class="sb-kanban-avatar" aria-hidden="true" title="${escapeCardText(name)}">${escapeCardText(name.charAt(0))}</span>`;
    }).join('');
    const extra = responsible.length > 3 ? `<span class="sb-kanban-avatar sb-kanban-avatar--extra" aria-hidden="true">+${responsible.length - 3}</span>` : '';
    const responsibleDisplay = `<div class="sb-kanban-people"><div class="sb-kanban-avatars">${avatars}${extra}</div><div class="sb-kanban-people-copy">${responsible.length
        ? `<span><strong>Principal:</strong> ${escapeCardText(responsibleNames[0])}</span>${responsible.length > 1 ? `<span><strong>Corresponsáveis:</strong> ${escapeCardText(responsibleNames.slice(1).join(', '))}</span>` : ''}`
        : '<span>Responsável não definido</span>'}</div></div>`;

    const dateText = task.dueDate ? formatDate(task.dueDate) : '';
    const dateBadge = `<span class="sb-kanban-date ${isOverdue ? 'sb-kanban-date--overdue' : ''}"><i data-lucide="calendar" aria-hidden="true"></i>${dateText ? `${isOverdue ? 'Atrasada · ' : 'Prazo · '}${escapeCardText(dateText)}` : 'Sem prazo'}</span>`;
    const attachmentIcon = (task.attachments?.length > 0)
        ? `<span class="sb-kanban-count" title="Anexos"><i data-lucide="paperclip" aria-hidden="true"></i>${task.attachments.length}<span class="sb-kanban-sr-only"> anexos</span></span>` : '';
    const commentsList = Array.isArray(task.comments) ? task.comments : [];
    const commentCount = commentsList.length;
    const commentIcon = commentCount > 0
        ? `<span class="sb-kanban-count" title="Comentários"><i data-lucide="message-circle" aria-hidden="true"></i>${commentCount}<span class="sb-kanban-sr-only"> comentários</span></span>` : '';

    let homologadorBadge = '';
    if ((task.status === 'homologation' || task.status === 'publication') && task.homologador) {
        const homolName = String((typeof task.homologador === 'object' ? (task.homologador.name || task.homologador.email) : task.homologador) || 'Nome não informado');
        const homolPic = typeof task.homologador === 'object' ? task.homologador.picture : null;
        const isApproved = task.status === 'publication';
        const avatarImg = homolPic
            ? `<img src="${escapeCardText(homolPic)}" class="sb-kanban-avatar" alt="">`
            : `<span class="sb-kanban-avatar" aria-hidden="true">${escapeCardText(homolName.charAt(0))}</span>`;
        homologadorBadge = `<div class="sb-kanban-homologator"><i data-lucide="${isApproved ? 'check-circle' : 'shield-check'}" aria-hidden="true"></i>${avatarImg}<span><strong>${isApproved ? 'Homologado por' : 'Homologador'}</strong> ${escapeCardText(homolName)}</span></div>`;
    }

    let actionButtons = '';
    if (task.status === 'homologation') {
        actionButtons = `<button type="button" class="approve-btn sb-kanban-action sb-kanban-action--primary" title="Aprovar para Publicação" aria-label="Aprovar ${escapeCardText(task.id)} para Publicação" data-task-id="${escapeCardText(task.id)}"><i data-lucide="arrow-right" aria-hidden="true"></i><span>Aprovar</span></button>`;
    } else if (task.status === 'publication') {
        actionButtons = `<button type="button" class="publish-btn sb-kanban-action sb-kanban-action--primary" title="Publicar Tarefa" aria-label="Publicar ${escapeCardText(task.id)} e enviar para Arquivados" data-task-id="${escapeCardText(task.id)}"><i data-lucide="check-circle" aria-hidden="true"></i><span>Publicar</span></button>`;
    }
    const quickActions = `<div class="sb-kanban-actions">
        <button type="button" class="expand-btn sb-kanban-action" title="Expandir Detalhes" aria-label="Abrir detalhes de ${escapeCardText(task.id)}" data-task-id="${escapeCardText(task.id)}"><i data-lucide="maximize-2" aria-hidden="true"></i><span>Detalhes</span></button>
        ${actionButtons}
        <button type="button" class="delete-task-btn sb-kanban-action sb-kanban-action--danger" title="Excluir" aria-label="Excluir ${escapeCardText(task.id)}" data-task-id="${escapeCardText(task.id)}"><i data-lucide="trash-2" aria-hidden="true"></i></button>
    </div>`;

    // Keep stored progress/payload semantics. Missing information is explicit in presentation.
    const progress = task.progress || 0;
    const hasProgress = task.progress !== null && task.progress !== undefined && task.progress !== '';
    const progressLabel = hasProgress ? `${progress}%` : 'Não informado';
    const missingText = task.missingToComplete || "Nada especificado.";
    const progressBarHtml = `<button type="button" class="progress-update-btn sb-kanban-progress" data-task-id="${escapeCardText(task.id)}" title="Clique para atualizar o progresso" aria-label="Atualizar progresso de ${escapeCardText(task.id)}. ${escapeCardText(progressLabel)}">
        <span class="sb-kanban-progress-heading"><span>Progresso informado</span><strong>${escapeCardText(progressLabel)}</strong></span>
        <span class="sb-kanban-progress-track" aria-hidden="true"><span class="sb-kanban-progress-fill" style="width: ${escapeCardText(progress)}%"></span></span>
    </button>`;

    taskCard.innerHTML = (typeof isFidelityV2 === 'function' && isFidelityV2()) ? renderFidelityCardMarkup(task, { escape: escapeCardText, avatars: avatars + extra, responsibleNames, projectStrip, progressBarHtml, actionButtons, isOverdue }) : `
        <div class="sb-kanban-card-head"><span class="sb-kanban-id">${escapeCardText(task.id)}</span><span class="sb-kanban-priority">Prioridade: ${escapeCardText(task.priority || 'Não informada')}</span></div>
        <div class="task-body">
            <h3 class="sb-kanban-title">${escapeCardText(task.title)}</h3>
            ${projectStrip}
            ${responsibleDisplay}
            ${homologadorBadge}
            ${progressBarHtml}
            <p class="sb-kanban-pending"><strong>Pendência:</strong> ${escapeCardText(missingText)}</p>
            <div class="sb-kanban-metadata">${dateBadge}<span class="sb-kanban-counts">${attachmentIcon}${commentIcon}</span></div>
        </div>
        ${quickActions}
    `;
    // CSS assignment retains the source value without interpolating it into markup.
    taskCard.querySelector('.sb-kanban-project-swatch').style.backgroundColor = pColor;

    // --- EVENT LISTENERS ---
    const expandBtn = taskCard.querySelector('.expand-btn');
    if(expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            renderTaskHistory(task.id);
        });
    }

    const deleteBtn = taskCard.querySelector('.delete-task-btn');
    if(deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDestructiveConfirmModal(
                'Excluir Tarefa?', 
                `Deseja realmente excluir a tarefa "${task.title}" (${task.id})?`, 
                async () => {
                    const api = await import('./api.js');
                    await api.deleteTask(task.id);
                    showToast('Tarefa excluída.', 'success');
                }
            );
        });
    }

    // Evento de clique da Barra de Progresso
    const progressBtn = taskCard.querySelector('.progress-update-btn');
    if (progressBtn) {
        progressBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede de abrir o modal grande do cartão
            
            // É essencial ter importado a função openProgressUpdateModal no topo ou certificar-se que ela existe no escopo!
            if (typeof openProgressUpdateModal === 'function') {
                openProgressUpdateModal(task);
            }
        });
    }

    return taskCard;
};

// --- LOGICA DE FILTRO ---

function filterTasks(tasks) {
    if (!tasks || !Array.isArray(tasks)) return [];

    let filtered = tasks;

    if (state.selectedProject && state.selectedProject !== 'all') {
        const targetProj = String(state.selectedProject).trim().toLowerCase();
        filtered = filtered.filter(t => {
            const taskProj = t.project ? String(t.project).trim().toLowerCase() : '';
            return taskProj === targetProj;
        });
    }

    if (state.selectedResponsible && state.selectedResponsible !== 'all') {
        const targetResp = String(state.selectedResponsible).trim().toLowerCase();
        filtered = filtered.filter(t => 
            Array.isArray(t.responsible) && 
            t.responsible.some(r => {
                const name = typeof r === 'object' ? r.name : r;
                return String(name).trim().toLowerCase() === targetResp;
            })
        );
    }

    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter(t => 
            (t.title && t.title.toLowerCase().includes(q)) || 
            (t.id && t.id.toLowerCase().includes(q))
        );
    }
    return (typeof isFidelityV2 === 'function' && isFidelityV2()) ? applyFidelityFilters(filtered) : filtered;
}

// --- RENDERIZAÇÃO: HOME (DASHBOARD DO USUÁRIO) ---

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
}

export function renderHomeView() {
    const container = document.getElementById('homeView');
    const {myActiveTasks, myIdentifiers, dbUser, counts, myHomologationsPending} = buildHomeModel(state, isTaskOverdue);
    const displayFullName = dbUser?.name || state.currentUser?.userDetails || 'Visitante';
    const userName = displayFullName.split(' ')[0];
    const views = [
        {key: 'todo', label: 'Fila', icon: 'list-todo', title: 'Tarefas na Fila'},
        {key: 'stopped', label: 'Parado', icon: 'pause-circle', title: 'Tarefas paradas'},
        {key: 'inprogress', label: 'Andamento', icon: 'play-circle', title: 'Tarefas em Andamento'},
        {key: 'homologation', label: 'Homologação', icon: 'clipboard-check', title: 'Tarefas em Homologação'},
        {key: 'publication', label: 'Publicação', icon: 'arrow-up-right', title: 'Tarefas em Publicação'},
        {key: 'overdue', label: 'Atrasadas', icon: 'calendar-clock', title: 'Tarefas Atrasadas'}
    ];
    const fidelity = document.body?.classList.contains('sb-fidelity-v2') === true;
    if (fidelity) setFidelitySecondaryHeading(`${getGreeting()}, ${userName}!`, 'O trabalho em curso e o que precisa da sua atenção.');
    const previousFilter = container.dataset.homeFilter;
    const focusedFilter = container.contains(document.activeElement) ? document.activeElement.closest('.metric-card')?.dataset.filter : undefined;
    container.innerHTML = fidelity ? renderFidelityHomeShell({myActiveTasks, counts, myHomologationsPending, views}) : `
        <section class="sb-home" aria-labelledby="home-greeting">
            <header class="sb-home-header">
                <div><p class="sb-home-eyebrow">Seu fluxo de trabalho</p><h2 id="home-greeting">${getGreeting()}, ${escapeHomeText(userName)}!</h2><p>O que precisa da sua atenção, em cada etapa.</p></div>
                ${myHomologationsPending > 0 ? `<button type="button" id="home-homologation-alert" class="sb-home-attention" data-filter="homologation"><i data-lucide="clipboard-check" aria-hidden="true"></i><span><strong>${myHomologationsPending} aguardando sua homologação</strong><span>Ver tarefas para validar</span></span><i data-lucide="arrow-right" aria-hidden="true"></i></button>` : ''}
            </header>
            <p id="home-scope-note" class="sb-home-scope">Resumo das tarefas carregadas em que você é responsável ou homologador pendente. Os números não representam um total global.</p>
            <div id="home-metric-cards" class="sb-home-metrics" aria-label="Selecionar etapa do resumo pessoal" aria-describedby="home-scope-note">
                ${views.map(view => `<button type="button" class="metric-card sb-home-metric" data-filter="${view.key}" aria-pressed="false" aria-controls="home-dynamic-list"><span class="sb-home-metric-label"><i data-lucide="${view.icon}" aria-hidden="true"></i>${view.label}</span><span class="sb-home-metric-value">${counts[view.key]}</span><span class="sb-home-metric-selected" aria-hidden="true">✓ Selecionado</span></button>`).join('')}
            </div>
            <section class="sb-home-list-section" aria-labelledby="home-list-title">
                <div class="sb-home-list-heading"><h2 id="home-list-title"><i id="home-list-icon" data-lucide="play-circle" aria-hidden="true"></i><span>Tarefas em Andamento</span></h2><p id="home-list-count" class="sb-home-meta" aria-live="polite"></p></div>
                <p id="home-selection-note" class="sb-home-meta"></p>
                <div id="home-dynamic-list" class="sb-home-list"></div>
            </section>
        </section>`;

    const updateList = filter => {
        const selectedView = views.find(view => view.key === filter) || views[2];
        filter = selectedView.key;
        container.dataset.homeFilter = filter;
        container.querySelectorAll('.metric-card').forEach(card => card.setAttribute('aria-pressed', String(card.dataset.filter === filter)));
        const filteredTasks = selectHomeTasks(myActiveTasks, filter, isTaskOverdue);
        const titleEl = document.getElementById('home-list-title');
        titleEl.innerHTML = `<i id="home-list-icon" data-lucide="${selectedView.icon}" aria-hidden="true"></i><span>${selectedView.title}</span>`;
        document.getElementById('home-list-count').textContent = `${filteredTasks.length} ${filteredTasks.length === 1 ? 'tarefa neste recorte' : 'tarefas neste recorte'}`;
        document.getElementById('home-selection-note').textContent = filter === 'publication' ? 'Publicação é uma etapa ativa. Essas tarefas ainda não estão no arquivo.' : filter === 'stopped' ? 'Parado é o estado registrado. O motivo deve ser consultado na tarefa.' : 'Ordenadas pelo prazo mais próximo; tarefas sem prazo ficam ao final.';
        const listContainer = document.getElementById('home-dynamic-list');
        if (!filteredTasks.length) {
            listContainer.innerHTML = `<div class="sb-empty"><i data-lucide="inbox" aria-hidden="true"></i><h3>${myActiveTasks.length ? 'Nenhuma tarefa nesta seleção' : 'Nenhuma tarefa pessoal carregada'}</h3><p class="sb-home-meta">${myActiveTasks.length ? 'Escolha outra etapa para consultar as suas tarefas.' : 'Este recorte reúne as tarefas carregadas em que você participa. Não há itens para exibir agora.'}</p></div>`;
        } else {
            listContainer.innerHTML = filteredTasks.map(task => {
                const status = views.find(view => view.key === task.status);
                const pending = isPendingHomeValidation(task, myIdentifiers);
                const overdue = isTaskOverdue(task);
                if (fidelity) return renderFidelityHomeRow(task, {status, pending, overdue, formatDate});
                return `<button type="button" class="list-row sb-home-row${pending ? ' sb-home-row--validation' : ''}" data-task-id="${escapeHomeText(task.id)}" aria-label="Abrir tarefa ${escapeHomeText(task.id)}: ${escapeHomeText(task.title)}. Estado: ${escapeHomeText(status?.label || 'não identificado')}.${pending ? ' Sua homologação pendente.' : ''}">
                    <span class="sb-home-row-main"><span class="sb-home-row-meta"><span class="sb-home-task-id">#${escapeHomeText(task.id)}</span><span class="sb-home-project"><span class="sb-home-project-dot" data-project-color="${escapeHomeText(task.projectColor || '#94A3B8')}" aria-hidden="true"></span>${escapeHomeText(task.project || 'Geral')}</span>${task.priority === 'Urgente' ? '<span class="sb-badge" data-status="error">Urgente</span>' : ''}${pending ? '<span class="sb-badge" data-status="homologation">Sua homologação</span>' : ''}</span><span class="sb-home-task-title">${escapeHomeText(task.title)}</span><span class="sb-home-row-meta"><span class="sb-badge" data-status="${escapeHomeText(task.status)}">${escapeHomeText(status?.label || 'Estado não identificado')}</span><span class="sb-home-meta">Prioridade: ${escapeHomeText(task.priority || 'não informada')}</span></span></span>
                    <span class="sb-home-row-end"><span class="sb-home-deadline${overdue ? ' sb-home-deadline--overdue' : ''}"><i data-lucide="${overdue ? 'calendar-clock' : 'calendar'}" aria-hidden="true"></i>${task.dueDate ? `${formatDate(task.dueDate)}${overdue ? ' · Atrasada' : ''}` : 'Sem prazo'}</span><span class="sb-home-open">Abrir tarefa <i data-lucide="arrow-up-right" aria-hidden="true"></i></span></span>
                </button>`;
            }).join('');
            listContainer.querySelectorAll('[data-project-color]').forEach(mark => { mark.style.backgroundColor = mark.dataset.projectColor; });
            listContainer.querySelectorAll('.list-row').forEach(row => row.addEventListener('click', () => {
                const taskId = row.dataset.taskId;
                highlightTask(taskId, false);
                renderTaskHistory(taskId);
            }));
        }
        lucide.createIcons({root: container});
    };
    container.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => updateList(button.dataset.filter)));
    updateList(views.some(view => view.key === previousFilter) ? previousFilter : 'inprogress');
    if (focusedFilter) [...container.querySelectorAll('.metric-card')].find(button => button.dataset.filter === focusedFilter)?.focus({preventScroll: true});
}

// --- RENDERIZAÇÃO: KANBAN ---

export function renderKanbanView() {
    const kanbanViewEl = document.getElementById('kanbanView');
    const fidelity = typeof isFidelityV2 === 'function' && isFidelityV2();
    // Aplica o filtro
    let activeTasks = filterTasks(state.tasks).filter(t => t.status !== 'done');
    
    const columns = [
        { id: 'todo', name: 'Fila', description: 'Tarefas por iniciar' },
        { id: 'stopped', name: 'Parado', description: 'Pausas e impedimentos' },
        { id: 'inprogress', name: 'Andamento', description: 'Trabalho em curso' },
        { id: 'homologation', name: 'Homologação', description: 'Aguardando validação' },
        { id: 'publication', name: 'Publicação', description: 'Etapa ativa · antes do arquivo' }
    ];

    columns.forEach((col, index) => {
        let columnEl = kanbanViewEl.querySelector(`.board-column[data-column-id="${col.id}"]`);
        const tasksForColumn = activeTasks.filter(t => t.status === col.id).sort((a, b) => (a.order || 0) - (b.order || 0));

        let animClass = '';
        if (index === 0) animClass = 'animate-slide-left'; 
        else if (index === columns.length - 1) animClass = 'animate-slide-right'; 
        else if (index % 2 !== 0) animClass = 'animate-slide-top';
        else animClass = 'animate-slide-bottom';

        if (!columnEl) {
            columnEl = document.createElement('div');
            columnEl.className = `board-column ${animClass}`;
            columnEl.setAttribute('data-column-id', col.id);

            columnEl.setAttribute('role', 'region');
            columnEl.setAttribute('aria-labelledby', `kanban-heading-${col.id}`);
            columnEl.innerHTML = `
                <div class="column-header sb-kanban-column-header">
                    <div class="sb-kanban-column-heading"><h2 id="kanban-heading-${col.id}">${fidelity ? `<i data-lucide="${({todo: 'circle', stopped: 'pause', inprogress: 'clock-3', homologation: 'shield-check', publication: 'upload'})[col.id]}" aria-hidden="true"></i>` : ''}${col.name}</h2><span class="column-count" aria-label="Tarefas nesta etapa">0</span></div>
                    ${fidelity ? '' : `<p>${col.description}</p>`}
                </div>
                <div class="kanban-task-list custom-scrollbar" data-column-id="${col.id}"></div>
                <p class="sb-kanban-empty">Nenhuma tarefa nesta etapa.</p>
            `;
            kanbanViewEl.appendChild(columnEl);
        } else {
            columnEl.classList.remove('fade-in');
            if(!columnEl.classList.contains(animClass)) {
                columnEl.classList.add(animClass);
            }
        }

        const countBadge = columnEl.querySelector('.column-count');
        if (countBadge) countBadge.textContent = tasksForColumn.length;

        const listEl = columnEl.querySelector('.kanban-task-list');
        listEl.innerHTML = ''; 
        tasksForColumn.forEach(task => listEl.appendChild(createTaskElement(task)));
    });

    lucide.createIcons();
}

// --- RENDERIZAÇÃO: LISTA / FLUXO V2 ---

function escapeListV2Text(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}

export function renderListView() {
    const container = document.getElementById('listView');
    const fidelity = document.body?.classList.contains('sb-fidelity-v2') === true;
    
    // 1. Filtragem Inicial
    let activeTasks = filterTasks(state.tasks).filter(t => t.status !== 'done');
    
    // 2. Lógica de Ordenação
    const sortBy = state.sortBy || 'createdAt'; 
    const sortDir = state.sortDirection || 'desc';

    activeTasks.sort((a, b) => {
        let valA, valB;

        if (sortBy === 'createdAt') {
            valA = new Date(a.createdAt || 0);
            valB = new Date(b.createdAt || 0);
        } else if (sortBy === 'dueDate') {
            // Tarefas sem prazo vão para o final
            valA = a.dueDate ? new Date(a.dueDate) : new Date(8640000000000000); 
            valB = b.dueDate ? new Date(b.dueDate) : new Date(8640000000000000);
        } else if (sortBy === 'title') {
            valA = (a.title || '').toLowerCase();
            valB = (b.title || '').toLowerCase();
        } else if (sortBy === 'status') {
            valA = (a.status || '').toLowerCase();
            valB = (b.status || '').toLowerCase();
        } else {
            // Fallback (Ordem do Kanban)
            valA = a.order || 0;
            valB = b.order || 0;
        }

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    // POPULAR O ORB DE ORDENAÇÃO (RADIAL)
    const orbOptions = document.getElementById('orb-sort-options');
    if (orbOptions) {
        orbOptions.innerHTML = ''; 

        const sortOptions = [
            { key: 'createdAt', label: 'Criação', icon: 'clock' },
            { key: 'dueDate', label: 'Prazo', icon: 'calendar' },
            { key: 'title', label: 'Título', icon: 'type' },
            { key: 'status', label: 'Status', icon: 'activity' }
        ];

        sortOptions.forEach(opt => {
            const isActive = sortBy === opt.key;
            const directionLabel = sortDir === 'asc' ? 'crescente' : 'decrescente';
            const btnWrapper = document.createElement('div');
            btnWrapper.className = 'radial-btn';
            btnWrapper.innerHTML = `
                <div class="radial-content ${isActive ? 'active' : ''}" data-sort="${opt.key}"
                     data-label="${opt.label}${isActive ? `, ${directionLabel}. Selecione para inverter` : ''}">
                    <i data-lucide="${opt.icon}" class="w-5 h-5" aria-hidden="true"></i>
                    <span class="sb-sort-option-label">${opt.label}</span>
                    <span class="sb-sort-direction">${isActive ? directionLabel : ''}</span>
                    <span class="sort-indicator" aria-hidden="true">${isActive ? `<i data-lucide="${sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}" class="w-4 h-4"></i>` : ''}</span>
                </div>`;

            const actualBtn = btnWrapper.querySelector('.radial-content');
            actualBtn.onclick = (e) => {
                e.stopPropagation();
                const key = actualBtn.dataset.sort;
                if (state.sortBy === key) {
                    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sortBy = key;
                    state.sortDirection = (key === 'title' || key === 'status') ? 'asc' : 'desc';
                }
                renderListView();
            };

            orbOptions.appendChild(btnWrapper);
        });
        
        const selectedSortLabel = document.getElementById('selected-sort-label');
        if (selectedSortLabel) selectedSortLabel.textContent = `${sortOptions.find(opt => opt.key === sortBy)?.label || 'Ordem do quadro'} · ${sortDir === 'asc' ? 'crescente' : 'decrescente'}`;
        lucide.createIcons();
    }

    // Se não houver tarefas
    if (activeTasks.length === 0) {
        const hasActiveTasks = state.tasks.some(task => task.status !== 'done');
        container.innerHTML = `<section class="sb-panel sb-list-empty" aria-labelledby="list-empty-title">
            <i data-lucide="${hasActiveTasks ? 'search' : 'clipboard-list'}" class="sb-list-empty-icon" aria-hidden="true"></i>
            <h2 id="list-empty-title">${hasActiveTasks ? 'Nenhuma tarefa corresponde aos filtros' : 'Nenhuma tarefa ativa'}</h2>
            <p>${hasActiveTasks ? 'Ajuste a busca, o projeto ou o responsável, ou use Limpar filtros para ver as tarefas ativas.' : 'As tarefas concluídas ficam em Arquivados. Novas tarefas aparecerão aqui.'}</p>
        </section>`;
        lucide.createIcons();
        container.onscroll = null; // Limpa evento
        return;
    }

    const statusMap = {
        'todo': 'Fila',
        'stopped': 'Parado',
        'inprogress': 'Em Andamento',
        'homologation': 'Homologação',
        'publication': 'Publicação',
        'done': 'Concluído'
    };

    // Presentation only: do not normalize or mutate stored task values.
    const rows = activeTasks.map(task => {
        const esc = escapeListV2Text;
        const respNames = (task.responsible || []).map(r => typeof r === 'object' ? (r?.name || r?.email || 'Nome não informado') : (r || 'Nome não informado')).join(', ');
        const statusLabel = statusMap[task.status] || 'Desconhecido';
        const projectColor = task.projectColor || '#7B8798';
        const progress = task.progress !== null && task.progress !== undefined && task.progress !== '' && Number.isFinite(Number(task.progress)) ? Number(task.progress) : null;
        const homologadorName = typeof task.homologador === 'object' ? (task.homologador?.name || task.homologador?.email) : task.homologador;
        const homologadorHtml = homologadorName && ['homologation', 'publication'].includes(task.status)
            ? `<p class="sb-list-reviewer"><i data-lucide="${task.status === 'publication' ? 'check-circle' : 'shield-check'}" aria-hidden="true"></i>Homologador: ${esc(homologadorName)}</p>` : '';
        if (fidelity) return renderFidelityListRow(task, {respNames, statusLabel, projectColor, progress, homologadorName, formatDate});
        return `
            <article class="task-list-row list-row sb-task-list-row" data-task-id="${esc(task.id)}" aria-labelledby="list-task-${esc(task.id)}">
                <div class="sb-list-task-main">
                    <div class="sb-list-task-meta"><span class="sb-list-task-id">${esc(task.id)}</span><span class="sb-badge" data-status="${esc(task.status)}">${esc(statusLabel)}</span><span class="sb-list-project"><span class="sb-list-project-dot" data-project-color="${esc(projectColor)}" aria-hidden="true"></span>${esc(task.project || 'Geral')}</span></div>
                    <h3 id="list-task-${esc(task.id)}">${esc(task.title)}</h3>
                    <p class="sb-list-owners"><span>Responsáveis:</span> ${esc(respNames || 'Sem responsável')}</p>
                    ${homologadorHtml}
                </div>
                <dl class="sb-list-task-details">
                    <div><dt>Prioridade</dt><dd>${esc(task.priority || 'Não informada')}</dd></div>
                    <div><dt>Prazo</dt><dd>${task.dueDate ? esc(formatDate(task.dueDate)) : 'Sem prazo'}</dd></div>
                    <div><dt>Progresso</dt><dd>${progress === null ? 'Não informado' : `<span>${esc(task.progress)}%${progress < 0 || progress > 100 ? ' (fora da faixa)' : ''}</span><progress max="100" value="${Math.max(0, Math.min(100, progress))}" aria-label="Progresso de ${esc(task.id)}">${esc(task.progress)}%</progress>`}</dd></div>
                    <div><dt>Criação</dt><dd>${esc(formatDate(task.createdAt) || 'Não informada')}</dd></div>
                </dl>
                <div class="sb-list-task-actions">
                    ${task.attachments?.length ? `<span class="sb-list-attachments"><i data-lucide="paperclip" aria-hidden="true"></i>${task.attachments.length} ${task.attachments.length === 1 ? 'anexo' : 'anexos'}</span>` : ''}
                    <button type="button" class="delete-list-btn sb-shell-icon-button" data-task-id="${esc(task.id)}" title="Excluir ${esc(task.id)}" aria-label="Excluir ${esc(task.id)}"><i data-lucide="trash-2" class="sb-shell-icon" aria-hidden="true"></i></button>
                    <button type="button" class="info-btn sb-shell-icon-button" data-task-id="${esc(task.id)}" aria-label="Abrir detalhes de ${esc(task.id)}"><i data-lucide="chevron-right" class="sb-shell-icon" aria-hidden="true"></i></button>
                </div>
            </article>`;
    }).join('');

    container.innerHTML = fidelity ? renderFidelityListShell(rows, activeTasks.length) : `<section class="sb-list-results" aria-label="Tarefas ativas">
        <div class="sb-list-results-heading"><h2>Tarefas</h2><p>${activeTasks.length} ${activeTasks.length === 1 ? 'tarefa' : 'tarefas'}</p></div>
        <div class="sb-list-rows">${rows}</div>
    </section>`;
    container.querySelectorAll('.sb-list-project-dot').forEach(dot => {
        dot.style.backgroundColor = dot.dataset.projectColor;
    });
    // Keep rows stable and fully opaque while scrolling.
    container.onscroll = null;

    // --- EVENTOS ---

    // Clique na linha
    container.querySelectorAll('.list-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (!e.target.closest('button, a')) {
                const taskId = row.dataset.taskId;
                highlightTask(taskId, false);
                renderTaskHistory(taskId);
            }
        });
    });

    // Excluir
    container.querySelectorAll('.delete-list-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const taskId = btn.dataset.taskId;
            const taskTitle = state.tasks.find(t => t.id === taskId)?.title || taskId;
            
            showDestructiveConfirmModal(
                'Excluir Tarefa?',
                `Deseja realmente excluir a tarefa "${taskTitle}" (${taskId})?`,
                async () => {
                    const api = await import('./api.js');
                    await api.deleteTask(taskId);
                    showToast('Tarefa excluída.', 'success');
                }
            );
        });
    });

    lucide.createIcons();
}

// --- RENDERIZAÇÃO: ARQUIVADOS ---

export async function renderArchivedTasks() {
    const container = document.getElementById('archivedView');
    const fidelity = document.body?.classList.contains('sb-fidelity-v2') === true;
    const archiveShell = fidelity ? renderFidelityArchiveShell : renderArchiveShell;
    if (fidelity) setFidelitySecondaryHeading('Arquivados', 'Tarefas concluídas ficam separadas do fluxo ativo. Restaurar envia a tarefa para Fila.');
    container.innerHTML = archiveShell('<div class="sb-empty sb-archive-state" role="status" aria-live="polite" aria-busy="true"><picture class="sb-cube sb-cube--archive" aria-hidden="true"><source media="(prefers-reduced-motion: no-preference)" srcset="assets/cube-assembly-128.gif"><img src="assets/cube-static-512.png" alt="" width="128" height="128"></picture><h3>Carregando arquivados…</h3><p>Aguarde a consulta das tarefas concluídas.</p></div>');
    lucide.createIcons();

    try {
        const tasks = await fetchArchivedTasks();
        container.innerHTML = fidelity ? renderFidelityArchiveRows(tasks, {archiveResponsibleNames, archiveUpdatedLabel}) : renderArchiveRows(tasks);
        applyArchiveProjectColors(container);
        lucide.createIcons();
    } catch (e) {
        console.error(e);
        container.innerHTML = archiveShell('<div class="sb-notice sb-notice--error sb-archive-state" role="alert"><h3>Não foi possível carregar o arquivo</h3><p>Os dados não estão disponíveis. Tente abrir Arquivados novamente.</p></div>');
    }
}

// --- RENDERIZAÇÃO: UTILIZADORES ---

export function renderUserManagementView() {
    const container = document.getElementById('userManagementView');
    const fidelity = document.body?.classList.contains('sb-fidelity-v2') === true;
    if (fidelity) setFidelitySecondaryHeading('Utilizadores', 'Pessoas, papéis e acesso ao espaço de trabalho.');
    
    // Filtra o utilizador de sistema e ORDENA alfabeticamente pelo Nome de Exibição
    const allUsers = state.users
        .filter(u => u.name !== 'DEFINIR')
        .sort((a, b) => {
            const nameA = (a.displayName || a.name || '').toLowerCase();
            const nameB = (b.displayName || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

    const userCards = allUsers.map(user => {
        const activeTasksCount = state.tasks.filter(t =>
            t.status !== 'done' &&
            t.responsible?.some(r => (typeof r === 'object' ? r.name : r) === user.name)
        ).length;
        return personCard(user, activeTasksCount);
    }).join('');

    container.innerHTML = `${fidelity ? renderFidelityPeopleDirectory(userCards, allUsers.length) : `
        <div class="sb-people-page">
            <header class="sb-people-header">
                <div><p class="sb-people-kicker">Pessoas</p><h1>Gestão de Utilizadores</h1><p>Acessos e cargos</p></div>
                <button type="button" id="openNewUserModalBtn" class="sb-button"><i data-lucide="plus" aria-hidden="true"></i><span>Novo Membro</span></button>
            </header>
            <div class="sb-people-search">
                <label for="userSearchInput" class="sb-label">Procurar utilizador</label>
                <input type="search" id="userSearchInput" class="sb-input" placeholder="Nome, email ou cargo…">
            </div>
            <div id="user-list-container" class="sb-people-list">
                ${userCards}
                ${allUsers.length === 0 ? '<div class="sb-empty"><h2>Nenhum membro disponível</h2><p>A lista de utilizadores está vazia.</p></div>' : ''}
                <div id="no-users-found" class="hidden sb-empty" role="status"><i data-lucide="users-2" aria-hidden="true"></i><p>Nenhum membro encontrado.</p></div>
            </div>
        </div>`}

        <div id="userFormModal" role="dialog" aria-labelledby="user-form-title" aria-describedby="user-form-subtitle" class="sb-people-dialog fixed inset-0 z-[1500] hidden items-center justify-center p-4 modal-backdrop">
            <div class="absolute inset-0 close-user-modal" aria-hidden="true"></div>
            <div class="sb-people-panel orb-glass-unified relative z-10 transform scale-95 opacity-0" id="userFormModalContent">
                <header class="sb-people-dialog-header">
                    <div><h2 id="user-form-title">Novo Membro</h2><p id="user-form-subtitle">Adicionar ao SyncBoard</p></div>
                    <button type="button" class="sb-people-close close-user-modal" aria-label="Fechar formulário"><i data-lucide="x" aria-hidden="true"></i></button>
                </header>
                <form id="addUserForm" class="sb-people-form">
                    <input type="hidden" id="editUserId" value="">
                    <div class="sb-field"><label for="newUserName" class="sb-label">Nome de Exibição (obrigatório)</label><input type="text" id="newUserName" required placeholder="Ex: Maria Silva" class="sb-input"></div>
                    <div class="sb-field"><label for="newUserEmail" class="sb-label">Email (Google, obrigatório)</label><input type="email" id="newUserEmail" required placeholder="maria@empresa.com" class="sb-input"></div>
                    <div class="sb-field"><label for="newUserRole" class="sb-label">Cargo</label><input type="text" id="newUserRole" placeholder="Ex: Frontend Developer…" class="sb-input"></div>
                    <div class="sb-person-permissions">
                        <label for="newUserIsAdmin"><input type="checkbox" id="newUserIsAdmin" aria-describedby="user-admin-help"><span>Privilégios Admin</span></label>
                        <p id="user-admin-help" class="sb-help">Permite editar projetos, gerir painéis e remover utilizadores.</p>
                    </div>
                    <div class="sb-person-permissions">
                        <label for="newUserIsAiAgent"><input type="checkbox" id="newUserIsAiAgent" aria-describedby="user-ai-agent-help"><span>Agente IA</span></label>
                        <p id="user-ai-agent-help" class="sb-help">Identifica este utilizador como agente de inteligência artificial. Não altera permissões de acesso.</p>
                    </div>
                    <div class="sb-people-form-actions">
                        <button type="button" class="sb-button sb-button--secondary close-user-modal">Cancelar</button>
                        <button type="submit" id="submitUserBtn" class="sb-button"><i data-lucide="save" aria-hidden="true"></i><span>Salvar Utilizador</span></button>
                    </div>
                </form>
            </div>
        </div>
    `;

    lucide.createIcons();

    const searchInput = document.getElementById('userSearchInput');
    const userItems = document.querySelectorAll('.user-card-item');
    const noUsersMsg = document.getElementById('no-users-found');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            let hasVisible = false;

            userItems.forEach(card => {
                const text = card.textContent.toLowerCase();
                if (text.includes(term)) {
                    card.style.display = 'flex';
                    hasVisible = true;
                } else {
                    card.style.display = 'none';
                }
            });

            if (!hasVisible && userItems.length > 0) {
                noUsersMsg.classList.remove('hidden');
                noUsersMsg.classList.add('flex');
            } else {
                noUsersMsg.classList.add('hidden');
                noUsersMsg.classList.remove('flex');
            }
        });
    }
}

// --- ROTEADOR UI (ATUALIZADO COM ANIMAÇÃO DE ENTRADA E SAÍDA) ---

export function updateActiveView() {
    // TC-455 preview shell renders first; per-view renderers can override the shared hero.
    if (typeof isFidelityV2 === 'function' && isFidelityV2()) syncFidelityShell(state, filterTasks(state.tasks).filter(t => t.status !== 'done'));
    const home = document.getElementById('homeView');
    const kanban = document.getElementById('kanbanView');
    const list = document.getElementById('listView');
    const archived = document.getElementById('archivedView');
    const users = document.getElementById('userManagementView');
    const main = document.getElementById('main-content');
    const label = document.getElementById('current-view-label');
    const sortOrb = document.getElementById('orb-sort'); 
    const filterOrb = document.getElementById('orb-filter'); // Pegamos o botão de filtro
    
    // Preserve only the focused Home metric before hiding the view detaches focus.
    const focusedHomeMetric = state.currentView === 'home' && home?.contains(document.activeElement)
        ? document.activeElement.closest('.metric-card')?.dataset.filter : undefined;

    // Esconde views de conteúdo imediatamente
    [home, kanban, list, archived, users].forEach(el => el && el.classList.add('hidden'));

    // Atualiza botões do menu inferior
    document.querySelectorAll('#view-switcher-orb .nav-item').forEach(btn => {
        const isActive = btn.dataset.view === state.currentView;
        if (isActive) {
            btn.classList.add('bg-white/20', 'font-bold', 'ring-1', 'ring-white/30');
            btn.classList.remove('ring-transparent');
        } else {
            btn.classList.remove('bg-white/20', 'font-bold', 'ring-white/30');
            btn.classList.add('ring-transparent');
        }
    });

    updateFilterBadge();

    // --- VISIBILIDADE DO ORB DE FILTRO ---
    if (filterOrb) {
        if (state.currentView === 'kanban' || state.currentView === 'list') {
            filterOrb.classList.remove('hidden');
        } else {
            filterOrb.classList.add('hidden');
            filterOrb.classList.remove('expanded'); // Garante que ele feche se estivesse aberto
        }
    }

    // --- LÓGICA DE ANIMAÇÃO DO ORB ---
    if (state.currentView === 'list') {
        // ENTRADA: Se não estiver visível ou estiver saindo, anima a entrada
        if (sortOrb) {
            // Garante que está visível para animar
            sortOrb.classList.remove('hidden');
            sortOrb.classList.remove('orb-slide-out');
            sortOrb.classList.remove('expanded'); 
            
            // Força reflow para reiniciar animação se necessário
            void sortOrb.offsetWidth; 
            
            sortOrb.classList.add('orb-slide-in');
        }
    } else {
        // SAÍDA: Se estiver visível, anima a saída
        if (sortOrb && !sortOrb.classList.contains('hidden')) {
            sortOrb.classList.remove('orb-slide-in');
            sortOrb.classList.remove('expanded');
            sortOrb.classList.add('orb-slide-out');

            // Aguarda o fim da animação para esconder de fato
            setTimeout(() => {
                // Checa se ainda não voltamos para list (navegação rápida)
                if (state.currentView !== 'list') {
                    sortOrb.classList.add('hidden');
                    sortOrb.classList.remove('orb-slide-out');
                }
            }, 500); // 500ms bate com a duração do CSS
        } else if (sortOrb && state.currentView !== 'list' && !sortOrb.classList.contains('orb-slide-out')) {
             // Caso inicial ou troca rápida sem animação
             sortOrb.classList.add('hidden');
        }
    }
    // --------------------------------

    // Renderização das Views
    if (state.currentView === 'kanban') {
        renderKanbanView();
        
        kanban.classList.remove('hidden', 'w-full');
        kanban.classList.add('flex', 'gap-8', 'w-fit', 'mx-auto'); 
        
        main.classList.add('immersive-canvas');
        main.classList.remove('block', 'h-screen', 'overflow-hidden', 'relative'); 
        label.textContent = "Quadro Kanban";
    } else {
        kanban.classList.add('w-full');
        kanban.classList.remove('flex', 'gap-8', 'w-fit', 'mx-auto');
        
        main.classList.remove('immersive-canvas');
        main.classList.add('block', 'h-screen', 'overflow-hidden', 'relative'); 

        // Adicionamos a verificação da Home aqui junto com as outras telas em lista
        if (state.currentView === 'home') {
            renderHomeView();
            home.classList.remove('hidden');
            if (focusedHomeMetric) [...home.querySelectorAll('.metric-card')].find(button => button.dataset.filter === focusedHomeMetric)?.focus({preventScroll: true});
            label.textContent = "Início";
        } else if (state.currentView === 'list') {
            renderListView();
            list.classList.remove('hidden');
            label.textContent = "Lista de Tarefas";
        } else if (state.currentView === 'archived') {
            renderArchivedTasks();
            archived.classList.remove('hidden');
            label.textContent = "Arquivo";
        } else if (state.currentView === 'users') {
            renderUserManagementView();
            users.classList.remove('hidden');
            label.textContent = "Utilizadores";
        }
    }
    if (typeof isFidelityV2 === 'function' && isFidelityV2()) finishFidelityView(state);
}

// --- FILTROS NO ORB + BADGE ---

function updateFilterBadge() {
    const filterOrb = document.getElementById('orb-filter');
    if (!filterOrb) return;
    const projectSelected = state.selectedProject && state.selectedProject !== 'all';
    const responsibleSelected = state.selectedResponsible && state.selectedResponsible !== 'all';
    const activeCount = Number(Boolean(projectSelected)) + Number(Boolean(responsibleSelected)) + Number(Boolean(state.searchQuery)) + ((typeof isFidelityV2 === 'function' && isFidelityV2()) ? fidelityFilterCount() : 0);
    const projectLabel = document.getElementById('selected-project-label');
    const responsibleLabel = document.getElementById('selected-responsible-label');
    const countLabel = document.getElementById('task-filter-count');
    if (projectLabel) projectLabel.textContent = projectSelected ? state.selectedProject : 'Todos';
    if (responsibleLabel) responsibleLabel.textContent = responsibleSelected ? state.selectedResponsible : 'Todos';
    if (countLabel) countLabel.textContent = activeCount ? `${activeCount} ${activeCount === 1 ? 'filtro ativo' : 'filtros ativos'}` : 'Sem filtros ativos';
    const clearButton = document.getElementById('clear-task-filters');
    if (clearButton) {
        clearButton.disabled = !activeCount;
        // Route clearing through the already-installed filter/search callbacks.
        clearButton.onclick = () => {
            if (typeof isFidelityV2 === 'function' && isFidelityV2()) resetFidelityFilters();
            document.querySelector('#orb-project-filters .filter-chip')?.click();
            document.querySelector('#orb-responsible-filters .filter-chip')?.click();
            const search = document.getElementById('search-input');
            if (search) {
                search.value = '';
                search.dispatchEvent(new Event('input', { bubbles: true }));
                search.focus();
            }
        };
    }
}

export function populateProjectFilter() {
    const container = document.getElementById('orb-project-filters');
    if (!container) return; 

    const projects = [...new Set([...state.tasks.map(t => t.project), ...(state.selectedProject && state.selectedProject !== 'all' ? [state.selectedProject] : [])].filter(Boolean))].sort();

    container.innerHTML = '';

    const allChip = document.createElement('div');
    const isAllActive = !state.selectedProject || state.selectedProject === 'all';
    allChip.className = `filter-chip ${isAllActive ? 'active' : ''}`;
    allChip.textContent = 'Todos';
    allChip.dataset.value = 'all';
    
    allChip.onclick = (e) => {
        e.stopPropagation();
        state.selectedProject = 'all';
        populateProjectFilter(); 
        updateActiveView();      
        updateFilterBadge();     
    };
    container.appendChild(allChip);
    
    projects.forEach(p => {
        const chip = document.createElement('div');
        const isActive = state.selectedProject === p;
        chip.className = `filter-chip ${isActive ? 'active' : ''}`;
        chip.textContent = p;
        chip.dataset.value = p;
        
        chip.onclick = (e) => {
            e.stopPropagation();
            state.selectedProject = isActive ? 'all' : p;
            populateProjectFilter(); 
            updateActiveView();
            updateFilterBadge();
        };
        container.appendChild(chip);
    });
    
    updateFilterBadge();
}

export function populateResponsibleFilter() {
    const container = document.getElementById('orb-responsible-filters');
    if (!container) return;

    const responsibles = [...new Set([...state.tasks.flatMap(t => t.responsible || []).map(r => (typeof r === 'object' ? r.name : r)), ...(state.selectedResponsible && state.selectedResponsible !== 'all' ? [state.selectedResponsible] : [])].filter(Boolean))].sort();
    
    container.innerHTML = '';
    
    const allChip = document.createElement('div');
    const isAllActive = !state.selectedResponsible || state.selectedResponsible === 'all';
    allChip.className = `filter-chip ${isAllActive ? 'active' : ''}`;
    allChip.textContent = 'Todos';
    allChip.dataset.value = 'all';
    
    allChip.onclick = (e) => {
        e.stopPropagation();
        state.selectedResponsible = 'all';
        populateResponsibleFilter();
        updateActiveView();
        updateFilterBadge();
    };
    container.appendChild(allChip);
    
    responsibles.forEach(r => {
        const chip = document.createElement('div');
        const isActive = state.selectedResponsible === r;
        chip.className = `filter-chip ${isActive ? 'active' : ''}`;
        chip.textContent = r;
        chip.dataset.value = r;
        
        chip.onclick = (e) => {
            e.stopPropagation();
            state.selectedResponsible = isActive ? 'all' : r;
            populateResponsibleFilter();
            updateActiveView();
            updateFilterBadge();
        };
        container.appendChild(chip);
    });

    updateFilterBadge();
}

// --- MODAL: DETALHES ---

// Adiciona o listener de duplo clique ('dblclick') no container do Kanban
document.getElementById('kanbanView').addEventListener('dblclick', function(e) {
    
    // Verifica se o duplo clique ocorreu dentro de um card de tarefa
    const taskCard = e.target.closest('.task-card');
    
    if (taskCard) {
        // Truque de UX: Previne a seleção de texto azul chata que acontece ao dar duplo clique
        window.getSelection().removeAllRanges();
        
        // Pega o ID da tarefa (Ajuste dependendo de como o ID está no seu HTML)
        // Geralmente está num atributo como data-id="123" ou id="task-123"
        const taskId = taskCard.dataset.id || taskCard.id.replace('task-', '');
        
        // Chama a função que já existe no seu código para abrir o modal do histórico/detalhes
        // IMPORTANTE: Substitua 'openTaskHistoryModal' pelo nome real da sua função!
        if (typeof openTaskHistoryModal === 'function') {
            openTaskHistoryModal(taskId);
        } else if (typeof window.openTaskDetails === 'function') {
            window.openTaskDetails(taskId);
        } else {
            console.log('Duplo clique detetado na tarefa ID:', taskId);
            // Insira aqui a sua chamada de função para abrir o #taskHistoryModal
        }
    }
});

// --- VARIÁVEIS DE ESTADO DA ANIMAÇÃO ---
let activeOriginRect = null;
let activeOriginEl = null;
let isAnimating = false;

// --- MODAL: DETALHES (Rich Text + Menções + Animação FLIP) ---

export function renderTaskHistory(taskId, fromNotification = false) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    state.lastInteractedTaskId = taskId;
    state.returnToNotifications = fromNotification; // Memoriza se viemos das notificações

    // =================================================================
    // 1. POPULAÇÃO DE DADOS
    // =================================================================

    const idDisplay = document.getElementById('modal-task-id-display');
    if (idDisplay) idDisplay.textContent = task.id;
    document.getElementById('modal-info-title').textContent = task.title;
    
    const projectLabel = document.getElementById('modal-info-project');
    if (projectLabel) {
        projectLabel.textContent = task.project || 'Geral';
        projectLabel.style.color = 'rgba(255, 255, 255, 0.9)'; 
        projectLabel.style.backgroundColor = hexToRgba(task.projectColor || '#94A3B8', 0.2);
        projectLabel.style.borderColor = hexToRgba(task.projectColor || '#94A3B8', 0.3);
    }

    document.getElementById('modal-info-description').textContent = task.description || '';

    // Responsáveis (Sidebar)
    const sidebarRespContainer = document.getElementById('sidebar-responsibles-container');
    if (sidebarRespContainer) {
        sidebarRespContainer.innerHTML = ''; 
        if (task.responsible && task.responsible.length > 0) {
            task.responsible.forEach((resp, index) => {
                const name = typeof resp === 'object' ? resp?.name : resp;
                const displayName = String(name || (typeof resp === 'object' ? resp?.email : '') || 'Nome não informado');
                const userObj = state.users.find(u => u.name === name);
                const pic = userObj ? userObj.picture : (typeof resp === 'object' ? resp?.picture : null);
                const isMain = index === 0;
                const sizeClass = isMain ? 'w-10 h-10 ring-2 ring-white/20' : 'w-8 h-8 opacity-80 hover:opacity-100';
                const zIndex = 10 - index;

                const avatarEl = document.createElement('div');
                avatarEl.className = `${sizeClass} rounded-full bg-cover bg-center bg-gray-700 border border-white/10 shadow-lg transition-all hover:scale-105 hover:ring-white/50 relative group cursor-help`;
                avatarEl.style.zIndex = zIndex;
                avatarEl.title = isMain ? `Responsável Principal: ${displayName}` : displayName;

                if (pic) {
                    avatarEl.style.backgroundImage = `url('${pic}')`;
                } else {
                    avatarEl.classList.add('flex', 'items-center', 'justify-center');
                    avatarEl.innerHTML = `<span class="${isMain ? 'text-lg' : 'text-xs'} font-bold text-white">${escapeHomeText(displayName.charAt(0))}</span>`;
                }
                // Show the same supplied name on touch screens, without relying on hover.
                const person = document.createElement('span');
                person.className = 'sb-task-person';
                const personName = document.createElement('span');
                personName.textContent = isMain ? `${displayName} · Principal` : displayName;
                avatarEl.setAttribute('aria-hidden', 'true');
                person.append(avatarEl, personName);
                sidebarRespContainer.appendChild(person);
            });
        } else {
            sidebarRespContainer.innerHTML = `
                <div class="w-10 h-10 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-white/20">
                    <i data-lucide="user" class="w-5 h-5"></i>
                </div>
                <span class="text-xs text-white/30 italic ml-2">Ninguém</span>
            `;
        }
    }

    // Homologador (Sidebar do Modal)
    const homologadorContainer = document.getElementById('modal-info-homologador-container');
    const homologadorContent = document.getElementById('modal-info-homologador');
    
    if (homologadorContainer && homologadorContent) {
        if (task.homologador && (task.status === 'homologation' || task.status === 'publication')) {
            const homolName = String((typeof task.homologador === 'object' ? (task.homologador.name || task.homologador.email) : task.homologador) || 'Nome não informado');
            const homolPic = typeof task.homologador === 'object' ? task.homologador.picture : null;
            const isApproved = task.status === 'publication';
            
            const borderColor = isApproved ? 'border-green-500' : 'border-orange-500';
            const bgColor = isApproved ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300';
            const statusText = isApproved ? 'Aprovado' : 'Pendente';
            const statusColor = isApproved ? 'text-green-400' : 'text-orange-400';

            const avatarImg = homolPic 
                ? `<img src="${homolPic}" class="w-8 h-8 rounded-full object-cover border-2 ${borderColor}">` 
                : `<div class="w-8 h-8 rounded-full ${bgColor} border-2 ${borderColor} flex items-center justify-center text-xs font-bold">${escapeHomeText(homolName.charAt(0))}</div>`;

            homologadorContent.innerHTML = `
                <div class="flex items-center gap-3 bg-black/10 dark:bg-white/5 pr-4 rounded-full border border-black/5 dark:border-white/10" title="Homologador: ${escapeHomeText(homolName)}">
                    ${avatarImg}
                    <div class="flex flex-col py-1">
                        <span class="text-xs font-bold text-custom-darkest dark:text-white leading-none">${escapeHomeText(homolName)}</span>
                        <span class="sb-task-validation-status text-[9px] ${statusColor} uppercase font-bold tracking-wider mt-0.5">${statusText}</span>
                    </div>
                </div>
            `;
            homologadorContainer.classList.remove('hidden');
            homologadorContainer.classList.add('flex');
        } else {
            homologadorContainer.classList.add('hidden');
            homologadorContainer.classList.remove('flex');
        }
    }

    // Google Calendar
    const calendarBtn = document.getElementById('modal-calendar-btn');
    if (calendarBtn) {
        const respEmails = (task.responsible || []).map(r => (typeof r === 'object' ? r?.email : '')).filter(Boolean).join(',');
        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.title)}&details=${encodeURIComponent(task.description || '')}&add=${respEmails}`;
        calendarBtn.href = googleUrl;
    }

    // Controle de Visibilidade do Botão de Aprovação
    const modalApproveBtn = document.getElementById('modal-approve-btn');
    if (modalApproveBtn) {
        if (task.status === 'homologation') {
            modalApproveBtn.classList.remove('hidden');
            modalApproveBtn.classList.add('flex');
            modalApproveBtn.dataset.taskId = task.id; // Guarda o ID para o click
            modalApproveBtn.disabled = false;
            modalApproveBtn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span class="hidden sm:inline">Aprovar</span>`;
        } else {
            modalApproveBtn.classList.add('hidden');
            modalApproveBtn.classList.remove('flex');
        }
    }

    // Prazo
    const dueDateContainer = document.getElementById('modal-info-dueDate-container');
    const dueDateText = document.getElementById('modal-info-dueDate');
    if (task.dueDate && dueDateContainer && dueDateText) {
        dueDateContainer.classList.remove('hidden');
        if (isTaskOverdue(task)) {
            dueDateText.innerHTML = `<span class="flex items-center gap-1 text-red-400"><i data-lucide="alert-circle" class="w-3 h-3"></i> ${formatDate(task.dueDate)} (Atrasado)</span>`;
        } else {
            dueDateText.textContent = formatDate(task.dueDate);
            dueDateText.className = 'text-sm font-bold text-white';
        }
    } else if (dueDateContainer) {
        dueDateContainer.classList.add('hidden');
    }

    // Link Externo
    const linkContainer = document.getElementById('modal-info-azure-link-container');
    if (task.azureLink && linkContainer) {
        const linkEl = document.getElementById('modal-info-azure-link');
        linkEl.href = task.azureLink;
        linkContainer.classList.remove('hidden');
    } else if (linkContainer) {
        linkContainer.classList.add('hidden');
    }

    // Anexos
    const attachContainer = document.getElementById('modal-info-attachments-container');
    if (task.attachments?.length > 0 && attachContainer) {
        // Passamos false para garantir que o modo é APENAS LEITURA (sem botão de excluir)
        renderAttachmentList('modal-info-attachments', task.attachments, false);
        attachContainer.classList.remove('hidden');
    } else if (attachContainer) {
        attachContainer.classList.add('hidden');
    }

    // Histórico
    const historyEl = document.getElementById('history-feed');
    if (historyEl) {
        const historyItems = (task.history || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        if (historyItems.length === 0) {
             historyEl.innerHTML = '<p class="sb-collab-empty text-xs text-white/30 italic">Nenhuma alteração registrada.</p>';
        } else {
            historyEl.innerHTML = historyItems.map(item => {
                let logText = '';
                let icon = 'activity'; // Ícone padrão
                
                // Trata o modelo novo e o modelo legado
                if (item.action === 'created') {
                    logText = item.description;
                    icon = 'plus-circle';
                } else if (item.action === 'edited') {
                    logText = item.description;
                    icon = 'edit-3';
                } else {
                    // Fallback para logs antigos
                    if (item.status === 'todo') {
                        logText = 'Tarefa criada (Fila)';
                        icon = 'plus-circle';
                    } else if (item.status === 'edited') {
                        logText = 'Tarefa editada';
                        icon = 'edit-3';
                    } else {
                        logText = `Mudou status para <span class="font-bold text-white">${item.status}</span>`;
                        icon = 'git-commit';
                    }
                }

                return `
                <div class="sb-collab-history-item relative pl-7 pb-5 border-l border-white/10 last:border-0 last:pb-0 group">
                    <div class="sb-collab-history-icon absolute -left-[13px] top-0 w-6 h-6 rounded-full bg-[#1E293B] border border-white/20 flex items-center justify-center text-white/60 shadow-sm group-hover:text-blue-400 group-hover:border-blue-400/50 transition-colors">
                        <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
                    </div>
                    <div class="sb-collab-history-description text-xs text-white/80 leading-relaxed">${logText}</div>
                    <p class="sb-collab-meta text-[10px] text-white/30 mt-1">${formatDateTime(item.timestamp) || 'Data não informada'}</p>
                </div>
                `;
            }).join('');
        }
    }

    // Comentários
    const commentsEl = document.getElementById('comments-feed');
    const comments = (task.comments || []).map((c, i) => ({...c, index: i})).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (comments.length === 0) {
        commentsEl.innerHTML = '<div class="sb-collab-empty text-center text-white/20 py-10 italic text-sm">Nenhum comentário ainda. Use o campo abaixo para começar.</div>';
    } else {
        commentsEl.innerHTML = comments.map(c => {
            const rawAuthor = typeof c.author === 'object' ? (c.author.email || c.author.name || '') : (c.author || '');
            let user = state.users.find(u => u.email === rawAuthor);
            if (!user) user = state.users.find(u => u.name && rawAuthor && u.name.toLowerCase() === rawAuthor.toLowerCase());

            const authorName = user ? user.name : (typeof c.author === 'object' ? (c.author.name || c.author.email || 'Usuário') : c.author);
            const displayAuthor = escapeHomeText(authorName || 'Autor não informado');
            const commentDate = formatDateTime(c.timestamp) || 'Data não informada';
            const editedLabel = c.editedAt ? `<span class="sb-collab-meta sb-collab-edited">Editado em ${formatDateTime(c.editedAt)}</span>` : '';
            const picUrl = user ? user.picture : null;
            const initial = (authorName || 'U').charAt(0).toUpperCase();
            const avatarHtml = picUrl 
                ? `<div class="sb-collab-comment-avatar w-8 h-8 rounded-full border border-white/10 bg-cover bg-center shrink-0" style="background-image: url('${picUrl}')" title="${displayAuthor}"></div>`
                : `<div class="sb-collab-comment-avatar w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-bold text-xs text-white shrink-0" title="${displayAuthor}">${escapeHomeText(initial)}</div>`;

            const normalize = (value) => (value || '').toString().trim().toLowerCase();
            const emailClaim = (state.currentUser?.claims || []).find(claim =>
                claim.typ === 'emails' ||
                claim.typ === 'email' ||
                claim.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
            )?.val;

            const myIdentifiers = new Set([
                state.currentUser?.userDetails,
                state.currentUser?.userId,
                state.currentUser?.email,
                emailClaim,
                state.currentUser?.identityProvider ? `${state.currentUser.identityProvider}_${state.currentUser.userId}` : null
            ].map(normalize).filter(Boolean));

            const currentUserEntry = state.users.find(u => {
                const userName = normalize(u?.name);
                const userEmail = normalize(u?.email);
                return (userName && myIdentifiers.has(userName)) || (userEmail && myIdentifiers.has(userEmail));
            });

            if (currentUserEntry?.name) myIdentifiers.add(normalize(currentUserEntry.name));
            if (currentUserEntry?.email) myIdentifiers.add(normalize(currentUserEntry.email));

            const commentAuthorEmail = typeof c.author === 'object' ? c.author.email : null;
            const commentAuthorName = typeof c.author === 'object' ? c.author.name : authorName;

            const commentIdentifiers = new Set([
                rawAuthor,
                commentAuthorEmail,
                commentAuthorName,
                c.userId,
                user?.email,
                user?.name
            ].map(normalize).filter(Boolean));

            const isMe = [...commentIdentifiers].some(identifier => myIdentifiers.has(identifier));

            if (isMe) {
                const commentKey = c.id || c.index;
                return `<div class="sb-collab-comment sb-collab-comment--own flex gap-3 justify-end group items-end animate-fade-in pl-8 mb-2"><div class="sb-collab-comment-main flex flex-col items-end min-w-0 max-w-full"><div class="sb-collab-comment-meta flex items-center gap-2 mb-1"><span class="sb-collab-meta text-[9px] text-white/30 shrink-0">${commentDate}</span>${editedLabel}<span class="sb-collab-comment-author text-xs font-bold text-white/90">Você · ${displayAuthor}</span><button class="edit-comment-btn text-amber-300/80 hover:text-amber-200 transition-colors p-1" data-task-id="${taskId}" data-comment-index="${c.index}" data-comment-key="${commentKey}" data-comment-text="${encodeURIComponent(c.text)}" title="Editar comentário" aria-label="Editar comentário"><i data-lucide="pencil" class="w-3 h-3"></i></button><button class="delete-comment-btn text-red-400/90 hover:text-red-300 transition-colors p-1" data-task-id="${taskId}" data-comment-index="${c.index}" title="Excluir comentário" aria-label="Excluir comentário"><i data-lucide="trash-2" class="w-3 h-3"></i></button></div><div class="sb-collab-comment-body p-3 rounded-l-xl rounded-tr-xl border bg-blue-600/20 border-blue-500/30 text-sm text-gray-200 shadow-sm relative group-hover:border-blue-400/50 transition-colors break-words">${c.text}</div></div>${avatarHtml}</div>`;
            } else {
                return `<div class="sb-collab-comment flex gap-3 group items-end animate-fade-in pr-8 mb-2">${avatarHtml}<div class="sb-collab-comment-main flex flex-col items-start min-w-0 max-w-full"><div class="sb-collab-comment-meta flex items-baseline gap-2 mb-1"><span class="sb-collab-comment-author text-xs font-bold text-white/90">${displayAuthor}</span><span class="sb-collab-meta text-[9px] text-white/30 shrink-0">${commentDate}</span>${editedLabel}</div><div class="sb-collab-comment-body p-3 rounded-r-xl rounded-tl-xl border bg-white/5 border-white/10 text-sm text-gray-200 shadow-sm relative group-hover:border-white/20 transition-colors break-words">${c.text}</div></div></div>`;
            }
        }).join('');
        setTimeout(() => { if(commentsEl) commentsEl.scrollTop = commentsEl.scrollHeight; }, 100);
    }

    // =================================================================
    // 2. INJEÇÃO DO RICH TEXT EDITOR
    // =================================================================
    
    const rightColumn = document.querySelector('#taskHistoryModal .glass-separator-v');
    const inputContainer = rightColumn ? rightColumn.querySelector('.p-6.mt-auto') : null;
    
    if(inputContainer) {
        inputContainer.innerHTML = `
            <div class="rich-editor-wrapper relative group">
                <div class="editor-toolbar" role="group" aria-label="Formatação do comentário">
                    <button type="button" class="editor-tool-btn" data-cmd="bold" title="Negrito" aria-label="Negrito">
                        <i data-lucide="bold" class="w-4 h-4"></i>
                    </button>
                    <button type="button" class="editor-tool-btn" data-cmd="italic" title="Itálico" aria-label="Itálico">
                        <i data-lucide="italic" class="w-4 h-4"></i>
                    </button>
                    <button type="button" class="editor-tool-btn" data-cmd="underline" title="Sublinhado" aria-label="Sublinhado">
                        <i data-lucide="underline" class="w-4 h-4"></i>
                    </button>
                    <div class="w-px h-4 bg-white/10 mx-1"></div>
                    <button type="button" class="editor-tool-btn" data-cmd="insertUnorderedList" title="Lista" aria-label="Lista">
                        <i data-lucide="list" class="w-4 h-4"></i>
                    </button>
                </div>

                <div id="comment-input-rich" role="textbox" aria-multiline="true" aria-label="Escrever comentário" aria-describedby="comment-editor-help" contenteditable="true" class="editor-content custom-scrollbar" placeholder="Escreva um comentário (use @ para mencionar)..."></div>

                <button id="add-comment-btn" aria-label="Enviar comentário" title="Enviar comentário" class="absolute bottom-3 right-3 p-2 bg-custom-darkest dark:bg-white text-white dark:text-custom-darkest rounded-xl hover:scale-110 active:scale-95 transition-all shadow-md z-10">
                    <i data-lucide="send" class="w-4 h-4"></i>
                </button>
            </div>
            <p id="comment-editor-help" class="sb-collab-help">Enter envia; Shift + Enter cria uma linha. Use @ para mencionar. O texto não enviado pode se perder ao fechar ou atualizar a tarefa.</p>
        `;
    }

    // =================================================================
    // 3. ANIMAÇÃO (MORPH/FLIP - Opacidade 1 Instantânea)
    // =================================================================
    
    const modal = document.getElementById('taskHistoryModal');
    const modalContent = modal.querySelector('.orb-glass-unified');
    const backdrop = modal; 

    activeOriginEl = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    if (!activeOriginEl || activeOriginEl.offsetParent === null) {
        activeOriginEl = document.querySelector(`.list-row[data-task-id="${taskId}"]`);
    }

    if (activeOriginEl) {
        activeOriginRect = activeOriginEl.getBoundingClientRect();
        activeOriginEl.style.opacity = '0'; 
    } else {
        activeOriginRect = null;
    }

    modal.classList.remove('hidden');
    backdrop.classList.remove('show'); 
    modalContent.style.transform = '';
    
    if (activeOriginRect) {
        const finalRect = modalContent.getBoundingClientRect(); 
        const deltaX = activeOriginRect.left - finalRect.left;
        const deltaY = activeOriginRect.top - finalRect.top;
        const scaleX = activeOriginRect.width / finalRect.width;
        const scaleY = activeOriginRect.height / finalRect.height;

        modalContent.style.transition = 'none';
        modalContent.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
        modalContent.style.opacity = '1'; 
        modalContent.style.borderRadius = '12px'; 
        modalContent.classList.add('animating-morph');

        requestAnimationFrame(() => {
            modalContent.getBoundingClientRect(); // Force reflow
            modalContent.style.transition = ''; 
            modalContent.style.transform = 'translate(0, 0) scale(1, 1)';
            modalContent.style.borderRadius = ''; 
            backdrop.classList.add('show'); 
            setTimeout(() => { modalContent.classList.remove('animating-morph'); }, 400); 
        });
    } else {
        modalContent.style.opacity = '1';
        backdrop.classList.add('show');
    }

    // =================================================================
    // 4. CONFIGURAÇÃO DE EVENTOS E EDITOR
    // =================================================================

    const closeBtn = document.getElementById('closeHistoryBtn');
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    newCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTaskHistory(taskId);
    });
    
    modal.onclick = (e) => {
        if (e.target === modal) closeTaskHistory(taskId);
    };

    if (window.lucide) lucide.createIcons();

    setupRichTextEditor();
    
    const sendBtn = document.getElementById('add-comment-btn');
    const editor = document.getElementById('comment-input-rich');

    if (sendBtn && editor) {
        sendBtn.onclick = async () => {
            const text = editor.innerHTML.trim(); 
            const cleanText = editor.innerText.trim();
            if (!cleanText && !text.includes('<img')) return; 

            const api = await import('./api.js');
            await api.addComment(taskId, { text: text, author: state.currentUser.email });
            
            editor.innerHTML = '';
            renderTaskHistory(taskId); 
        };
    }
}

// --- FUNÇÃO AUXILIAR: FECHAR MODAL ---

export function closeTaskHistory(taskId) {
    const modal = document.getElementById('taskHistoryModal');
    const modalContent = modal.querySelector('.orb-glass-unified');
    const backdrop = modal;
    const restoreHomeFocus = () => {
        if (state.currentView === 'home' && !state.returnToNotifications) {
            restoreHomeTaskFocus(document.getElementById('homeView'), taskId);
        }
    };

    if (isAnimating) return;
    isAnimating = true;

    backdrop.classList.remove('show');

    let currentOriginRect = activeOriginRect;
    if (activeOriginEl) {
        currentOriginRect = activeOriginEl.getBoundingClientRect();
    }

    if (currentOriginRect) {
        const currentModalRect = modalContent.getBoundingClientRect();
        const deltaX = currentOriginRect.left - currentModalRect.left;
        const deltaY = currentOriginRect.top - currentModalRect.top;
        const scaleX = currentOriginRect.width / currentModalRect.width;
        const scaleY = currentOriginRect.height / currentModalRect.height;

        modalContent.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
        modalContent.style.opacity = '0'; 
        modalContent.style.borderRadius = '12px';
        
        // Delay otimizado (300ms) para suavidade
        setTimeout(() => {
            if (activeOriginEl) activeOriginEl.style.opacity = '1';
            modal.classList.add('hidden');
            modalContent.style.transform = '';
            modalContent.style.opacity = '';
            modalContent.style.borderRadius = '';
            activeOriginRect = null;
            activeOriginEl = null;
            isAnimating = false;
            restoreHomeFocus();

            // NOVO: Volta para o modal de notificações se tiver vindo de lá
            if (state.returnToNotifications) {
                state.returnToNotifications = false; // Limpa o estado para os próximos cliques
                const notifModal = document.getElementById('notificationsModal');
                if (notifModal) {
                    notifModal.classList.remove('hidden');
                    requestAnimationFrame(() => {
                        notifModal.classList.add('show');
                    });
                }
            }
        }, 300); 
    } else {
        modal.classList.add('hidden');
        isAnimating = false;
        restoreHomeFocus();
        
        // Trata o caso em que o modal fecha sem origem animada
        if (state.returnToNotifications) {
            state.returnToNotifications = false;
            const notifModal = document.getElementById('notificationsModal');
            if (notifModal) {
                notifModal.classList.remove('hidden');
                requestAnimationFrame(() => {
                    notifModal.classList.add('show');
                });
            }
        }
    }
}

// --- SETUP DO RICH TEXT EDITOR COM MENÇÕES (@) ---

export function setupRichTextEditor() {
    const editor = document.getElementById('comment-input-rich');
    const btns = document.querySelectorAll('.editor-tool-btn');
    
    // 1. Garante que a caixa de sugestões exista e tenha estilos críticos
    let suggestionBox = document.getElementById('rich-mention-suggestions');
    if (!suggestionBox) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = 'rich-mention-suggestions';
        
        // Estilos Inline de Segurança (Garante visibilidade independente do CSS externo)
        Object.assign(suggestionBox.style, {
            position: 'fixed',
            zIndex: '99999',
            display: 'none',
            flexDirection: 'column',
            backgroundColor: 'rgba(15, 23, 42, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            minWidth: '220px',
            maxHeight: '250px',
            overflowY: 'auto',
            padding: '4px',
            backdropFilter: 'blur(12px)'
        });
        
        document.body.appendChild(suggestionBox); 
    }
    
    if (!editor) return;

    // 2. Toolbar Actions
    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); 
            const cmd = btn.dataset.cmd;
            document.execCommand(cmd, false, null);
            editor.focus();
            btn.classList.toggle('active');
            setTimeout(() => btn.classList.remove('active'), 200);
        });
    });

    // 3. Atalhos Básicos
    editor.addEventListener('keydown', (e) => {
        // Se Enter for pressionado sem Shift e o menu estiver visível, seleciona a primeira opção
        if (e.key === 'Enter' && !e.shiftKey) {
            if (suggestionBox.style.display !== 'none') {
                e.preventDefault();
                const firstItem = suggestionBox.querySelector('.mention-item');
                if (firstItem) firstItem.click();
            } else {
                e.preventDefault();
                document.getElementById('add-comment-btn').click();
            }
        }
        
        // Fecha menu com ESC
        if (e.key === 'Escape') {
            suggestionBox.style.display = 'none';
        }
    });

    // 4. Lógica de Menção Inteligente (@)
    editor.addEventListener('keyup', (e) => {
        // Do not reopen suggestions after dismissal or keyboard selection.
        if (e.key === 'Escape' || e.key === 'Enter') {
            suggestionBox.style.display = 'none';
            return;
        }
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        let textNode = range.startContainer;
        
        // Normalização: Se o foco estiver no DIV e não no texto (comum em editores vazios)
        if (textNode.nodeType !== Node.TEXT_NODE) {
            // Tenta encontrar o nó de texto dentro da seleção ou ignora se não houver conteúdo
            if (textNode.childNodes.length > 0 && textNode.childNodes[0].nodeType === Node.TEXT_NODE) {
                textNode = textNode.childNodes[0];
            } else {
                suggestionBox.style.display = 'none';
                return;
            }
        }

        // Pega o texto até o cursor
        const textBeforeCaret = textNode.textContent.substring(0, range.startOffset);
        
        // Regex Melhorada: Aceita espaços normais (\s) e Non-Breaking Spaces (\u00A0)
        const match = textBeforeCaret.match(/@([\w\sáàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ\u00A0]*)$/);

        if (match) {
            const query = match[1].trim().toLowerCase(); // Trim para evitar espaços extras na busca
            
            // Proteção contra state.users vazio
            const allUsers = state.users || [];
            
            const users = allUsers.filter(u => 
                u.name !== 'DEFINIR' && 
                u.name.toLowerCase().includes(query)
            );

            if (users.length > 0) {
                // Renderiza Lista
                suggestionBox.innerHTML = users.map(u => `
                    <button type="button" class="mention-item"
                         style="display: flex; align-items: center; gap: 10px; padding: 10px; cursor: pointer; color: white; border-radius: 8px; transition: background 0.2s;"
                         onmouseover="this.style.backgroundColor='rgba(56, 189, 248, 0.2)'" 
                         onmouseout="this.style.backgroundColor='transparent'"
                         data-email="${u.email}" 
                         data-name="${u.name}" 
                         data-pic="${u.picture || ''}">
                        <img src="${u.picture || 'https://i.imgur.com/6b6psVE.png'}" alt="" style="width: 24px; height: 24px; rounded-full; object-fit: cover; border-radius: 50%;">
                        <span style="font-size: 0.9rem; font-weight: 500;">${u.name}</span>
                    </button>
                `).join('');

                // Posiciona popup
                const rect = range.getBoundingClientRect();
                
                // Correção de posicionamento: Se rect for 0 (elemento oculto/bug), usa o editor
                const topPos = (rect.bottom === 0) ? editor.getBoundingClientRect().bottom : rect.bottom;
                const leftPos = (rect.left === 0) ? editor.getBoundingClientRect().left : rect.left;

                suggestionBox.style.display = 'flex';
                suggestionBox.style.top = `${topPos + 5}px`;
                suggestionBox.style.left = `${leftPos}px`;

                // Evento de Clique na Sugestão
                suggestionBox.querySelectorAll('.mention-item').forEach(item => {
                    item.onclick = (evt) => {
                        evt.preventDefault();
                        evt.stopPropagation();
                        insertMention(item, textNode, match.index, match[0].length);
                    };
                });
            } else {
                suggestionBox.style.display = 'none';
            }
        } else {
            suggestionBox.style.display = 'none';
        }
    });

    // Fecha ao clicar fora
    document.addEventListener('click', (e) => {
        if (suggestionBox && !suggestionBox.contains(e.target) && e.target !== editor) {
            suggestionBox.style.display = 'none';
        }
    });

    // Função interna para inserir a "pílula" de menção
    function insertMention(item, textNode, startIndex, lengthToReplace) {
        const name = item.dataset.name;
        const pic = item.dataset.pic || 'https://i.imgur.com/6b6psVE.png';
        const email = item.dataset.email;

        // 1. Corta o texto: remove o "@nome..." digitado
        const fullText = textNode.textContent;
        const before = fullText.substring(0, startIndex);
        const after = fullText.substring(startIndex + lengthToReplace);
        
        // Atualiza o nó de texto atual apenas com a parte anterior
        textNode.textContent = before;
        
        // 2. HTML da Pílula
        // The editor preserves whitespace: template indentation would become visible
        // newlines and move the caret below the mention. Keep only the trailing NBSP.
        const mentionHtml = `<span class="mention-tag" contenteditable="false" data-email="${email}" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38BDF8; padding: 2px 8px 2px 2px; border-radius: 99px; font-size: 0.85em; font-weight: 600; vertical-align: middle; user-select: none; margin: 0 2px;"><img src="${pic}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">@${name}</span>&nbsp;`;

        // 3. Insere a Pílula e o resto do texto
        const fragment = document.createRange().createContextualFragment(mentionHtml);
        const lastNode = fragment.lastChild; // O espaço &nbsp;
        
        // Se houver texto depois, cria um novo nó de texto
        if (after) {
            const afterNode = document.createTextNode(after);
            fragment.appendChild(afterNode);
        }

        // Insere tudo logo após o nó de texto original
        if (textNode.nextSibling) {
            textNode.parentNode.insertBefore(fragment, textNode.nextSibling);
        } else {
            textNode.parentNode.appendChild(fragment);
        }

        // 4. Move o cursor para depois do espaço
        const newRange = document.createRange();
        newRange.setStart(lastNode, lastNode.textContent.length); // Dentro do espaço após a menção
        newRange.collapse(true);
        
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(newRange);

        // 5. Limpa
        suggestionBox.style.display = 'none';
        editor.focus();
    }
}

// --- UTILITÁRIOS ---

export function highlightTask(taskId, temporary = true) {
    if (!taskId) return;
    document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
    
    const el = document.querySelector(`[data-task-id="${taskId}"]`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        el.classList.add('highlight');
        if (temporary) {
            setTimeout(() => el.classList.remove('highlight'), 2000);
        }
    }
}

// [CORREÇÃO] Adicionada animação de entrada e saída
export function showDestructiveConfirmModal(title, message, onConfirm, onCancel) {
    return showConfirmModal(title, message, onConfirm, onCancel, true);
}

export function showConfirmModal(title, message, onConfirm, onCancel, destructive = false) {
    const modal = document.getElementById('deleteConfirmModal');
    modal.querySelector('h2').textContent = title;
    modal.querySelector('p').textContent = message;
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.dataset.intent = destructive ? 'destructive' : 'confirm';
    newConfirmBtn.textContent = destructive ? 'Sim, remover' : 'Confirmar';
    const icon = document.getElementById('modal-icon');
    if (icon) {
        icon.setAttribute('data-lucide', destructive ? 'trash-2' : 'check-circle');
        icon.parentElement.classList.add('sb-confirm-icon');
        icon.parentElement.dataset.intent = destructive ? 'destructive' : 'confirm';
        if (window.lucide) lucide.createIcons();
    }
    
    // Função helper para fechar com animação
    const closeModal = (callback) => {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.classList.add('hidden');
            if (callback) callback();
        }, 300);
    };

    newConfirmBtn.onclick = () => {
        closeModal(onConfirm);
    };
    
    document.getElementById('cancelDeleteBtn').onclick = () => {
        closeModal(onCancel);
    };
    
    // Abrir com animação
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.add('show');
    });
}

export async function updateNotificationBadge() {
    const notifs = await fetchNotifications();
    const unread = notifs.filter(n => !n.isRead);
    const count = unread.length;
    
    const badgeOrb = document.getElementById('notification-badge-orb');
    const badgeMenu = document.getElementById('orb-notif-count');
    const badgeOrbExternal = document.getElementById('notification-orb-badge');
    
    // 1. Atualiza as bolinhas vermelhas de contagem
    if (count > 0) {
        if(badgeOrb) badgeOrb.classList.remove('hidden');
        if(badgeOrbExternal) badgeOrbExternal.classList.remove('hidden');
        if(badgeMenu) {
            badgeMenu.textContent = count > 9 ? '9+' : count;
            badgeMenu.classList.remove('hidden');
        }
    } else {
        if(badgeOrb) badgeOrb.classList.add('hidden');
        if(badgeOrbExternal) badgeOrbExternal.classList.add('hidden');
        if(badgeMenu) badgeMenu.classList.add('hidden');
        
        const avatarOrb = document.getElementById('orb-avatar-container');
        if (avatarOrb) avatarOrb.classList.add('active');
    }

    // 2. Renderiza a lista no Novo Modal
    const listContainer = document.getElementById('modal-notifications-list');
    if (!listContainer) return; // Proteção contra erros

    if (notifs.length === 0) {
        listContainer.innerHTML = `
            <div class="sb-empty"><h3>Nenhuma notificação disponível</h3><p>Sua lista de notificações está vazia.</p></div>
        `;
    } else {
        listContainer.innerHTML = notifs.map(n => notificationCard(n, formatDateTime(n.createdAt))).join('');

        if (window.lucide) lucide.createIcons();
        
        // 3. Lógica do Clique Coreografado
        listContainer.querySelectorAll('div[data-notif-id]').forEach(el => {
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    el.click();
                }
            });
            el.addEventListener('click', (e) => {
                const notifId = el.dataset.notifId;
                const taskId = el.dataset.taskId;
                
                // Dá feedback imediato (encolhe levemente o cartão)
                el.style.transform = 'scale(0.98)';
                el.style.opacity = '0.5';
                
                // Marca como lida
                if (!el.classList.contains('opacity-60')) {
                    markNotificationRead(notifId).then(() => updateNotificationBadge());
                }
                
                // Começa a fechar o modal das notificações
                const notifModal = document.getElementById('notificationsModal');
                if (notifModal) notifModal.classList.remove('show');
                
                // Espera 300ms (tempo da animação) e lança o modal da tarefa
                setTimeout(() => {
                    if (notifModal) notifModal.classList.add('hidden');
                    
                    if (state.tasks.find(t => t.id === taskId)) {
                        highlightTask(taskId);
                        
                        // O SEGREDO ESTÁ AQUI: O "true" avisa o sistema que o modal veio das notificações!
                        renderTaskHistory(taskId, true); 
                    } else {
                        showToast('Tarefa não encontrada (pode ter sido excluída).', 'error');
                    }
                }, 300);
            });
        });
    }
}

// --- AUTOCOMPLETE E INPUTS ---

export function setupCommentAutocomplete() {
    const input = document.getElementById('comment-input');
    if (!input) return;

    let box = document.getElementById('mention-suggestions');
    if (!box) {
        box = document.createElement('div');
        box.id = 'mention-suggestions';
        box.className = 'absolute bottom-16 left-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl hidden z-50 overflow-hidden';
        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(box);
    }

    input.addEventListener('keyup', (e) => {
        const val = input.value;
        const cursor = input.selectionStart;
        const lastAt = val.lastIndexOf('@', cursor - 1);
        
        if (lastAt !== -1) {
            const query = val.substring(lastAt + 1, cursor);
            if (query.includes(' ')) {
                box.classList.add('hidden');
                return;
            }
            
            const matches = state.users.filter(u => 
                u.name !== 'DEFINIR' && 
                u.name.toLowerCase().includes(query.toLowerCase())
            );

            if (matches.length > 0) {
                box.innerHTML = matches.map(u => `
                    <div class="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer text-sm text-custom-darkest dark:text-white" data-name="${u.name}">
                        <div class="w-5 h-5 rounded-full bg-custom-dark text-white flex items-center justify-center text-[10px]">${u.name.charAt(0)}</div>
                        <span>${u.name}</span>
                    </div>
                `).join('');
                box.classList.remove('hidden');
                
                box.querySelectorAll('div').forEach(el => {
                    el.onclick = () => {
                        const name = el.dataset.name;
                        const before = val.substring(0, lastAt);
                        const after = val.substring(cursor);
                        input.value = `${before}@${name} ${after}`;
                        box.classList.add('hidden');
                        input.focus();
                    };
                });
            } else {
                box.classList.add('hidden');
            }
        } else {
            box.classList.add('hidden');
        }
    });
}

export function setupResponsibleInput(initialResponsibles = []) {
    const container = document.getElementById('responsible-input-container');
    const input = document.getElementById('taskResponsible');
    const suggestions = document.getElementById('responsible-suggestions');
    let current = [...initialResponsibles];

    const renderTags = () => {
        Array.from(container.children).forEach(c => {
            if (c !== input) c.remove();
        });

        current.forEach(u => {
            const name = typeof u === 'object' ? u.name : u;
            const tag = document.createElement('div');
            tag.className = 'flex items-center gap-1 bg-white dark:bg-white/10 px-2 py-1 rounded-lg text-xs font-bold text-custom-darkest dark:text-white shadow-sm border border-gray-100 dark:border-gray-700 select-none';
            
            // Botão "X" corrigido (mantendo a correção anterior)
            tag.innerHTML = `
                <span>${name}</span>
                <button type="button" class="ml-0.5 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors focus:outline-none" title="Remover">
                    <i data-lucide="x" class="w-3 h-3"></i>
                </button>
            `;
            
            const btn = tag.querySelector('button');
            btn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                current = current.filter(x => (typeof x === 'object' ? x.name : x) !== name);
                renderTags();
            };
            
            container.insertBefore(tag, input);
        });
        
        if(window.lucide) lucide.createIcons();
    };

    const showSuggestions = () => {
        const val = input.value.toLowerCase();
        const source = state.users.filter(u => u.name !== 'DEFINIR');
        
        const matches = source.filter(u => {
            const isSelected = current.some(c => (typeof c === 'object' ? c.name : c) === u.name);
            if (isSelected) return false;
            if (!val) return true; 
            return u.name.toLowerCase().includes(val);
        });

        if (matches.length > 0) {
            suggestions.innerHTML = matches.map(u => `
                <div class="p-2 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer flex items-center gap-2 text-sm text-custom-darkest dark:text-white transition-colors">
                    <img src="${u.picture || 'https://i.imgur.com/6b6psVE.png'}" class="w-5 h-5 rounded-full object-cover">
                    ${u.name}
                </div>
            `).join('');

            suggestions.classList.remove('hidden');
            
            Array.from(suggestions.children).forEach((el, i) => {
                el.onclick = (e) => {
                    e.stopPropagation();
                    current.push(matches[i]);
                    input.value = '';
                    suggestions.classList.add('hidden');
                    renderTags();
                    
                    // CORREÇÃO AQUI: Removemos o input.focus()
                    // Isso impede que o menu abra novamente sozinho.
                    // O usuário terá que clicar no input para adicionar outro.
                };
            });
        } else {
            suggestions.classList.add('hidden');
        }
    };

    input.oninput = showSuggestions;
    input.onfocus = showSuggestions;
    input.onclick = (e) => { 
        e.stopPropagation(); 
        showSuggestions(); 
    };
    
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.classList.add('hidden');
        }
    });

    renderTags();
}

export function setupProjectSuggestions() {
    const input = document.getElementById('taskProject');
    const list = document.getElementById('project-suggestions');
    const colorInput = document.getElementById('taskProjectColor');
    const colorBtn = document.getElementById('color-picker-button');

    const projectMap = new Map();
    state.tasks.forEach(t => { 
        if(t.project) projectMap.set(t.project, t.projectColor); 
    });

    const setProjectLock = (locked, color = null) => {
        if(!colorBtn) return;
        // Tenta achar ícone, se não tiver (seu novo botão não tem), ignora
        const icon = colorBtn.querySelector('i'); 
        
        if (locked && color) {
            colorBtn.disabled = true;
            colorBtn.classList.add('cursor-not-allowed', 'opacity-80'); // Visual de bloqueado
            colorBtn.title = "Cor definida pelo projeto existente";
            if(icon) icon.setAttribute('data-lucide', 'lock');
            
            if(colorInput && colorInput.value !== color) {
                colorInput.value = color;
                colorInput.dispatchEvent(new Event('input')); 
            }
        } else {
            colorBtn.disabled = false;
            colorBtn.classList.remove('cursor-not-allowed', 'opacity-80');
            colorBtn.title = "Escolher cor";
            if(icon) icon.setAttribute('data-lucide', 'palette');
        }
        if(window.lucide) lucide.createIcons();
    };

    const checkLock = () => {
        const val = input.value;
        const lowerVal = val ? val.toLowerCase() : '';
        const exactMatch = Array.from(projectMap.keys()).find(p => p.toLowerCase() === lowerVal);
        
        if (exactMatch) {
            setProjectLock(true, projectMap.get(exactMatch));
        } else {
            setProjectLock(false);
        }
    };

    const showSuggestions = () => {
        checkLock();

        const val = input.value.toLowerCase();
        const allProjects = Array.from(projectMap.keys()).sort();
        
        // Filtra se tiver texto, senão mostra tudo
        const matches = val 
            ? allProjects.filter(p => p.toLowerCase().includes(val))
            : allProjects;
        
        if (matches.length > 0) {
            list.innerHTML = matches.map(p => `
                <div class="p-3 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer text-sm text-custom-darkest dark:text-white flex justify-between items-center transition-colors">
                    <span class="font-bold">${p}</span>
                    <span class="w-4 h-4 rounded-full shadow-sm border border-black/10" style="background-color: ${projectMap.get(p)}"></span>
                </div>
            `).join('');

            list.classList.remove('hidden');
            Array.from(list.children).forEach((el, i) => {
                el.onclick = (e) => {
                    e.stopPropagation();
                    const selectedProject = matches[i];
                    input.value = selectedProject;
                    setProjectLock(true, projectMap.get(selectedProject));
                    list.classList.add('hidden');
                };
            });
        } else {
            list.classList.add('hidden');
        }
    };

    input.oninput = showSuggestions;
    input.onfocus = showSuggestions; // Abre ao focar
    input.onclick = (e) => { 
        e.stopPropagation(); 
        showSuggestions(); // Abre ao clicar
    };
    
    checkLock();

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !list.contains(e.target)) list.classList.add('hidden');
    });
}

export function setupCustomColorPicker() {
    const btn = document.getElementById('color-picker-button');
    const bgPreview = document.getElementById('current-color-bg');
    const palette = document.getElementById('color-palette');
    const grid = document.getElementById('palette-grid');
    const input = document.getElementById('taskProjectColor');
    const hexDisplay = document.getElementById('hex-display');

    if (!btn || !palette || !grid || !input || !bgPreview) return;

    const presetColors = [
        '#64748B', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', 
        '#3B82F6', '#6366F1', '#8B5CF6', '#D946EF', '#F43F5E', '#526D82', '#27374D'
    ];

    const updateMainButton = (color) => {
        // CORREÇÃO 1: Cor sólida (100% visível)
        bgPreview.style.backgroundColor = color;
        bgPreview.style.opacity = '1'; 
        bgPreview.classList.remove('opacity-20'); 

        input.value = color;
        if(hexDisplay) hexDisplay.textContent = color.toUpperCase();
        
        // Ajusta contraste do ícone (Branco ou Escuro)
        const icon = btn.querySelector('i');
        if(icon) {
            const c = color.substring(1);
            const rgb = parseInt(c, 16);
            const r = (rgb >> 16) & 0xff;
            const g = (rgb >>  8) & 0xff;
            const b = (rgb >>  0) & 0xff;
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            icon.style.color = luma > 180 ? '#1e293b' : '#ffffff';
        }
    };

    grid.innerHTML = '';
    
    presetColors.forEach(color => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'w-8 h-8 rounded-full shadow-sm hover:scale-110 transition-transform border-2 border-transparent focus:outline-none focus:border-gray-400 dark:focus:border-white relative';
        swatch.style.backgroundColor = color;
        swatch.setAttribute('aria-label', `Cor ${color}`);
        swatch.title = color;
        swatch.onclick = (e) => {
            e.stopPropagation();
            updateMainButton(color);
            togglePalette(false);
        };
        grid.appendChild(swatch);
    });

    // Botão Arco-íris (Custom)
    const customBtn = document.createElement('button');
    customBtn.type = 'button';
    customBtn.setAttribute('aria-label', 'Escolher cor personalizada');
    customBtn.className = 'w-8 h-8 rounded-full shadow-sm hover:scale-110 transition-transform overflow-hidden flex items-center justify-center';
    customBtn.style.background = 'conic-gradient(from 180deg at 50% 50%, #FF0000 0deg, #00FFE0 120deg, #0000FF 240deg, #FF0000 360deg)';
    customBtn.innerHTML = '<i data-lucide="plus" class="w-4 h-4 text-white drop-shadow-md"></i>';
    customBtn.onclick = (e) => {
        e.stopPropagation();
        input.click();
        togglePalette(false);
    };
    grid.appendChild(customBtn);
    
    if(window.lucide) window.lucide.createIcons();

    const togglePalette = (show) => {
        if (show) {
            palette.classList.remove('hidden');
            setTimeout(() => {
                palette.classList.remove('scale-95', 'opacity-0');
                palette.classList.add('scale-100', 'opacity-100');
            }, 10);
        } else {
            palette.classList.remove('scale-100', 'opacity-100');
            palette.classList.add('scale-95', 'opacity-0');
            setTimeout(() => palette.classList.add('hidden'), 300);
        }
    };

    btn.onclick = (e) => {
        e.stopPropagation();
        if (btn.disabled) return; // Respeita o travamento
        togglePalette(palette.classList.contains('hidden'));
    };

    input.oninput = (e) => updateMainButton(e.target.value);
    
    // Inicializa
    updateMainButton(input.value || '#526D82');

    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !palette.contains(e.target)) {
            togglePalette(false);
        }
    });
}

// --- CONFIGURAÇÃO DE EVENTOS DO NOVO ORB DE ORDENAÇÃO ---

export function setupSortOrbEvents() {
    const orb = document.getElementById('orb-sort');
    if(!orb) return;

    // Expandir ao clicar no orb
    orb.addEventListener('click', (e) => {
        // Se clicar no botão de fechar, não faz nada (o listener do close cuida disso)
        if(e.target.closest('.close-btn')) return;
        
        if (!orb.classList.contains('expanded')) {
            orb.classList.add('expanded');
        }
    });

    // Fechar ao clicar no X
    const closeBtn = orb.querySelector('.close-btn');
    if(closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            orb.classList.remove('expanded');
        });
    }

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        if (orb.classList.contains('expanded') && !orb.contains(e.target)) {
            orb.classList.remove('expanded');
        }
    });
}

// --- MODAL DE ATUALIZAÇÃO DE PROGRESSO ---
export function openProgressUpdateModal(task) {
    // Evita abrir vários
    if (document.getElementById('progressUpdateModal')) return;

    const modal = document.createElement('div');
    modal.id = 'progressUpdateModal';
    modal.className = 'sb-task-dialog fixed inset-0 bg-custom-darkest/40 dark:bg-black/60 flex items-center justify-center z-[2000] animate-fade-in px-4';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'progress-modal-heading');
    modal.setAttribute('aria-describedby', 'progress-modal-help');
    
    modal.innerHTML = `
        <div class="orb-glass-unified backdrop-blur-[12px] w-full max-w-sm p-8 text-center relative shadow-2xl border border-white/20 dark:border-white/10 transform scale-95 opacity-0 transition-all duration-300" id="progressModalContent">
            
            <div class="w-16 h-16 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-500/20 shadow-inner">
                <i data-lucide="bar-chart-horizontal" class="w-8 h-8 text-blue-600 dark:text-blue-400"></i>
            </div>

            <h2 id="progress-modal-heading" class="text-xl font-extrabold text-custom-darkest dark:text-white mb-6 tracking-tight">Atualizar progresso</h2>
            <p id="progress-modal-help" class="sb-task-help">100% representa o progresso informado. A aprovação e a publicação são etapas separadas.</p>
            
            <div class="mb-5 text-left relative">
                <label for="progressInput" class="sb-task-label">Porcentagem (%)</label>
                <input type="number" id="progressInput" min="0" max="100" value="${task.progress || 0}" class="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-3 text-custom-darkest dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none text-xl font-bold text-center transition-all">
            </div>
            
            <div class="mb-8 text-left transition-opacity duration-300" id="missingTextContainer">
                <label for="missingInput" class="sb-task-label">
                    <span>O que falta para 100%?</span>
                    <i data-lucide="help-circle" class="w-3 h-3 opacity-50"></i>
                </label>
                <textarea id="missingInput" rows="2" aria-describedby="missing-input-help" class="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-3 text-custom-darkest dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none text-sm custom-scrollbar placeholder-custom-dark/40 dark:placeholder-white/30 resize-none transition-all" placeholder="Ex: Falta integrar a API de pagamentos...">${task.missingToComplete || ''}</textarea>
                <p id="missing-input-help" class="sb-task-help">Informe a pendência quando o progresso for menor que 100%.</p>
            </div>
            
            <div class="grid grid-cols-2 gap-3">
                <button type="button" id="cancelProgressBtn" class="py-3.5 px-4 rounded-xl font-bold text-sm bg-gray-500/10 hover:bg-gray-500/20 text-custom-darkest dark:text-white transition-colors border border-black/5 dark:border-white/5">Cancelar</button>
                <button type="button" id="saveProgressBtn" class="py-3.5 px-4 rounded-xl font-bold text-sm bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2"><i data-lucide="check" class="w-4 h-4"></i> Salvar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons({ root: modal });
    
    // Animação de entrada
    requestAnimationFrame(() => {
        const content = document.getElementById('progressModalContent');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });

    const progressInput = document.getElementById('progressInput');
    const missingContainer = document.getElementById('missingTextContainer');
    const missingInput = document.getElementById('missingInput');

    // Lógica UX: Desativar a caixa "o que falta" se o progresso for 100%
    progressInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (val > 100) e.target.value = 100;
        if (val < 0) e.target.value = 0;
        
        if (parseInt(e.target.value) === 100) {
            missingContainer.style.opacity = '0.3';
            missingInput.disabled = true;
            missingInput.value = 'Progresso informado: 100%';
        } else {
            missingContainer.style.opacity = '1';
            missingInput.disabled = false;
            if (missingInput.value === 'Progresso informado: 100%') missingInput.value = '';
        }
    });

    // Função de fecho suave
    const closeModal = () => {
        const content = document.getElementById('progressModalContent');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => modal.remove(), 300);
    };

    document.getElementById('cancelProgressBtn').onclick = closeModal;
    
    // Lógica de Guardar
    document.getElementById('saveProgressBtn').onclick = async () => {
        const newProgress = parseInt(progressInput.value) || 0;
        const newMissing = missingInput.value.trim();
        
        // Validação Inteligente
        if (newProgress < 100 && newMissing === '') {
            missingInput.classList.add('ring-2', 'ring-red-500', 'border-red-500');
            showToast('Informe o que falta para completar a tarefa!', 'error');
            setTimeout(() => missingInput.classList.remove('ring-2', 'ring-red-500', 'border-red-500'), 2000);
            return;
        }
        
        // Atualiza a Task no State Local
        task.progress = newProgress;
        task.missingToComplete = newProgress === 100 ? '' : newMissing;
        
        // Envia para o backend (usando o import dinâmico que usa no ui.js)
        try {
            const api = await import('./api.js');
            // Nota: Certifique-se que o seu updateTask na cloud aceita estes novos campos no JSON
            await api.updateTask(task.id, { 
                progress: task.progress, 
                missingToComplete: task.missingToComplete 
            });
            
            showToast('Progresso atualizado com sucesso!', 'success');
            
            // Re-renderiza o quadro
            updateActiveView(); 
            closeModal();
            
        } catch (error) {
            console.error(error);
            showToast('Erro ao atualizar o progresso.', 'error');
        }
    };
}