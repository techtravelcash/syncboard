const { CosmosClient } = require("@azure/cosmos");
const axios = require('axios'); // Importar axios para o webhook

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL; // URL do seu webhook

// Função auxiliar para identificar o usuário logado
function getUser(request) {
    const header = request.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    return JSON.parse(decoded);
}

// Função para enviar notificação ao Discord
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
    const user = getUser(req); // Identifica quem está sinalizando

    if (!user) {
        context.res = { status: 401, body: "Acesso não autorizado." };
        return;
    }
    
    try {
        const { resource: existingTask } = await container.item(taskId, taskId).read();
        if (!existingTask) {
            context.res = { status: 404, body: "Tarefa não encontrada." };
            return;
        }

        const responsibleNames = existingTask.responsible.map(r => (typeof r === 'object' ? r.name : r));
        
        if (!responsibleNames || responsibleNames.length === 0) {
            context.res = { status: 400, body: "Esta tarefa não tem responsáveis para sinalizar." };
            return;
        }

        const currentAlerts = existingTask.pendingAlerts || [];
        const newAlerts = [...new Set([...currentAlerts, ...responsibleNames])];
        existingTask.pendingAlerts = newAlerts;

        const { resource: replaced } = await container.item(taskId, taskId).replace(existingTask);

        // --- Notificação para o Discord ---
        await sendDiscordNotification({
            username: "SyncBoard - Alerta",
            avatar_url: "https://i.imgur.com/AoaA8WI.png",
            content: `**🚨 Atenção!**`,
            embeds: [{
                title: `Tarefa [${taskId}] - ${existingTask.title}`,
                description: `O usuário **${user.userDetails}** sinalizou esta tarefa e está a solicitando uma atenção especial dos responsáveis.`,
                color: 0xEF4444, // Vermelho para alerta
                fields: [
                    { name: "Responsáveis Sinalizados", value: responsibleNames.join(', '), inline: false },
                    { name: "Projeto", value: existingTask.project || "N/A", inline: true }
                ],
                timestamp: new Date().toISOString()
            }]
        });

        context.bindings.signalRMessage = {
            target: 'taskUpdated',
            arguments: [replaced]
        };

        context.res = { body: replaced };
    } catch (error) {
        context.log.error(`Erro ao sinalizar tarefa: ${error.message}`);
        context.res = { status: 500, body: "Erro interno." };
    }
};