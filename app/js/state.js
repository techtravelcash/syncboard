export const state = {
    currentUser: null,
    users: [],
    tasks: [],
    projectTaskCounts: [],
    projectTaskCountsStatus: 'loading',
    notifications: [],
    currentView: 'home', 
    selectedProject: 'all',
    selectedResponsible: 'all',
    searchQuery: '',
    sortBy: 'createdAt',      // Padrão: Data de criação
    sortDirection: 'desc'     // Padrão: Do mais recente para o mais antigo
};