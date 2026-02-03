const { CosmosClient } = require("@azure/cosmos");
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");
const usersContainer = database.container("Users");
const notificationsContainer = database.container("Notifications");
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

function getUser(request) {
    const header = request.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    return JSON.parse(decoded);
}

async function sendDiscordNotification(payload) {
    if (!discordWebhookUrl) return;
    try {
        await axios.post(discordWebhookUrl, payload);
    } catch (error) {
        console.error('Erro ao enviar notificação para o Discord:', error.message);
    }
}

module.exports = async function (context, req) {
    const user = getUser(req);
    if (!user) {
        context.res = { status: 401, body: "Acesso não autorizado." };
        return;
    }

    const taskId = context.bindingData.id;
    const commentData = req.body;
    context.log(`Adicionando comentário à tarefa com ID: ${taskId}`);

    try {
        // Garante que o container de notificações existe
        await database.containers.createIfNotExists({ id: "Notifications", partitionKey: { paths: ["/targetUserEmail"] } });

        const { resource: existingTask } = await container.item(taskId, taskId).read();
        if (!existingTask) {
            context.res = { status: 404, body: "Tarefa não encontrada." };
            return;
        }

        // 1. Adicionar o Comentário
        const newComment = {
            text: commentData.text,
            author: user.userDetails,
            userId: user.userId, 
            timestamp: new Date().toISOString()
        };

        if (!Array.isArray(existingTask.comments)) {
            existingTask.comments = [];
        }
        existingTask.comments.push(newComment);

        // 2. Lógica de Menção (@Nome) - APENAS NOTIFICAÇÃO (Sem Alerta Vermelho)
        const { resources: allUsers } = await usersContainer.items.readAll().fetchAll();
        const mentionedUsers = allUsers.filter(u => commentData.text.includes(`@${u.name}`));
        
        if (mentionedUsers.length > 0) {
            for (const mentionedUser of mentionedUsers) {
                // Cria o registo no Histórico de Notificações
                const newNotification = {
                    id: uuidv4(),
                    targetUserEmail: mentionedUser.email, // Partition Key
                    type: 'mention',
                    taskId: taskId,
                    taskTitle: existingTask.title,
                    message: `Você foi mencionado por ${user.userDetails}`,
                    commentPreview: commentData.text,
                    isRead: false,
                    createdAt: new Date().toISOString()
                };
                await notificationsContainer.items.create(newNotification);
            }
        }

        const { resource: replaced } = await container.item(taskId, taskId).replace(existingTask);

        // 3. Notificar Discord
        await sendDiscordNotification({
            username: "SyncBoard",
            avatar_url: "https://i.imgur.com/AoaA8WI.png",
            content: `**💬 Novo Comentário de ${user.userDetails} na Tarefa [${taskId}]**`,
            embeds: [{
                description: newComment.text,
                color: 0x9DB2BF
            }]
        });

        // 4. Sinalizar Frontends
        context.bindings.signalRMessage = {
            target: 'taskUpdated',
            arguments: [replaced]
        };

        context.res = { body: replaced };
    } catch (error) {
        context.log.error(`Erro ao adicionar comentário: ${error.message}`);
        context.res = { status: 500, body: "Erro ao adicionar comentário." };
    }
};