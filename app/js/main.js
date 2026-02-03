import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { connectToSignalR } from './signalr.js';
import { updateNotificationBadge, setupCommentAutocomplete } from './ui.js';

// --- Variáveis Globais ---
let listSortableInstance = null;
let kanbanSortableInstances = [];
let localFiles = []; // Array para guardar objetos de arquivo (File ou {url, name})
let alertQueue = [];
let isAlertModalOpen = false;

// --- PONTO DE ENTRADA DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    const loaderContainerEl = document.getElementById('loader-container');
    const mainContentEl = document.getElementById('main-content');
    try {
        // Carrega dados essenciais primeiro
        state.currentUser = await api.getUserInfo();

        if (state.currentUser && state.currentUser.claims) {
            const pictureClaim = state.currentUser.claims.find(c => c.typ === 'picture' || c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/picture');
            const photoUrl = pictureClaim ? pictureClaim.val : state.currentUser.claims.find(c => c.val && c.val.includes('googleusercontent.com'))?.val;

            if (photoUrl) {
                // Usa a nova função do api.js
                // Não usamos 'await' para não bloquear o carregamento da página
                api.updateUserPhoto(photoUrl).catch(err => console.error("SyncBoard: Erro na foto:", err));
            }
        }

        if (!state.currentUser || !state.currentUser.userRoles.includes('travelcash_user')) {
            loaderContainerEl.innerHTML = `
                <div class="text-center text-white p-8">
                    <h1 class="text-2xl font-bold mb-4">Acesso Negado</h1>
                    <p class="mb-6">A conta selecionada não tem permissão para aceder a este quadro.</p>
                    <a href="/logout" class="bg-white text-custom-darkest font-bold py-3 px-6 rounded-lg inline-block">Tentar com outra conta</a>
                </div>
            `;
            const video = document.getElementById('loader-video');
            if (video) video.style.display = 'none';
            return;
        }
        
        // Mostra o botão de gestão se o utilizador for admin
        if (state.currentUser && state.currentUser.userRoles.includes('admin')) {
            document.getElementById('user-management-btn').classList.remove('hidden');
        }

        const [users, tasks] = await Promise.all([
            api.fetchUsers(),
            api.fetchTasks()
        ]);
        state.users = users;
        state.tasks = tasks;
        updateNotificationBadge();
        checkAndQueueAlerts(state.tasks);

        // A inicialização dos event listeners só acontece depois de os dados estarem disponíveis
        initializeEventListeners();

        // 1. Lógica do Dropdown de Notificação
        const notifBtn = document.getElementById('notification-btn');
        const notifDropdown = document.getElementById('notification-dropdown');

        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('hidden');
        });

        document.getElementById('refresh-notifications').addEventListener('click', (e) => {
            e.stopPropagation();
            updateNotificationBadge();
        });

        // Fechar dropdown ao clicar fora
        document.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                notifDropdown.classList.add('hidden');
            }
        });


        // 2. Ativar o Autocomplete quando abrir o histórico da tarefa
        // Procure onde você tem o evento para abrir o histórico (ex: info-btn click ou editTaskBtn)
        document.body.addEventListener('click', async (e) => {
            const infoBtn = e.target.closest('.info-btn');
            if (infoBtn) {
                setTimeout(() => setupCommentAutocomplete(), 500); // Timeout pequeno para esperar o modal renderizar
            }
        });
        
        loaderContainerEl.classList.add('hidden');
        mainContentEl.classList.add('content-reveal');
        mainContentEl.style.opacity = '1';

        ui.updateActiveView();
        
        updateDragAndDropState();
        
        // Passamos a função de atualização do drag-and-drop para o SignalR
        connectToSignalR(updateDragAndDropState);
        checkAndQueueAlerts(state.tasks);

    } catch (error)
    {
        console.error("Falha na inicialização:", error);
        loaderContainerEl.innerHTML = `<p class="text-red-500 text-2xl">Falha ao carregar: ${error.message}</p>`;
    }
});

// --- FUNÇÃO "MESTRE" PARA GERENCIAR O DRAG-AND-DROP ---
function updateDragAndDropState() {
    if (listSortableInstance) {
        listSortableInstance.destroy();
        listSortableInstance = null;
    }
    kanbanSortableInstances.forEach(instance => instance.destroy());
    kanbanSortableInstances = [];

    if (state.currentView === 'kanban') {
        initializeKanbanDragAndDrop();
    } 
    else if (state.currentView === 'list' && state.selectedResponsible !== 'all') {
        initializeListDragAndDrop();
    }
}

