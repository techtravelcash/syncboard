import { state } from './state.js';
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
            item.className = 'flex items-center justify-between p-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-lg group hover:border-custom-medium/50 transition-colors';
            
            const downloadLink = !isLocalFile ? `
                <a href="${file.url}" target="_blank" class="text-blue-500 hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Baixar">
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
    const isPop = task.priority === 'Urgente' || task.status === 'done';

    let cardClasses = 'task-card group'; 
    if (isOverdue) cardClasses += ' border-l-[4px] border-l-red-500';
    if (isPop) cardClasses += ' card-pop';

    taskCard.className = cardClasses;
    taskCard.dataset.taskId = task.id;

    const pColor = task.projectColor || '#94A3B8';
    const bgRgba = hexToRgba(pColor, 0.50); 
    
    const projectStrip = task.project 
        ? `<div class="project-strip" style="background-color: ${bgRgba};">${task.project}</div>`
        : `<div class="project-strip" style="background-color: ${hexToRgba('#94A3B8', 0.5)};">Geral</div>`;

    let responsibleDisplay = '';
    if (task.responsible && task.responsible.length > 0) {
        const avatars = task.responsible.slice(0, 3).map(r => {
            const name = typeof r === 'object' ? r.name : r;
            const pic = typeof r === 'object' ? r.picture : null;
            const userState = state.users.find(u => u.name === name);
            const finalPic = userState?.picture || pic;

            if (finalPic) {
                return `<img src="${finalPic}" class="w-6 h-6 rounded-full border border-white dark:border-[#334155] object-cover" title="${name}">`;
            }
            return `<div class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 border border-white dark:border-[#334155] flex items-center justify-center text-[9px] font-bold text-gray-600 dark:text-gray-300" title="${name}">${name.charAt(0)}</div>`;
        }).join('');
        
        const extra = task.responsible.length > 3 ? `<div class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 border border-white dark:border-[#334155] flex items-center justify-center text-[9px] font-bold text-gray-500">+${task.responsible.length - 3}</div>` : '';
        responsibleDisplay = `<div class="flex -space-x-1.5">${avatars}${extra}</div>`;
    }

    const dateText = task.dueDate ? formatDate(task.dueDate) : '';
    const dateClass = isOverdue ? 'text-red-500 font-bold opacity-100' : 'ox-text-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300';
    
    const dateBadge = dateText ? 
        `<div class="flex items-center gap-1 ${dateClass} text-[10px]" title="Prazo"><i data-lucide="calendar" class="w-3 h-3"></i><span>${dateText}</span></div>` : '';

    const attachmentIcon = (task.attachments?.length > 0) 
        ? `<div class="flex items-center gap-1 ox-text-tertiary text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" title="Anexos"><i data-lucide="paperclip" class="w-3 h-3"></i><span>${task.attachments.length}</span></div>` 
        : '';

    const commentsList = Array.isArray(task.comments) ? task.comments : [];
    const commentCount = commentsList.length;
    
    const commentIcon = (commentCount > 0) 
        ? `<div class="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" title="Comentários">
             <i data-lucide="message-circle" class="w-3 h-3"></i>
             <span class="font-semibold">${commentCount}</span>
           </div>` 
        : '';
    
    const idBadge = `<span class="font-mono text-xs font-bold ox-text-secondary tracking-wider mr-2">${task.id}</span>`;

    const quickActions = `
        <div class="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
            <button class="delete-task-btn p-1 rounded-md bg-white/20 hover:bg-red-500 hover:text-white text-white backdrop-blur-sm transition-colors shadow-sm" title="Excluir" data-task-id="${task.id}">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>

            <button class="expand-btn p-1 rounded-md bg-white/20 hover:bg-white text-white hover:text-custom-dark backdrop-blur-sm transition-colors shadow-sm" title="Expandir Detalhes" data-task-id="${task.id}">
                <i data-lucide="maximize-2" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>

            ${task.status === 'homologation' ? `<button class="approve-btn p-1 rounded-md bg-green-500 hover:bg-green-600 text-white shadow-sm" title="Aprovar" data-task-id="${task.id}"><i data-lucide="check" class="w-3.5 h-3.5 pointer-events-none"></i></button>` : ''}
        </div>
    `;

    taskCard.innerHTML = `
        ${projectStrip}
        ${quickActions}
        
        <div class="task-body">
            <h3 class="text-sm ox-text-primary leading-snug break-words pr-1">${task.title}</h3>
            
            <div class="flex items-end justify-between mt-auto pt-2 border-t border-dashed border-gray-200 dark:border-white/5">
                <div class="flex items-center gap-3 min-h-[24px]">
                    ${idBadge}
                    ${dateBadge}
                    ${attachmentIcon}
                    ${commentIcon}
                </div>
                ${responsibleDisplay}
            </div>
        </div>
    `;

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
            showConfirmModal(
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
    return filtered;
}

