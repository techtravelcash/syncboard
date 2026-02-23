const { CosmosClient } = require("@azure/cosmos");
const axios = require('axios');
const crypto = require('crypto');

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");
const notificationsContainer = database.container("Notifications");
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

const statusLabels = {
    todo: 'Fila',
    stopped: 'Parado',
    inprogress: 'Andamento',
    homologation: 'Homologação',
    publication: 'Publicação',
    done: 'Concluída'
};

async function sendDiscordNotification(payload) {
    if (!discordWebhookUrl) return;
    try {
        await axios.post(discordWebhookUrl, payload);
    } catch (error) {
        console.error('Erro ao enviar notificação para o Discord:', error.message);
    }
}

module.exports = async function (context, req) {
    const taskId = context.bindingData.id;
    const updatedData = req.body;
    context.log(`A atualizar tarefa com ID: ${taskId}`);

    try {
        const { resource: existingTask } = await container.item(taskId, taskId).read();
        if (!existingTask) {
            context.res = { status: 404, body: "Tarefa não encontrada." };
            return;
        }

        const oldStatus = existingTask.status;

        if (Object.keys(updatedData).some(key => key !== 'status')) {
            if (!existingTask.history) existingTask.history = [];
            existingTask.history.push({ status: 'edited', timestamp: new Date().toISOString() });
        }

        if (updatedData.attachments && !Array.isArray(updatedData.attachments)) {
            updatedData.attachments = [];
        }

        const taskToUpdate = { ...existingTask, ...updatedData };
        const { resource: replaced } = await container.item(taskId, taskId).replace(taskToUpdate);

        // --- GERAR NOTIFICAÇÃO PARA O HOMOLOGADOR ---
        try {
            const newStatus = updatedData.status || oldStatus;
            
            // Agora usamos o EMAIL como referência principal de troca e criação
            const oldHomologadorEmail = existingTask.homologador ? existingTask.homologador.email : null;
            const newHomologadorEmail = updatedData.homologador ? updatedData.homologador.email : oldHomologadorEmail;

            // Dispara a notificação se a tarefa acabou de entrar em homologação OU se trocaram o homologador
            if (newStatus === 'homologation' && newHomologadorEmail) {
                if (oldStatus !== 'homologation' || oldHomologadorEmail !== newHomologadorEmail) {
                    const notification = {
                        id: crypto.randomUUID(),
                        taskId: taskId,
                        targetUserEmail: newHomologadorEmail, // <<< PROPRIEDADE CORRETA ESPERADA PELO SEU SISTEMA
                        message: "Homologação Pendente",
                        commentPreview: `Você foi designado para homologar a tarefa #${taskId}: ${taskToUpdate.title}`,
                        isRead: false,
                        createdAt: new Date().toISOString()
                    };
                    await notificationsContainer.items.create(notification);
                }
            }
        } catch (notifErr) {
            context.log.error(`Erro ao criar notificação de homologador: ${notifErr.message}`);
        }
        // --------

        if (updatedData.status && updatedData.status !== oldStatus) {
            await sendDiscordNotification({
                username: "SyncBoard",
                avatar_url: "https://i.imgur.com/AoaA8WI.png",
                content: `**🔄 Tarefa [${taskId}] atualizada para -> ${statusLabels[updatedData.status] || updatedData.status}**`
            });
        }

        context.bindings.signalRMessage = {
            target: 'taskUpdated',
            arguments: [replaced]
        };

        context.res = { body: replaced };
    } catch (error) {
        context.log.error(`Erro ao atualizar tarefa ${taskId}: ${error.message}`);
        context.res = { status: 500, body: "Erro ao atualizar tarefa." };
    }
};