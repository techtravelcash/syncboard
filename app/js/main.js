import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { connectToSignalR } from './signalr.js';

// --- Variáveis Globais ---
let kanbanSortableInstances = [];
let localFiles = [];
let alertQueue = [];
let isAlertModalOpen = false;

// --- PONTO DE ENTRADA ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Carrega Utilizador
        state.currentUser = await api.getUserInfo();

        // 2. Atualiza UI do Orb de Perfil
        if (state.currentUser) {
            updateUserProfileUI();
            
            // Verifica permissão
            if (!state.currentUser.userRoles.includes('travelcash_user')) {
                document.body.innerHTML = '<div class="flex items-center justify-center h-screen text-white bg-red-900">Acesso Negado</div>';
                return;
            }
            
            // Mostra botão de admin se necessário
            if (state.currentUser.userRoles.includes('admin')) {
                const adminBtn = document.getElementById('user-management-btn');
                if(adminBtn) adminBtn.classList.remove('hidden');
            }
        }

        // 3. Carrega Dados
        const [users, tasks] = await Promise.all([
            api.fetchUsers(),
            api.fetchTasks()
        ]);
        state.users = users;
        state.tasks = tasks;

        // 4. Inicializa UI e Filtros
        ui.populateProjectFilter();
        ui.populateResponsibleFilter();
        ui.updateNotificationBadge();
        ui.updateActiveView();

        // 5. Remove Loader
        const loader = document.getElementById('loader-container');
        const mainContent = document.getElementById('main-content');
        if (loader) {
            loader.style.transition = 'opacity 0.5s';
            loader.style.opacity = '0';
            setTimeout(() => loader.classList.add('hidden'), 500);
        }
        if (mainContent) {
            mainContent.style.opacity = '1';
        }

        // 6. Conecta SignalR e Eventos
        connectToSignalR(updateDragAndDropState);
        updateDragAndDropState();
        initializeEventListeners();
        
        // Verifica alertas iniciais
        checkAndQueueAlerts(state.tasks);

    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
        alert("Erro ao carregar aplicação.");
    }
});

