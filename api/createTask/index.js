const { CosmosClient } = require("@azure/cosmos");
const axios = require('axios');

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");
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

    context.log('HTTP trigger function: Criando uma nova tarefa.');
    try {
        const operations = [{ op: 'incr', path: '/currentId', value: 1 }];
        const { resource: updatedCounter } = await container.item("taskCounter", "taskCounter").patch(operations);
        const newNumericId = updatedCounter.currentId;

        const newTaskId = `TC-${String(newNumericId).padStart(3, '0')}`;

        const taskData = req.body;
        if (!taskData.title || !taskData.description || !taskData.responsible) {
            context.res = { status: 400, body: "Título, Descrição e Responsável são obrigatórios." };
            return;
        }

        const newTask = {
            id: newTaskId,
            numericId: newNumericId,
            title: taskData.title,
            description: taskData.description,
            responsible: taskData.responsible,
            azureLink: taskData.azureLink || '',
            project: taskData.project || '',
            projectColor: taskData.projectColor || '#526D82',
            priority: taskData.priority || 'Média',
            status: 'todo',
            createdAt: new Date().toISOString(),
            createdBy: user.userDetails,
            history: [{ status: 'todo', timestamp: new Date().toISOString() }],
            order: -Date.now(),
            dueDate: taskData.dueDate || null,
            attachments: taskData.attachments || []
        };

        await container.items.create(newTask);

        const responsibleNames = newTask.responsible.map(r => (typeof r === 'object' ? r.name : r)).join(', ');
        await sendDiscordNotification({
            username: "SyncBoard",
            avatar_url: "https://i.imgur.com/AoaA8WI.png",
            content: `**📝 Nova Tarefa Criada por ${user.userDetails}**`,
            embeds: [{
                title: `[${newTask.id}] ${newTask.title}`,
                description: newTask.description,
                color: parseInt(newTask.projectColor.substring(1), 16),
                fields: [
                    { name: "Projeto", value: newTask.project || "N/A", inline: true },
                    { name: "Responsáveis", value: responsibleNames || "N/A", inline: true },
                    { name: "Prioridade", value: newTask.priority, inline: true }
                ]
            }]
        });

        context.bindings.signalRMessage = {
            target: 'taskCreated',
            arguments: [newTask]
        };

        context.res = { body: newTask };
    } catch (error) {
        context.log.error(`Erro ao criar tarefa: ${error.message}`);
        context.res = { status: 500, body: "Erro ao salvar tarefa." };
    }
};