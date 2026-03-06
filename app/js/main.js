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

// Exemplo de código para adicionar no DOMContentLoaded ou no script principal
const setupSortOrbEvents = () => {
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

    // Fechar ao clicar fora (opcional, mas recomendado)
    document.addEventListener('click', (e) => {
        if (orb.classList.contains('expanded') && !orb.contains(e.target)) {
            orb.classList.remove('expanded');
        }
    });
};

// Chame isso uma vez ao carregar a página
document.addEventListener('DOMContentLoaded', setupSortOrbEvents);

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

                    // INTERCEPTAR IDA PARA HOMOLOGAÇÃO (Abre o modal)
                    if (oldStatus !== newStatus && newStatus === 'homologation') {
                        // Reverte o elemento no DOM para a coluna original visualmente
                        if (evt.oldIndex < evt.from.children.length) {
                            evt.from.insertBefore(itemEl, evt.from.children[evt.oldIndex]);
                        } else {
                            evt.from.appendChild(itemEl);
                        }
                        
                        // Abre o modal de escolha do homologador
                        openHomologadorModal(task, oldStatus, newStatus);
                        return; // O fluxo segue apenas se o modal for confirmado
                    }

                    // PREPARAR DADOS PARA ATUALIZAÇÃO DA TAREFA
                    let updatePayload = { status: newStatus };
                    
                    // SE SAIR DA HOMOLOGAÇÃO PARA OUTRA COLUNA: Remove o homologador
                    let removedHomologador = false;
                    if (oldStatus === 'homologation' && newStatus !== 'homologation') {
                        task.homologador = null;
                        updatePayload.homologador = null;
                        removedHomologador = true;
                    }

                    task.status = newStatus;

                    if (oldStatus !== newStatus) {
                        itemEl.classList.remove('border-l-[6px]', 'border-l-red-500');
                        
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
                            // Atualiza na API enviando o status e, se necessário, anulando o homologador
                            await api.updateTask(taskId, updatePayload);
                        }
                        await api.updateOrder(orderedTasksPayload);
                        
                        // Se removeu o homologador, renderiza novamente para limpar o crachá do front-end
                        if (removedHomologador) {
                            ui.renderKanbanView();
                            updateDragAndDropState();
                        }
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

