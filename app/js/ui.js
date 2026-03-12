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

    // --- NOVO: BADGE DO HOMOLOGADOR ---
    let homologadorBadge = '';
    
    // Agora o badge aparece tanto na homologação quanto na publicação
    if ((task.status === 'homologation' || task.status === 'publication') && task.homologador) {
        const homolName = typeof task.homologador === 'object' ? task.homologador.name : task.homologador;
        const homolPic = typeof task.homologador === 'object' ? task.homologador.picture : null;
        
        // Verifica se já foi aprovado para publicação
        const isApproved = task.status === 'publication';
        
        // Definição dinâmica de cores e estilos
        const badgeBg = isApproved 
            ? 'bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/20' 
            : 'bg-gradient-to-r from-orange-500/10 to-orange-500/5 border-orange-500/20';
            
        const iconName = isApproved ? 'check-circle' : 'shield-check';
        const iconColor = isApproved ? 'text-green-500' : 'text-orange-500';
        
        // Mantém a animação pulsante apenas quando está pendente
        const pingEffect = isApproved ? '' : '<span class="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-30 group-hover/homol:animate-ping"></span>';
        
        const avatarBorder = isApproved ? 'border-green-200 dark:border-green-800' : 'border-orange-200 dark:border-orange-800';
        const avatarFallbackBg = isApproved ? 'bg-green-200 dark:bg-green-800' : 'bg-orange-200 dark:bg-orange-800';
        const avatarFallbackText = isApproved ? 'text-green-700 dark:text-green-200' : 'text-orange-700 dark:text-orange-200';
        
        const labelTextClass = isApproved ? 'text-green-600/70 dark:text-green-400/80' : 'text-orange-600/70 dark:text-orange-400/80';
        const nameTextClass = isApproved ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300';
        const labelText = isApproved ? 'Homologado por' : 'Homologador';

        const avatarImg = homolPic 
            ? `<img src="${homolPic}" class="w-5 h-5 rounded-full object-cover border ${avatarBorder}">` 
            : `<div class="w-5 h-5 rounded-full ${avatarFallbackBg} flex items-center justify-center text-[9px] font-bold ${avatarFallbackText} shadow-inner">${homolName.charAt(0)}</div>`;

        homologadorBadge = `
            <div class="mt-3 flex items-center gap-2 px-2.5 py-1.5 ${badgeBg} border rounded-xl w-fit group/homol transition-colors duration-500">
                <div class="relative flex items-center justify-center">
                    ${pingEffect}
                    <i data-lucide="${iconName}" class="w-4 h-4 ${iconColor} relative z-10"></i>
                </div>
                ${avatarImg}
                <div class="flex flex-col">
                    <span class="text-[8px] font-bold uppercase tracking-widest ${labelTextClass} leading-none mb-0.5">${labelText}</span>
                    <span class="text-[11px] font-extrabold ${nameTextClass} leading-none tracking-tight">${homolName.split(' ')[0]}</span>
                </div>
            </div>
        `;
    }
    // -------------------------------------------

    let actionButtons = '';
    if (task.status === 'homologation') {
        actionButtons = `<button class="approve-btn p-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white shadow-sm" title="Aprovar para Publicação" data-task-id="${task.id}"><i data-lucide="arrow-right" class="w-3.5 h-3.5 pointer-events-none"></i></button>`;
    } else if (task.status === 'publication') {
        actionButtons = `<button class="publish-btn p-1 rounded-md bg-green-500 hover:bg-green-600 text-white shadow-sm" title="Publicar Tarefa" data-task-id="${task.id}"><i data-lucide="check-circle" class="w-3.5 h-3.5 pointer-events-none"></i></button>`;
    }

    const quickActions = `
        <div class="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
            <button class="delete-task-btn p-1 rounded-md bg-white/20 hover:bg-red-500 hover:text-white text-white backdrop-blur-sm transition-colors shadow-sm" title="Excluir" data-task-id="${task.id}">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>

            <button class="expand-btn p-1 rounded-md bg-white/20 hover:bg-white text-white hover:text-custom-dark backdrop-blur-sm transition-colors shadow-sm" title="Expandir Detalhes" data-task-id="${task.id}">
                <i data-lucide="maximize-2" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>

            ${actionButtons}
        </div>
    `;

    taskCard.innerHTML = `
        ${projectStrip}
        ${quickActions}
        
        <div class="task-body flex flex-col h-full">
            <h3 class="text-sm ox-text-primary leading-snug break-words pr-1">${task.title}</h3>
            ${homologadorBadge}
            
            <div class="flex items-end justify-between mt-auto pt-3 border-t border-dashed border-gray-200 dark:border-white/5">
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

// --- RENDERIZAÇÃO: HOME (DASHBOARD DO USUÁRIO) ---

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
}

export function renderHomeView() {
    const container = document.getElementById('homeView');

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

    // 3. Calcular Métricas
    const counts = {
        todo: myActiveTasks.filter(t => t.status === 'todo').length,
        inprogress: myActiveTasks.filter(t => t.status === 'inprogress').length,
        homologation: myActiveTasks.filter(t => t.status === 'homologation').length,
        overdue: myActiveTasks.filter(t => isTaskOverdue(t)).length
    };

    // NOVO: Calcular quantas tarefas dependem da homologação ESPECÍFICA do usuário logado
    const myHomologationsPending = myActiveTasks.filter(t => {
        if (t.status !== 'homologation' || !t.homologador) return false;
        const hName = normalize(typeof t.homologador === 'object' ? t.homologador.name : t.homologador);
        const hEmail = normalize(typeof t.homologador === 'object' ? t.homologador.email : null);
        return myIdentifiers.has(hName) || myIdentifiers.has(hEmail);
    }).length;

    // NOVO: Gerar o HTML do badge animado (se houver pendências)
    const homologationBadge = myHomologationsPending > 0 
        ? `<div class="absolute -top-2 -right-2 flex h-6 w-6 z-10" title="Você tem ${myHomologationsPending} homologação(ões) pendente(s)">
             <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
             <span class="relative inline-flex rounded-full h-6 w-6 bg-red-500 text-white text-[10px] font-bold items-center justify-center border-2 border-white dark:border-[#1E293B] shadow-sm">${myHomologationsPending}</span>
           </div>`
        : '';

    const displayFullName = dbUser?.name || state.currentUser?.userDetails || 'Visitante';
    const userName = displayFullName.split(' ')[0];
    const greeting = getGreeting();

    // 4. Estrutura Base HTML com Cards Interativos (metric-card)
    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-10 animate-fade-in">
            
            <div class="pt-4">
                <h1 class="text-3xl md:text-4xl font-extrabold text-custom-darkest dark:text-white tracking-tight">${greeting}, ${userName}!</h1>
                <p class="text-custom-dark dark:text-gray-400 mt-2 font-medium">Aqui está o resumo do seu fluxo de trabalho.</p>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6" id="home-metric-cards">
                <div class="metric-card cursor-pointer bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-[28px] p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-300" data-filter="inprogress">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="p-2.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl"><i data-lucide="play-circle" class="w-5 h-5"></i></div>
                        <h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Em Andamento</h3>
                    </div>
                    <p class="text-4xl font-black text-custom-darkest dark:text-white">${counts.inprogress}</p>
                </div>

                <div class="metric-card relative cursor-pointer bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-[28px] p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-300" data-filter="homologation">
                    ${homologationBadge}
                    <div class="flex items-center gap-3 mb-3">
                        <div class="p-2.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl"><i data-lucide="eye" class="w-5 h-5"></i></div>
                        <h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Homologação</h3>
                    </div>
                    <p class="text-4xl font-black text-custom-darkest dark:text-white">${counts.homologation}</p>
                </div>

                <div class="metric-card cursor-pointer bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-[28px] p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-300" data-filter="todo">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="p-2.5 bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-xl"><i data-lucide="list-todo" class="w-5 h-5"></i></div>
                        <h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Na Fila</h3>
                    </div>
                    <p class="text-4xl font-black text-custom-darkest dark:text-white">${counts.todo}</p>
                </div>

                <div class="metric-card cursor-pointer bg-white/60 dark:bg-white/5 backdrop-blur-xl border ${counts.overdue > 0 ? 'border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/10' : 'border-white/40 dark:border-white/10'} rounded-[28px] p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-300" data-filter="overdue">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="p-2.5 ${counts.overdue > 0 ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'} rounded-xl">
                            <i data-lucide="${counts.overdue > 0 ? 'alert-triangle' : 'check-circle'}" class="w-5 h-5"></i>
                        </div>
                        <h3 class="text-[10px] font-bold uppercase tracking-widest ${counts.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}">Atrasadas</h3>
                    </div>
                    <p class="text-4xl font-black ${counts.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-custom-darkest dark:text-white'}">${counts.overdue}</p>
                </div>
            </div>

            <div>
                <h2 id="home-list-title" class="text-lg font-bold text-custom-darkest dark:text-white mb-5 flex items-center gap-2 transition-colors">
                    <i id="home-list-icon" data-lucide="play-circle" class="w-5 h-5 text-blue-500"></i>
                    <span>Tarefas em Andamento</span>
                </h2>
                <div id="home-dynamic-list" class="space-y-3 min-h-[200px]">
                    </div>
            </div>
        </div>
    `;

    lucide.createIcons({ root: container });

    // 5. Função que renderiza a lista com base no filtro selecionado
    const updateList = (filter) => {
        // Atualiza a UI dos cards para mostrar qual está selecionado (efeito "anel luminoso")
        container.querySelectorAll('.metric-card').forEach(card => {
            if (card.dataset.filter === filter) {
                card.classList.add('ring-4', 'ring-blue-500/40', 'dark:ring-blue-400/30');
            } else {
                card.classList.remove('ring-4', 'ring-blue-500/40', 'dark:ring-blue-400/30');
            }
        });

        // Configurações baseadas no filtro
        let filteredTasks = [];
        let listTitle = '';
        let listIcon = '';
        let iconColor = '';

        if (filter === 'inprogress') {
            filteredTasks = myActiveTasks.filter(t => t.status === 'inprogress');
            listTitle = 'Tarefas em Andamento';
            listIcon = 'play-circle';
            iconColor = 'text-blue-500';
        } else if (filter === 'homologation') {
            filteredTasks = myActiveTasks.filter(t => t.status === 'homologation');
            listTitle = 'Tarefas em Homologação';
            listIcon = 'eye';
            iconColor = 'text-orange-500';
        } else if (filter === 'todo') {
            filteredTasks = myActiveTasks.filter(t => t.status === 'todo');
            listTitle = 'Tarefas na Fila';
            listIcon = 'list-todo';
            iconColor = 'text-gray-500 dark:text-gray-400';
        } else if (filter === 'overdue') {
            filteredTasks = myActiveTasks.filter(t => isTaskOverdue(t));
            listTitle = 'Tarefas Atrasadas';
            listIcon = 'alert-triangle';
            iconColor = 'text-red-500';
        }

        // Ordena as tarefas exibidas (Prazo mais próximo no topo)
        filteredTasks.sort((a, b) => {
            const dA = a.dueDate ? new Date(a.dueDate) : new Date(8640000000000000);
            const dB = b.dueDate ? new Date(b.dueDate) : new Date(8640000000000000);
            return dA - dB;
        });

        // Atualiza o título e ícone da lista
       const titleEl = document.getElementById('home-list-title');
        titleEl.innerHTML = `
            <i data-lucide="${listIcon}" class="w-5 h-5 ${iconColor}"></i>
            <span>${listTitle}</span>
        `;
        lucide.createIcons({ root: titleEl });

        const listContainer = document.getElementById('home-dynamic-list');

        // Estado Vazio
        if (filteredTasks.length === 0) {
            listContainer.innerHTML = `<div class="text-center py-10 bg-white/30 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-white/10 text-gray-500 dark:text-gray-400 text-sm font-medium animate-fade-in">Não há tarefas aqui. 🎉</div>`;
            return;
        }

        // Renderiza as linhas
        listContainer.innerHTML = filteredTasks.map(task => {
            const isOverdue = isTaskOverdue(task);
            const statusColors = {
                todo: 'bg-gray-400', inprogress: 'bg-blue-500', homologation: 'bg-orange-500', stopped: 'bg-red-500', publication: 'bg-purple-500'
            };
            const sColor = statusColors[task.status] || 'bg-gray-400';

            // NOVO: Verifica se o usuário logado é o homologador pendente DESSA tarefa
            let isPendingMyHomologation = false;
            if (task.homologador && task.status === 'homologation') {
                const hName = normalize(typeof task.homologador === 'object' ? task.homologador.name : task.homologador);
                const hEmail = normalize(typeof task.homologador === 'object' ? task.homologador.email : null);
                isPendingMyHomologation = myIdentifiers.has(hName) || myIdentifiers.has(hEmail);
            }

            // Cria o Badge caso dependa dele
            const homologadorBadge = isPendingMyHomologation 
                ? `<span class="text-[10px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded-full border border-orange-300 dark:border-orange-700 animate-pulse flex items-center gap-1 shadow-sm"><i data-lucide="shield-alert" class="w-3 h-3"></i> SUA HOMOLOGAÇÃO</span>` 
                : '';

            return `
            <div class="bg-white dark:bg-[#1E293B] border ${isPendingMyHomologation ? 'border-orange-300 dark:border-orange-500/50' : 'border-gray-100 dark:border-gray-700'} rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all duration-300 cursor-pointer list-row group animate-fade-in" data-task-id="${task.id}">
                <div class="flex items-center gap-4 min-w-0">
                    <div class="w-1.5 h-10 rounded-full ${sColor} shrink-0"></div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full" style="background-color: ${task.projectColor || '#94A3B8'}">${task.project || 'Geral'}</span>
                            <span class="text-xs font-mono font-bold text-gray-400">#${task.id}</span>
                            ${task.priority === 'Urgente' ? '<span class="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">URGENTE</span>' : ''}
                            ${homologadorBadge}
                        </div>
                        <h4 class="font-bold text-custom-darkest dark:text-white truncate pr-4">${task.title}</h4>
                    </div>
                </div>
                <div class="flex items-center gap-3 shrink-0 text-right hidden sm:block">
                    ${task.dueDate ? `
                        <div class="text-xs font-semibold ${isOverdue ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}">
                            <i data-lucide="${isOverdue ? 'alert-triangle' : 'calendar'}" class="w-3.5 h-3.5 inline mb-0.5"></i>
                            ${formatDate(task.dueDate)}
                        </div>
                    ` : '<span class="text-xs text-gray-400 italic">Sem prazo</span>'}
                </div>
            </div>`;
        }).join('');

        lucide.createIcons({ root: listContainer });

        // Adiciona eventos de clique nas tarefas recém renderizadas
        listContainer.querySelectorAll('.list-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.closest('button, a')) {
                    const taskId = row.dataset.taskId;
                    highlightTask(taskId, false);
                    renderTaskHistory(taskId); // Abre o modal de detalhes
                }
            });
        });
    };

    // 6. Configurar os cliques nos Cards
    container.querySelectorAll('.metric-card').forEach(card => {
        card.addEventListener('click', () => {
            const filter = card.dataset.filter;
            updateList(filter);
        });
    });

    // 7. Renderização inicial: Mostrar as tarefas 'Em Andamento' por padrão
    updateList('inprogress');
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
        { id: 'homologation', name: 'Homologação', color: 'bg-orange-500' },
        { id: 'publication', name: 'Publicação', color: 'bg-purple-500' }
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
        'publication': 'Publicação',
        'done': 'Concluído'
    };

    // 3. Gerar HTML das Linhas
    const rows = activeTasks.map((task, index) => {
        const respNames = (task.responsible || []).map(r => typeof r === 'object' ? r.name : r).join(', ');
        
        const statusColor = task.status === 'stopped' ? 'red-500' : 
                          task.status === 'homologation' ? 'orange-500' : 
                          task.status === 'inprogress' ? 'blue-500' : 
                          task.status === 'publication' ? 'purple-500' : 'gray-300';
        
        const statusLabel = statusMap[task.status] || 'Desconhecido';

        // NOVO: Badge do Homologador na Lista
        let homologadorHtml = '';
        if (task.homologador && (task.status === 'homologation' || task.status === 'publication')) {
            const hName = typeof task.homologador === 'object' ? task.homologador.name : task.homologador;
            const isApproved = task.status === 'publication';
            const colorClass = isApproved 
                ? 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20' 
                : 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20';
            const icon = isApproved ? 'check-circle' : 'shield-check';
            
            homologadorHtml = `
                <div class="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-lg border ${colorClass} text-[10px] font-bold ml-1" title="Homologador: ${hName}">
                    <i data-lucide="${icon}" class="w-3 h-3"></i>
                    <span>${hName.split(' ')[0]}</span>
                </div>
            `;
        }

        return `
        <div class="animate-slide-up-enter" style="animation-delay: ${index * 0.05}s">
            <div class="task-list-row list-row group" data-task-id="${task.id}">
                <div class="w-1 h-12 rounded-full bg-${statusColor} shrink-0"></div>
                
                <div class="flex-grow min-w-0 flex flex-col justify-center">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full" style="background-color: ${task.projectColor || '#ccc'}">${task.project || 'Geral'}</span>
                        <span class="text-sm font-mono ox-text-secondary font-bold">${task.id}</span>
                        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/5">${statusLabel}</span>
                        ${homologadorHtml}
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
    
    // Filtra o utilizador de sistema e ORDENA alfabeticamente pelo Nome de Exibição
    const allUsers = state.users
        .filter(u => u.name !== 'DEFINIR')
        .sort((a, b) => {
            const nameA = (a.displayName || a.name || '').toLowerCase();
            const nameB = (b.displayName || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

    // O map agora recebe (user, index) para calcularmos o atraso da animação
    const userCards = allUsers.map((user, index) => {
        const activeTasksCount = state.tasks.filter(t => 
            t.status !== 'done' && 
            t.responsible?.some(r => (typeof r === 'object' ? r.name : r) === user.name)
        ).length;

        const roleBadge = user.role 
            ? `<span class="px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-blue-200 dark:border-blue-800/50 shadow-sm">${user.role}</span>` 
            : '';

        return `
        <div class="user-card-item animate-slide-up-enter group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 rounded-[24px] hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 hover:border-blue-200 dark:hover:border-blue-500/30 relative overflow-hidden" style="animation-delay: ${index * 0.05}s">
            <div class="absolute right-0 top-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl -z-10 group-hover:scale-150 transition-transform duration-700"></div>

            <div class="flex items-center gap-5 mb-4 sm:mb-0 relative z-10">
                <div class="relative shrink-0">
                    <img src="${user.picture || 'https://i.imgur.com/6b6psVE.png'}" class="w-14 h-14 rounded-full object-cover border-[3px] border-white dark:border-[#0F172A] shadow-md group-hover:scale-105 transition-transform duration-300">
                    ${user.isAdmin 
                        ? `<div class="absolute -bottom-1 -right-1 bg-purple-500 text-white rounded-full p-1.5 border-2 border-white dark:border-[#0F172A] shadow-sm" title="Administrador do Sistema">
                            <i data-lucide="shield-check" class="w-3 h-3"></i>
                           </div>` 
                        : ''}
                </div>
                <div>
                    <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                        <p class="font-extrabold text-custom-darkest dark:text-white text-base leading-tight">${user.displayName || user.name}</p>
                        ${roleBadge}
                    </div>
                    <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        <span class="flex items-center gap-1.5 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-md border border-gray-100 dark:border-white/5">
                            <i data-lucide="mail" class="w-3.5 h-3.5 opacity-70"></i> ${user.email}
                        </span>
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto border-t border-gray-100 dark:border-gray-700 sm:border-0 pt-4 sm:pt-0 relative z-10">
                
                <div class="flex flex-col justify-center items-center px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10 bg-transparent min-w-[120px]">
                    <span class="text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 leading-none mb-1.5 text-center">Tarefas Ativas</span>
                    <span class="text-xl font-black text-custom-darkest dark:text-white leading-none text-center">${activeTasksCount}</span>
                </div>

                <div class="flex items-center gap-2.5">
                    <button type="button" class="edit-user-btn flex items-center justify-center w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-[1.05] active:scale-95 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 transition-all border border-transparent dark:border-blue-500/10 shadow-sm" data-user-email="${user.email}" title="Editar Perfil">
                        <i data-lucide="user-cog" class="w-5 h-5 pointer-events-none"></i>
                    </button>
                    
                    <button type="button" class="delete-user-btn flex items-center justify-center w-11 h-11 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 hover:scale-[1.05] active:scale-95 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-all border border-transparent dark:border-red-500/10 shadow-sm" data-user-id="${user.id || user.email}" title="Remover Acesso">
                        <i data-lucide="user-x" class="w-5 h-5 pointer-events-none"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="max-w-4xl mx-auto flex flex-col gap-6 animate-fade-in pb-12">
            
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 pb-2">
                <div>
                    <h1 class="text-3xl md:text-4xl font-extrabold text-custom-darkest dark:text-white tracking-tight">
                        Gestão de Utilizadores
                    </h1>
                    <p class="text-custom-dark dark:text-gray-400 mt-2 font-medium">Acessos e cargos</p>
                </div>
                
                <div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                    
                    <div class="relative w-full sm:w-64">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none h-full">
                            <i data-lucide="search" class="w-4 h-4 text-gray-400"></i>
                        </div>
                        <input type="text" id="userSearchInput" placeholder="Procurar utilizador..." class="w-full h-[50px] bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-2xl pl-11 pr-4 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white placeholder-gray-400 shadow-sm">
                    </div>

                    <button id="openNewUserModalBtn" class="w-full sm:w-auto flex-shrink-0 h-[50px] bg-custom-darkest text-white dark:bg-white dark:text-custom-darkest px-6 rounded-2xl text-sm font-bold shadow-xl shadow-custom-darkest/10 dark:shadow-white/5 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 border border-transparent dark:border-white/10">
                        <i data-lucide="plus" class="w-4 h-4 pointer-events-none"></i>
                        <span class="hidden sm:inline pointer-events-none tracking-wide">Novo Membro</span>
                    </button>
                </div>
            </div>

            <div class="space-y-4" id="user-list-container">
                ${userCards}
                
                <div id="no-users-found" class="hidden flex-col items-center justify-center py-12 text-gray-400 opacity-60">
                    <i data-lucide="users-2" class="w-16 h-16 mb-4"></i>
                    <p class="font-medium">Nenhum membro encontrado.</p>
                </div>
            </div>
        </div>

        <div id="userFormModal" class="fixed inset-0 z-[1500] hidden items-center justify-center p-4 modal-backdrop transition-opacity duration-300">
            
            <div class="absolute inset-0 close-user-modal"></div>
            
            <div class="orb-glass-unified backdrop-blur-[6px] w-full max-w-md p-8 relative z-10 flex flex-col shadow-2xl border border-white/20 dark:border-white/10 transform scale-95 opacity-0 transition-all duration-300" id="userFormModalContent">
                
                <button type="button" class="absolute top-6 right-6 p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/10 text-custom-darkest dark:text-white transition-all opacity-60 hover:opacity-100 close-user-modal">
                    <i data-lucide="x" class="w-5 h-5 pointer-events-none"></i>
                </button>

                <div class="mb-8">
                    <h2 id="user-form-title" class="text-2xl font-extrabold text-custom-darkest dark:text-white leading-tight tracking-tight">Novo Membro</h2>
                    <p id="user-form-subtitle" class="text-xs text-custom-dark dark:text-gray-400 font-medium mt-0.5 opacity-80">Adicionar ao SyncBoard</p>
                </div>
                
                <form id="addUserForm" class="space-y-6">
                    <input type="hidden" id="editUserId" value="">
                    
                    <div>
                        <label class="block text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2 flex items-center gap-2 text-custom-darkest dark:text-white">
                            <i data-lucide="user" class="w-3 h-3"></i> Nome de Exibição
                        </label>
                        <input type="text" id="newUserName" required placeholder="Ex: Maria Silva" class="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl text-sm text-custom-darkest dark:text-white focus:ring-0 focus:border-black/20 dark:focus:border-white/20 p-3 outline-none transition-all placeholder-black/30 dark:placeholder-white/20">
                    </div>

                    <div>
                        <label class="block text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2 flex items-center gap-2 text-custom-darkest dark:text-white">
                            <i data-lucide="mail" class="w-3 h-3"></i> Email (Google)
                        </label>
                        <input type="email" id="newUserEmail" required placeholder="maria@empresa.com" class="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl text-sm text-custom-darkest dark:text-white focus:ring-0 focus:border-black/20 dark:focus:border-white/20 p-3 outline-none transition-all placeholder-black/30 dark:placeholder-white/20">
                    </div>

                    <div>
                        <label class="block text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2 flex items-center gap-2 text-custom-darkest dark:text-white">
                            <i data-lucide="briefcase" class="w-3 h-3"></i> Cargo
                        </label>
                        <input type="text" id="newUserRole" placeholder="Ex: Frontend Developer..." class="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl text-sm text-custom-darkest dark:text-white focus:ring-0 focus:border-black/20 dark:focus:border-white/20 p-3 outline-none transition-all placeholder-black/30 dark:placeholder-white/20">
                    </div>

                    <div class="p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 mt-2">
                        <div class="flex items-center justify-between">
                            <div class="pr-4">
                                <p class="text-xs font-bold text-custom-darkest dark:text-white flex items-center gap-1.5 opacity-80">
                                    <i data-lucide="shield" class="w-4 h-4"></i> Privilégios Admin
                                </p>
                                <p class="text-[10px] text-custom-dark dark:text-gray-400 mt-1 leading-snug font-medium opacity-80">Permite editar projetos, gerir painéis e remover utilizadores.</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0 opacity-80 hover:opacity-100 transition-opacity">
                                <input type="checkbox" id="newUserIsAdmin" class="sr-only peer">
                                <div class="w-11 h-6 bg-black/20 dark:bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                        </div>
                    </div>

                    <div class="pt-4 flex flex-col gap-3">
                        <button type="submit" id="submitUserBtn" class="w-full py-4 rounded-xl text-sm font-bold bg-custom-darkest text-white hover:bg-custom-header dark:bg-white dark:text-custom-darkest shadow-lg shadow-custom-darkest/10 dark:shadow-white/5 transition-transform active:scale-95 flex items-center justify-center gap-2 group border border-transparent dark:border-white/10">
                            <i data-lucide="save" class="w-4 h-4 group-hover:scale-110 transition-transform pointer-events-none"></i>
                            <span class="tracking-wide pointer-events-none">Salvar Utilizador</span>
                        </button>
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
    const home = document.getElementById('homeView');
    const kanban = document.getElementById('kanbanView');
    const list = document.getElementById('listView');
    const archived = document.getElementById('archivedView');
    const users = document.getElementById('userManagementView');
    const main = document.getElementById('main-content');
    const label = document.getElementById('current-view-label');
    const sortOrb = document.getElementById('orb-sort'); 
    const filterOrb = document.getElementById('orb-filter'); // Pegamos o botão de filtro
    
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
                const name = typeof resp === 'object' ? resp.name : resp;
                const userObj = state.users.find(u => u.name === name);
                const pic = userObj ? userObj.picture : (typeof resp === 'object' ? resp.picture : null);
                const isMain = index === 0;
                const sizeClass = isMain ? 'w-10 h-10 ring-2 ring-white/20' : 'w-8 h-8 opacity-80 hover:opacity-100';
                const zIndex = 10 - index;

                const avatarEl = document.createElement('div');
                avatarEl.className = `${sizeClass} rounded-full bg-cover bg-center bg-gray-700 border border-white/10 shadow-lg transition-all hover:scale-105 hover:ring-white/50 relative group cursor-help`;
                avatarEl.style.zIndex = zIndex;
                avatarEl.title = isMain ? `Responsável Principal: ${name}` : name;

                if (pic) {
                    avatarEl.style.backgroundImage = `url('${pic}')`;
                } else {
                    avatarEl.classList.add('flex', 'items-center', 'justify-center');
                    avatarEl.innerHTML = `<span class="${isMain ? 'text-lg' : 'text-xs'} font-bold text-white">${name.charAt(0)}</span>`;
                }
                sidebarRespContainer.appendChild(avatarEl);
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
            const homolName = typeof task.homologador === 'object' ? task.homologador.name : task.homologador;
            const homolPic = typeof task.homologador === 'object' ? task.homologador.picture : null;
            const isApproved = task.status === 'publication';
            
            const borderColor = isApproved ? 'border-green-500' : 'border-orange-500';
            const bgColor = isApproved ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300';
            const statusText = isApproved ? 'Aprovado' : 'Pendente';
            const statusColor = isApproved ? 'text-green-400' : 'text-orange-400';

            const avatarImg = homolPic 
                ? `<img src="${homolPic}" class="w-8 h-8 rounded-full object-cover border-2 ${borderColor}">` 
                : `<div class="w-8 h-8 rounded-full ${bgColor} border-2 ${borderColor} flex items-center justify-center text-xs font-bold">${homolName.charAt(0)}</div>`;

            homologadorContent.innerHTML = `
                <div class="flex items-center gap-3 bg-black/10 dark:bg-white/5 pr-4 rounded-full border border-black/5 dark:border-white/10" title="Homologador: ${homolName}">
                    ${avatarImg}
                    <div class="flex flex-col py-1">
                        <span class="text-xs font-bold text-custom-darkest dark:text-white leading-none">${homolName.split(' ')[0]}</span>
                        <span class="text-[9px] ${statusColor} uppercase font-bold tracking-wider mt-0.5">${statusText}</span>
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
        const respEmails = (task.responsible || []).map(r => (typeof r === 'object' ? r.email : '')).filter(Boolean).join(',');
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
        renderAttachmentList('modal-info-attachments', task.attachments);
        attachContainer.classList.remove('hidden');
    } else if (attachContainer) {
        attachContainer.classList.add('hidden');
    }

    // Histórico
    const historyEl = document.getElementById('history-feed');
    if (historyEl) {
        const historyItems = (task.history || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        if (historyItems.length === 0) {
             historyEl.innerHTML = '<p class="text-xs text-white/30 italic">Nenhuma alteração registrada.</p>';
        } else {
            historyEl.innerHTML = historyItems.map(item => `
                <div class="relative pl-4 pb-4 border-l border-white/10 last:border-0 last:pb-0">
                    <div class="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-white/20 border border-white/10"></div>
                    <p class="text-xs text-white/70">Mudou para <span class="font-bold text-white">${item.status}</span></p>
                    <p class="text-[10px] text-white/30">${formatDateTime(item.timestamp)}</p>
                </div>
            `).join('');
        }
    }

    // Comentários
    const commentsEl = document.getElementById('comments-feed');
    const comments = (task.comments || []).map((c, i) => ({...c, index: i})).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (comments.length === 0) {
        commentsEl.innerHTML = '<div class="text-center text-white/20 py-10 italic text-sm">Nenhum comentário ainda.</div>';
    } else {
        commentsEl.innerHTML = comments.map(c => {
            const rawAuthor = typeof c.author === 'object' ? (c.author.email || c.author.name || '') : (c.author || '');
            let user = state.users.find(u => u.email === rawAuthor);
            if (!user) user = state.users.find(u => u.name && rawAuthor && u.name.toLowerCase() === rawAuthor.toLowerCase());

            const authorName = user ? user.name : (typeof c.author === 'object' ? (c.author.name || c.author.email || 'Usuário') : c.author);
            const picUrl = user ? user.picture : null;
            const initial = (authorName || 'U').charAt(0).toUpperCase();
            const avatarHtml = picUrl 
                ? `<div class="w-8 h-8 rounded-full border border-white/10 bg-cover bg-center shrink-0" style="background-image: url('${picUrl}')" title="${authorName}"></div>`
                : `<div class="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-bold text-xs text-white shrink-0" title="${authorName}">${initial}</div>`;

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
                return `<div class="flex gap-3 justify-end group items-end animate-fade-in pl-8 mb-2"><div class="flex flex-col items-end min-w-0 max-w-full"><div class="flex items-center gap-2 mb-1"><span class="text-[9px] text-white/30 shrink-0">${formatDateTime(c.timestamp)}</span><span class="text-xs font-bold text-white/90 truncate">Você</span><button class="edit-comment-btn text-amber-300/80 hover:text-amber-200 transition-colors p-1" data-task-id="${taskId}" data-comment-index="${c.index}" data-comment-key="${commentKey}" data-comment-text="${encodeURIComponent(c.text)}" title="Editar"><i data-lucide="pencil" class="w-3 h-3"></i></button><button class="delete-comment-btn text-red-400/90 hover:text-red-300 transition-colors p-1" data-task-id="${taskId}" data-comment-index="${c.index}" title="Excluir"><i data-lucide="trash-2" class="w-3 h-3"></i></button></div><div class="p-3 rounded-l-xl rounded-tr-xl border bg-blue-600/20 border-blue-500/30 text-sm text-gray-200 shadow-sm relative group-hover:border-blue-400/50 transition-colors break-words">${c.text}</div></div>${avatarHtml}</div>`;
            } else {
                return `<div class="flex gap-3 group items-end animate-fade-in pr-8 mb-2">${avatarHtml}<div class="flex flex-col items-start min-w-0 max-w-full"><div class="flex items-baseline gap-2 mb-1"><span class="text-xs font-bold text-white/90 truncate">${authorName}</span><span class="text-[9px] text-white/30 shrink-0">${formatDateTime(c.timestamp)}</span></div><div class="p-3 rounded-r-xl rounded-tl-xl border bg-white/5 border-white/10 text-sm text-gray-200 shadow-sm relative group-hover:border-white/20 transition-colors break-words">${c.text}</div></div></div>`;
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
                <div class="editor-toolbar">
                    <button type="button" class="editor-tool-btn" data-cmd="bold" title="Negrito">
                        <i data-lucide="bold" class="w-4 h-4"></i>
                    </button>
                    <button type="button" class="editor-tool-btn" data-cmd="italic" title="Itálico">
                        <i data-lucide="italic" class="w-4 h-4"></i>
                    </button>
                    <button type="button" class="editor-tool-btn" data-cmd="underline" title="Sublinhado">
                        <i data-lucide="underline" class="w-4 h-4"></i>
                    </button>
                    <div class="w-px h-4 bg-white/10 mx-1"></div>
                    <button type="button" class="editor-tool-btn" data-cmd="insertUnorderedList" title="Lista">
                        <i data-lucide="list" class="w-4 h-4"></i>
                    </button>
                </div>

                <div id="comment-input-rich" contenteditable="true" class="editor-content custom-scrollbar" placeholder="Escreva um comentário (use @ para mencionar)..."></div>

                <button id="add-comment-btn" class="absolute bottom-3 right-3 p-2 bg-custom-darkest dark:bg-white text-white dark:text-custom-darkest rounded-xl hover:scale-110 active:scale-95 transition-all shadow-md z-10">
                    <i data-lucide="send" class="w-4 h-4"></i>
                </button>
            </div>
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
                    <div class="mention-item" 
                         style="display: flex; align-items: center; gap: 10px; padding: 10px; cursor: pointer; color: white; border-radius: 8px; transition: background 0.2s;"
                         onmouseover="this.style.backgroundColor='rgba(56, 189, 248, 0.2)'" 
                         onmouseout="this.style.backgroundColor='transparent'"
                         data-email="${u.email}" 
                         data-name="${u.name}" 
                         data-pic="${u.picture || ''}">
                        <img src="${u.picture || 'https://i.imgur.com/6b6psVE.png'}" style="width: 24px; height: 24px; rounded-full; object-fit: cover; border-radius: 50%;">
                        <span style="font-size: 0.9rem; font-weight: 500;">${u.name}</span>
                    </div>
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
        const mentionHtml = `
            <span class="mention-tag" contenteditable="false" data-email="${email}" 
                  style="display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38BDF8; padding: 2px 8px 2px 2px; border-radius: 99px; font-size: 0.85em; font-weight: 600; vertical-align: middle; user-select: none; margin: 0 2px;">
                <img src="${pic}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">
                @${name}
            </span>&nbsp;
        `;

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
        newRange.setStartAfter(lastNode); // Posição após o &nbsp;
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
export function showConfirmModal(title, message, onConfirm, onCancel) {
    const modal = document.getElementById('deleteConfirmModal');
    modal.querySelector('h2').textContent = title;
    modal.querySelector('p').textContent = message;
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
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
            <div class="flex flex-col items-center justify-center py-16 text-custom-dark/50 dark:text-white/30">
                <i data-lucide="bell-off" class="w-12 h-12 mb-3 opacity-50"></i>
                <p class="text-sm font-bold tracking-wide uppercase">Tudo limpo por aqui</p>
            </div>
        `;
    } else {
        listContainer.innerHTML = notifs.map(n => `
            <div class="p-4 rounded-2xl border ${n.isRead ? 'bg-white/40 dark:bg-white/5 border-transparent opacity-60' : 'bg-white/80 dark:bg-[#1E293B]/80 border-blue-200 dark:border-blue-500/30 shadow-sm'} hover:scale-[1.01] transition-all duration-300 cursor-pointer flex gap-4 group" data-notif-id="${n.id}" data-task-id="${n.taskId}">
                
                <div class="mt-1 flex-shrink-0">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center ${n.isRead ? 'bg-black/5 dark:bg-white/10 text-custom-dark dark:text-gray-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}">
                        <i data-lucide="${n.isRead ? 'check' : 'bell'}" class="w-5 h-5"></i>
                    </div>
                </div>
                
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-1 gap-2">
                        <h4 class="text-sm font-bold text-custom-darkest dark:text-white leading-snug">${n.message}</h4>
                        <span class="text-[10px] font-bold text-custom-dark/60 dark:text-gray-400 whitespace-nowrap pt-0.5">${formatDateTime(n.createdAt)}</span>
                    </div>
                    <p class="text-xs font-medium text-custom-dark dark:text-gray-300 italic line-clamp-2">"${n.commentPreview}"</p>
                </div>
                
            </div>
        `).join('');
        
        if (window.lucide) lucide.createIcons();
        
        // 3. Lógica do Clique Coreografado
        listContainer.querySelectorAll('div[data-notif-id]').forEach(el => {
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