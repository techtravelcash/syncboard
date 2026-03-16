const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const tasksContainer = database.container("Tasks");
const usersContainer = database.container("Users");
const notificationsContainer = database.container("Notifications"); // <-- Referência às Notificações

function getUser(request) {
    const header = request.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    return JSON.parse(decoded);
}

module.exports = async function (context, req) {
    const taskId = context.bindingData.id;
    context.log(`Iniciando dismissAlert para a tarefa: ${taskId}`);

    try {
        const user = getUser(req);
        if (!user) {
             context.res = { status: 401, body: "Usuário não identificado." };
             return;
        }

        const userEmail = user.userDetails;
        let userNameToRemove = userEmail;

        try {
            const { resource: userProfile } = await usersContainer.item(userEmail.toLowerCase(), userEmail.toLowerCase()).read();
            if (userProfile && userProfile.name) {
                userNameToRemove = userProfile.name;
            } else if (user.claims) {
                const nameClaim = user.claims.find(c => c.typ === 'name');
                if (nameClaim) userNameToRemove = nameClaim.val;
            }
        } catch (dbError) {
            context.log.warn(`Erro ao buscar perfil do usuário: ${dbError.message}`);
        }

        const { resource: existingTask } = await tasksContainer.item(taskId, taskId).read();
        if (!existingTask) {
            context.res = { status: 404, body: "Tarefa não encontrada." };
            return;
        }

        if (existingTask.pendingAlerts && Array.isArray(existingTask.pendingAlerts)) {
            const originalLength = existingTask.pendingAlerts.length;
            
            // Remove o alerta (suportando string antiga ou o novo formato de objeto)
            let newAlerts = existingTask.pendingAlerts.filter(alertItem => {
                const target = typeof alertItem === 'object' ? alertItem.targetUser : alertItem;
                return target !== userNameToRemove && target !== userEmail;
            });

            existingTask.pendingAlerts = newAlerts;
            
            if (existingTask.pendingAlerts.length !== originalLength) {
                context.log(`Alerta removido com sucesso.`);
                
                const { resource: replaced } = await tasksContainer.item(taskId, taskId).replace(existingTask);
                
                // --- NOVO: CRIAR A NOTIFICAÇÃO NA FILA NORMAL DO USUÁRIO ---
                try {
                    await notificationsContainer.items.create({
                        targetUserEmail: userEmail, // Email do usuário que clicou em "vou olhar"
                        taskId: taskId,
                        message: "Atenção Solicitada",
                        commentPreview: `Lembrete: Você foi sinalizado na tarefa #${taskId} - ${existingTask.title}`,
                        createdAt: new Date().toISOString(),
                        isRead: false // Deixamos false para o sininho ficar com a bolinha vermelha!
                    });
                } catch (notifErr) {
                    context.log.warn(`Erro ao gerar notificação pós-alerta: ${notifErr.message}`);
                }
                // -------------------------------------------------------------

                context.bindings.signalRMessage = {
                    target: 'taskUpdated',
                    arguments: [replaced]
                };
                context.res = { body: replaced };
            } else {
                context.res = { body: existingTask }; 
            }
        } else {
            context.res = { body: existingTask };
        }

    } catch (error) {
        context.log.error(`ERRO CRÍTICO ao dispensar alerta: ${error.message}`, error);
        context.res = { status: 500, body: `Erro interno: ${error.message}` };
    }
};