// Gerencia o modal de seleção do homologador
function openHomologadorModal(task, oldStatus, newStatus) {
    const modal = document.getElementById('homologadorModal');
    const select = document.getElementById('homologadorSelect');
    
    // Popula a lista dinamicamente
    select.innerHTML = '<option value="" disabled selected>Selecione um usuário...</option>' + 
        state.users.filter(u => u.name !== 'DEFINIR').map(u => `<option value="${u.name}">${u.name}</option>`).join('');

    const confirmBtn = document.getElementById('confirmHomologadorBtn');
    const cancelBtn = document.getElementById('cancelHomologadorBtn');

    // FIX: Garante que o botão seja redefinido para o estado inicial sempre que abrir o modal
    confirmBtn.innerHTML = 'Confirmar';
    confirmBtn.disabled = false;

    // Remove event listeners antigos clonando os botões
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Mostra o modal
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('show'));

    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    newCancelBtn.onclick = closeModal;

    newConfirmBtn.onclick = async () => {
        const selectedName = select.value;
        if (!selectedName) return ui.showToast('Selecione um homologador', 'info');
        
        newConfirmBtn.innerHTML = '<i class="animate-spin" data-lucide="loader-2"></i> ...';
        newConfirmBtn.disabled = true;
        lucide.createIcons();

        const selectedUser = state.users.find(u => u.name === selectedName);
        const homologadorData = { name: selectedUser.name, picture: selectedUser.picture, email: selectedUser.email };

        try {
            task.status = newStatus;
            task.homologador = homologadorData;

            // Salva na API tanto o status quanto o homologador
            await api.updateTask(task.id, { status: newStatus, homologador: homologadorData });
            
            ui.renderKanbanView(); // Re-renderiza o quadro com a tarefa na coluna certa
            updateDragAndDropState(); // Reinicializa as instâncias do SortableJS
            ui.showToast(`Enviado para Homologação com ${selectedName.split(' ')[0]}!`, 'success');
            closeModal();
        } catch (error) {
            console.error(error);
            ui.showToast('Erro ao mover tarefa', 'error');
            newConfirmBtn.innerHTML = 'Confirmar'; // Em caso de erro, permite tentar de novo
            newConfirmBtn.disabled = false;
        }
    };
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

    // --- 2. ANIMAÇÃO CÍCLICA DOS ÍCONES ---
    const cyclingState = {};
    
    setInterval(() => {
        // Avalia tanto o menu de navegação (esquerda) quanto o menu de ferramentas/perfil (direita)
        const containers = [
            document.getElementById('orb-nav'), 
            document.getElementById('orb-tools')
        ].filter(Boolean);
        
        containers.forEach(container => {
            // Só cicla se o menu estiver FECHADO
            if (!container.classList.contains('expanded')) {
                // Seleciona os ícones do container que NÃO estão ocultos
                const icons = Array.from(container.querySelectorAll('.cycling-icon')).filter(el => !el.classList.contains('hidden'));
                
                if (icons.length === 0) return;
                
                // Se só sobrou 1 ícone visível (ex: zerou as notificações e ocultou o sino),
                // garante que a foto fique visível e para de ciclar.
                if (icons.length === 1) {
                    icons[0].classList.add('active');
                    return;
                }

                const cid = container.id;
                if (typeof cyclingState[cid] === 'undefined') cyclingState[cid] = 0;
                
                icons.forEach(icon => icon.classList.remove('active'));
                
                cyclingState[cid] = (cyclingState[cid] + 1) % icons.length;
                
                icons[cyclingState[cid]].classList.add('active');
            }
        });
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

    // --- DUPLO CLIQUE NO KANBAN PARA ABRIR TAREFA ---
    const kanbanView = document.getElementById('kanbanView');
    if (kanbanView) {
        kanbanView.addEventListener('dblclick', (e) => {
            const taskCard = e.target.closest('.task-card');
            
            if (taskCard) {
                // Previne a seleção de texto azul acidental ao dar duplo clique
                window.getSelection().removeAllRanges();
                
                // Vai buscar o ID da tarefa (que é guardado no atributo data-task-id)
                const taskId = taskCard.dataset.taskId;
                
                if (taskId) {
                    // Dá um pequeno destaque visual e abre o modal
                    ui.highlightTask(taskId, false);
                    ui.renderTaskHistory(taskId);
                }
            }
        });
    }

    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskModal = document.getElementById('taskModal');
    const taskForm = document.getElementById('taskForm');

    // [CORREÇÃO] Animação de entrada do Modal de Tarefa
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
        requestAnimationFrame(() => {
            taskModal.classList.add('show');
        });
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
                // Agora envia para publicação em vez de 'done'
                await api.updateTask(approveBtn.dataset.taskId, { status: 'publication' });
                ui.showToast('Enviado para Publicação!', 'success');
            } catch (err) { ui.showToast('Erro ao aprovar', 'error'); }
            return;
        }
        const publishBtn = e.target.closest('.publish-btn');
        if (publishBtn) {
            e.stopPropagation();
            try {
                // Este botão finaliza a tarefa (envia para arquivado)
                await api.updateTask(publishBtn.dataset.taskId, { status: 'done' });
                ui.showToast('Tarefa publicada e concluída!', 'success');
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
            // Nota: Para corrigir o modal de confirmação, é necessário editar o ui.js também
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

            // [CORREÇÃO] Fechar modal com animação
            taskModal.classList.remove('show');
            setTimeout(() => {
                taskModal.classList.add('hidden');
            }, 300);

        } catch (error) {
            console.error(error);
            ui.showToast('Erro ao salvar.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
        // [CORREÇÃO] Fechar modal com animação
        taskModal.classList.remove('show');
        
        setTimeout(() => {
            taskModal.classList.add('hidden'); // Fecha o modal de edição
            
            // Verifica se estava editando para reabrir o histórico
            if (state.editingTaskId) {
                ui.renderTaskHistory(state.editingTaskId);
                state.editingTaskId = null; 
            }
        }, 300);
    });

    document.getElementById('closeHistoryBtn').addEventListener('click', () => ui.closeTaskHistory(state.lastInteractedTaskId));

    // Evento para Aprovar a tarefa diretamente do Modal de Histórico
    const modalApproveBtn = document.getElementById('modal-approve-btn');
    if (modalApproveBtn) {
        modalApproveBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const taskId = modalApproveBtn.dataset.taskId;
            if (!taskId) return;

            try {
                // Feedback visual de carregamento
                modalApproveBtn.innerHTML = '<i class="animate-spin w-4 h-4" data-lucide="loader-2"></i><span class="hidden sm:inline">Aprovando...</span>';
                modalApproveBtn.disabled = true;
                if (window.lucide) lucide.createIcons();

                // Atualiza a tarefa na API enviando para o próximo status
                await api.updateTask(taskId, { status: 'publication' });
                ui.showToast('Tarefa aprovada para Publicação!', 'success');
                
                // Atualiza o state local (otimista) e recarrega a UI
                const taskIndex = state.tasks.findIndex(t => t.id === taskId);
                if(taskIndex !== -1) state.tasks[taskIndex].status = 'publication';
                
                ui.renderTaskHistory(taskId); // Re-renderiza o modal (vai esconder o botão agora que mudou de status)
                ui.updateActiveView(); // Atualiza a tela atrás do modal (Home, Lista ou Kanban)
                
            } catch (err) {
                console.error(err);
                ui.showToast('Erro ao aprovar tarefa', 'error');
                // Restaura o botão em caso de falha
                modalApproveBtn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span class="hidden sm:inline">Aprovar</span>';
                modalApproveBtn.disabled = false;
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // [CORREÇÃO] Animação de entrada do Modal de Edição
    document.getElementById('editTaskBtn').addEventListener('click', () => {
        const taskId = state.lastInteractedTaskId;
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;

        // Fecha o histórico e abre a edição
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
        requestAnimationFrame(() => {
            taskModal.classList.add('show');
        });
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

    // Listener para ações em comentários (Delegado no Modal de Histórico)
    document.getElementById('taskHistoryModal').addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-comment-btn');
        if (editBtn) {
            e.stopPropagation();
            const taskId = editBtn.dataset.taskId;
            const commentIndex = parseInt(editBtn.dataset.commentIndex);
            const commentKey = editBtn.dataset.commentKey;
            const originalText = decodeURIComponent(editBtn.dataset.commentText || '');

            const nextText = window.prompt('Editar comentário:', originalText);
            if (nextText === null) return;
            const trimmedText = nextText.trim();
            if (!trimmedText) return ui.showToast('Comentário não pode ficar vazio.', 'info');

            (async () => {
                try {
                    const currentAuthor = state.currentUser?.userId || state.currentUser?.email || state.currentUser?.userDetails;
                    await api.editComment(taskId, commentKey, trimmedText, currentAuthor);

                    const task = state.tasks.find(t => t.id === taskId);
                    if (task && task.comments && task.comments[commentIndex]) {
                        task.comments[commentIndex].text = trimmedText;
                        task.comments[commentIndex].editedAt = new Date().toISOString();
                    }

                    ui.renderTaskHistory(taskId);
                    ui.showToast('Comentário atualizado.', 'success');
                } catch (error) {
                    console.error(error);
                    ui.showToast('Erro ao editar comentário.', 'error');
                }
            })();
            return;
        }

        const deleteBtn = e.target.closest('.delete-comment-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const taskId = deleteBtn.dataset.taskId;
            const commentIndex = parseInt(deleteBtn.dataset.commentIndex);

            // Nota: Para corrigir o modal de confirmação, é necessário editar o ui.js também
            ui.showConfirmModal(
                'Excluir Comentário?',
                'Deseja realmente apagar este comentário permanentemente?',
                async () => {
                    try {
                        await api.deleteComment(taskId, commentIndex);

                        const task = state.tasks.find(t => t.id === taskId);
                        if (task && task.comments) {
                            task.comments.splice(commentIndex, 1);
                        }

                        ui.renderTaskHistory(taskId);
                        ui.showToast('Comentário removido.', 'success');
                    } catch (error) {
                        console.error(error);
                        ui.showToast('Erro ao excluir comentário.', 'error');
                    }
                }
            );
        }
    });

    const aiModal = document.getElementById('aiTitleModal');
    if (aiModal) {
        // [CORREÇÃO] Animação de entrada Modal IA
        document.getElementById('openAiModalBtn').addEventListener('click', () => {
            const current = document.getElementById('taskTitle').value;
            if(!current) return ui.showToast('Escreva um título primeiro', 'info');
            document.getElementById('ai-original-title').textContent = current;
            document.getElementById('ai-result-container').classList.add('hidden');
            document.getElementById('applyAiBtn').classList.add('hidden');
            document.getElementById('generateAiBtn').classList.remove('hidden');
            
            aiModal.classList.remove('hidden');
            requestAnimationFrame(() => {
                aiModal.classList.add('show');
            });
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

        const closeAiModal = () => {
            aiModal.classList.remove('show');
            setTimeout(() => {
                aiModal.classList.add('hidden');
            }, 300);
        };

        document.getElementById('applyAiBtn').addEventListener('click', () => {
            document.getElementById('taskTitle').value = document.getElementById('ai-result-text').value;
            closeAiModal();
        });

        document.getElementById('closeAiModalBtn').addEventListener('click', closeAiModal);
        document.getElementById('cancelAiBtn').addEventListener('click', closeAiModal);
    }

    // --- LÓGICA DO MODAL DE NOTIFICAÇÕES ---
    const notifBtn = document.getElementById('orb-notif-btn');
    const notifModal = document.getElementById('notificationsModal');
    const closeNotifBtn = document.getElementById('closeNotificationsBtn');

    if (notifBtn && notifModal) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Fecha o menu orbital
            document.getElementById('orb-tools').classList.remove('expanded');
            
            // Abre o modal de notificações com animação
            notifModal.classList.remove('hidden');
            requestAnimationFrame(() => {
                notifModal.classList.add('show');
            });
        });

        // Fechar pelo botão X
        if (closeNotifBtn) {
            closeNotifBtn.addEventListener('click', () => {
                notifModal.classList.remove('show');
                setTimeout(() => notifModal.classList.add('hidden'), 300);
            });
        }

        // Fechar clicando fora (no backdrop escuro)
        notifModal.addEventListener('click', (e) => {
            if (e.target === notifModal) {
                notifModal.classList.remove('show');
                setTimeout(() => notifModal.classList.add('hidden'), 300);
            }
        });
    }
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