// --- FUNÇÃO CENTRAL QUE INICIALIZA TODAS AS INTERAÇÕES ---
function initializeEventListeners() {
    const taskModal = document.getElementById('taskModal');
    const taskForm = document.getElementById('taskForm');
    const historyModal = document.getElementById('taskHistoryModal');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const listViewEl = document.getElementById('listView');
    
    const dueDateInput = document.getElementById('taskDueDate');
    const noDueDateCheckbox = document.getElementById('no-due-date-checkbox');
    const fileInput = document.getElementById('task-attachment-input');
    const attachmentList = document.getElementById('attachment-list');

    // LÓGICA DA BUSCA
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
        state.searchQuery = searchInput.value.trim().toLowerCase();
        ui.updateActiveView();
    });

    // Lógica para anexos
    fileInput.addEventListener('change', (e) => {
        for (const file of e.target.files) {
            localFiles.push(file);
        }
        ui.renderModalAttachments(localFiles);
        fileInput.value = '';
    });

    attachmentList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-attachment-btn');
        if (removeBtn) {
            const indexToRemove = parseInt(removeBtn.dataset.index, 10);
            const blobName = removeBtn.dataset.blobName;
            const fileToRemove = localFiles[indexToRemove];

            if (blobName && !(fileToRemove instanceof File)) {
                ui.showConfirmModal(
                    'Excluir Anexo',
                    `Tem a certeza de que deseja excluir o anexo "${fileToRemove.name}"? Esta ação é permanente.`,
                    async () => {
                        try {
                            await api.deleteAttachment(blobName);
                            localFiles.splice(indexToRemove, 1);
                            ui.renderModalAttachments(localFiles);
                            ui.showToast('Anexo eliminado com sucesso.', 'info');
                        } catch (error) {
                            console.error("Erro ao eliminar anexo:", error);
                            ui.showToast('Falha ao eliminar o anexo.', 'error');
                        }
                    }
                );
            } else {
                localFiles.splice(indexToRemove, 1);
                ui.renderModalAttachments(localFiles);
            }
        }
    });

    // Lógica do checkbox de data
    noDueDateCheckbox.addEventListener('change', () => {
        if (noDueDateCheckbox.checked) {
            dueDateInput.disabled = true;
            dueDateInput.value = '';
            dueDateInput.style.opacity = '0.5';
        } else {
            dueDateInput.disabled = false;
            dueDateInput.style.opacity = '1';
        }
    });

    // Lógica do tema
    const themeToggle = document.getElementById('theme-toggle');
    const themeIconLight = document.getElementById('theme-icon-light');
    const themeIconDark = document.getElementById('theme-icon-dark');
    const applyTheme = () => {
        if (localStorage.getItem('theme') === 'dark' || (!('theme'in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            themeIconLight.classList.remove('hidden');
            themeIconDark.classList.add('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            themeIconLight.classList.add('hidden');
            themeIconDark.classList.remove('hidden');
        }
    }
    themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        applyTheme();
    });
    applyTheme();

    // Lógica do seletor de visualização
    document.getElementById('view-switcher').addEventListener('click', (e) => {
        const view = e.target.closest('.view-btn')?.dataset.view;
        if (view && view !== state.currentView) {
            state.currentView = view;
            if (state.currentView === 'kanban') {
                state.lastInteractedTaskId = null;
                ui.highlightTask(null);
            }
            ui.updateActiveView();
            updateDragAndDropState();
        }
    });

    // Lógica dos dropdowns de filtro
    function setupDropdown(dropdownId) {
        const dropdownEl = document.getElementById(dropdownId);
        const button = dropdownEl.querySelector('button');
        const panel = dropdownEl.querySelector('.dropdown-panel');
        const label = dropdownEl.querySelector('span');

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-panel').forEach(p => {
                if (p !== panel) p.classList.add('hidden');
            });
            panel.classList.toggle('hidden');
        });

        panel.addEventListener('click', (e) => {
            const selectedButton = e.target.closest('button');
            if (selectedButton) {
                const newValue = selectedButton.dataset.value;
                label.textContent = selectedButton.textContent;
                panel.classList.add('hidden');

                if (dropdownId.includes('project')) {
                    state.selectedProject = newValue;
                } else if (dropdownId.includes('responsible')) {
                    state.selectedResponsible = newValue;
                }
                ui.updateActiveView();
                updateDragAndDropState();
            }
        });
    }

    setupDropdown('project-filter-dropdown');
    setupDropdown('responsible-filter-dropdown');
    
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-panel').forEach(p => p.classList.add('hidden'));
    });

    // Lógica de ordenação da lista
    listViewEl.addEventListener('click', (e) => {
        if (state.selectedResponsible !== 'all') return;
        const header = e.target.closest('.sortable-header');
        if (!header) return;
        const sortBy = header.dataset.sortBy;
        if (state.sortColumn === sortBy) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortColumn = sortBy;
            state.sortDirection = 'asc';
        }
        ui.renderListView();
    });
    
    // Abrir modal de nova tarefa
    document.getElementById('addTaskBtn').addEventListener('click', () => {
        state.editingTaskId = null;
        document.getElementById('modalTitle').textContent = 'Nova Tarefa';
        taskForm.reset();
        
        noDueDateCheckbox.checked = false;
        dueDateInput.disabled = false;
        dueDateInput.style.opacity = '1';

        localFiles = [];
        ui.renderModalAttachments(localFiles);

        document.getElementById('color-picker-button').style.backgroundColor = '#526D82';
        document.getElementById('status-container').classList.add('hidden');
        
        ui.setupResponsibleInput([]);
        
        ui.setupProjectSuggestions();
        ui.setupCustomColorPicker();
        taskModal.classList.remove('hidden');
    });

    // --- LÓGICA DO MODAL DE IA ---
    const aiModal = document.getElementById('aiTitleModal');
    const openAiBtn = document.getElementById('openAiModalBtn');
    const closeAiBtn = document.getElementById('closeAiModalBtn');
    const cancelAiBtn = document.getElementById('cancelAiBtn');
    const generateAiBtn = document.getElementById('generateAiBtn');
    const applyAiBtn = document.getElementById('applyAiBtn');
    
    const taskTitleInput = document.getElementById('taskTitle');
    const aiOriginalTitle = document.getElementById('ai-original-title');
    const aiInstructionInput = document.getElementById('ai-instruction');
    const aiResultContainer = document.getElementById('ai-result-container');
    const aiResultText = document.getElementById('ai-result-text');

    // Chips de sugestão
    document.querySelectorAll('.ai-suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            aiInstructionInput.value = chip.textContent.trim();
            aiInstructionInput.focus();
        });
    });

    // Abrir Modal
    openAiBtn.addEventListener('click', () => {
        const currentTitle = taskTitleInput.value.trim();
        if (!currentTitle) {
            ui.showToast('Digite um título para a IA analisar.', 'info');
            return;
        }

        // Preenche dados iniciais
        aiOriginalTitle.textContent = currentTitle;
        aiInstructionInput.value = ''; 
        aiResultText.value = ''; // Limpa qualquer texto de resultado anterior
        
        // --- RESET COMPLETO DO ESTADO VISUAL ---
        
        // 1. Esconde a área de resultado e o botão de aplicar
        aiResultContainer.classList.add('hidden');
        applyAiBtn.classList.add('hidden');
        generateAiBtn.classList.remove('hidden');

        // 2. Reseta o texto e ícone do botão "Gerar"
        generateAiBtn.disabled = false;
        generateAiBtn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i> <span>Gerar</span>';
        
        // 3. Restaura as classes originais (Estilo Primário) e remove as de "Tentar Novamente"
        // Adiciona estilo roxo sólido
        generateAiBtn.classList.add('bg-purple-600', 'text-white', 'shadow-purple-500/30');
        // Remove estilo transparente/secundário usado no "Tentar Novamente"
        generateAiBtn.classList.remove('text-purple-600', 'hover:bg-purple-50', 'dark:hover:bg-purple-900/20');
        
        // Abre o modal
        aiModal.classList.remove('hidden');
        aiInstructionInput.focus();
        lucide.createIcons();
    });

    // Fechar Modal
    const closeAiModal = () => aiModal.classList.add('hidden');
    closeAiBtn.addEventListener('click', closeAiModal);
    cancelAiBtn.addEventListener('click', closeAiModal);

    // Gerar Título
    generateAiBtn.addEventListener('click', async () => {
        const currentTitle = taskTitleInput.value.trim();
        const instruction = aiInstructionInput.value.trim();

        // Estado de Loading
        generateAiBtn.disabled = true;
        generateAiBtn.innerHTML = '<i class="animate-spin" data-lucide="loader-2"></i> Pensando...';
        lucide.createIcons();

        try {
            const result = await api.improveTitle(currentTitle, instruction);
            
            // Mostrar Resultado
            aiResultText.value = result.title;
            aiResultContainer.classList.remove('hidden');
            
            // Trocar botões
            generateAiBtn.classList.add('hidden');
            applyAiBtn.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            ui.showToast('Erro ao conectar com a IA.', 'error');
        } finally {
            generateAiBtn.disabled = false;
            generateAiBtn.innerHTML = '<i data-lucide="sparkles"></i> <span>Tentar Novamente</span>';
            generateAiBtn.classList.remove('bg-purple-600', 'text-white'); // Muda estilo para secundário
            generateAiBtn.classList.add('text-purple-600', 'hover:bg-purple-50', 'dark:hover:bg-purple-900/20');
            lucide.createIcons();
        }
    });

    // Aplicar Título
    applyAiBtn.addEventListener('click', () => {
        if (aiResultText.value) {
            taskTitleInput.value = aiResultText.value;
            
            // Feedback visual no input original
            taskTitleInput.classList.add('ring-2', 'ring-purple-500', 'border-purple-500');
            setTimeout(() => {
                taskTitleInput.classList.remove('ring-2', 'ring-purple-500', 'border-purple-500');
            }, 1500);

            closeAiModal();
            ui.showToast('Título atualizado pela IA! Agora não precisam mais Brigar!', 'success');
        }
    });

    // Botão de cancelar do modal
    document.getElementById('cancelBtn').addEventListener('click', () => taskModal.classList.add('hidden'));

    // Submissão do formulário de tarefa
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveButton = taskForm.querySelector('button[type="submit"]');
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="animate-spin" data-lucide="loader-2"></i> Salvando...';
        lucide.createIcons();
        
        try {
            const uploadedAttachments = [];

            for (const file of localFiles) {
                if (file instanceof File) {
                    try {
                        const uploadedFile = await api.uploadAttachment(file);
                        uploadedAttachments.push(uploadedFile);
                    } catch (uploadError) {
                        console.error(`Falha no upload do arquivo ${file.name}:`, uploadError);
                        ui.showToast(`Erro ao enviar o anexo: ${file.name}`, 'error');
                    }
                } else {
                    uploadedAttachments.push(file);
                }
            }
            
            const responsibleTags = Array.from(document.querySelectorAll('#responsible-input-container .responsible-tag'));
            const responsiblePayload = responsibleTags.map(tag => {
                const name = tag.querySelector('span').textContent;
                return state.users.find(u => u.name === name);
            }).filter(Boolean);
            
            let dueDateISO = null;
            if (!noDueDateCheckbox.checked) {
                const dueDateValue = dueDateInput.value;
                if (dueDateValue) {
                    const dateParts = dueDateValue.split('-');
                    dueDateISO = new Date(Date.UTC(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10))).toISOString();
                }
            }

            const taskPayload = {
                title: document.getElementById('taskTitle').value,
                description: document.getElementById('taskDescription').value,
                responsible: responsiblePayload,
                project: document.getElementById('taskProject').value.trim(),
                projectColor: document.getElementById('taskProjectColor').value,
                priority: document.getElementById('taskPriority').value,
                dueDate: dueDateISO,
                azureLink: document.getElementById('taskAzureLink').value,
                attachments: uploadedAttachments,
                status: state.editingTaskId ? document.getElementById('taskStatus').value : 'todo'
            };
            
            const isEditing = !!state.editingTaskId;
            const apiCall = isEditing ? api.updateTask(state.editingTaskId, taskPayload) : api.createTask(taskPayload);
            const savedTask = await apiCall;
            
            state.taskToHighlightTemporarily = savedTask.id;
            taskModal.classList.add('hidden');
            ui.showToast(isEditing ? 'Tarefa atualizada com sucesso!' : 'Tarefa criada com sucesso!', 'success');

        } catch (error) {
            console.error("Erro ao salvar tarefa:", error);
            ui.showToast('Falha ao salvar a tarefa.', 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = 'Salvar';
        }
    });

    // Botões do modal de histórico
    document.getElementById('closeHistoryBtn').addEventListener('click', () => historyModal.classList.add('hidden'));
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => deleteConfirmModal.classList.add('hidden'));
    
    document.getElementById('editTaskBtn').addEventListener('click', () => {
        const taskId = state.lastInteractedTaskId;
        const taskToEdit = state.tasks.find(t => t.id === taskId);
        if (!taskToEdit) return;
        const statusContainer = document.getElementById('status-container');
        const statusInput = document.getElementById('taskStatus');
        
        statusContainer.classList.remove('hidden');
        statusInput.value = taskToEdit.status || 'todo';

        state.editingTaskId = taskId;
        document.getElementById('modalTitle').textContent = 'Editar Tarefa';
        document.getElementById('taskTitle').value = taskToEdit.title || '';
        document.getElementById('taskDescription').value = taskToEdit.description || '';
        document.getElementById('taskAzureLink').value = taskToEdit.azureLink || '';
        document.getElementById('taskProject').value = taskToEdit.project || '';
        document.getElementById('taskProjectColor').value = taskToEdit.projectColor || '#526D82';
        document.getElementById('color-picker-button').style.backgroundColor = taskToEdit.projectColor || '#526D82';
        
        if (taskToEdit.dueDate) {
            noDueDateCheckbox.checked = false;
            dueDateInput.disabled = false;
            dueDateInput.style.opacity = '1';
            dueDateInput.value = taskToEdit.dueDate.split('T')[0];
        } else {
            noDueDateCheckbox.checked = true;
            dueDateInput.disabled = true;
            dueDateInput.style.opacity = '0.5';
            dueDateInput.value = '';
        }

        localFiles = taskToEdit.attachments ? [...taskToEdit.attachments] : [];
        ui.renderModalAttachments(localFiles);

        document.getElementById('taskPriority').value = taskToEdit.priority || 'Média';
        
        ui.setupResponsibleInput(taskToEdit.responsible || []);

        ui.setupProjectSuggestions();
        ui.setupCustomColorPicker();
        historyModal.classList.add('hidden');
        taskModal.classList.remove('hidden');
    });

    document.getElementById('add-comment-btn').addEventListener('click', async () => {
        const commentInput = document.getElementById('comment-input');
        const text = commentInput.value.trim();
        if (!text || !state.lastInteractedTaskId) return;
        try {
            await api.addComment(state.lastInteractedTaskId, { text });
            commentInput.value = '';
        } catch (error) {
            console.error("Erro ao adicionar comentário:", error);
            ui.showToast("Falha ao adicionar comentário.", 'error');
        }
    });
    
    // Delegação de eventos para o formulário de adicionar utilizador
    document.body.addEventListener('submit', async (e) => {
        if (e.target.id === 'addUserForm') {
            e.preventDefault();
            const form = e.target;
            const nameInput = document.getElementById('newUserName');
            const emailInput = document.getElementById('newUserEmail');
            const isAdminCheckbox = document.getElementById('newUserIsAdmin');
            const submitButton = form.querySelector('button[type="submit"]');

            submitButton.disabled = true;

            const payload = {
                name: nameInput.value,
                email: emailInput.value,
                isAdmin: isAdminCheckbox.checked
            };

            try {
                const newUser = await api.addUser(payload);
                ui.showToast(`Utilizador ${newUser.name} adicionado com sucesso!`, 'success');
                
                state.users.push(newUser);
                ui.renderUserManagementView();
            } catch (error) {
                console.error("Erro ao adicionar utilizador:", error);
                ui.showToast(error.message, 'error');
            } finally {
                submitButton.disabled = false;
            }
        }
    });

    // Delegação de eventos para botões de ação
    document.body.addEventListener('click', async (e) => {
        const infoBtn = e.target.closest('.info-btn');
        if (infoBtn) {
            state.lastInteractedTaskId = infoBtn.dataset.taskId;
            ui.highlightTask(state.lastInteractedTaskId, false);
            ui.renderTaskHistory(state.lastInteractedTaskId);
        }
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            const taskId = deleteBtn.dataset.taskId;
            ui.showConfirmModal(
                'Excluir Tarefa',
                'Você tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.',
                async () => {
                    try {
                        await api.deleteTask(taskId);
                        ui.showToast('Tarefa excluída com sucesso.', 'info');
                    } catch (error) {
                        console.error("Erro ao excluir tarefa:", error);
                        ui.showToast('Falha ao excluir a tarefa.', 'error');
                    }
                }
            );
        }
        const approveBtn = e.target.closest('.approve-btn');
        if (approveBtn) {
            try {
                await api.updateTask(approveBtn.dataset.taskId, { status: 'done' });
                ui.showToast('Tarefa aprovada e arquivada!', 'success');
            } catch (error) {
                console.error("Erro ao aprovar tarefa:", error);
                ui.showToast('Falha ao aprovar a tarefa.', 'error');
            }
        }
        const restoreBtn = e.target.closest('.restore-btn');
        if (restoreBtn) {
            try {
                await api.updateTask(restoreBtn.dataset.taskId, { status: 'todo' });
                ui.showToast('Tarefa restaurada para a fila.', 'success');
            } catch (error) {
                console.error("Erro ao restaurar tarefa:", error);
                ui.showToast('Falha ao restaurar a tarefa.', 'error');
            }
        }
        const deleteCommentBtn = e.target.closest('.delete-comment-btn');
        if (deleteCommentBtn) {
            const taskId = deleteCommentBtn.dataset.taskId;
            const commentIndex = parseInt(deleteCommentBtn.dataset.commentIndex, 10);
            ui.showConfirmModal(
                'Excluir Comentário',
                'Você tem certeza que deseja excluir este comentário?',
                async () => {
                    try {
                        await api.deleteComment(taskId, commentIndex);
                        ui.showToast('Comentário excluído.', 'info');
                    } catch (error) {
                        console.error("Erro ao excluir comentário:", error);
                        ui.showToast("Falha ao excluir comentário.", 'error');
                    }
                }
            );
        }
        const deleteUserBtn = e.target.closest('.delete-user-btn');
            if (deleteUserBtn) {
                const userId = deleteUserBtn.dataset.userId;
                
                // Encontrar o nome do utilizador para mostrar na mensagem
                const user = state.users.find(u => u.id === userId || u.email === userId);
                const userName = user ? user.name : userId;

                ui.showConfirmModal(
                    'Eliminar Utilizador',
                    `Tem a certeza de que deseja remover o acesso de "${userName}"?`,
                    async () => {
                        try {
                            await api.deleteUser(userId);
                            
                            // Atualizar o estado local removendo o utilizador
                            state.users = state.users.filter(u => u.id !== userId && u.email !== userId);
                            
                            // Atualizar a UI
                            ui.renderUserManagementView();
                            ui.showToast('Utilizador removido com sucesso.', 'info');
                            
                            // Opcional: Atualizar filtros de responsáveis se necessário
                            ui.populateResponsibleFilter(); 
                            
                        } catch (error) {
                            console.error("Erro ao eliminar utilizador:", error);
                            ui.showToast(error.message || 'Falha ao eliminar utilizador.', 'error');
                        }
                    }
                );
            }
        });
    }

