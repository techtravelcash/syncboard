import { canDecideHomologation, openForwardDialog, canEditHomologationResponsible, homologationEditPayload, selectHomologador, homologationAssignmentPayload, canRecoverHomologador } from './homologation-v2.js';
import { showApprovalSuccess } from './approval-success.js';
import { isFidelityV2, hasFidelityFilters, initializeFidelityControls } from './fidelity-v2.js';
import { state } from './state.js';
import { escapePeopleText, peopleAvatar } from './people-v2.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { connectToSignalR } from './signalr.js';
import { initializeShell, closeShellPanels, syncShellView, showStartupState } from './shell-v2.js';

// --- Variáveis Globais ---
let kanbanSortableInstances = [];
let localFiles = [];
let filesToDelete = [];
let editingTaskSnapshot = null;
let editingFormSnapshot = null;
let alertQueue = [];
let isAlertModalOpen = false;

function taskFormDraft(attachments) {
    const tags = document.querySelectorAll('#responsible-input-container > div span');
    const responsiblePayload = document.getElementById('responsible-input-container').getResponsibles?.() || Array.from(tags).map(span => {
        const name = span.textContent;
        return state.users.find(u => u.name === name);
    }).filter(Boolean);

    return {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        responsible: responsiblePayload,
        project: document.getElementById('taskProject').value,
        projectColor: document.getElementById('taskProjectColor').value,
        priority: document.getElementById('taskPriority').value,
        dueDate: document.getElementById('taskDueDate').value || null,
        azureLink: document.getElementById('taskAzureLink').value,
        attachments,
        status: state.editingTaskId ? document.getElementById('taskStatus').value : 'todo'
    };
}

// One in-flight decision per task, shared by card and detail actions.
const pendingHomologationDecisions = state.pendingHomologationDecisions = new Set();
async function decideHomologation(taskId, decision, newResponsibleEmail) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!canDecideHomologation(task, state.currentUser) || pendingHomologationDecisions.has(taskId)) {
        ui.showToast('A decisão está indisponível. Confira o homologador e a etapa da tarefa.', 'error');
        return false;
    }
    const rejecting = decision === 'reject';
    const forwarding = decision === 'forward';
    const payload = { homologationAction: decision, expectedStatus: 'homologation', expectedEtag: task._etag };
    if (forwarding) payload.newResponsibleEmail = newResponsibleEmail;
    pendingHomologationDecisions.add(taskId);
    const buttons = [...document.querySelectorAll('.approve-btn, .reject-btn, .forward-btn, #modal-approve-btn, #modal-reject-btn, #modal-forward-btn')]
        .filter(button => button.dataset.taskId === taskId);
    buttons.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); });
    let persisted = false;
    try {
        const updatedTask = await api.updateTask(taskId, payload);
        const expectedStatus = { approve: 'publication', reject: 'inprogress', forward: 'todo' }[decision];
        if (updatedTask?.status !== expectedStatus) throw new Error('A decisão não foi confirmada pelo servidor.');
        persisted = true;
        const index = state.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) state.tasks[index] = { ...state.tasks[index], ...updatedTask };
        ui.showToast(forwarding ? 'Tarefa encaminhada para Fila com o novo responsável!' : rejecting ? 'Tarefa reprovada e devolvida para Andamento!' : 'Tarefa aprovada para Publicação!', 'success');
        const modal = document.getElementById('taskHistoryModal');
        // A delayed response must not reopen a closed detail or replace another task.
        if (!forwarding && state.lastInteractedTaskId === taskId && modal && !modal.classList.contains('hidden') && modal.classList.contains('show')) ui.renderTaskHistory(taskId, state.returnToNotifications);
        ui.updateActiveView();
        if (decision === 'approve' && updatedTask.status === 'publication') {
            try { showApprovalSuccess(() => ui.closeApprovedTaskHistory(taskId)); } catch { /* Cosmetic feedback must not report a persisted approval as failed. */ }
        }
        return true;
    } catch (err) {
        if (persisted) {
            ui.showToast('Decisão salva. Recarregue a página para atualizar a visualização.', 'success');
            return true;
        }
        let refreshed = false;
        if (err.status === 409) {
            try {
                state.tasks = await api.fetchTasks();
                ui.updateActiveView();
                const modal = document.getElementById('taskHistoryModal');
                if (state.lastInteractedTaskId === taskId && modal && !modal.classList.contains('hidden') && modal.classList.contains('show')) ui.renderTaskHistory(taskId, state.returnToNotifications);
                refreshed = true;
            } catch { /* Keep the decision explicit; never retry a write automatically. */ }
        }
        const message = err.status === 403 ? 'Somente o homologador atribuído pode decidir esta tarefa.' : err.status === 409 ? (refreshed ? 'A tarefa mudou e foi atualizada. Confira os dados antes de tentar novamente.' : 'A tarefa mudou. Recarregue a página antes de decidir.') : 'Não foi possível salvar a decisão. Tente novamente.';
        ui.showToast(message, 'error');
        return false;
    } finally {
        pendingHomologationDecisions.delete(taskId);
        [...document.querySelectorAll('.approve-btn, .reject-btn, .forward-btn, #modal-approve-btn, #modal-reject-btn, #modal-forward-btn')].filter(button => button.dataset.taskId === taskId).forEach(button => { button.disabled = persisted; button.removeAttribute('aria-busy'); });
    }
}

