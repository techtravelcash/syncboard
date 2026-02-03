import { state } from './state.js';
import { markNotificationRead, fetchNotifications, fetchArchivedTasks } from './api.js';

// --- Funções Auxiliares de Formatação ---
export const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

export const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const getSortIndicator = (columnName) => {
    if (state.sortColumn !== columnName) return '';
    const icon = state.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down';
    return `<i data-lucide="${icon}" class="w-4 h-4 ml-1"></i>`;
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

// --- Função para Toasts ---
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const icons = {
        success: 'check-circle-2',
        error: 'alert-circle',
        info: 'info'
    };
    const colors = {
        success: 'bg-green-500 border-green-600',
        error: 'bg-red-500 border-red-600',
        info: 'bg-blue-500 border-blue-600'
    };

    toast.className = `toast flex items-center gap-3 text-white text-sm font-semibold px-4 py-3 rounded-lg shadow-2xl border-b-4 ${colors[type]}`;
    toast.innerHTML = `
        <i data-lucide="${icons[type]}" class="w-5 h-5"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('toast-exit');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

// --- Funções para Renderizar Anexos ---
function renderAttachmentList(containerId, attachments) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (attachments && attachments.length > 0) {
        attachments.forEach((file, index) => {
            const isLocalFile = file instanceof File;
            const fileName = isLocalFile ? file.name : (file.name || 'arquivo');
            const fileSize = isLocalFile ? `${(file.size / 1024).toFixed(1)} KB` : '';
            
            const blobName = !isLocalFile && file.url ? decodeURIComponent(file.url.split('/').pop()) : '';

            const item = document.createElement('div');
            item.className = 'attachment-item bg-custom-light/60 dark:bg-custom-dark/40 p-2 rounded-md flex items-center justify-between';
            item.innerHTML = `
                <div class="flex items-center gap-2 overflow-hidden">
                    <i data-lucide="file-text" class="w-5 h-5 text-custom-dark dark:text-custom-medium flex-shrink-0"></i>
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-sm font-medium truncate">${fileName}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">${fileSize}</span>
                    </div>
                </div>
                <div class="flex items-center flex-shrink-0">
                    ${!isLocalFile ? `<a href="${file.url || '#'}" target="_blank" class="p-1 text-blue-500 hover:text-blue-700"><i data-lucide="download-cloud" class="w-4 h-4"></i></a>` : ''}
                    <button type="button" class="remove-attachment-btn p-1 text-red-500 hover:text-red-700" data-index="${index}" data-blob-name="${blobName}">
                        <i data-lucide="x" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });
        lucide.createIcons();
    }
}

export function renderModalAttachments(files) {
    renderAttachmentList('attachment-list', files);
}

// --- Funções de Renderização da UI Principal ---
export const createTaskElement = (task) => {

    const taskCard = document.createElement('div');
    const overdueClass = isTaskOverdue(task) ? ' task-overdue' : '';
    taskCard.className = `task-card bg-base-white dark:bg-custom-darkest rounded-lg shadow-sm flex flex-col overflow-hidden fade-in ${overdueClass}`;
    taskCard.dataset.taskId = task.id;

    let responsibleDisplay = '';
    
    // Verifica se existem responsáveis
    if (Array.isArray(task.responsible) && task.responsible.length > 0) {
        
        const avatars = task.responsible.map(resp => {
            // 1. Normaliza o nome e busca a imagem
            const isObject = typeof resp === 'object' && resp !== null && resp.name;
            const name = isObject ? resp.name : resp;
            
            // BUSCA DINÂMICA: Tenta pegar a foto atualizada do state
            const userFromState = state.users.find(u => u.name === name);
            const picture = userFromState?.picture || (isObject ? resp.picture : null);

            // 2. Renderiza o avatar apropriado
            if (name === 'DEFINIR') {
                return `<div class="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold border-2 border-white dark:border-custom-darkest" title="A Definir">?</div>`;
            }
            
            if (picture) {
                return `<img src="${picture}" alt="${name}" class="w-6 h-6 rounded-full border-2 border-white dark:border-custom-darkest" title="${name}">`;
            }
            
            // Fallback: Bola colorida com a inicial
            return `<div class="w-6 h-6 rounded-full bg-custom-dark text-white flex items-center justify-center text-xs font-bold border-2 border-white dark:border-custom-darkest" title="${name}">${name.charAt(0)}</div>`;
        
        }).slice(0, 3).join(''); // Pega apenas os 3 primeiros

        // Contador para os restantes (+2, +3 etc)
        const remainingCount = task.responsible.length > 3 
            ? `<div class="w-6 h-6 rounded-full bg-custom-medium text-custom-darkest flex items-center justify-center text-xs font-bold border-2 border-white dark:border-custom-darkest">+${task.responsible.length - 3}</div>` 
            : '';
            
        responsibleDisplay = `<div class="flex -space-x-2">${avatars}${remainingCount}</div>`;
    }

    // Botões e Elementos Visuais do Card
    const approveButton = task.status === 'homologation' 
        ? `<button class="approve-btn bg-green-500/10 hover:bg-green-500/20 text-green-600 p-1.5 rounded-full" data-task-id="${task.id}" title="Aprovar e Arquivar"><i data-lucide="check-circle-2" class="w-5 h-5 pointer-events-none"></i></button>` 
        : '';

    const dueDateTag = task.dueDate 
        ? `<div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-custom-light dark:bg-custom-dark/50 px-2 py-0.5 rounded"><i data-lucide="calendar" class="w-3 h-3"></i><span>${formatDate(task.dueDate)}</span></div>` 
        : `<div class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-custom-dark/30 px-2 py-0.5 rounded"><i data-lucide="calendar-off" class="w-3 h-3"></i><span>Sem prazo definido</span></div>`;

    const attachmentIcon = (task.attachments && task.attachments.length > 0) 
        ? `<div class="flex items-center gap-1 text-xs text-custom-medium dark:text-custom-light font-semibold"><i data-lucide="paperclip" class="w-3 h-3"></i>${task.attachments.length}</div>` 
        : '';

    // Monta o HTML final do card
    taskCard.innerHTML = `
        <div class="flex flex-col justify-between w-full flex-grow">
            <div class="p-3">
                <div class="flex justify-between items-start gap-2">
                    <p class="text-custom-darkest dark:text-custom-light font-semibold pr-2 break-words">${task.title || ''}</p>
                </div>
                <div class="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-2">
                        <span class="font-mono text-xs font-bold text-custom-medium dark:text-custom-light">${task.id}</span>
                        ${dueDateTag}
                    </div>
                    ${attachmentIcon}
                </div>
            </div>
            <div class="px-3 py-2 border-t border-custom-light dark:border-custom-dark/50 flex justify-between items-center">
                ${responsibleDisplay}
                <div class="flex items-center gap-1">
                    ${approveButton}                   
                    <button class="info-btn text-custom-medium hover:text-custom-dark dark:hover:text-custom-light p-1.5 rounded-full transition-colors" data-task-id="${task.id}" title="Ver Detalhes"><i data-lucide="info" class="w-5 h-5 pointer-events-none"></i></button>
                    <a href="${task.azureLink || '#'}" target="_blank" class="${task.azureLink ? '' : 'hidden'} text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 p-1.5 rounded-full" title="Abrir no Azure"><i data-lucide="external-link" class="w-5 h-5 pointer-events-none"></i></a>
                    <button class="delete-btn text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-full transition-colors" data-task-id="${task.id}" title="Excluir"><i data-lucide="trash-2" class="w-5 h-5 pointer-events-none"></i></button>
                </div>
            </div>
        </div>
        <div class="h-auto w-full color-bar flex items-center justify-end px-3 py-0.5" style="background-color: ${task.projectColor || '#9DB2BF'};">
            <span class="text-white text-xs font-bold truncate">${task.project || ''}</span>
        </div>
    `;

    return taskCard;
};