// --- FUNÇÕES DE DRAG-AND-DROP ---
function initializeKanbanDragAndDrop() {
    document.querySelectorAll('.kanban-column .task-list').forEach(list => {
        const sortable = new Sortable(list, {
            group: 'kanban',
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: async function (evt) {
                const taskId = evt.item.dataset.taskId;
                const newStatus = evt.to.dataset.columnId;
                const task = state.tasks.find(t => t.id === taskId);
                if (task && task.status !== newStatus) {
                    try {
                        await api.updateTask(taskId, { status: newStatus });
                        ui.showToast(`Tarefa movida.`, 'info');
                    } catch (error) {
                        ui.showToast(`Erro ao mover tarefa.`, 'error');
                    }
                }
                const orderedTasksPayload = [];
                document.querySelectorAll('.kanban-column .task-list').forEach(column => {
                    Array.from(column.children).forEach((taskCard, index) => {
                        if (taskCard.dataset.taskId) orderedTasksPayload.push({
                            id: taskCard.dataset.taskId,
                            order: index
                        });
                    });
                });
                try {
                    await api.updateOrder(orderedTasksPayload);
                } catch (error) {
                    console.error("Erro ao reordenar tarefas:", error);
                }
            }
        });
        kanbanSortableInstances.push(sortable);
    });
}

