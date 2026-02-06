export const state = {
    currentUser: null,
    users: [],
    tasks: [],
    notifications: [],
    currentView: 'kanban', 
    selectedProject: 'all',
    selectedResponsible: 'all',
    searchQuery: '',
    sortBy: 'createdAt',      // Padrão: Data de criação
    sortDirection: 'desc'     // Padrão: Do mais recente para o mais antigo
};