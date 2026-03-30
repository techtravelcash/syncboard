export async function getUserInfo() {
    try {
        const response = await fetch('/.auth/me');
        if (!response.ok) return null;
        const payload = await response.json();
        return payload.clientPrincipal;
    } catch (error) {
        console.error('Não foi possível obter informações do usuário.', error);
        return null;
    }
}

export async function fetchTasks() {
    const response = await fetch('/api/getTasks');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
}

export async function fetchUsers() {
    // timestamp "?t=..." para o browser nunca usar cache nesta rota
    const response = await fetch('/api/getUsers?t=' + new Date().getTime());
    if (!response.ok) throw new Error('Falha ao buscar usuários.');
    return await response.json();
}

export async function createTask(taskPayload) {
    const response = await fetch('/api/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskPayload),
    });
    if (!response.ok) throw new Error('Falha ao criar a tarefa.');
    return await response.json();
}

export async function updateTask(taskId, taskPayload) {
    const response = await fetch(`/api/updateTask/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskPayload)
    });
    if (!response.ok) throw new Error('Falha ao atualizar a tarefa.');
    return await response.json();
}

export async function deleteTask(taskId) {
    const response = await fetch(`/api/deleteTask/${taskId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Falha ao excluir a tarefa.');
}

export async function addComment(taskId, commentPayload) {
    const response = await fetch(`/api/addComment/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentPayload)
    });
    if (!response.ok) throw new Error('Falha ao adicionar o comentário.');
    return await response.json();
}

export async function updateOrder(orderedTasksPayload) {
     const response = await fetch(`/api/updateOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderedTasksPayload)
    });
    if (!response.ok) throw new Error('Falha ao reordenar tarefas.');
}

export async function deleteComment(taskId, commentIndex) {
    const response = await fetch(`/api/deleteComment/${taskId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: commentIndex })
    });
    if (!response.ok) throw new Error('Falha ao excluir o comentário.');
    return await response.json();
}

export async function updateProjectColor(projectName, newColor) {
    const response = await fetch(`/api/updateProjectColor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, newColor })
    });
    if (!response.ok) throw new Error('Falha ao atualizar a cor do projeto.');
}

export async function fetchArchivedTasks() {
    const response = await fetch('/api/getArchivedTasks');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

export async function uploadAttachment(file) {
    // Enviamos o arquivo direto no body e passamos os detalhes pelo Header
    const response = await fetch('/api/tasks/attachments', {
        method: 'POST',
        headers: {
            'x-file-name': encodeURIComponent(file.name),
            'x-file-type': file.type || 'application/octet-stream',
            // Dizemos ao backend: "Isso é um fluxo de dados cru"
            'Content-Type': 'application/octet-stream' 
        },
        body: file, // Aqui vai o arquivo purinho!
    });

    if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(`Falha no upload do anexo: ${errorMsg}`);
    }
    
    return await response.json();
}

export async function deleteAttachment(blobName) {
    const response = await fetch(`/api/tasks/attachments/${blobName}`, {
        method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
        throw new Error('Falha ao eliminar o anexo.');
    }
    return response;
}

export async function addUser(userPayload) {
    const response = await fetch('/api/addUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || 'Falha ao adicionar o utilizador.');
    }
    return await response.json();
}

export async function deleteUser(userId) {
    // O userId é o email, por isso devemos usar encodeURIComponent para garantir que caracteres como '@' passam corretamente na URL
    const response = await fetch(`/api/deleteUser/${encodeURIComponent(userId)}`, { 
        method: 'DELETE' 
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Falha ao eliminar o utilizador.');
    }
}

export async function signalResponsible(taskId, targets) {
    const response = await fetch(`/api/signalResponsible/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }) // Envia os nomes selecionados
    });
    if (!response.ok) throw new Error('Falha ao sinalizar responsável.');
    return await response.json();
}

export async function dismissAlert(taskId) {
    const response = await fetch(`/api/dismissAlert/${taskId}`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error('Falha ao dispensar alerta.');
    return await response.json();
}

export async function fetchNotifications() {
    const response = await fetch('/api/getNotifications');
    if (!response.ok) return [];
    return await response.json();
}

export async function markNotificationRead(id) {
    await fetch('/api/markNotificationRead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
}

export async function improveTitle(currentTitle, userInstruction) {
    const response = await fetch('/api/improveTitle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentTitle, userInstruction })
    });

    if (!response.ok) {
        throw new Error('Falha ao melhorar o título.');
    }
    return await response.json();
}

export async function updateUserPhoto(pictureUrl) {
    const response = await fetch('/api/updateUserPhoto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pictureUrl })
    });
    
    // Não vamos lançar erro aqui para não travar a aplicação caso falhe, 
    // mas retornamos o status para quem chamar decidir.
    if (!response.ok) {
        console.warn('Falha silenciosa ao atualizar foto de perfil.');
        return null;
    }
    return await response.json();
}

export async function editComment(taskId, commentId, text, authorEmail) {
    const response = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, author: authorEmail })
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }
    return await response.json();
}
export async function updateUser(userId, userPayload) {
    const response = await fetch(`/api/updateUser/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Falha ao atualizar a conta de utilizador.');
    }
    
    return await response.json();
}