function initializeListDragAndDrop() {
    const tbody = document.getElementById('list-view-tbody');
    if (!tbody) return;
    listSortableInstance = new Sortable(tbody, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost-list',
        onEnd: async function () {
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const orderedTasksPayload = rows.map((row, index) => ({
                id: row.dataset.taskId,
                order: index
            }));
            try {
                await api.updateOrder(orderedTasksPayload);
                ui.showToast('Ordem das tarefas atualizada.', 'info');
            } catch (error) {
                console.error("Erro ao reordenar tarefas na lista:", error);
                ui.showToast('Falha ao reordenar tarefas.', 'error');
            }
        }
    });
}

// Função para processar a fila de alertas de tarefas
function processAlertQueue() {
    if (alertQueue.length === 0) return;
    
    // Se o modal já está visível processando a tarefa ATUAL, não faz nada.
    // Mas se acabamos de fechar um e chamamos o processAlertQueue novamente via setTimeout, 
    // isAlertModalOpen deve ser false (controlado no final desta função).
    if (isAlertModalOpen) return;

    const task = alertQueue[0]; // Pega o primeiro da fila
    isAlertModalOpen = true; // Bloqueia novas chamadas
    
    const modal = document.getElementById('alertModal');
    document.getElementById('alert-task-id').textContent = task.id;
    document.getElementById('alert-task-title').textContent = task.title;
    document.getElementById('alert-queue-count').textContent = alertQueue.length - 1;
    
    // Configura o botão de dispensar
    const dismissBtn = document.getElementById('dismissAlertBtn');
    
    // Remove listeners antigos clonando o botão
    const newBtn = dismissBtn.cloneNode(true);
    dismissBtn.parentNode.replaceChild(newBtn, dismissBtn);

    // --- Reseta o visual do botão para o estado original ---
    newBtn.innerHTML = `
        <i data-lucide="check-check" class="w-6 h-6"></i>
        <span>Confirmar Leitura</span>
    `;
    newBtn.className = "w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl text-lg transition-transform transform hover:scale-105 shadow-lg flex items-center justify-center gap-2";
    // Recria os ícones Lucide pois alteramos o innerHTML
    lucide.createIcons();
    
    newBtn.addEventListener('click', async () => {
        // Estado visual de carregamento
        newBtn.innerHTML = '<i class="animate-spin" data-lucide="loader-2"></i> Confirmando...';
        lucide.createIcons();
        
        try {
            await api.dismissAlert(task.id);
            
            // Sucesso: Remove o atual da fila
            alertQueue.shift();
            
            // Fecha o modal visualmente
            modal.classList.add('hidden');
            
            // Libera a flag para permitir que o próximo alerta abra
            isAlertModalOpen = false;
            
            // Tenta processar o próximo imediatamente (se houver)
            if (alertQueue.length > 0) {
                setTimeout(processAlertQueue, 300);
            }
            
        } catch (error) {
            console.error(error);
            newBtn.innerHTML = 'Erro - Tentar Novamente';
        }
    });

    modal.classList.remove('hidden');
}