export function renderKanbanView() {
    const kanbanViewEl = document.getElementById('kanbanView');
    kanbanViewEl.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');
    
    let activeTasks = state.tasks.filter(t => t.status !== 'done');
    
    // FILTROS
    if (state.selectedResponsible !== 'all') {
        activeTasks = activeTasks.filter(t => Array.isArray(t.responsible) && t.responsible.map(r => (typeof r === 'object' ? r.name : r)).includes(state.selectedResponsible));
    }
    if (state.selectedProject !== 'all') {
        activeTasks = activeTasks.filter(t => t.project === state.selectedProject);
    }
    // FILTRO DE BUSCA
    if (state.searchQuery) {
        activeTasks = activeTasks.filter(t =>
            (t.title && t.title.toLowerCase().includes(state.searchQuery)) ||
            (t.description && t.description.toLowerCase().includes(state.searchQuery)) ||
            (t.id && t.id.toLowerCase().includes(state.searchQuery))
        );
    }

    const columns = [ { id: 'todo', name: 'Fila' }, { id: 'stopped', name: 'Parado' }, { id: 'inprogress', name: 'Andamento' }, { id: 'homologation', name: 'Homologação' }];
    columns.forEach(col => {
        const columnEl = kanbanViewEl.querySelector(`.kanban-column:has([data-column-id="${col.id}"])`);
        if (columnEl) {
            const tasksForColumn = activeTasks.filter(t => t.status === col.id).sort((a, b) => a.order - b.order);
            const header = columnEl.querySelector('h2');
            const list = columnEl.querySelector('.task-list');
            header.innerHTML = `<span>${col.name}</span><span class="bg-custom-light dark:bg-custom-dark/80 text-custom-darkest dark:text-custom-light text-xs font-bold px-2 py-1 rounded-full">${tasksForColumn.length}</span>`;
            tasksForColumn.forEach(task => list.appendChild(createTaskElement(task)));
        }   
    });
    lucide.createIcons();
}

