const { CosmosClient } = require("@azure/cosmos");
const axios = require('axios');

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

const statusLabels = {
    todo: 'Fila',
    stopped: 'Parado',
    inprogress: 'Andamento',
    homologation: 'Homologação',
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