// Função para verificar se o usuário atual tem alertas
function checkAndQueueAlerts(tasks) {
    if (!state.currentUser) return;
    
    // Tenta pegar o nome da claim personalizada PRIMEIRO.
    // O 'val' é onde o valor real fica nas claims do SWA.
    const nameFromClaim = state.currentUser.claims && state.currentUser.claims.find(c => c.typ === 'name')?.val;
    const myName = nameFromClaim || state.currentUser.userDetails;

    console.log(`[DEBUG ALERTA] Sou: "${myName}" | Tarefas para checar: ${tasks.length}`);

    if (!myName) return;

    let foundAlert = false;

    tasks.forEach(task => {
        if (task.pendingAlerts && Array.isArray(task.pendingAlerts)) {
            console.log(`[DEBUG ALERTA] Tarefa ${task.id} tem alertas para:`, task.pendingAlerts);
            
            if (task.pendingAlerts.includes(myName)) {
                console.log(`[DEBUG ALERTA] MATCH! Encontrei um alerta para mim na tarefa ${task.id}`);
                
                // Se a tarefa não estiver já na fila, adiciona
                if (!alertQueue.find(t => t.id === task.id)) {
                    alertQueue.push(task);
                    foundAlert = true;
                }
            }
        }
    });

    if (foundAlert) {
        processAlertQueue();
    }
}