// --- ATUALIZA PERFIL NO ORB (Botão e Menu) ---
function updateUserProfileUI() {
    const nameDisplay = document.getElementById('user-name-display');
    const roleDisplay = document.getElementById('user-role-display');
    const avatarMenu = document.getElementById('user-avatar-menu'); 
    const avatarOrb = document.getElementById('orb-avatar-container');

    if (nameDisplay) nameDisplay.textContent = state.currentUser.userDetails || 'Utilizador';
    if (roleDisplay) roleDisplay.textContent = state.currentUser.userRoles.includes('admin') ? 'Administrador' : 'Membro';

    const picClaim = state.currentUser.claims.find(c => c.typ === 'picture' || c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/picture');
    const photoUrl = picClaim ? picClaim.val : null;

    if (photoUrl) {
        const imgTag = `<img src="${photoUrl}" class="w-full h-full object-cover">`;
        if (avatarMenu) avatarMenu.innerHTML = imgTag;
        if (avatarOrb) avatarOrb.innerHTML = imgTag;
        api.updateUserPhoto(photoUrl).catch(console.error);
    } else {
        const initial = (state.currentUser.userDetails || 'U').charAt(0).toUpperCase();
        const placeholder = `<div class="w-full h-full bg-custom-dark text-white flex items-center justify-center font-bold text-xl">${initial}</div>`;
        if (avatarMenu) avatarMenu.innerHTML = placeholder;
        if (avatarOrb) avatarOrb.innerHTML = placeholder;
    }
}

// --- DRAG AND DROP ---
function updateDragAndDropState() {
    kanbanSortableInstances.forEach(i => i.destroy());
    kanbanSortableInstances = [];

    if (state.currentView === 'kanban') {
        const columns = document.querySelectorAll('.kanban-task-list');
        
        columns.forEach(list => {
            const sortable = new Sortable(list, {
                group: 'kanban',
                animation: 150,
                delay: 100,
                delayOnTouchOnly: true,
                ghostClass: 'opacity-50',
                dragClass: 'rotate-2',
                
                onEnd: async (evt) => {
                    const itemEl = evt.item;
                    const taskId = itemEl.dataset.taskId;
                    const newStatus = evt.to.dataset.columnId;
                    const oldStatus = evt.from.dataset.columnId;
                    
                    const task = state.tasks.find(t => t.id === taskId);
                    if (!task) return;

                    task.status = newStatus;

                    if (oldStatus !== newStatus) {
                        itemEl.classList.remove('border-l-[6px]', 'border-l-red-500');
                        if (ui.isTaskOverdue(task)) {
                           // Mantém estilo se necessário
                        }
                        
                        const oldColHeader = evt.from.parentElement.querySelector('.column-count');
                        const newColHeader = evt.to.parentElement.querySelector('.column-count');
                        if(oldColHeader) oldColHeader.textContent = Math.max(0, parseInt(oldColHeader.textContent) - 1);
                        if(newColHeader) newColHeader.textContent = parseInt(newColHeader.textContent) + 1;
                    }

                    const orderedTasksPayload = [];
                    document.querySelectorAll('.kanban-task-list').forEach(column => {
                        Array.from(column.children).forEach((card, index) => {
                            const cId = card.dataset.taskId;
                            if (cId) {
                                const t = state.tasks.find(k => k.id === cId);
                                if (t) {
                                    t.order = index;
                                    orderedTasksPayload.push({ id: cId, order: index });
                                }
                            }
                        });
                    });

                    try {
                        if (oldStatus !== newStatus) {
                            await api.updateTask(taskId, { status: newStatus });
                        }
                        await api.updateOrder(orderedTasksPayload);
                    } catch (error) {
                        console.error("Erro no sync:", error);
                        ui.showToast('Erro ao salvar posição.', 'error');
                        ui.renderKanbanView();
                    }
                }
            });
            kanbanSortableInstances.push(sortable);
        });
    }
}

// --- EVENT LISTENERS ---
function initializeEventListeners() {
    const orbs = ['orb-nav', 'orb-filter', 'orb-tools'];
    
    orbs.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;

        el.addEventListener('click', (e) => {
            if (e.target.closest('.close-btn')) return;
            orbs.filter(o => o !== id).forEach(other => document.getElementById(other).classList.remove('expanded'));
            el.classList.add('expanded');
        });

        const closeBtn = el.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                el.classList.remove('expanded');
            });
        }
    });

    const canvas = document.querySelector('.immersive-canvas');
    if (canvas) {
        canvas.addEventListener('click', (e) => {
            if (!e.target.closest('.corner-orb') && !e.target.closest('.orb-fab')) {
                orbs.forEach(id => document.getElementById(id).classList.remove('expanded'));
            }
        });
    }

    // --- 2. ANIMAÇÃO CÍCLICA DOS ÍCONES (CORRIGIDO) ---
    let navIconIdx = 0;
    
    setInterval(() => {
        const navOrb = document.getElementById('orb-nav');
        // RE-SELECIONA os ícones a cada ciclo para garantir que temos os elementos atuais do DOM
        const navIcons = document.querySelectorAll('#orb-nav .cycling-icon');
        
        if (navIcons.length === 0) return;

        // Só alterna se o menu estiver FECHADO
        if (navOrb && !navOrb.classList.contains('expanded')) {
            navIcons.forEach(icon => icon.classList.remove('active'));
            
            navIconIdx = (navIconIdx + 1) % navIcons.length;
            
            navIcons[navIconIdx].classList.add('active');
        }
    }, 1500); // 1.5 segundos

    document.getElementById('view-switcher-orb').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        state.currentView = btn.dataset.view;
        ui.updateActiveView();
        updateDragAndDropState();
        document.getElementById('orb-nav').classList.remove('expanded');
    });

    const setupFilterClick = (containerId, type) => {
        const container = document.getElementById(containerId);
        if(!container) return;
        container.addEventListener('click', (e) => {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            const val = chip.dataset.value;
            if (type === 'project') state.selectedProject = val;
            if (type === 'responsible') state.selectedResponsible = val;
            ui.populateProjectFilter();
            ui.populateResponsibleFilter();
            ui.updateActiveView();
            updateDragAndDropState();
        });
    };
    setupFilterClick('orb-project-filters', 'project');
    setupFilterClick('orb-responsible-filters', 'responsible');

    document.getElementById('search-input').addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        ui.updateActiveView();
    });

    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskModal = document.getElementById('taskModal');
    const taskForm = document.getElementById('taskForm');

    addTaskBtn.addEventListener('click', () => {
        state.editingTaskId = null;
        document.getElementById('modalTitle').textContent = 'Nova Tarefa';
        taskForm.reset();
        localFiles = [];
        ui.renderModalAttachments(localFiles);
        document.getElementById('no-due-date-checkbox').checked = false;
        document.getElementById('taskDueDate').disabled = false;
        ui.setupResponsibleInput([]);
        ui.setupProjectSuggestions();
        ui.setupCustomColorPicker();
        document.getElementById('status-container').classList.add('hidden');
        taskModal.classList.remove('hidden');
    });

    document.getElementById('main-content').addEventListener('click', async (e) => {
        const infoBtn = e.target.closest('.info-btn');
        if (infoBtn) {
            e.stopPropagation();
            state.lastInteractedTaskId = infoBtn.dataset.taskId;
            ui.renderTaskHistory(state.lastInteractedTaskId);
            return;
        }
        const approveBtn = e.target.closest('.approve-btn');
        if (approveBtn) {
            e.stopPropagation();
            try {
                await api.updateTask(approveBtn.dataset.taskId, { status: 'done' });
                ui.showToast('Tarefa concluída!', 'success');
            } catch (err) { ui.showToast('Erro ao concluir', 'error'); }
            return;
        }
        const restoreBtn = e.target.closest('.restore-btn');
        if (restoreBtn) {
            e.stopPropagation();
            try {
                await api.updateTask(restoreBtn.dataset.taskId, { status: 'todo' });
                ui.showToast('Tarefa restaurada', 'success');
                ui.renderArchivedTasks();
            } catch (err) { ui.showToast('Erro ao restaurar', 'error'); }
            return;
        }
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            ui.showConfirmModal(
                'Excluir Tarefa',
                'Tem a certeza? Esta ação é irreversível.',
                async () => {
                    try {
                        await api.deleteTask(deleteBtn.dataset.taskId);
                        ui.showToast('Tarefa eliminada', 'info');
                        if(state.currentView === 'archived') ui.renderArchivedTasks();
                        else ui.updateActiveView();
                    } catch (err) { ui.showToast('Erro ao eliminar', 'error'); }
                }
            );
            return;
        }
    });

    const fileInput = document.getElementById('task-attachment-input');
    fileInput.addEventListener('change', (e) => {
        for (const file of e.target.files) {
            localFiles.push(file);
        }
        ui.renderModalAttachments(localFiles);
        fileInput.value = '';
    });

    document.getElementById('attachment-list').addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-attachment-btn');
        if (removeBtn) {
            const index = parseInt(removeBtn.dataset.index, 10);
            localFiles.splice(index, 1);
            ui.renderModalAttachments(localFiles);
        }
    });

    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = taskForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        try {
            const uploadedAttachments = [];
            for (const file of localFiles) {
                if (file instanceof File) {
                    try {
                        const uploaded = await api.uploadAttachment(file);
                        uploadedAttachments.push(uploaded);
                    } catch (err) { console.error(err); }
                } else {
                    uploadedAttachments.push(file);
                }
            }

            const tags = document.querySelectorAll('#responsible-input-container > div span');
            const responsiblePayload = Array.from(tags).map(span => {
                const name = span.textContent;
                return state.users.find(u => u.name === name);
            }).filter(Boolean);

            const payload = {
                title: document.getElementById('taskTitle').value,
                description: document.getElementById('taskDescription').value,
                responsible: responsiblePayload,
                project: document.getElementById('taskProject').value,
                projectColor: document.getElementById('taskProjectColor').value,
                priority: document.getElementById('taskPriority').value,
                dueDate: document.getElementById('taskDueDate').value || null,
                azureLink: document.getElementById('taskAzureLink').value,
                attachments: uploadedAttachments,
                status: state.editingTaskId ? document.getElementById('taskStatus').value : 'todo'
            };

            if (state.editingTaskId) {
                await api.updateTask(state.editingTaskId, payload);
                ui.showToast('Tarefa atualizada!', 'success');
            } else {
                await api.createTask(payload);
                ui.showToast('Tarefa criada!', 'success');
            }

            taskModal.classList.add('hidden');

        } catch (error) {
            console.error(error);
            ui.showToast('Erro ao salvar.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    document.getElementById('cancelBtn').addEventListener('click', () => taskModal.classList.add('hidden'));
    document.getElementById('closeHistoryBtn').addEventListener('click', () => document.getElementById('taskHistoryModal').classList.add('hidden'));

    document.getElementById('editTaskBtn').addEventListener('click', () => {
        const taskId = state.lastInteractedTaskId;
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;

        document.getElementById('taskHistoryModal').classList.add('hidden');
        state.editingTaskId = taskId;
        document.getElementById('modalTitle').textContent = 'Editar Tarefa';
        
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description;
        document.getElementById('taskProject').value = task.project || '';
        document.getElementById('taskProjectColor').value = task.projectColor || '#526D82';
        document.getElementById('color-picker-button').style.backgroundColor = task.projectColor || '#526D82';
        document.getElementById('taskPriority').value = task.priority || 'Média';
        document.getElementById('taskAzureLink').value = task.azureLink || '';
        
        if (task.dueDate) {
            document.getElementById('taskDueDate').value = task.dueDate.split('T')[0];
            document.getElementById('no-due-date-checkbox').checked = false;
        } else {
            document.getElementById('taskDueDate').value = '';
            document.getElementById('no-due-date-checkbox').checked = true;
        }

        document.getElementById('status-container').classList.remove('hidden');
        document.getElementById('taskStatus').value = task.status;

        localFiles = task.attachments ? [...task.attachments] : [];
        ui.renderModalAttachments(localFiles);
        ui.setupResponsibleInput(task.responsible || []);
        ui.setupProjectSuggestions();
        ui.setupCustomColorPicker();

        taskModal.classList.remove('hidden');
    });

    document.getElementById('add-comment-btn').addEventListener('click', async () => {
        const input = document.getElementById('comment-input');
        const text = input.value.trim();
        if (!text || !state.lastInteractedTaskId) return;

        try {
            await api.addComment(state.lastInteractedTaskId, { text });
            input.value = '';
        } catch (e) { ui.showToast('Erro ao comentar', 'error'); }
    });

    const aiModal = document.getElementById('aiTitleModal');
    if (aiModal) {
        document.getElementById('openAiModalBtn').addEventListener('click', () => {
            const current = document.getElementById('taskTitle').value;
            if(!current) return ui.showToast('Escreva um título primeiro', 'info');
            document.getElementById('ai-original-title').textContent = current;
            document.getElementById('ai-result-container').classList.add('hidden');
            document.getElementById('applyAiBtn').classList.add('hidden');
            document.getElementById('generateAiBtn').classList.remove('hidden');
            aiModal.classList.remove('hidden');
        });

        document.getElementById('generateAiBtn').addEventListener('click', async () => {
            const title = document.getElementById('taskTitle').value;
            const instr = document.getElementById('ai-instruction').value;
            const btn = document.getElementById('generateAiBtn');
            btn.disabled = true;
            btn.innerHTML = 'Gerando...';
            try {
                const res = await api.improveTitle(title, instr);
                document.getElementById('ai-result-text').value = res.title;
                document.getElementById('ai-result-container').classList.remove('hidden');
                btn.classList.add('hidden');
                document.getElementById('applyAiBtn').classList.remove('hidden');
            } catch (e) { ui.showToast('Erro na IA', 'error'); }
            finally { btn.disabled = false; btn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i> Gerar'; lucide.createIcons(); }
        });

        document.getElementById('applyAiBtn').addEventListener('click', () => {
            document.getElementById('taskTitle').value = document.getElementById('ai-result-text').value;
            aiModal.classList.add('hidden');
        });

        document.getElementById('closeAiModalBtn').addEventListener('click', () => aiModal.classList.add('hidden'));
        document.getElementById('cancelAiBtn').addEventListener('click', () => aiModal.classList.add('hidden'));
    }

    const notifBtn = document.getElementById('orb-notif-btn');
    const notifList = document.getElementById('orb-notifications-list');
    if (notifBtn) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifList.classList.toggle('hidden');
        });
    }

    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    const applyTheme = (isDark) => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            if(themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
        } else {
            document.documentElement.classList.remove('dark');
            if(themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
        }
        lucide.createIcons();
    };

    const savedTheme = localStorage.getItem('theme');
    const prefersDark = savedTheme === 'dark' || !savedTheme;
    applyTheme(prefersDark);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isDarkNow = document.documentElement.classList.contains('dark');
            const newThemeIsDark = !isDarkNow;
            applyTheme(newThemeIsDark);
            localStorage.setItem('theme', newThemeIsDark ? 'dark' : 'light');
        });
    }
}