export function renderListView() {
    const listViewEl = document.getElementById('listView');
    let activeTasks = state.tasks.filter(t => t.status !== 'done');
    const statusLabels = { todo: 'Fila', stopped: 'Parado', inprogress: 'Em Andamento', homologation: 'Em Homologação', done: 'Pronto', edited: 'Editado' };
    
    // FILTROS
    if (state.selectedResponsible !== 'all') {
        activeTasks = activeTasks.filter(t => Array.isArray(t.responsible) && t.responsible.map(r => (typeof r === 'object' ? r.name : r)).includes(state.selectedResponsible));
    }
    if (state.selectedProject !== 'all') {
        activeTasks = activeTasks.filter(t => t.project === state.selectedProject);
    }
    // FILTRO DE BUSCA
    if (state.searchQuery) {
        activeTasks = activeTasks.filter(t =>
            (t.title && t.title.toLowerCase().includes(state.searchQuery)) ||
            (t.description && t.description.toLowerCase().includes(state.searchQuery)) ||
            (t.id && t.id.toLowerCase().includes(state.searchQuery))
        );
    }

    if (state.selectedResponsible !== 'all') {
        activeTasks.sort((a, b) => (a.order || 0) - (b.order || 0));
    } else {
        activeTasks.sort((a, b) => {
            const getFirstName = (respArray) => {
                if (!Array.isArray(respArray) || respArray.length === 0) return '';
                const firstResp = respArray[0];
                return typeof firstResp === 'object' ? firstResp.name : firstResp;
            };
            const valA = (state.sortColumn === 'responsible' ? getFirstName(a.responsible) : a[state.sortColumn]) || '';
            const valB = (state.sortColumn === 'responsible' ? getFirstName(b.responsible) : b[state.sortColumn]) || '';

            if (state.sortColumn === 'createdAt' || state.sortColumn === 'dueDate') {
                if (!valA) return 1; if (!valB) return -1;
                return state.sortDirection === 'asc' ? new Date(valA) - new Date(valB) : new Date(valB) - new Date(valA);
            }
            return state.sortDirection === 'asc' 
                ? String(valA).trim().toLowerCase().localeCompare(String(valB).trim().toLowerCase()) 
                : String(valB).trim().toLowerCase().localeCompare(String(valA).trim().toLowerCase());
        });
    }

    const isDraggable = state.selectedResponsible !== 'all';

    const tableBody = activeTasks.map(task => {
        const overdueClass = isTaskOverdue(task) ? ' bg-red-500/5 dark:bg-red-500/10' : '';
        let projectTag = task.project ? `<span class="text-xs font-semibold rounded px-2 py-1 text-white" style="background-color:${task.projectColor};">${task.project}</span>` : '';
        const attachmentIcon = (task.attachments && task.attachments.length > 0) ? `<div class="flex items-center gap-1 text-xs text-custom-medium dark:text-custom-light font-semibold"><i data-lucide="paperclip" class="w-4 h-4"></i>${task.attachments.length}</div>` : '';
        const responsibleNames = (task.responsible || []).map(r => (typeof r === 'object' ? r.name : r)).join(', ');

        return `
            <tr class="list-row hover:bg-custom-light/50 dark:hover:bg-custom-dark/50 fade-in${overdueClass}" data-task-id="${task.id}">
                <td class="px-3 py-3 text-center text-custom-medium ${isDraggable ? 'drag-handle cursor-grab' : 'opacity-50'}"><i data-lucide="grip-vertical" class="w-5 h-5 inline-block"></i></td>
                <td class="px-3 py-3 font-mono text-xs font-bold text-custom-medium dark:text-custom-light whitespace-nowrap">${task.id}</td>
                <td class="px-3 py-3">
                    <div class="text-custom-darkest dark:text-custom-light">${task.title}</div>
                </td>
                <td class="px-3 py-3 whitespace-nowrap">${projectTag}</td>
                <td class="px-3 py-3 whitespace-nowrap text-sm">${responsibleNames}</td>
                <td class="px-3 py-3 whitespace-nowrap">${attachmentIcon}</td>
                <td class="px-3 py-3 whitespace-nowrap"><span class="text-xs font-semibold rounded-full px-2.5 py-1 bg-custom-medium/50 dark:bg-custom-dark/80">${statusLabels[task.status] || task.status}</span></td>
                <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatDate(task.createdAt)}</td>
                <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${task.dueDate ? formatDate(task.dueDate) : 'Sem prazo'}</td>
                <td class="px-3 py-3 whitespace-nowrap"><div class="flex items-center gap-1">
                    <button class="info-btn text-custom-medium hover:text-custom-dark dark:hover:text-custom-light p-1.5 rounded-full" data-task-id="${task.id}" title="Ver detalhes"><i data-lucide="info" class="w-5 h-5 pointer-events-none"></i></button>
                    <a href="${task.azureLink || '#'}" target="_blank" rel="noopener noreferrer" class="${task.azureLink ? '' : 'hidden'} text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 p-1.5 rounded-full" title="Abrir no Azure DevOps"><i data-lucide="external-link" class="w-5 h-5 pointer-events-none"></i></a>
                    <button class="delete-btn text-red-400 hover:text-red-600 dark:hover:text-red-500 p-1.5 rounded-full" data-task-id="${task.id}" title="Excluir tarefa"><i data-lucide="trash-2" class="w-5 h-5 pointer-events-none"></i></button>
                </div></td>
            </tr>`;
    }).join('');

    const headerClass = isDraggable ? '' : 'cursor-pointer sortable-header';

    const tableHtml = `
        <div class="bg-base-white dark:bg-custom-darkest/40 rounded-lg shadow-sm overflow-hidden">
            <table class="min-w-full">
                <thead class="bg-custom-light/50 dark:bg-custom-darkest/60">
                    <tr>
                        <th class="px-3 py-3 w-12"></th>
                        <th class="px-3 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider ${headerClass}" data-sort-by="id"><div class="flex items-center">ID ${getSortIndicator('id')}</div></th>
                        <th class="px-3 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider ${headerClass}" data-sort-by="title"><div class="flex items-center gap-2"><span>Tarefa</span><span class="bg-custom-medium/50 dark:bg-custom-dark/80 text-custom-darkest dark:text-custom-light text-xs font-bold px-2 py-1 rounded-full">${activeTasks.length}</span>${getSortIndicator('title')}</div></th>
                        <th class="px-3 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider ${headerClass}" data-sort-by="project"><div class="flex items-center">Projeto ${getSortIndicator('project')}</div></th>
                        <th class="px-3 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider ${headerClass}" data-sort-by="responsible"><div class="flex items-center">Responsável ${getSortIndicator('responsible')}</div></th>
                        <th class="px-3 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider"><div class="flex items-center"><i data-lucide="paperclip" class="w-4 h-4"></i></div></th>
                        <th class="px-3 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider ${headerClass}" data-sort-by="status"><div class="flex items-center">Estado ${getSortIndicator('status')}</div></th>
                        <th class="px-3 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider ${headerClass}" data-sort-by="createdAt"><div class="flex items-center">Criação ${getSortIndicator('createdAt')}</div></th>
                        <th class="px-3 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider ${headerClass}" data-sort-by="dueDate"><div class="flex items-center">Previsão ${getSortIndicator('dueDate')}</div></th>
                        <th class="px-3 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider">Ações</th>
                    </tr>
                </thead>
                <tbody id="list-view-tbody" class="divide-y divide-custom-light dark:divide-custom-dark">${tableBody}</tbody>
            </table>
        </div>`;
    listViewEl.innerHTML = tableHtml;
    lucide.createIcons();
}

