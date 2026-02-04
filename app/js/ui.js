import { state } from './state.js';
import { markNotificationRead, fetchNotifications, fetchArchivedTasks } from './api.js';

// --- HELPERS E FORMATAÇÃO ---

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

// --- TOASTS / NOTIFICAÇÕES VISUAIS ---

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const styles = {
        success: 'bg-custom-darkest text-white border-l-4 border-green-500',
        error:   'bg-red-600 text-white border-l-4 border-white',
        info:    'bg-white text-custom-darkest border-l-4 border-custom-dark shadow-xl'
    };

    toast.className = `min-w-[300px] p-4 rounded-r-xl shadow-2xl flex items-center gap-3 toast-enter ${styles[type]}`;
    
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

function renderAttachmentList(containerId, attachments) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (attachments && attachments.length > 0) {
        attachments.forEach((file, index) => {
            const isLocalFile = file instanceof File;
            const fileName = isLocalFile ? file.name : (file.name || 'documento');
            const blobName = !isLocalFile && file.url ? decodeURIComponent(file.url.split('/').pop()) : '';

            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2 bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-lg group hover:border-custom-medium/50 transition-colors';
            
            const downloadLink = !isLocalFile ? `
                <a href="${file.url}" target="_blank" class="text-blue-500 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Baixar">
                    <i data-lucide="download-cloud" class="w-4 h-4"></i>
                </a>
            ` : '';

            item.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="bg-gray-100 dark:bg-gray-700 p-1.5 rounded-md text-gray-500 dark:text-gray-300">
                        <i data-lucide="file-text" class="w-4 h-4"></i>
                    </div>
                    <span class="text-xs font-medium truncate text-custom-darkest dark:text-gray-200">${fileName}</span>
                </div>
                <div class="flex items-center gap-1">
                    ${downloadLink}
                    <button type="button" class="remove-attachment-btn text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" data-index="${index}" data-blob-name="${blobName}" title="Remover">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
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

// --- RENDERIZAÇÃO: CARD DE TAREFA ---

export const createTaskElement = (task) => {
    const taskCard = document.createElement('div');
    const isOverdue = isTaskOverdue(task);
    
    let cardClasses = 'task-card bg-white dark:bg-[#27374d] p-5 rounded-[20px] shadow-sm hover:shadow-lg relative flex flex-col gap-3 group border border-transparent hover:border-custom-medium/20';
    
    if (isOverdue) {
        cardClasses += ' border-l-[6px] border-l-red-500';
    }

    taskCard.className = cardClasses;
    taskCard.dataset.taskId = task.id;

    // Badge do Projeto
    const projectColor = task.projectColor || '#9DB2BF';
    const projectBadge = task.project 
        ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm" style="background-color: ${projectColor}">${task.project}</span>`
        : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 dark:bg-gray-700">Geral</span>`;

    // Avatares
    let responsibleDisplay = '';
    if (task.responsible && task.responsible.length > 0) {
        const avatars = task.responsible.slice(0, 3).map(r => {
            const name = typeof r === 'object' ? r.name : r;
            const pic = typeof r === 'object' ? r.picture : null;
            const userState = state.users.find(u => u.name === name);
            const finalPic = userState?.picture || pic;

            if (finalPic) {
                return `<img src="${finalPic}" class="w-6 h-6 rounded-full border-2 border-white dark:border-[#1f2937] object-cover" title="${name}">`;
            }
            return `<div class="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-[#1f2937] flex items-center justify-center text-[9px] font-bold text-gray-600 dark:text-gray-200" title="${name}">${name.charAt(0)}</div>`;
        }).join('');
        
        const extra = task.responsible.length > 3 ? `<div class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-[#1f2937] flex items-center justify-center text-[9px] font-bold text-gray-500">+${task.responsible.length - 3}</div>` : '';
        responsibleDisplay = `<div class="flex -space-x-2">${avatars}${extra}</div>`;
    }

    // Indicadores
    const attachmentIcon = (task.attachments?.length > 0) 
        ? `<div class="flex items-center gap-1 text-gray-400 text-xs"><i data-lucide="paperclip" class="w-3 h-3"></i><span>${task.attachments.length}</span></div>` 
        : '';
    
    let dateBadge = '';
    if(task.dueDate) {
        const dateText = formatDate(task.dueDate);
        const dateColorClass = isOverdue ? 'text-red-500 font-bold' : 'text-gray-400';
        dateBadge = `<div class="flex items-center gap-1 ${dateColorClass} text-xs" title="Prazo"><i data-lucide="calendar" class="w-3 h-3"></i><span>${dateText}</span></div>`;
    }

    const quickActions = `
        <div class="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="info-btn p-1.5 rounded-lg text-gray-400 hover:text-custom-dark hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" title="Ver Detalhes" data-task-id="${task.id}">
                <i data-lucide="maximize-2" class="w-4 h-4 pointer-events-none"></i>
            </button>
            ${task.status === 'homologation' ? `<button class="approve-btn p-1.5 rounded-lg text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="Aprovar" data-task-id="${task.id}"><i data-lucide="check" class="w-4 h-4 pointer-events-none"></i></button>` : ''}
        </div>
    `;

    taskCard.innerHTML = `
        <div class="flex justify-between items-start pr-12">
            ${projectBadge}
        </div>
        ${quickActions}
        <h3 class="text-sm font-bold text-custom-darkest dark:text-gray-100 leading-snug break-words">${task.title}</h3>
        <div class="mt-auto pt-3 flex items-end justify-between border-t border-gray-100 dark:border-gray-700/50">
            <div class="flex flex-col gap-1.5">
                <span class="text-[10px] font-mono font-bold text-gray-300 dark:text-gray-600">#${task.id}</span>
                <div class="flex items-center gap-3">
                    ${dateBadge}
                    ${attachmentIcon}
                </div>
            </div>
            ${responsibleDisplay}
        </div>
    `;

    return taskCard;
};

// --- RENDERIZAÇÃO: KANBAN HORIZONTAL ---

export function renderKanbanView() {
    const kanbanViewEl = document.getElementById('kanbanView');
    
    // Filtra tarefas ativas
    let activeTasks = filterTasks(state.tasks).filter(t => t.status !== 'done');
    
    const columns = [
        { id: 'todo', name: 'Backlog', color: 'bg-gray-400' },
        { id: 'stopped', name: 'Parado', color: 'bg-red-500' },
        { id: 'inprogress', name: 'Em Progresso', color: 'bg-blue-500' },
        { id: 'homologation', name: 'Homologação', color: 'bg-orange-500' }
    ];

    columns.forEach(col => {
        // Tenta encontrar a coluna existente pelo ID
        let columnEl = kanbanViewEl.querySelector(`.board-column[data-column-id="${col.id}"]`);
        
        // Filtra as tarefas dessa coluna específica
        const tasksForColumn = activeTasks.filter(t => t.status === col.id).sort((a, b) => (a.order || 0) - (b.order || 0));

        // Se a coluna não existe, cria (só acontece na primeira vez)
        if (!columnEl) {
            columnEl = document.createElement('div');
            columnEl.className = 'board-column fade-in'; // Animação só na criação
            columnEl.setAttribute('data-column-id', col.id);

            columnEl.innerHTML = `
                <div class="column-header select-none">
                    <div class="flex items-center gap-3">
                        <span class="w-2.5 h-2.5 rounded-full ${col.color} shadow-sm"></span>
                        <h2 class="font-extrabold text-lg text-custom-darkest dark:text-white tracking-tight">${col.name}</h2>
                    </div>
                    <span class="column-count bg-custom-light dark:bg-white/10 text-custom-dark dark:text-gray-300 text-xs font-bold px-2.5 py-1 rounded-lg">0</span>
                </div>
                <div class="kanban-task-list custom-scrollbar space-y-4" data-column-id="${col.id}"></div>
            `;
            kanbanViewEl.appendChild(columnEl);
        }

        // --- ATUALIZAÇÃO (Sem destruir a coluna) ---
        
        // 1. Atualiza o contador
        const countBadge = columnEl.querySelector('.column-count');
        if (countBadge) countBadge.textContent = tasksForColumn.length;

        // 2. Atualiza a lista de tarefas
        const listEl = columnEl.querySelector('.kanban-task-list');
        
        // Estratégia simples: Limpa e recria APENAS os cards (é rápido e mantém a coluna estável)
        // Se quiser ser ainda mais suave, poderíamos fazer diffing de cards, mas isso já resolve o "flash" da coluna.
        listEl.innerHTML = ''; 
        tasksForColumn.forEach(task => listEl.appendChild(createTaskElement(task)));
    });

    lucide.createIcons();
}

// --- RENDERIZAÇÃO: LISTA ---

export function renderListView() {
    const container = document.getElementById('listView');
    let activeTasks = filterTasks(state.tasks).filter(t => t.status !== 'done');
    activeTasks.sort((a, b) => (a.order || 0) - (b.order || 0));

    if (activeTasks.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-400 opacity-60 mt-20"><i data-lucide="clipboard-list" class="w-16 h-16 mb-4"></i><p>Nenhuma tarefa encontrada.</p></div>`;
        lucide.createIcons();
        return;
    }

    const rows = activeTasks.map(task => {
        const respNames = (task.responsible || []).map(r => typeof r === 'object' ? r.name : r).join(', ');
        
        return `
        <div class="list-row group bg-white dark:bg-[#1f2937] p-4 rounded-2xl mb-3 shadow-sm hover:shadow-md border border-transparent hover:border-custom-medium/30 transition-all cursor-pointer flex items-center gap-4 fade-in" data-task-id="${task.id}">
            <div class="w-1 h-12 rounded-full bg-${task.status === 'stopped' ? 'red-500' : (task.status === 'homologation' ? 'orange-500' : 'gray-300')} shrink-0"></div>
            <div class="flex-grow min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full" style="background-color: ${task.projectColor || '#ccc'}">${task.project || 'Geral'}</span>
                    <span class="text-[10px] font-mono text-gray-400">#${task.id}</span>
                </div>
                <h3 class="font-bold text-custom-darkest dark:text-white truncate">${task.title}</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">${respNames || 'Sem responsável'}</p>
            </div>
            <div class="hidden md:flex items-center gap-6 shrink-0">
                ${task.dueDate ? `<div class="text-xs text-gray-500 flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i> ${formatDate(task.dueDate)}</div>` : ''}
                ${task.attachments?.length ? `<div class="text-xs text-gray-400"><i data-lucide="paperclip" class="w-3 h-3"></i></div>` : ''}
            </div>
            <button class="info-btn p-2 rounded-xl text-gray-300 hover:text-custom-dark hover:bg-gray-100 dark:hover:bg-white/10 transition-colors shrink-0" data-task-id="${task.id}">
                <i data-lucide="chevron-right" class="w-5 h-5 pointer-events-none"></i>
            </button>
        </div>
        `;
    }).join('');

    container.innerHTML = `<div class="max-w-4xl mx-auto space-y-1">${rows}</div>`;
    
    container.querySelectorAll('.list-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (!e.target.closest('button, a')) {
                const taskId = row.dataset.taskId;
                highlightTask(taskId, false);
                renderTaskHistory(taskId);
            }
        });
    });

    lucide.createIcons();
}

// --- RENDERIZAÇÃO: ARQUIVADOS ---

export async function renderArchivedTasks() {
    const container = document.getElementById('archivedView');
    container.innerHTML = '<div class="flex justify-center mt-20"><i class="animate-spin text-custom-dark" data-lucide="loader-2"></i></div>';
    lucide.createIcons();

    try {
        const tasks = await fetchArchivedTasks();
        if (tasks.length === 0) {
            container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-400 opacity-60 mt-20"><i data-lucide="archive" class="w-16 h-16 mb-4"></i><p>O arquivo está vazio.</p></div>`;
            lucide.createIcons();
            return;
        }

        const rows = tasks.map(task => `
            <div class="bg-white dark:bg-[#1f2937] p-5 rounded-2xl mb-3 border border-gray-100 dark:border-gray-700 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
                <div>
                    <h3 class="font-bold text-gray-600 dark:text-gray-300 line-through decoration-gray-400">${task.title}</h3>
                    <p class="text-xs text-gray-400 mt-1">Concluída em ${formatDate(task.updatedAt || new Date())} • ${task.project}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button class="restore-btn text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2.5 rounded-xl transition-colors" data-task-id="${task.id}" title="Restaurar para Fila">
                        <i data-lucide="undo-2" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                    <button class="delete-btn text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2.5 rounded-xl transition-colors" data-task-id="${task.id}" title="Excluir Permanentemente">
                        <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `<div class="max-w-3xl mx-auto"><h2 class="text-2xl font-bold mb-6 text-custom-darkest dark:text-white">Arquivo Morto</h2>${rows}</div>`;
        lucide.createIcons();

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-center text-red-500 mt-10">Erro ao carregar arquivo.</p>';
    }
}

// --- RENDERIZAÇÃO: UTILIZADORES ---

export function renderUserManagementView() {
    const container = document.getElementById('userManagementView');
    const allUsers = state.users.filter(u => u.name !== 'DEFINIR');

    const rows = allUsers.map(user => `
        <div class="flex items-center justify-between p-4 bg-white dark:bg-[#1f2937] border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <div class="flex items-center gap-4">
                <img src="${user.picture || 'https://i.imgur.com/6b6psVE.png'}" class="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600">
                <div>
                    <p class="font-bold text-custom-darkest dark:text-white">${user.name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${user.email}</p>
                </div>
            </div>
            <div class="flex items-center gap-4">
                ${user.isAdmin ? '<span class="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] font-bold uppercase rounded-lg">Admin</span>' : '<span class="text-xs text-gray-400">Membro</span>'}
                <button class="delete-user-btn text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" data-user-id="${user.id || user.email}">
                    <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="md:col-span-2">
                <h2 class="text-2xl font-bold mb-6 text-custom-darkest dark:text-white">Equipa</h2>
                <div class="bg-white dark:bg-[#1f2937] rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                    ${rows}
                </div>
            </div>
            <div>
                <h2 class="text-2xl font-bold mb-6 text-custom-darkest dark:text-white">Novo Membro</h2>
                <form id="addUserForm" class="bg-white dark:bg-[#1f2937] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-gray-400 mb-1">Nome</label>
                        <input type="text" id="newUserName" required class="w-full bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 text-sm focus:ring-custom-dark focus:border-custom-dark">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-gray-400 mb-1">Email</label>
                        <input type="email" id="newUserEmail" required class="w-full bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 text-sm focus:ring-custom-dark focus:border-custom-dark">
                    </div>
                    <div class="flex items-center gap-2 py-2">
                        <input type="checkbox" id="newUserIsAdmin" class="rounded border-gray-300 text-custom-dark focus:ring-custom-dark">
                        <label for="newUserIsAdmin" class="text-sm text-gray-600 dark:text-gray-300">Acesso Administrador</label>
                    </div>
                    <button type="submit" class="w-full bg-custom-darkest text-white font-bold py-3 rounded-xl hover:bg-opacity-90 transition-opacity">Adicionar</button>
                </form>
            </div>
        </div>
    `;
    lucide.createIcons();
}

// --- GERENCIADOR DE VISUALIZAÇÕES (ROTEADOR UI) ---
// *** CORREÇÃO AQUI: Adicionado flex e gap-8 ao kanbanView para corrigir alinhamento vertical ***

export function updateActiveView() {
    const kanban = document.getElementById('kanbanView');
    const list = document.getElementById('listView');
    const archived = document.getElementById('archivedView');
    const users = document.getElementById('userManagementView');
    const main = document.getElementById('main-content');
    const label = document.getElementById('current-view-label');
    
    // 1. Resetar Visibilidade
    [kanban, list, archived, users].forEach(el => el.classList.add('hidden'));

    // 2. Atualizar Botões do Menu
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

    // 3. Renderizar View Escolhida
    if (state.currentView === 'kanban') {
        renderKanbanView();
        
        // CORREÇÃO DE CENTRALIZAÇÃO:
        // Removemos 'w-full' para o container não esticar 100%
        // Adicionamos 'w-fit' (largura do conteúdo) e 'mx-auto' (margem auto horizontal)
        kanban.classList.remove('hidden', 'w-full');
        kanban.classList.add('flex', 'gap-8', 'w-fit', 'mx-auto'); 
        
        main.classList.add('immersive-canvas');
        main.classList.remove('block'); 
        label.textContent = "Quadro Geral";
    } else {
        // Restauramos o padrão para outras views
        kanban.classList.add('w-full');
        kanban.classList.remove('flex', 'gap-8', 'w-fit', 'mx-auto');
        
        main.classList.remove('immersive-canvas');
        main.classList.add('block'); 

        if (state.currentView === 'list') {
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
}

// --- FILTROS NO ORB ---

function filterTasks(tasks) {
    let filtered = tasks;
    if (state.selectedProject !== 'all') {
        filtered = filtered.filter(t => t.project === state.selectedProject);
    }
    if (state.selectedResponsible !== 'all') {
        filtered = filtered.filter(t => Array.isArray(t.responsible) && t.responsible.map(r => (typeof r === 'object' ? r.name : r)).includes(state.selectedResponsible));
    }
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
    }
    return filtered;
}

export function populateProjectFilter() {
    const container = document.getElementById('orb-project-filters');
    const projects = [...new Set(state.tasks.map(t => t.project).filter(Boolean))].sort();

    container.innerHTML = `<div class="filter-chip ${state.selectedProject === 'all' ? 'active' : ''}" data-value="all">Todos</div>`;
    
    projects.forEach(p => {
        const isActive = state.selectedProject === p ? 'active' : '';
        const chip = document.createElement('div');
        chip.className = `filter-chip ${isActive}`;
        chip.dataset.value = p;
        chip.textContent = p;
        container.appendChild(chip);
    });
}

export function populateResponsibleFilter() {
    const container = document.getElementById('orb-responsible-filters');
    const responsibles = [...new Set(state.tasks.flatMap(t => t.responsible || []).map(r => (typeof r === 'object' ? r.name : r)).filter(Boolean))].sort();
    
    container.innerHTML = `<div class="filter-chip ${state.selectedResponsible === 'all' ? 'active' : ''}" data-value="all">Todos</div>`;
    
    responsibles.forEach(r => {
        const isActive = state.selectedResponsible === r ? 'active' : '';
        const chip = document.createElement('div');
        chip.className = `filter-chip ${isActive}`;
        chip.dataset.value = r;
        chip.textContent = r;
        container.appendChild(chip);
    });
}

// --- MODAL: DETALHES ---

export function renderTaskHistory(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('modal-info-title').textContent = task.title;
    document.getElementById('modal-info-project').textContent = task.project || 'Geral';
    document.getElementById('modal-info-project').style.color = task.projectColor || '#9DB2BF';
    document.getElementById('modal-info-description').textContent = task.description;

    const respNames = (task.responsible || []).map(r => typeof r === 'object' ? r.name : r).join(', ');
    document.getElementById('modal-info-responsible').textContent = respNames || 'Não atribuído';

    const calendarBtn = document.getElementById('modal-calendar-btn');
    const respEmails = (task.responsible || []).map(r => r.email).filter(Boolean).join(',');
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.title)}&details=${encodeURIComponent(task.description)}&add=${respEmails}`;
    calendarBtn.href = googleUrl;

    const dueDateEl = document.getElementById('modal-info-dueDate');
    const dueDateContainer = document.getElementById('modal-info-dueDate-container');
    if (task.dueDate) {
        dueDateEl.querySelector('span').textContent = formatDate(task.dueDate);
        dueDateContainer.classList.remove('hidden');
    } else {
        dueDateContainer.classList.add('hidden');
    }

    const linkContainer = document.getElementById('modal-info-azure-link-container');
    const linkEl = document.getElementById('modal-info-azure-link');
    if (task.azureLink) {
        linkEl.href = task.azureLink;
        linkEl.querySelector('span').textContent = task.azureLink;
        linkContainer.classList.remove('hidden');
    } else {
        linkContainer.classList.add('hidden');
    }

    const attachContainer = document.getElementById('modal-info-attachments-container');
    if (task.attachments?.length > 0) {
        renderAttachmentList('modal-info-attachments', task.attachments);
        attachContainer.classList.remove('hidden');
    } else {
        attachContainer.classList.add('hidden');
    }

    const historyEl = document.getElementById('history-feed');
    const historyItems = (task.history || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    historyEl.innerHTML = historyItems.map(item => `
        <div class="relative pl-4 pb-4 border-l border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
            <div class="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
            <p class="text-xs text-gray-600 dark:text-gray-300">Mudou para <span class="font-bold">${item.status}</span></p>
            <p class="text-[10px] text-gray-400">${formatDateTime(item.timestamp)}</p>
        </div>
    `).join('');

    const commentsEl = document.getElementById('comments-feed');
    const comments = (task.comments || []).map((c, i) => ({...c, index: i})).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (comments.length === 0) {
        commentsEl.innerHTML = '<div class="text-center text-gray-400 py-10 italic text-sm">Nenhum comentário ainda.<br>Inicie a discussão!</div>';
    } else {
        commentsEl.innerHTML = comments.map(c => {
            const author = state.users.find(u => u.name === c.author) || { name: c.author, picture: null };
            const avatar = author.picture 
                ? `<img src="${author.picture}" class="w-8 h-8 rounded-full border border-gray-200">`
                : `<div class="w-8 h-8 rounded-full bg-custom-dark text-white flex items-center justify-center font-bold text-xs">${author.name.charAt(0)}</div>`;

            return `
                <div class="flex gap-3 group">
                    <div class="shrink-0">${avatar}</div>
                    <div class="flex-grow">
                        <div class="flex items-baseline justify-between">
                            <span class="text-sm font-bold text-custom-darkest dark:text-white">${c.author}</span>
                            <span class="text-[10px] text-gray-400">${formatDateTime(c.timestamp)}</span>
                        </div>
                        <div class="bg-white dark:bg-white/5 p-3 rounded-tr-xl rounded-b-xl border border-gray-100 dark:border-gray-700 text-sm text-custom-darkest dark:text-gray-200 mt-1 shadow-sm relative">
                            ${c.text}
                            <button class="delete-comment-btn absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity" data-task-id="${taskId}" data-comment-index="${c.index}">
                                <i data-lucide="trash-2" class="w-3 h-3"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    const oldSignal = document.getElementById('signalBtn');
    if (oldSignal) oldSignal.remove();

    const signalBtn = document.createElement('button');
    signalBtn.id = 'signalBtn';
    signalBtn.className = 'p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors';
    signalBtn.title = 'Enviar Alerta Urgente';
    signalBtn.innerHTML = '<i data-lucide="siren" class="w-5 h-5"></i>';
    
    const closeBtn = document.getElementById('closeHistoryBtn');
    closeBtn.parentNode.insertBefore(signalBtn, closeBtn);

    signalBtn.onclick = () => {
        showConfirmModal(
            'Enviar Alerta', 
            'Isto enviará um aviso sonoro/visual de tela cheia para o responsável. Usar apenas em emergências.', 
            async () => {
                const api = await import('./api.js');
                await api.signalResponsible(taskId);
                showToast('Alerta enviado!', 'success');
            }, 
            null
        );
    };

    document.getElementById('taskHistoryModal').classList.remove('hidden');
    lucide.createIcons();
    setTimeout(() => setupCommentAutocomplete(), 300);
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

export function showConfirmModal(title, message, onConfirm, onCancel) {
    const modal = document.getElementById('deleteConfirmModal');
    modal.querySelector('h2').textContent = title;
    modal.querySelector('p').textContent = message;
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.onclick = () => {
        onConfirm();
        modal.classList.add('hidden');
    };
    
    document.getElementById('cancelDeleteBtn').onclick = () => {
        if(onCancel) onCancel();
        modal.classList.add('hidden');
    };
    
    modal.classList.remove('hidden');
}

export async function updateNotificationBadge() {
    const notifs = await fetchNotifications();
    const unread = notifs.filter(n => !n.isRead);
    const count = unread.length;
    
    const badgeOrb = document.getElementById('notification-badge-orb');
    const badgeMenu = document.getElementById('orb-notif-count');
    
    if (count > 0) {
        badgeOrb.classList.remove('hidden');
        badgeMenu.textContent = count > 9 ? '9+' : count;
        badgeMenu.classList.remove('hidden');
    } else {
        badgeOrb.classList.add('hidden');
        badgeMenu.classList.add('hidden');
    }

    const listContainer = document.getElementById('orb-notifications-list');
    if (notifs.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">Sem notificações.</div>';
    } else {
        listContainer.innerHTML = notifs.map(n => `
            <div class="p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer ${n.isRead ? 'opacity-50' : 'bg-blue-50/50 dark:bg-blue-900/10'}" data-notif-id="${n.id}" data-task-id="${n.taskId}">
                <p class="text-xs font-bold text-custom-darkest dark:text-white">${n.message}</p>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate">"${n.commentPreview}"</p>
                <p class="text-[9px] text-gray-400 text-right mt-1">${formatDateTime(n.createdAt)}</p>
            </div>
        `).join('');
        
        listContainer.querySelectorAll('div[data-notif-id]').forEach(el => {
            el.addEventListener('click', async () => {
                const notifId = el.dataset.notifId;
                const taskId = el.dataset.taskId;
                
                if (!el.classList.contains('opacity-50')) {
                    await markNotificationRead(notifId);
                    updateNotificationBadge();
                }
                
                document.getElementById('orb-tools').classList.remove('expanded');
                
                if (state.tasks.find(t => t.id === taskId)) {
                    highlightTask(taskId);
                    renderTaskHistory(taskId);
                } else {
                    showToast('Tarefa não encontrada (pode ter sido excluída).', 'error');
                }
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

    const render = () => {
        Array.from(container.children).forEach(c => {
            if (c !== input) c.remove();
        });

        current.forEach(u => {
            const name = typeof u === 'object' ? u.name : u;
            const tag = document.createElement('div');
            tag.className = 'flex items-center gap-1 bg-white dark:bg-white/10 px-2 py-1 rounded-lg text-xs font-bold text-custom-darkest dark:text-white shadow-sm';
            tag.innerHTML = `<span>${name}</span><i data-lucide="x" class="w-3 h-3 cursor-pointer hover:text-red-500"></i>`;
            tag.querySelector('i').onclick = () => {
                current = current.filter(x => (typeof x === 'object' ? x.name : x) !== name);
                render();
            };
            container.insertBefore(tag, input);
        });
        lucide.createIcons();
    };

    input.oninput = () => {
        const val = input.value.toLowerCase();
        if (!val) { suggestions.classList.add('hidden'); return; }

        const matches = state.users.filter(u => 
            u.name.toLowerCase().includes(val) && 
            !current.some(c => (typeof c === 'object' ? c.name : c) === u.name)
        );

        suggestions.innerHTML = matches.map(u => `
            <div class="p-2 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer flex items-center gap-2 text-sm text-custom-darkest dark:text-white">
                <img src="${u.picture || 'https://i.imgur.com/6b6psVE.png'}" class="w-5 h-5 rounded-full">
                ${u.name}
            </div>
        `).join('');

        if (matches.length > 0) {
            suggestions.classList.remove('hidden');
            Array.from(suggestions.children).forEach((el, i) => {
                el.onclick = () => {
                    current.push(matches[i]);
                    input.value = '';
                    suggestions.classList.add('hidden');
                    render();
                };
            });
        } else {
            suggestions.classList.add('hidden');
        }
    };
    
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) suggestions.classList.add('hidden');
    });

    render();
}

export function setupProjectSuggestions() {
    const input = document.getElementById('taskProject');
    const list = document.getElementById('project-suggestions');
    const colorInput = document.getElementById('taskProjectColor');
    const colorBtn = document.getElementById('color-picker-button');

    const projectMap = new Map();
    state.tasks.forEach(t => { if(t.project) projectMap.set(t.project, t.projectColor); });

    input.oninput = () => {
        const val = input.value.toLowerCase();
        if (!val) { list.classList.add('hidden'); return; }

        const matches = Array.from(projectMap.keys()).filter(p => p.toLowerCase().includes(val));
        
        list.innerHTML = matches.map(p => `
            <div class="p-2 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer text-sm text-custom-darkest dark:text-white flex justify-between">
                <span>${p}</span>
                <span class="w-3 h-3 rounded-full" style="background-color: ${projectMap.get(p)}"></span>
            </div>
        `).join('');

        if (matches.length > 0) {
            list.classList.remove('hidden');
            Array.from(list.children).forEach((el, i) => {
                el.onclick = () => {
                    input.value = matches[i];
                    const color = projectMap.get(matches[i]);
                    if(color) {
                        colorInput.value = color;
                        colorBtn.style.backgroundColor = color;
                    }
                    list.classList.add('hidden');
                };
            });
        } else {
            list.classList.add('hidden');
        }
    };
}

export function setupCustomColorPicker() {
    const btn = document.getElementById('color-picker-button');
    const palette = document.getElementById('color-palette');
    const input = document.getElementById('taskProjectColor');
    const nativeTrig = document.getElementById('native-color-picker-trigger');

    const colors = ['#526D82', '#9DB2BF', '#27374D', '#1D5B79', '#468B97', '#EF6262', '#F3AA60', '#F9D949', '#68B984', '#3D5656', '#A25B5B', '#635985'];

    palette.innerHTML = colors.map(c => `
        <div class="w-full h-8 rounded-lg cursor-pointer hover:scale-110 transition-transform shadow-sm" style="background-color: ${c}" data-color="${c}"></div>
    `).join('');

    btn.onclick = () => palette.classList.toggle('hidden');
    
    const updateBtn = () => btn.style.backgroundColor = input.value;
    input.oninput = updateBtn;
    updateBtn();

    Array.from(palette.children).forEach(swatch => {
        swatch.onclick = () => {
            input.value = swatch.dataset.color;
            updateBtn();
            palette.classList.add('hidden');
        };
    });

    nativeTrig.onclick = () => input.click();
    
    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !palette.contains(e.target)) palette.classList.add('hidden');
    });
}