// --- ALERTA DE SINALIZAÇÃO ---
function checkAndQueueAlerts(tasks) {
    if (!state.currentUser) return;
    const myName = state.currentUser.userDetails;
    if (!myName) return;
    tasks.forEach(task => {
        if (task.pendingAlerts && task.pendingAlerts.includes(myName)) {
            if (!alertQueue.find(t => t.id === task.id)) {
                alertQueue.push(task);
            }
        }
    });
    if (alertQueue.length > 0) processAlertQueue();
}

function processAlertQueue() {
    if (alertQueue.length === 0 || isAlertModalOpen) return;
    const task = alertQueue[0];
    isAlertModalOpen = true;
    const modal = document.getElementById('alertModal');
    document.getElementById('alert-task-id').textContent = task.id;
    document.getElementById('alert-task-title').textContent = task.title;
    document.getElementById('alert-queue-count').textContent = alertQueue.length - 1;
    const btn = document.getElementById('dismissAlertBtn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', async () => {
        newBtn.textContent = 'Confirmando...';
        try {
            await api.dismissAlert(task.id);
            alertQueue.shift();
            modal.classList.add('hidden');
            isAlertModalOpen = false;
            if (alertQueue.length > 0) setTimeout(processAlertQueue, 500);
        } catch (e) { newBtn.textContent = 'Erro ao confirmar'; }
    });
    modal.classList.remove('hidden');
}