function startHomologationDecision(taskId, decision) {
    const task = state.tasks.find(t => t.id === taskId);
    if (decision !== 'forward') return decideHomologation(taskId, decision);
    if (!canDecideHomologation(task, state.currentUser) || pendingHomologationDecisions.has(taskId)) return;
    const modal = document.getElementById('taskHistoryModal');
    const fromDetail = state.lastInteractedTaskId === taskId && modal && !modal.classList.contains('hidden') && modal.classList.contains('show');
    if (openForwardDialog(task, state.users, email => decideHomologation(taskId, 'forward', email), () => {
        // Restore focus only after the native dialog releases its modal focus trap.
        // The closer also protects a different detail opened while awaiting the server.
        if (fromDetail) ui.closeApprovedTaskHistory(taskId);
    }) === false) {
        ui.showToast('Não foi possível abrir a seleção de responsável neste navegador.', 'error');
    }
}

// --- PONTO DE ENTRADA ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const initialTheme = localStorage.getItem('theme');
        document.documentElement.classList.toggle('dark', initialTheme === 'dark' || !initialTheme);
    } catch { /* A blocked preference store must not prevent the loading screen. */ }
    try {
        initializeShell();
        // 1. Carrega a Sessão do Utilizador (Google Auth)
        state.currentUser = await api.getUserInfo();
        if (!state.currentUser) {
            showStartupState('Sua sessão não está disponível', 'Acesse sua conta ou tente carregar novamente para continuar.', true);
            return;
        }

        // 2. Verifica permissões de acesso
        if (state.currentUser) {
            if (!state.currentUser.userRoles.includes('travelcash_user')) {
                showStartupState('Acesso não autorizado', 'Esta conta não possui acesso ao SyncBoard NT. Entre com uma conta autorizada.', true);
                return;
            }
            if (state.currentUser.userRoles.includes('admin')) {
                const adminBtn = document.getElementById('user-management-btn');
                if(adminBtn) adminBtn.classList.remove('hidden');
            }
        }

        // 3. Carrega os Dados (Isto tem de acontecer ANTES de renderizar o perfil)
        const [users, tasks] = await Promise.all([
            api.fetchUsers(),
            api.fetchTasks()
        ]);
        state.users = users;
        state.tasks = tasks;

        // 4. Atualiza a UI do Orb de Perfil (Agora já tem acesso à lista state.users)
        if (state.currentUser) {
            updateUserProfileUI();
        }

        // 5. Inicializa UI e Filtros
        ui.populateProjectFilter();
        ui.populateResponsibleFilter();
        ui.updateNotificationBadge();
        ui.updateActiveView();

        // 6. Conecta SignalR e Eventos
        connectToSignalR(updateDragAndDropState);
        updateDragAndDropState();
        initializeEventListeners();

        // Verifica alertas iniciais
        checkAndQueueAlerts(state.tasks);

        // 7. Reveal only after every synchronous initializer has succeeded
        const loader = document.getElementById('loader-container');
        const mainContent = document.getElementById('main-content');
        if (loader) {
            loader.style.transition = 'opacity 0.5s';
            loader.style.opacity = '0';
            setTimeout(() => loader.classList.add('hidden'), 500);
        }
        if (mainContent) {
            mainContent.style.opacity = '1';
            mainContent.setAttribute('aria-busy', 'false');
        }

        document.getElementById('app').inert = false;

    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
        showStartupState('Não foi possível carregar o SyncBoard NT', 'Verifique sua conexão e tente novamente para recarregar suas informações.');
    }
});