export function updateActiveView() {
    const viewSwitcherEl = document.getElementById('view-switcher');
    const kanbanViewEl = document.getElementById('kanbanView');
    const listViewEl = document.getElementById('listView');
    const archivedViewEl = document.getElementById('archivedView');
    const userManagementViewEl = document.getElementById('userManagementView');

    populateResponsibleFilter();
    populateProjectFilter();
    
    viewSwitcherEl.querySelectorAll('.view-btn').forEach(btn => {
        const isSelected = btn.dataset.view === state.currentView;
        btn.classList.toggle('bg-custom-darkest', isSelected);
        btn.classList.toggle('dark:bg-custom-light', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('dark:text-custom-darkest', isSelected);
        btn.classList.toggle('text-custom-dark', !isSelected);
        btn.classList.toggle('dark:text-custom-light', !isSelected);
    });

    kanbanViewEl.classList.toggle('hidden', state.currentView !== 'kanban');
    listViewEl.classList.toggle('hidden', state.currentView !== 'list');
    archivedViewEl.classList.toggle('hidden', state.currentView !== 'archived');
    userManagementViewEl.classList.toggle('hidden', state.currentView !== 'users');

    if (state.currentView === 'kanban') renderKanbanView();
    else if (state.currentView === 'list') renderListView();
    else if (state.currentView === 'archived') renderArchivedTasks();
    else if (state.currentView === 'users') renderUserManagementView();

    if (state.lastInteractedTaskId) {
        setTimeout(() => highlightTask(state.lastInteractedTaskId, state.currentView === 'kanban'), 0);
    }
}

export async function renderArchivedTasks() {
    const archivedViewEl = document.getElementById('archivedView');
    archivedViewEl.innerHTML = '<p class="text-center p-8">Carregando tarefas arquivadas...</p>';

    try {
        const archivedTasks = await fetchArchivedTasks();

        const tableBody = archivedTasks.map(task => {
            const responsibleNames = (task.responsible || []).map(r => (typeof r === 'object' ? r.name : r)).join(', ');
            return `
            <tr class="list-row hover:bg-custom-light/50 dark:hover:bg-custom-dark/50 fade-in" data-task-id="${task.id}">
                <td class="px-4 py-4">
                    <div class="font-semibold text-custom-darkest dark:text-custom-light">${task.title}</div>
                    <div class="text-xs text-custom-dark dark:text-custom-medium truncate" style="max-width: 300px;">${task.description}</div>
                </td>
                <td class="px-4 py-4 whitespace-nowrap">${task.project || ''}</td>
                <td class="px-4 py-4 whitespace-nowrap">${responsibleNames}</td>
                <td class="px-4 py-4 whitespace-nowrap">${formatDate(task.createdAt)}</td>
                <td class="px-4 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-1">
                        <button class="restore-btn text-blue-500 hover:text-blue-700 p-1.5 rounded-full" data-task-id="${task.id}" title="Restaurar Tarefa"><i data-lucide="undo-2" class="w-5 h-5 pointer-events-none"></i></button>
                        <button class="delete-btn text-red-400 hover:text-red-600 p-1.5 rounded-full" data-task-id="${task.id}" title="Excluir Tarefa Definitivamente"><i data-lucide="trash-2" class="w-5 h-5 pointer-events-none"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        const tableHtml = `
            <div class="bg-base-white dark:bg-custom-darkest/40 rounded-lg shadow-sm overflow-hidden">
                <table class="min-w-full">
                    <thead class="bg-custom-light/50 dark:bg-custom-darkest/60">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider"><div class="flex items-center gap-2"><span>Tarefa Concluída</span><span class="bg-custom-medium/50 dark:bg-custom-dark/80 text-custom-darkest dark:text-custom-light text-xs font-bold px-2 py-1 rounded-full">${archivedTasks.length}</span></div></th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider">Projeto</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider">Responsável</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider">Criação</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-custom-light dark:divide-custom-dark">
                        ${tableBody}
                        ${archivedTasks.length === 0 ? '<tr><td colspan="5" class="text-center py-10 text-custom-dark dark:text-custom-medium">Nenhuma tarefa arquivada.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>`;

        archivedViewEl.innerHTML = tableHtml;
        lucide.createIcons();
    } catch (error) {
        console.error("Erro ao renderizar tarefas arquivadas:", error);
        archivedViewEl.innerHTML = '<p class="text-center p-8 text-red-500">Falha ao carregar tarefas arquivadas.</p>';
    }
}

export function renderTaskHistory(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const statusLabels = { 
        todo: 'A fazer', 
        stopped: 'Parado', 
        inprogress: 'Em Andamento', 
        homologation: 'Em Homologação', 
        done: 'Pronto', 
        edited: 'Editado' 
    };

    const calendarBtn = document.getElementById('modal-calendar-btn');
    if (calendarBtn) {
        // 1. Coleta emails dos responsáveis
        const responsibleEmails = (task.responsible || [])
            .map(r => (typeof r === 'object' ? r.email : null))
            .filter(email => email)
            .join(',');

        // 2. Gera o Link
        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("SyncBoard Meet: " + task.title)}&details=${encodeURIComponent("Discussão sobre a tarefa: " + task.title + "\n\nProjeto: " + (task.project || "Geral"))}&add=${responsibleEmails}`;
        
        // 3. Atualiza o botão
        calendarBtn.href = googleUrl;
    }
    
    // 1. Preenchimento das Informações Básicas
    document.getElementById('modal-info-title').textContent = `${task.id}: ${task.title || ''}`;
    
    const projectTag = document.getElementById('modal-info-project');
    if (task.project) {
        projectTag.textContent = task.project;
        projectTag.style.color = task.projectColor;
    } else { 
        projectTag.textContent = ''; 
    }
    
    document.getElementById('modal-info-description').textContent = task.description;
    document.getElementById('modal-info-responsible').textContent = (task.responsible || []).map(r => (typeof r === 'object' ? r.name : r)).join(', ');

    // 2. Links, Datas e Anexos (Campos Opcionais)
    const linkContainer = document.getElementById('modal-info-azure-link-container');
    const linkEl = document.getElementById('modal-info-azure-link');
    if (task.azureLink) {
        linkEl.href = task.azureLink;
        linkEl.textContent = task.azureLink;
        linkContainer.classList.remove('hidden');
    } else { 
        linkContainer.classList.add('hidden'); 
    }
    
    const dueDateContainer = document.getElementById('modal-info-dueDate-container');
    const dueDateEl = document.getElementById('modal-info-dueDate');
    if (task.dueDate) {
        dueDateEl.textContent = formatDate(task.dueDate);
        dueDateContainer.classList.remove('hidden');
    } else { 
        dueDateContainer.classList.add('hidden'); 
    }

    const attachmentsContainer = document.getElementById('modal-info-attachments-container');
    if (task.attachments && task.attachments.length > 0) {
        renderAttachmentList('modal-info-attachments', task.attachments);
        attachmentsContainer.classList.remove('hidden');
    } else {
        attachmentsContainer.classList.add('hidden');
    }
    
    // 3. Renderizar Histórico do Sistema (Logs de Status)
    const historyFeedEl = document.getElementById('history-feed');
    if (historyFeedEl) {
        const historyItems = (task.history || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        historyFeedEl.innerHTML = historyItems.map(item => `
            <div class="flex items-start gap-3 opacity-80">
                <div class="mt-1 w-1.5 h-1.5 rounded-full bg-custom-medium shrink-0"></div>
                <div>
                    <p class="text-xs text-custom-darkest dark:text-custom-light">
                        Status alterado para <span class="font-semibold">${statusLabels[item.status] || item.status}</span>
                    </p>
                    <p class="text-[10px] text-custom-dark dark:text-custom-medium">${formatDateTime(item.timestamp)}</p>
                </div>
            </div>
        `).join('');
    }

    // 4. Renderizar Comentários (Interação Humana)
    const commentsFeedEl = document.getElementById('comments-feed');
    if (commentsFeedEl) {
        const commentItems = (task.comments || []).map((item, index) => ({ ...item, index }))
                                                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        commentsFeedEl.innerHTML = commentItems.length > 0 ? commentItems.map(item => {
            const authorName = item.author || 'Utilizador';
            const user = state.users.find(u => u.name === authorName || u.email === authorName);
            const authorPicture = user ? user.picture : (state.currentUser && state.currentUser.userDetails === authorName ? state.currentUser.claims.picture : null);
            
            const avatar = authorPicture
                ? `<img src="${authorPicture}" alt="${authorName}" class="w-7 h-7 mt-0.5 rounded-full">`
                : `<div class="w-7 h-7 mt-0.5 rounded-full bg-custom-dark text-white flex items-center justify-center text-xs font-bold">${authorName.charAt(0)}</div>`;

            return `
                <div class="flex items-start gap-3 group relative">
                    ${avatar}
                    <div class="flex-grow">
                        <div class="flex justify-between items-center">
                            <p class="font-bold text-sm text-custom-darkest dark:text-custom-light">${authorName}</p>
                            <p class="text-[10px] text-custom-dark dark:text-custom-medium">${formatDateTime(item.timestamp)}</p>
                        </div>
                        <div class="bg-custom-light dark:bg-custom-dark/50 p-3 rounded-lg mt-1">
                            <p class="text-sm text-custom-darkest dark:text-custom-light">${item.text}</p>
                        </div>
                    </div>
                    <button class="delete-comment-btn absolute -top-1 -right-1 p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" data-task-id="${taskId}" data-comment-index="${item.index}" title="Excluir comentário">
                        <i data-lucide="trash-2" class="w-3 h-3 pointer-events-none"></i>
                    </button>
                </div>`;
        }).join('') : '<p class="text-center text-sm text-custom-dark py-10 italic">Nenhum comentário ainda.</p>';
    }

    // 5. Lógica do Botão de Sinalização
    const headerButtonsContainer = document.querySelector('#taskHistoryModal .flex.items-center.gap-2');
    const oldSignalBtn = document.getElementById('signalBtn');
    if(oldSignalBtn) oldSignalBtn.remove();

    const signalBtn = document.createElement('button');
    signalBtn.id = 'signalBtn';
    signalBtn.className = 'p-2 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors';
    signalBtn.title = 'Sinalizar Responsável (Enviar Alerta)';
    signalBtn.innerHTML = '<i data-lucide="megaphone" class="w-5 h-5"></i>';
    signalBtn.onclick = () => {
        showConfirmModal(
            'Sinalizar Responsável',
            'Deseja realmente enviar um alerta de atenção para os responsáveis desta tarefa?',
            async () => {
                try {
                    const apiModule = await import('./api.js');
                    await apiModule.signalResponsible(taskId);
                    showToast('Responsável sinalizado com sucesso!', 'success');
                } catch (e) {
                    console.error(e);
                    showToast('Erro ao sinalizar.', 'error');
                }
            },
            null,           // onCancel
            'Sinalizar',    // Texto do botão confirmar
            'Voltar',       // Texto do botão cancelar
            'megaphone'     // ÍCONE
        );
    };

    const closeBtn = document.getElementById('closeHistoryBtn');
    if (headerButtonsContainer && closeBtn) {
        headerButtonsContainer.insertBefore(signalBtn, closeBtn);
    }
    
    // 6. Exibição do Modal e Ícones
    document.getElementById('taskHistoryModal').classList.remove('hidden');
    lucide.createIcons();
}

export function highlightTask(taskId, temporary = true) {
    document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
    if (!taskId) return;
    const selector = `.task-card[data-task-id="${taskId}"], .list-row[data-task-id="${taskId}"]`;
    const elementToHighlight = document.querySelector(selector);
    if (elementToHighlight) {
        elementToHighlight.classList.add('highlight');
        if (temporary) {
            setTimeout(() => {
                elementToHighlight.classList.remove('highlight');
            }, 2500);
        }
    }
}

export function populateResponsibleFilter() {
    const panel = document.getElementById('responsible-filter-panel');
    const responsibles = [...new Set(state.tasks.flatMap(t => t.responsible || []).map(r => (typeof r === 'object' ? r.name : r)).filter(Boolean))].sort();
    
    panel.innerHTML = '<div class="p-2"><button data-value="all" class="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-custom-light dark:hover:bg-custom-dark">Todos os Responsáveis</button></div>';

    responsibles.forEach(r => {
        panel.querySelector('.p-2').innerHTML += `<button data-value="${r}" class="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-custom-light dark:hover:bg-custom-dark">${r}</button>`;
    });
}

export function populateProjectFilter() {
    const panel = document.getElementById('project-filter-panel');
    const projects = [...new Set(state.tasks.map(t => t.project).filter(Boolean))].sort();

    panel.innerHTML = '<div class="p-2"><button data-value="all" class="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-custom-light dark:hover:bg-custom-dark">Todos os Projetos</button></div>';
    
    projects.forEach(p => {
        panel.querySelector('.p-2').innerHTML += `<button data-value="${p}" class="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-custom-light dark:hover:bg-custom-dark">${p}</button>`;
    });
}

export function setupResponsibleInput(initialResponsibles = []) {
    const container = document.getElementById('responsible-input-container');
    const input = document.getElementById('taskResponsible');
    const suggestionsContainer = document.getElementById('responsible-suggestions');
    let currentResponsibles = [...initialResponsibles];

    const renderTags = () => {
        container.querySelectorAll('.responsible-tag').forEach(tag => tag.remove());
        currentResponsibles.forEach(user => {
            const tag = document.createElement('div');
            tag.className = 'responsible-tag';
            
            const name = typeof user === 'object' ? user.name : user;
            const picture = typeof user === 'object' ? user.picture : null;
            
            const avatar = picture
                ? `<img src="${picture}" class="w-5 h-5 rounded-full">`
                : `<div class="w-5 h-5 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold">${name === 'DEFINIR' ? '?' : name.charAt(0)}</div>`;

            tag.innerHTML = `${avatar}<span>${name}</span>`;
            
            const removeBtn = document.createElement('span');
            removeBtn.className = 'tag-remove-btn';
            removeBtn.innerHTML = `<i data-lucide="x" class="w-3 h-3 pointer-events-none"></i>`;
            removeBtn.onclick = () => {
                currentResponsibles = currentResponsibles.filter(r => (typeof r === 'object' ? r.name : r) !== name);
                renderTags();
            };
            tag.appendChild(removeBtn);
            container.insertBefore(tag, input);
        });
        lucide.createIcons();
    };

    const addResponsible = (user) => {
        if (user && !currentResponsibles.some(r => (typeof r === 'object' ? r.name : r) === user.name)) {
            currentResponsibles.push(user);
            renderTags();
        }
        input.value = '';
        suggestionsContainer.classList.add('hidden');
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const matchingUser = state.users.find(u => u.name.toLowerCase() === input.value.trim().toLowerCase());
            if(matchingUser) addResponsible(matchingUser);
        }
        if (e.key === 'Backspace' && input.value === '' && currentResponsibles.length > 0) {
            currentResponsibles.pop();
            renderTags();
        }
    });

    const showSuggestions = (filteredData) => {
        suggestionsContainer.innerHTML = '';
        if (filteredData.length === 0) {
            suggestionsContainer.classList.add('hidden');
            return;
        }
        filteredData.forEach(user => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'p-2 cursor-pointer hover:bg-custom-light dark:hover:bg-custom-dark flex items-center gap-2';
            
            const avatar = user.picture
                ? `<img src="${user.picture}" class="w-6 h-6 rounded-full">`
                : `<div class="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold">${user.name === 'DEFINIR' ? '?' : user.name.charAt(0)}</div>`;

            suggestionItem.innerHTML = `${avatar}<span>${user.name}</span>`;
            suggestionItem.addEventListener('mousedown', (e) => {
                e.preventDefault();
                addResponsible(user);
                setTimeout(() => input.focus(), 0);
            });
            suggestionsContainer.appendChild(suggestionItem);
        });
        suggestionsContainer.classList.remove('hidden');
    };

    const updateSuggestions = () => {
        const query = input.value.trim().toLowerCase();
        const availableSuggestions = state.users.filter(u => !currentResponsibles.some(r => (typeof r === 'object' ? r.name : r) === u.name));
        
        if (query === '') {
            showSuggestions(availableSuggestions);
        } else {
            const filtered = availableSuggestions.filter(u => u.name.toLowerCase().includes(query));
            showSuggestions(filtered);
        }
    };

    input.addEventListener('focus', updateSuggestions);
    input.addEventListener('input', updateSuggestions);
    document.addEventListener('click', (e) => {
        if (!container.parentElement.contains(e.target)) {
            suggestionsContainer.classList.add('hidden');
        }
    });

    renderTags();
};

export function setupProjectSuggestions() {
    const input = document.getElementById('taskProject');
    const suggestionsContainer = document.getElementById('project-suggestions');
    const colorInput = document.getElementById('taskProjectColor');
    const colorButton = document.getElementById('color-picker-button');
    
    const projects = new Map();
    state.tasks.forEach(task => {
        if (task.project && !projects.has(task.project)) {
            projects.set(task.project, task.projectColor);
        }
    });
    const allProjects = Array.from(projects.keys());

    const selectProject = (name) => {
        const projectName = name.trim();
        input.value = projectName;
        suggestionsContainer.classList.add('hidden');
        
        if (projects.has(projectName)) {
            const existingColor = projects.get(projectName);
            colorInput.value = existingColor;
            colorButton.style.backgroundColor = existingColor;
        }
    };

    const showSuggestions = (filteredData) => {
        suggestionsContainer.innerHTML = '';
        if (filteredData.length === 0) {
            suggestionsContainer.classList.add('hidden');
            return;
        }
        filteredData.forEach(name => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'p-2 cursor-pointer hover:bg-custom-light dark:hover:bg-custom-dark';
            suggestionItem.textContent = name;
            suggestionItem.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectProject(name);
            });
            suggestionsContainer.appendChild(suggestionItem);
        });
        suggestionsContainer.classList.remove('hidden');
    };

    const updateSuggestions = () => {
        const query = input.value.toLowerCase();
        const filtered = allProjects.filter(name => name.toLowerCase().includes(query));
        showSuggestions(filtered);
    };

    input.addEventListener('focus', updateSuggestions);
    input.addEventListener('input', updateSuggestions);
    input.addEventListener('blur', () => {
        setTimeout(() => {
            suggestionsContainer.classList.add('hidden');
        }, 200);
    });
};

export function setupCustomColorPicker() {
    const colorInput = document.getElementById('taskProjectColor');
    const colorButton = document.getElementById('color-picker-button');
    const colorPalette = document.getElementById('color-palette');
    const nativePickerTrigger = document.getElementById('native-color-picker-trigger');
    const colors = ['#526D82', '#9DB2BF', '#27374D', '#1D5B79', '#468B97', '#EF6262', '#F3AA60', '#F9D949', '#68B984', '#3D5656', '#A25B5B', '#635985'];
    
    colorPalette.innerHTML = colors.map(color => `<div class="w-full h-8 rounded-md cursor-pointer color-swatch" style="background-color: ${color};" data-color="${color}"></div>`).join('');
    
    const syncColor = () => { colorButton.style.backgroundColor = colorInput.value; };
    
    colorButton.addEventListener('click', () => colorPalette.classList.toggle('hidden'));
    colorPalette.addEventListener('click', (e) => {
        const swatch = e.target.closest('.color-swatch');
        if (swatch) {
            colorInput.value = swatch.dataset.color;
            syncColor();
            colorPalette.classList.add('hidden');
        }
    });
    nativePickerTrigger.addEventListener('click', () => colorInput.click());
    colorInput.addEventListener('input', syncColor);
    syncColor();
};

export function renderUserManagementView() {
    const userManagementViewEl = document.getElementById('userManagementView');
    // Filtramos o utilizador 'DEFINIR' para não aparecer na gestão
    const allUsers = state.users.filter(u => u.name !== 'DEFINIR');

    const userRows = allUsers.map(user => `
        <tr class="hover:bg-custom-light/50 dark:hover:bg-custom-dark/50">
            <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                    <img src="${user.picture || 'https://i.imgur.com/6b6psVE.png'}" class="w-8 h-8 rounded-full">
                    <div>
                        <div class="font-semibold text-custom-darkest dark:text-custom-light">${user.name}</div>
                        <div class="text-sm text-custom-dark dark:text-custom-medium">${user.email}</div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3">
                ${user.isAdmin ? '<span class="text-xs font-semibold rounded-full px-2.5 py-1 bg-purple-200 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">Admin</span>' : '<span class="text-xs text-gray-500">Utilizador</span>'}
            </td>
            <td class="px-4 py-3 text-right">
                <button class="delete-user-btn text-red-400 hover:text-red-600 dark:hover:text-red-500 p-1.5 rounded-full transition-colors" data-user-id="${user.id || user.email}" title="Eliminar Utilizador">
                    <i data-lucide="trash-2" class="w-5 h-5 pointer-events-none"></i>
                </button>
            </td>
        </tr>
    `).join('');

    userManagementViewEl.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="md:col-span-2">
                <h2 class="text-2xl font-bold mb-4 text-custom-darkest dark:text-custom-light">Utilizadores Cadastrados</h2>
                <div class="bg-base-white dark:bg-custom-darkest/40 rounded-lg shadow-sm overflow-hidden">
                    <table class="min-w-full">
                        <thead class="bg-custom-light/50 dark:bg-custom-darkest/60">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider">Utilizador</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider">Permissões</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-custom-dark dark:text-custom-light uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-custom-light dark:divide-custom-dark">
                            ${userRows}
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h2 class="text-2xl font-bold mb-4 text-custom-darkest dark:text-custom-light">Adicionar Novo Utilizador</h2>
                <form id="addUserForm" class="bg-base-white dark:bg-custom-darkest/40 rounded-lg shadow-sm p-6 space-y-4">
                    <div>
                        <label for="newUserName" class="block text-sm font-bold mb-2 text-custom-dark dark:text-custom-medium">Nome Completo</label>
                        <input type="text" id="newUserName" required class="w-full bg-transparent border border-custom-medium dark:border-custom-dark rounded-lg py-2 px-3 text-custom-darkest dark:text-custom-light focus:ring-2 focus:ring-custom-dark focus:outline-none">
                    </div>
                    <div>
                        <label for="newUserEmail" class="block text-sm font-bold mb-2 text-custom-dark dark:text-custom-medium">E-mail (@travelcash.me)</label>
                        <input type="email" id="newUserEmail" required class="w-full bg-transparent border border-custom-medium dark:border-custom-dark rounded-lg py-2 px-3 text-custom-darkest dark:text-custom-light focus:ring-2 focus:ring-custom-dark focus:outline-none">
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="checkbox" id="newUserIsAdmin" class="h-4 w-4 rounded border-gray-300 text-custom-dark focus:ring-custom-dark">
                        <label for="newUserIsAdmin" class="text-sm font-medium text-custom-darkest dark:text-custom-light">Conceder permissões de Administrador</label>
                    </div>
                    <button type="submit" class="w-full bg-custom-darkest hover:bg-opacity-90 dark:bg-custom-light dark:text-custom-darkest dark:hover:bg-opacity-90 text-white font-bold py-2 px-4 rounded-lg transition-colors">Adicionar Utilizador</button>
                </form>
            </div>
        </div>
    `;
    lucide.createIcons();
}

export function showConfirmModal(title, message, onConfirm, onCancel = null, confirmLabel = 'Excluir', cancelLabel = 'Cancelar', iconName = 'trash-2') {
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const confirmTitle = deleteConfirmModal.querySelector('h2');
    const confirmMessage = deleteConfirmModal.querySelector('p');
    const confirmButton = document.getElementById('confirmDeleteBtn');
    const cancelButton = document.getElementById('cancelDeleteBtn');

    const iconElement = document.getElementById('modal-icon');
    if (iconElement) {
        iconElement.setAttribute('data-lucide', iconName);
    }

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;

    // Atualiza o texto dos botões
    confirmButton.textContent = confirmLabel;
    cancelButton.textContent = cancelLabel;

    confirmButton.onclick = () => {
        onConfirm();
        deleteConfirmModal.classList.add('hidden');
    };
    cancelButton.onclick = () => {
        if (onCancel) onCancel();
        deleteConfirmModal.classList.add('hidden');
    };
    
    deleteConfirmModal.classList.remove('hidden');


    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// --- ATUALIZAR LISTA DE NOTIFICAÇÕES ---
export async function updateNotificationBadge() {
    const notifications = await fetchNotifications();
    const unreadCount = notifications.filter(n => !n.isRead).length;
    
    const badge = document.getElementById('notification-badge');
    const list = document.getElementById('notification-list');
    
    if (unreadCount > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    list.innerHTML = '';
    if (notifications.length === 0) {
        list.innerHTML = '<p class="p-6 text-center text-sm text-gray-500">Você não tem notificações.</p>';
        return;
    }

    notifications.forEach(notif => {
        const item = document.createElement('div');
        // Estilo diferente se não lida
        const bgClass = notif.isRead ? 'bg-transparent opacity-70' : 'bg-blue-50 dark:bg-blue-900/20';
        item.className = `p-3 border-b border-custom-light dark:border-custom-dark hover:bg-gray-100 dark:hover:bg-custom-dark/40 cursor-pointer transition-colors ${bgClass}`;
        
        item.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="mt-1 bg-custom-dark text-white rounded-full p-1.5 shrink-0"><i data-lucide="at-sign" class="w-3 h-3"></i></div>
                <div>
                    <p class="text-xs font-bold text-custom-darkest dark:text-custom-light">${notif.message}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 italic line-clamp-2">"${notif.commentPreview}"</p>
                    <p class="text-[10px] text-gray-400 mt-1">${new Date(notif.createdAt).toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;
        
        item.addEventListener('click', async () => {
            // 1. Marca como lida
            if (!notif.isRead) {
                await markNotificationRead(notif.id);
                updateNotificationBadge(); // Atualiza contador
            }
            // 2. Abre a tarefa
            const task = state.tasks.find(t => t.id === notif.taskId);
            if (task) {
                state.lastInteractedTaskId = task.id;
                // Fecha dropdown
                document.getElementById('notification-dropdown').classList.add('hidden');
                
                // Abre modal usando a função existente
                highlightTask(task.id, false);
                renderTaskHistory(task.id);
            } else {
                showToast('A tarefa não foi encontrada (pode ter sido excluída).', 'error');
            }
        });
        
        list.appendChild(item);
    });
    lucide.createIcons();
}

// --- AUTOCOMPLETE NO COMENTÁRIO (@) ---
export function setupCommentAutocomplete() {
    const input = document.getElementById('comment-input');
    if (!input) return; 

    // Cria o container de sugestão se não existir e anexa ao pai do input
    let suggestionBox = document.getElementById('comment-suggestions');
    if (!suggestionBox) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = 'comment-suggestions';
        suggestionBox.className = 'absolute bottom-16 left-0 w-64 bg-white dark:bg-custom-darkest border border-custom-medium dark:border-custom-dark rounded-md shadow-xl hidden z-[60] max-h-40 overflow-y-auto';
        input.parentNode.style.position = 'relative'; // Garante posicionamento relativo
        input.parentNode.appendChild(suggestionBox);
    }

    input.addEventListener('keyup', (e) => {
        const cursorPosition = input.selectionStart;
        const textBeforeCursor = input.value.substring(0, cursorPosition);
        const lastAt = textBeforeCursor.lastIndexOf('@');
        
        if (lastAt !== -1) {
            const query = textBeforeCursor.substring(lastAt + 1);
            // Se houver espaço, assume que parou de digitar o nome
            if (query.includes(' ')) {
                suggestionBox.classList.add('hidden');
                return;
            }

            // Filtra usuários (excluindo 'DEFINIR')
            const matches = state.users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()) && u.name !== 'DEFINIR');
            
            if (matches.length > 0) {
                suggestionBox.innerHTML = '';
                matches.forEach(user => {
                    const div = document.createElement('div');
                    div.className = 'p-2 hover:bg-custom-light dark:hover:bg-custom-dark cursor-pointer flex items-center gap-2 text-sm text-custom-darkest dark:text-custom-light';
                    
                    const avatar = user.picture 
                        ? `<img src="${user.picture}" class="w-5 h-5 rounded-full">` 
                        : `<div class="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center text-[10px] text-white">${user.name.charAt(0)}</div>`;

                    div.innerHTML = `${avatar}<span class="font-bold">@${user.name}</span>`;
                    
                    div.onmousedown = (evt) => { // Usar onmousedown previne perder foco antes do clique
                        evt.preventDefault();
                        const textAfterCursor = input.value.substring(cursorPosition);
                        const newText = input.value.substring(0, lastAt) + `@${user.name} ` + textAfterCursor;
                        input.value = newText;
                        suggestionBox.classList.add('hidden');
                        input.focus();
                    };
                    suggestionBox.appendChild(div);
                });
                suggestionBox.classList.remove('hidden');
            } else {
                suggestionBox.classList.add('hidden');
            }
        } else {
            suggestionBox.classList.add('hidden');
        }
    });
}