// --- RENDERIZAÇÃO: KANBAN ---

export function renderKanbanView() {
    const kanbanViewEl = document.getElementById('kanbanView');
    // Aplica o filtro
    let activeTasks = filterTasks(state.tasks).filter(t => t.status !== 'done');
    
    const columns = [
        { id: 'todo', name: 'Fila', color: 'bg-gray-400' },
        { id: 'stopped', name: 'Parado', color: 'bg-red-500' },
        { id: 'inprogress', name: 'Andamento', color: 'bg-blue-500' },
        { id: 'homologation', name: 'Homologação', color: 'bg-orange-500' }
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

            columnEl.innerHTML = `
                <div class="column-header select-none group">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full ${col.color} ring-4 ring-transparent group-hover:ring-white/10 transition-all"></div>
                        <h2 class="font-bold text-sm uppercase tracking-wider ox-text-primary opacity-70 group-hover:opacity-100 transition-opacity">${col.name}</h2>
                    </div>
                    <span class="column-count text-[10px] font-bold ox-text-secondary bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">0</span>
                </div>
                <div class="kanban-task-list custom-scrollbar space-y-4" data-column-id="${col.id}"></div>
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

// --- RENDERIZAÇÃO: LISTA (MODIFICADO PARA ORB LATERAL E ANIMAÇÃO) ---

export function renderListView() {
    const container = document.getElementById('listView');
    
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

        // CONFIGURAÇÃO DO ARCO (Efeito Vertical Stretched)
        const startAngle = 145; 
        const endAngle = 215;
        
        const total = sortOptions.length;
        const step = total > 1 ? (endAngle - startAngle) / (total - 1) : 0;

        sortOptions.forEach((opt, index) => {
            const isActive = state.sortBy === opt.key;
            
            let arrowIcon = '';
            if (isActive) {
                arrowIcon = state.sortDirection === 'asc' 
                    ? '<i data-lucide="arrow-up" class="w-2.5 h-2.5 stroke-[3]"></i>' 
                    : '<i data-lucide="arrow-down" class="w-2.5 h-2.5 stroke-[3]"></i>';
            }

            const activeClass = isActive ? 'active' : '';
            const angle = startAngle + (index * step);
            
            const btnWrapper = document.createElement('div');
            btnWrapper.className = 'radial-btn';
            
            // Define a rotação (com pivô deslocado no CSS)
            btnWrapper.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
            btnWrapper.style.transitionDelay = `${index * 0.03}s`; 

            btnWrapper.innerHTML = `
                <div class="radial-content ${activeClass}" 
                     style="transform: rotate(-${angle}deg)" 
                     data-sort="${opt.key}"
                     data-label="${opt.label}">
                     
                    <i data-lucide="${opt.icon}" class="w-5 h-5"></i>
                    
                    <div class="sort-indicator">
                        ${arrowIcon}
                    </div>
                </div>
            `;

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
        
        lucide.createIcons();
    }

    // Se não houver tarefas
    if (activeTasks.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-400 opacity-60 mt-20"><i data-lucide="clipboard-list" class="w-16 h-16 mb-4"></i><p>Nenhuma tarefa encontrada.</p></div>`;
        lucide.createIcons();
        container.onscroll = null; // Limpa evento
        return;
    }

    const statusMap = {
        'todo': 'Fila',
        'stopped': 'Parado',
        'inprogress': 'Em Andamento',
        'homologation': 'Homologação',
        'done': 'Concluído'
    };

    // 3. Gerar HTML das Linhas
    const rows = activeTasks.map((task, index) => {
        const respNames = (task.responsible || []).map(r => typeof r === 'object' ? r.name : r).join(', ');
        
        const statusColor = task.status === 'stopped' ? 'red-500' : 
                          task.status === 'homologation' ? 'orange-500' : 
                          task.status === 'inprogress' ? 'blue-500' : 'gray-300';
        
        const statusLabel = statusMap[task.status] || 'Desconhecido';

        return `
        <div class="animate-slide-up-enter" style="animation-delay: ${index * 0.05}s">
            <div class="task-list-row list-row group" data-task-id="${task.id}">
                <div class="w-1 h-12 rounded-full bg-${statusColor} shrink-0"></div>
                
                <div class="flex-grow min-w-0 flex flex-col justify-center">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full" style="background-color: ${task.projectColor || '#ccc'}">${task.project || 'Geral'}</span>
                        <span class="text-sm font-mono ox-text-secondary font-bold">${task.id}</span>
                        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/5">${statusLabel}</span>
                    </div>
                    <h3 class="font-bold ox-text-primary truncate">${task.title}</h3>
                    <p class="text-xs ox-text-secondary truncate mt-0.5">${respNames || 'Sem responsável'}</p>
                </div>
                
                <div class="hidden md:flex items-center gap-4 shrink-0 mr-4">
                    <div class="text-xs ox-text-secondary flex items-center gap-1" title="Criado em">
                        <i data-lucide="clock" class="w-3 h-3"></i> ${formatDate(task.createdAt)}
                    </div>

                    ${task.dueDate ? `<div class="text-xs ox-text-secondary flex items-center gap-1" title="Prazo"><i data-lucide="calendar" class="w-3 h-3"></i> ${formatDate(task.dueDate)}</div>` : ''}
                    ${task.attachments?.length ? `<div class="text-xs ox-text-tertiary"><i data-lucide="paperclip" class="w-3 h-3"></i></div>` : ''}
                </div>
                
                <div class="flex items-center gap-1 shrink-0">
                    <button class="delete-list-btn p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" data-task-id="${task.id}" title="Excluir">
                        <i data-lucide="trash-2" class="w-5 h-5 pointer-events-none"></i>
                    </button>
                    <button class="info-btn p-2 rounded-xl text-gray-300 hover:text-custom-dark hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" data-task-id="${task.id}">
                        <i data-lucide="chevron-right" class="w-5 h-5 pointer-events-none"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    // Renderiza APENAS a lista
    container.innerHTML = `
        <div class="pt-6 pb-32">
            <div class="max-w-4xl mx-auto space-y-1">
                ${rows}
            </div>
        </div>
    `;
    
    // Liga os efeitos
    setTimeout(() => {
        requestAnimationFrame(updateListScrollEffect);
        container.onscroll = () => requestAnimationFrame(updateListScrollEffect);
    }, 100);

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
            
            showConfirmModal(
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
            <div class="bg-white dark:bg-[#1E293B] p-5 rounded-2xl mb-3 border border-gray-100 dark:border-gray-700 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
                <div>
                    <h3 class="font-bold ox-text-secondary line-through decoration-gray-400">${task.title}</h3>
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
        <div class="flex items-center justify-between p-4 bg-white dark:bg-[#1E293B] border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <div class="flex items-center gap-4">
                <img src="${user.picture || 'https://i.imgur.com/6b6psVE.png'}" class="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600">
                <div>
                    <p class="font-bold ox-text-primary">${user.name}</p>
                    <p class="text-xs ox-text-secondary">${user.email}</p>
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
                <div class="bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                    ${rows}
                </div>
            </div>
            <div>
                <h2 class="text-2xl font-bold mb-6 text-custom-darkest dark:text-white">Novo Membro</h2>
                <form id="addUserForm" class="bg-white dark:bg-[#1E293B] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
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

// --- ROTEADOR UI (ATUALIZADO COM ANIMAÇÃO DE ENTRADA E SAÍDA) ---

export function updateActiveView() {
    const kanban = document.getElementById('kanbanView');
    const list = document.getElementById('listView');
    const archived = document.getElementById('archivedView');
    const users = document.getElementById('userManagementView');
    const main = document.getElementById('main-content');
    const label = document.getElementById('current-view-label');
    const sortOrb = document.getElementById('orb-sort'); 
    
    // Esconde views de conteúdo imediatamente
    [kanban, list, archived, users].forEach(el => el.classList.add('hidden'));

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

// --- FILTROS NO ORB + BADGE ---

function updateFilterBadge() {
    const filterOrb = document.getElementById('orb-filter');
    if (!filterOrb) return;

    let badge = filterOrb.querySelector('.filter-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'filter-badge hidden';
        filterOrb.appendChild(badge);
    }

    let activeCount = 0;
    if (state.selectedProject && state.selectedProject !== 'all') activeCount++;
    if (state.selectedResponsible && state.selectedResponsible !== 'all') activeCount++;

    if (activeCount > 0) {
        badge.textContent = activeCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

export function populateProjectFilter() {
    const container = document.getElementById('orb-project-filters');
    if (!container) return; 

    const projects = [...new Set(state.tasks.map(t => t.project).filter(Boolean))].sort();

    container.innerHTML = '';

    const allChip = document.createElement('div');
    const isAllActive = !state.selectedProject || state.selectedProject === 'all';
    allChip.className = `filter-chip ${isAllActive ? 'active' : ''}`;
    allChip.textContent = 'Todos';
    
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

    const responsibles = [...new Set(state.tasks.flatMap(t => t.responsible || []).map(r => (typeof r === 'object' ? r.name : r)).filter(Boolean))].sort();
    
    container.innerHTML = '';
    
    const allChip = document.createElement('div');
    const isAllActive = !state.selectedResponsible || state.selectedResponsible === 'all';
    allChip.className = `filter-chip ${isAllActive ? 'active' : ''}`;
    allChip.textContent = 'Todos';
    
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
    const badgeOrbExternal = document.getElementById('notification-orb-badge');
    
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