// --- ATUALIZA PERFIL NO ORB (Botão e Menu) ---
function updateUserProfileUI() {
    const nameDisplay = document.getElementById('user-name-display');
    const roleDisplay = document.getElementById('user-role-display');
    const avatarMenu = document.getElementById('user-avatar-menu'); 
    const avatarOrb = document.getElementById('orb-avatar-container');

    // 1. Procura o utilizador logado na Base de Dados (para obter o nome e cargo editados)
    const authEmail = state.currentUser.userDetails; // Email que vem do Google Auth
    const dbUser = state.users.find(u => u.email.toLowerCase() === authEmail.toLowerCase());

    // 2. Prioriza o Nome e Cargo da BD. Se não encontrar, usa os do Google por defeito.
   const displayName = dbUser ? (dbUser.displayName || dbUser.name) : (state.currentUser.userDetails || 'Utilizador');
    const displayRole = (dbUser && dbUser.role) ? dbUser.role : (state.currentUser.userRoles.includes('admin') ? 'Administrador' : 'Membro');

    if (nameDisplay) nameDisplay.textContent = displayName;
    if (roleDisplay) roleDisplay.textContent = displayRole;

    // 3. Trata a fotografia de perfil
    const profileClaims = Array.isArray(state.currentUser.claims) ? state.currentUser.claims : [];
    const picClaim = profileClaims.find(c => c?.typ === 'picture' || c?.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/picture');
    const photoUrl = picClaim ? picClaim.val : null;

    if (photoUrl) {
        const imgTag = peopleAvatar(displayName, photoUrl);
        if (avatarMenu) avatarMenu.innerHTML = imgTag;
        if (avatarOrb) avatarOrb.innerHTML = imgTag;
        // Atualiza a foto na BD silenciosamente
        api.updateUserPhoto(photoUrl).catch(console.error);
    } else {
        const placeholder = peopleAvatar(displayName, null);
        if (avatarMenu) avatarMenu.innerHTML = placeholder;
        if (avatarOrb) avatarOrb.innerHTML = placeholder;
    }
}

// --- DRAG AND DROP ---
function updateDragAndDropState() {
    kanbanSortableInstances.forEach(i => i.destroy());
    kanbanSortableInstances = [];

    // Filtered boards allow status moves, never reordering a partial task set.
    const filtered = typeof isFidelityV2 === 'function' && isFidelityV2() && hasFidelityFilters(state);
    if (state.currentView === 'kanban') {
        const columns = document.querySelectorAll('.kanban-task-list');
        
        columns.forEach(list => {
            const sortable = new Sortable(list, {
                group: 'kanban',
                ...((typeof isFidelityV2 === 'function' && isFidelityV2()) ? { filter: 'button:not(.fidelity-task-open), summary, details, input, select, a', preventOnFilter: false, sort: !filtered } : {}),
                animation: 150,
                delay: 100,
                delayOnTouchOnly: true,
                ghostClass: 'opacity-50',
                dragClass: 'rotate-2',
                
                onEnd: async (evt) => {
                    if (!kanbanSortableInstances.includes(sortable) || filtered !== (typeof isFidelityV2 === 'function' && isFidelityV2() && hasFidelityFilters(state))) {
                        ui.renderKanbanView(); updateDragAndDropState(); return;
                    }
                    const itemEl = evt.item;
                    const taskId = itemEl.dataset.taskId;
                    const newStatus = evt.to.dataset.columnId;
                    const oldStatus = evt.from.dataset.columnId;
                    
                    if (filtered && oldStatus === newStatus) {
                        ui.renderKanbanView(); updateDragAndDropState(); return;
                    }

                    const task = state.tasks.find(t => t.id === taskId);
                    if (!task) return;

                    if (oldStatus === 'homologation' && newStatus !== oldStatus) {
                        ui.renderKanbanView(); updateDragAndDropState();
                        ui.showToast('Use Aprovar, Reprovar ou Encaminhar para decidir a homologação.', 'info');
                        return;
                    }

                    // INTERCEPTAR IDA PARA HOMOLOGAÇÃO
                    if (oldStatus !== newStatus && newStatus === 'homologation') {
                        if (evt.oldIndex < evt.from.children.length) {
                            evt.from.insertBefore(itemEl, evt.from.children[evt.oldIndex]);
                        } else {
                            evt.from.appendChild(itemEl);
                        }
                        openHomologadorModal(task, oldStatus, newStatus);
                        return; 
                    }

                    // PREPARAR DADOS PARA ATUALIZAÇÃO DA TAREFA
                    let updatePayload = { status: newStatus, oldStatus: oldStatus };

                    // --- Forçar 100% no progresso se for Publicação ou Concluído ---
                    if (newStatus === 'publication' || newStatus === 'done') {
                        updatePayload.progress = 100;
                        task.progress = 100; // Atualiza na memória local
                    }
                    
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
                    if (!filtered) document.querySelectorAll('.kanban-task-list').forEach(column => {
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
                            await api.updateTask(taskId, updatePayload);
                        }
                        if (!filtered) await api.updateOrder(orderedTasksPayload);
                        
                        if (filtered) {
                            ui.updateActiveView();
                        } else if (removedHomologador) {
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

// Entry and orphan recovery persist only after an explicit email selection.
const pendingHomologationAssignments = new Set();
async function openHomologadorModal(task, oldStatus, newStatus, recovery = false) {
    if (pendingHomologationAssignments.has(task.id)) return;
    if (recovery && !canRecoverHomologador(task, state.currentUser, state.users)) return;
    const snapshot = structuredClone(task);
    pendingHomologationAssignments.add(task.id);
    let persisted = false;
    try {
        state.users = await api.fetchUsers();
        if (recovery && !canRecoverHomologador(snapshot, state.currentUser, state.users)) {
            ui.showToast('A recuperação está indisponível. Confira seu acesso e o homologador atual.', 'error');
            return;
        }
        const email = await selectHomologador(state.users, recovery);
        if (!email) return;
        const payload = homologationAssignmentPayload(snapshot, email, state.users, recovery);
        const beforeRequest = state.tasks.find(item => item.id === task.id);
        const updatedTask = await api.updateTask(task.id, payload);
        if (updatedTask?.status !== 'homologation' || !updatedTask?.homologador?.email) throw new Error('A atribuição não foi confirmada pelo servidor.');
        persisted = true;
        const index = state.tasks.findIndex(item => item.id === task.id);
        // Do not replace a more recent SignalR update with a delayed HTTP response.
        if (index !== -1 && state.tasks[index] === beforeRequest) state.tasks[index] = updatedTask;
        ui.updateActiveView();
        updateDragAndDropState();
        const detail = document.getElementById('taskHistoryModal');
        if (state.lastInteractedTaskId === task.id && detail && !detail.classList.contains('hidden') && detail.classList.contains('show')) ui.renderTaskHistory(task.id, state.returnToNotifications);
        ui.showToast(recovery ? 'Homologador atribuído. A tarefa aguarda validação.' : 'Tarefa enviada para Homologação!', 'success');
    } catch (error) {
        if (persisted) { ui.showToast('Atribuição salva. Recarregue a página para atualizar a visualização.', 'success'); return; }
        if (error.status === 409) {
            try { state.tasks = await api.fetchTasks(); ui.updateActiveView(); } catch { /* Never retry an uncertain write automatically. */ }
        }
        ui.showToast(error.status === 409 ? 'A tarefa mudou. Reabra a tarefa e confira os dados antes de tentar novamente.' : error.status === 403 ? 'Você não tem permissão para esta atribuição.' : error.status === 400 ? 'O homologador selecionado é inválido ou não está mais cadastrado. Reabra a seleção para atualizar os usuários.' : error.message || 'Não foi possível atribuir o homologador.', 'error');
    } finally { pendingHomologationAssignments.delete(task.id); }
}

// --- EVENT LISTENERS ---
function initializeEventListeners() {
    if (typeof isFidelityV2 === 'function' && isFidelityV2()) {
        initializeFidelityControls(state, { refresh: () => { ui.updateActiveView(); } });
        document.addEventListener('sb:fidelity-view-updated', updateDragAndDropState);
    }
    // Shell presentation owns panel state and accessible focus.
    document.getElementById('view-switcher-orb').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-view]');
        if (!btn) return;
        state.currentView = btn.dataset.view;
        ui.updateActiveView();
        updateDragAndDropState();
        syncShellView(state.currentView);
        closeShellPanels();
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

    const kanbanView = document.getElementById('kanbanView');
    if (kanbanView) {
        kanbanView.addEventListener('dblclick', (e) => {
            const taskCard = e.target.closest('.task-card');
            
            if (taskCard) {
                window.getSelection().removeAllRanges();
                const taskId = taskCard.dataset.taskId;
                
                if (taskId) {
                    ui.highlightTask(taskId, false);
                    ui.renderTaskHistory(taskId);
                }
            }
        });
    }

    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskModal = document.getElementById('taskModal');
    const taskForm = document.getElementById('taskForm');

    addTaskBtn.addEventListener('click', () => {
        state.editingTaskId = null;
        editingTaskSnapshot = null;
        editingFormSnapshot = null;
        document.getElementById('modalTitle').textContent = 'Nova Tarefa';
        taskForm.reset();
        localFiles = [];
        filesToDelete = [];
        ui.renderModalAttachments(localFiles);
        document.getElementById('no-due-date-checkbox').checked = false;
        document.getElementById('taskDueDate').disabled = false;
        document.getElementById('responsible-input-container').inert = false;
        ui.setupResponsibleInput([]);
        ui.setupProjectSuggestions();
        ui.setupCustomColorPicker();
        document.getElementById('taskStatus').disabled = false;
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
        const decisionBtn = e.target.closest('.approve-btn, .reject-btn, .forward-btn');
        if (decisionBtn) {
            e.stopPropagation();
            const decision = decisionBtn.classList.contains('forward-btn') ? 'forward' : decisionBtn.classList.contains('reject-btn') ? 'reject' : 'approve';
            await startHomologationDecision(decisionBtn.dataset.taskId, decision);
            return;
        }
        const publishBtn = e.target.closest('.publish-btn');
        if (publishBtn) {
            e.stopPropagation();
            try {
                // E também garantimos os 100% se for direto para concluído
                await api.updateTask(publishBtn.dataset.taskId, { status: 'done', progress: 100 });
                ui.showToast('Tarefa publicada e concluída!', 'success');
            } catch (err) { ui.showToast('Erro ao concluir', 'error'); }
            return;
        }
        const restoreBtn = e.target.closest('.restore-btn');
        if (restoreBtn) {
            e.stopPropagation();
            const taskId = restoreBtn.dataset.taskId;
            try {
                // Ao atualizar para "todo", a tarefa sai do arquivo e volta pra fila
                await api.updateTask(taskId, { status: 'todo' });
                ui.showToast(`Tarefa #${taskId} restaurada com sucesso!`, 'success');
                ui.renderArchivedTasks();
            } catch (err) { 
                ui.showToast('Erro ao restaurar a tarefa', 'error'); 
            }
            return;
        }
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn && !deleteBtn.classList.contains('delete-user-btn') && !deleteBtn.classList.contains('delete-comment-btn')) {
            e.stopPropagation();
            ui.showDestructiveConfirmModal(
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

        /// ==========================================
        // GESTÃO DE UTILIZADORES E MODAL
        // ==========================================

        // 1. ABRIR MODAL: NOVO MEMBRO
        const openNewUserBtn = e.target.closest('#openNewUserModalBtn');
        if (openNewUserBtn) {
            e.stopPropagation();
            document.getElementById('addUserForm').reset();
            document.getElementById('editUserId').value = '';
            
            document.getElementById('user-form-title').textContent = 'Novo Membro';
            document.getElementById('user-form-subtitle').textContent = 'Adicionar ao SyncBoard';
            document.getElementById('submitUserBtn').querySelector('span').textContent = 'Salvar Utilizador';

            const modal = document.getElementById('userFormModal');
            const content = document.getElementById('userFormModalContent');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            requestAnimationFrame(() => {
                modal.classList.add('show');
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            });
            return;
        }

        // 2. ABRIR MODAL: EDITAR MEMBRO
        const editUserBtn = e.target.closest('.edit-user-btn');
        if (editUserBtn) {
            e.stopPropagation();
            const userEmail = editUserBtn.dataset.userEmail;
            const user = state.users.find(u => u.email === userEmail);
            
            if (user) {
                document.getElementById('editUserId').value = user.id || user.email;
                document.getElementById('newUserName').value = user.displayName || user.name || '';
                document.getElementById('newUserEmail').value = user.email;
                document.getElementById('newUserRole').value = user.role || '';
                document.getElementById('newUserIsAdmin').checked = user.isAdmin;
                document.getElementById('newUserIsAiAgent').checked = user.isAiAgent === true;

                document.getElementById('user-form-title').textContent = 'Editar Membro';
                document.getElementById('user-form-subtitle').textContent = 'Atualizar informações';
                document.getElementById('submitUserBtn').querySelector('span').textContent = 'Atualizar Utilizador';

                const modal = document.getElementById('userFormModal');
                const content = document.getElementById('userFormModalContent');
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                requestAnimationFrame(() => {
                    modal.classList.add('show');
                    content.classList.remove('scale-95', 'opacity-0');
                    content.classList.add('scale-100', 'opacity-100');
                });
            }
            return;
        }

        // 3. FECHAR MODAL
        const closeUserModalBtn = e.target.closest('.close-user-modal');
        if (closeUserModalBtn) {
            e.stopPropagation();
            const modal = document.getElementById('userFormModal');
            const content = document.getElementById('userFormModalContent');
            
            modal.classList.remove('show'); // <-- CORREÇÃO: Esconde o backdrop
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }, 300);
            return;
        }

        // 4. APAGAR UTILIZADOR (Mantém exatamente igual)
        const deleteUserBtn = e.target.closest('.delete-user-btn');
        if (deleteUserBtn) {
            e.stopPropagation();
            const userId = deleteUserBtn.dataset.userId;
            
            ui.showDestructiveConfirmModal(
                'Remover Acesso',
                'Tem a certeza? Este utilizador perderá o acesso ao SyncBoard imediatamente.',
                async () => {
                    try {
                        await api.deleteUser(userId);
                        ui.showToast('Membro removido com sucesso.', 'info');
                        
                        state.users = await api.fetchUsers();
                        ui.renderUserManagementView();
                    } catch (err) { 
                        ui.showToast(escapePeopleText(err.message || 'Erro ao remover membro.'), 'error');
                    }
                }
            );
            return;
        }
    });

    // ==========================================
    // DELEGAÇÃO DO SUBMIT DE FORMULÁRIOS INJETADOS DINAMICAMENTE
    // ==========================================
    document.getElementById('main-content').addEventListener('submit', async (e) => {
        if (e.target.id === 'addUserForm') {
            e.preventDefault();
            
            const btn = document.getElementById('submitUserBtn');
            const originalHtml = btn.innerHTML;
            
            btn.disabled = true;
            btn.innerHTML = '<i class="animate-spin w-5 h-5" data-lucide="loader-2"></i><span>A guardar...</span>';
            if (window.lucide) lucide.createIcons();

            const editUserId = document.getElementById('editUserId').value;
            const payload = {
                displayName: document.getElementById('newUserName').value,
                email: document.getElementById('newUserEmail').value,
                role: document.getElementById('newUserRole').value,
                isAdmin: document.getElementById('newUserIsAdmin').checked,
                isAiAgent: document.getElementById('newUserIsAiAgent').checked
            };

            try {
                if (editUserId) {
                    // MODO EDIÇÃO: Agora chama a API correta de Update
                    await api.updateUser(editUserId, payload);
                    ui.showToast('Membro atualizado com sucesso!', 'success');
                } else {
                    // MODO CRIAÇÃO
                    await api.addUser(payload);
                    ui.showToast('Novo membro adicionado à equipa!', 'success');
                }

                // Recarrega a lista do servidor
                state.users = await api.fetchUsers();
                
                // Redesenha a vista de Gestão de Utilizadores
                ui.renderUserManagementView();

                // 🌟 NOVO: Atualiza instantaneamente o seu perfil no menu superior direito!
                updateUserProfileUI();

            } catch (error) {
                console.error(error);
                ui.showToast(escapePeopleText(error.message || 'Erro ao guardar as alterações.'), 'error');
            }
        }
    });

    document.getElementById('modal-recover-homologador-btn')?.addEventListener('click', () => {
        const task = state.tasks.find(item => item.id === state.lastInteractedTaskId);
        if (task) openHomologadorModal(task, task.status, task.status, true);
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
            const blobName = removeBtn.dataset.blobName; // O ui.js já insere este atributo!
            
            // Se for um ficheiro que já está na Azure, colocamos na fila de eliminação
            if (blobName) {
                filesToDelete.push(blobName);
            }
            
            localFiles.splice(index, 1);
            ui.renderModalAttachments(localFiles);
        }
    });

    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = taskForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        if (btn.disabled) return;
        const savingTaskId = state.editingTaskId;
        const savingSnapshot = editingTaskSnapshot;
        const savingFormSnapshot = editingFormSnapshot;
        const savingFiles = [...localFiles];
        const deletingFiles = [...filesToDelete];
        const payload = taskFormDraft(savingFiles);
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        try {
            if (savingSnapshot?.status === 'homologation') homologationEditPayload(savingSnapshot, payload, state.currentUser, savingFormSnapshot);
            if (savingTaskId && savingSnapshot?.status !== 'homologation' && payload.status === 'homologation') {
                state.users = await api.fetchUsers();
                if (state.editingTaskId !== savingTaskId || editingTaskSnapshot !== savingSnapshot) return;
                const email = await selectHomologador(state.users);
                if (!email || state.editingTaskId !== savingTaskId || editingTaskSnapshot !== savingSnapshot) return;
                Object.assign(payload, homologationAssignmentPayload(savingSnapshot, email, state.users));
            }
            const uploadedAttachments = [];
            for (const file of savingFiles) {
                if (file instanceof File) {
                    try {
                        const uploaded = await api.uploadAttachment(file);
                        uploadedAttachments.push(uploaded);
                    } catch (err) { throw err; }
                } else {
                    uploadedAttachments.push(file);
                }
            }

            // Closing/canceling during an upload must not start a later task write.
            if (state.editingTaskId !== savingTaskId || editingTaskSnapshot !== savingSnapshot) return;
            payload.attachments = uploadedAttachments;

            if (savingTaskId) {
                const patch = savingSnapshot?.status === 'homologation'
                    ? homologationEditPayload(savingSnapshot, payload, state.currentUser, savingFormSnapshot) : payload;
                const beforeRequest = state.tasks.find(task => task.id === savingTaskId);
                const updatedTask = await api.updateTask(savingTaskId, patch);
                const index = state.tasks.findIndex(task => task.id === savingTaskId);
                // SignalR may have delivered a newer decision while the HTTP response was in flight.
                if (index !== -1 && state.tasks[index] === beforeRequest) state.tasks[index] = updatedTask;
                ui.updateActiveView();
                ui.showToast('Tarefa atualizada!', 'success');
            } else {
                await api.createTask(payload);
                ui.showToast('Tarefa criada!', 'success');
            }

            // Delete blobs only after the task save succeeds, never after an ETag conflict.
            for (const blob of deletingFiles) {
                try { await api.deleteAttachment(blob); } catch (err) { console.error(err); }
            }
            if (state.editingTaskId === savingTaskId && editingTaskSnapshot === savingSnapshot) {
                filesToDelete = [];
                taskModal.classList.remove('show');
                setTimeout(() => {
                    if (state.editingTaskId === savingTaskId && editingTaskSnapshot === savingSnapshot) taskModal.classList.add('hidden');
                }, 300);
            }

        } catch (error) {
            console.error(error);
            ui.showToast(error.status === 409 ? 'A tarefa mudou. Cancele e reabra a edição antes de salvar.' : error.status === 403 ? 'Você não tem permissão para esta alteração.' : error.status === 400 && payload.status === 'homologation' && savingSnapshot?.status !== 'homologation' ? 'O homologador selecionado é inválido ou não está mais cadastrado. Tente salvar novamente para atualizar a seleção.' : error.message || 'Erro ao salvar.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
        const cancelledTaskId = state.editingTaskId;
        state.editingTaskId = null;
        editingTaskSnapshot = null;
        editingFormSnapshot = null;
        taskModal.classList.remove('show');
        setTimeout(() => {
            if (state.editingTaskId !== null || taskModal.classList.contains('show')) return;
            taskModal.classList.add('hidden');
            if (cancelledTaskId) ui.renderTaskHistory(cancelledTaskId);
        }, 300);
    });

    document.getElementById('closeHistoryBtn').addEventListener('click', () => ui.closeTaskHistory(state.lastInteractedTaskId));

    for (const [id, decision] of [['modal-approve-btn', 'approve'], ['modal-reject-btn', 'reject'], ['modal-forward-btn', 'forward']]) {
        document.getElementById(id)?.addEventListener('click', async (event) => {
            event.stopPropagation();
            await startHomologationDecision(event.currentTarget.dataset.taskId, decision);
        });
    }

    document.getElementById('editTaskBtn').addEventListener('click', () => {
        const taskId = state.lastInteractedTaskId;
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;

        document.getElementById('taskHistoryModal').classList.add('hidden');
        
        state.editingTaskId = taskId;
        editingTaskSnapshot = JSON.parse(JSON.stringify(task));
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
        document.getElementById('taskStatus').disabled = task.status === 'homologation';

        localFiles = task.attachments ? [...task.attachments] : [];
        filesToDelete = [];
        ui.renderModalAttachments(localFiles);
        document.getElementById('responsible-input-container').inert = task.status === 'homologation' && !canEditHomologationResponsible(task, state.currentUser);
        document.getElementById('responsible-input-container').title = task.status === 'homologation' ? (canEditHomologationResponsible(task, state.currentUser) ? 'Alterar responsáveis mantém a tarefa em Homologação.' : 'Somente administradores podem editar responsáveis durante a homologação.') : '';
        ui.setupResponsibleInput(task.responsible || []);
        editingFormSnapshot = taskFormDraft(localFiles);
        ui.setupProjectSuggestions();
        ui.setupCustomColorPicker();

        taskModal.classList.remove('hidden');
        requestAnimationFrame(() => {
            taskModal.classList.add('show');
        });
    });

    // Evento para o botão de sinalização (Megafone) no cabeçalho da tarefa
    const signalBtn = document.getElementById('modal-signal-btn');
    if (signalBtn) {
        signalBtn.addEventListener('click', () => {
            const taskId = state.lastInteractedTaskId;
            if (!taskId) return;

            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;

            if (task.status === 'homologation') return;
            const responsibleList = task.responsible || [];
            if (responsibleList.length === 0) {
                ui.showToast('Esta tarefa não possui responsáveis para sinalizar.', 'info');
                return;
            }

            const modal = document.getElementById('signalConfirmModal');
            const confirmBtn = document.getElementById('confirmSignalBtn');
            const cancelBtn = document.getElementById('cancelSignalBtn');
            const targetsContainer = document.getElementById('signal-targets-container');

            // Renderiza os checkboxes dinamicamente
            targetsContainer.innerHTML = responsibleList.map((r, index) => {
                const name = typeof r === 'object' ? r.name : r;
                // Deixa apenas o primeiro responsável (Principal) marcado por padrão
                const checked = index === 0 ? 'checked' : '';
                return `
                    <label class="sb-signal-target">
                        <input type="checkbox" value="${escapePeopleText(String(name))}" class="target-checkbox" ${checked}>
                        <span class="sb-signal-name">${escapePeopleText(name || 'Nome não informado')}</span>
                        ${index === 0 ? '<span class="sb-signal-principal">Principal</span>' : ''}
                    </label>
                `;
            }).join('');
            
            if(window.lucide) lucide.createIcons();

            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

            const closeModal = () => {
                modal.classList.remove('show');
                setTimeout(() => modal.classList.add('hidden'), 300);
            };

            cancelBtn.onclick = closeModal;

            newConfirmBtn.onclick = async () => {
                // Coleta quem o usuário selecionou
                const checkedBoxes = targetsContainer.querySelectorAll('.target-checkbox:checked');
                const selectedTargets = Array.from(checkedBoxes).map(cb => cb.value);

                if (selectedTargets.length === 0) {
                    ui.showToast('Selecione pelo menos um responsável.', 'info');
                    return;
                }

                newConfirmBtn.innerHTML = '<i class="animate-spin w-5 h-5 mx-auto" data-lucide="loader-2"></i>';
                newConfirmBtn.disabled = true;

                try {
                    signalBtn.innerHTML = '<i class="animate-spin w-6 h-6" data-lucide="loader-2"></i>';
                    
                    // Passa a lista selecionada para a API
                    await api.signalResponsible(taskId, selectedTargets);
                    ui.showToast('Responsáveis sinalizados com sucesso!', 'success');
                    
                } catch (err) {
                    console.error(err);
                    ui.showToast('Erro ao sinalizar', 'error'); 
                } finally {
                    setTimeout(() => {
                        signalBtn.innerHTML = '<i data-lucide="megaphone" class="w-6 h-6"></i>';
                        if(window.lucide) lucide.createIcons();
                    }, 1000);
                    
                    newConfirmBtn.innerHTML = 'Sinalizar';
                    newConfirmBtn.disabled = false;
                    closeModal();
                }
            };

            modal.classList.remove('hidden');
            requestAnimationFrame(() => modal.classList.add('show'));
        });
    }

    document.getElementById('add-comment-btn').addEventListener('click', async () => {
        const input = document.getElementById('comment-input');
        const text = input.value.trim();
        if (!text || !state.lastInteractedTaskId) return;

        try {
            await api.addComment(state.lastInteractedTaskId, { text });
            input.value = '';
        } catch (e) { ui.showToast('Erro ao comentar', 'error'); }
    });

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

            ui.showDestructiveConfirmModal(
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

    const notifBtn = document.getElementById('orb-notif-btn');
    const notifModal = document.getElementById('notificationsModal');
    const closeNotifBtn = document.getElementById('closeNotificationsBtn');

    if (notifBtn && notifModal) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            closeShellPanels(false);
            
            notifModal.classList.remove('hidden');
            requestAnimationFrame(() => {
                notifModal.classList.add('show');
            });
        });

        if (closeNotifBtn) {
            closeNotifBtn.addEventListener('click', () => {
                notifModal.classList.remove('show');
                setTimeout(() => notifModal.classList.add('hidden'), 300);
            });
        }

        notifModal.addEventListener('click', (e) => {
            if (e.target === notifModal) {
                notifModal.classList.remove('show');
                setTimeout(() => notifModal.classList.add('hidden'), 300);
            }
        });
    }
    const notifList = document.getElementById('orb-notifications-list');
    if (notifBtn && notifList) {
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
    
    // Cria um Set de identificadores do usuário para garantir que ele seja reconhecido
    const myIdentifiers = [
        state.currentUser.userDetails?.toLowerCase(),
        state.currentUser.userId?.toLowerCase(),
        state.currentUser.claims?.find(c => c.typ === 'name')?.val?.toLowerCase()
    ].filter(Boolean);

    // Opcional: Pegar o nome do BD caso exista
    const dbUser = state.users.find(u => myIdentifiers.includes(u.email?.toLowerCase()));
    if (dbUser && dbUser.name) myIdentifiers.push(dbUser.name.toLowerCase());

    tasks.forEach(task => {
        if (task.pendingAlerts && task.pendingAlerts.length > 0) {
            // Verifica se o usuário atual está na lista de pendingAlerts
            const myAlert = task.pendingAlerts.find(alertItem => {
                const target = typeof alertItem === 'object' ? alertItem.targetUser : alertItem;
                return myIdentifiers.includes(target.toLowerCase());
            });

            if (myAlert && !alertQueue.find(t => t.task.id === task.id)) {
                alertQueue.push({ task: task, alertData: myAlert });
            }
        }
    });
    
    if (alertQueue.length > 0) processAlertQueue();
}

function processAlertQueue() {
    if (alertQueue.length === 0 || isAlertModalOpen) return;
    
    const { task, alertData } = alertQueue[0];
    isAlertModalOpen = true;
    
    const modal = document.getElementById('alertModal');
    document.getElementById('alert-task-id').textContent = '#' + task.id;
    document.getElementById('alert-task-title').textContent = task.title;
    document.getElementById('alert-queue-count').textContent = alertQueue.length - 1;
    
    const signaledBy = (typeof alertData === 'object' && alertData.signaledBy) 
        ? alertData.signaledBy
        : 'Um colega';
    document.getElementById('alert-signaled-by').textContent = signaledBy;

    const btn = document.getElementById('dismissAlertBtn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // --- 1. RESET DO ESTADO DO BOTÃO ---
    newBtn.innerHTML = '<i data-lucide="check-circle" class="w-6 h-6"></i> Recebido, vou olhar!';
    newBtn.disabled = false;
    // -----------------------------------
    
    newBtn.addEventListener('click', async () => {
        newBtn.innerHTML = '<i class="animate-spin w-5 h-5" data-lucide="loader-2"></i> Confirmando...';
        newBtn.disabled = true; // Bloqueia cliques duplos

        try {
            await api.dismissAlert(task.id);
            alertQueue.shift(); // Remove da fila
            
            ui.updateNotificationBadge();
            
            modal.classList.remove('show');
            setTimeout(() => {
                modal.classList.add('hidden');
                isAlertModalOpen = false;
                
                // Abre a tarefa automaticamente
                ui.highlightTask(task.id);
                ui.renderTaskHistory(task.id);
                
                // --- 2. REMOVIDO: Não chamamos mais o próximo alerta aqui! ---
                // Deixamos isso a cargo do Observador abaixo.
            }, 300);
        } catch (e) { 
            newBtn.innerHTML = 'Erro ao confirmar, tente novamente'; 
            newBtn.disabled = false;
        }
    });

    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('show'));
    if (window.lucide) lucide.createIcons();
}

// --- OBSERVADOR DE FLUXO DE ALERTAS ---
// Fica a observar o modal do histórico de tarefas. 
// Quando ele for fechado, dispara o próximo alerta da fila (se houver).
const taskHistoryModalEl = document.getElementById('taskHistoryModal');
if (taskHistoryModalEl) {
    const modalObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            // Verifica se a classe CSS do modal foi alterada
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                
                // Se o modal acabou de receber a classe 'hidden' (ou seja, fechou)
                if (taskHistoryModalEl.classList.contains('hidden')) {
                    
                    // Verifica se ainda há alertas na fila e garante que não há nenhum alerta aberto
                    if (alertQueue.length > 0 && !isAlertModalOpen) {
                        // Aguarda 500ms para a animação de fecho respirar antes de atirar o próximo alerta
                        setTimeout(processAlertQueue, 500);
                    }
                }
            }
        });
    });
    
    // Inicia a observação dos atributos
    modalObserver.observe(taskHistoryModalEl, { attributes: true });
}
