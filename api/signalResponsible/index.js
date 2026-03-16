const { CosmosClient } = require("@azure/cosmos");
const axios = require('axios'); // Importar axios para o webhook

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");
const usersContainer = database.container("Users"); // Referência à tabela de usuários
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

        // --- LÊ OS ALVOS SELECIONADOS PELO FRONTEND ---
        const reqBody = req.body || {};
        const targetNames = reqBody.targets || [];

        if (!targetNames || targetNames.length === 0) {
            context.res = { status: 400, body: "Nenhum responsável selecionado para sinalizar." };
            return;
        }

        // Medida de Segurança: Garante que só vai sinalizar quem de fato consta como responsável na Tarefa
        const validTargets = targetNames.filter(name => 
            existingTask.responsible && existingTask.responsible.some(r => (typeof r === 'object' ? r.name : r) === name)
        );

        if (validTargets.length === 0) {
            context.res = { status: 400, body: "Os usuários selecionados não são responsáveis por esta tarefa." };
            return;
        }
        // -----------------------------------------------

        // --- NOVO: Busca o displayName ou name do banco de usuários ---
        let senderName = user.userDetails; // Fallback de segurança (email)
        try {
            const { resource: userProfile } = await usersContainer.item(user.userDetails.toLowerCase(), user.userDetails.toLowerCase()).read();
            if (userProfile) {
                // Prioridade: displayName > name > email
                senderName = userProfile.displayName || userProfile.name || senderName;
            } else if (user.claims) {
                const nameClaim = user.claims.find(c => c.typ === 'name');
                if (nameClaim) senderName = nameClaim.val;
            }
        } catch (dbError) {
            context.log.warn(`Erro ao buscar perfil do usuário: ${dbError.message}`);
        }
        // --------------------------------------------------------------

        const currentAlerts = existingTask.pendingAlerts || [];
        
        const newAlertObjects = validTargets.map(name => ({
            targetUser: name,
            signaledBy: senderName, // Salva o nome amigável de quem sinalizou
            timestamp: new Date().toISOString()
        }));

        // Filtra para não duplicar alertas para a mesma pessoa
        const mergedAlerts = [...currentAlerts];
        newAlertObjects.forEach(newAlert => {
            if (!mergedAlerts.some(a => (a.targetUser || a) === newAlert.targetUser)) {
                mergedAlerts.push(newAlert);
            }
        });

        existingTask.pendingAlerts = mergedAlerts;

        const { resource: replaced } = await container.item(taskId, taskId).replace(existingTask);

        // --- Notificação para o Discord ---
        await sendDiscordNotification({
            username: "SyncBoard - Alerta",
            avatar_url: "https://i.imgur.com/AoaA8WI.png",
            content: `**🚨 Atenção!**`,
            embeds: [{
                title: `Tarefa [${taskId}] - ${existingTask.title}`,
                // Usa o senderName resolvido e a lista de alvos validados
                description: `O usuário **${senderName}** sinalizou esta tarefa e está solicitando uma atenção especial dos responsáveis.`,
                color: 0xEF4444, // Vermelho para alerta
                fields: [
                    { name: "Responsáveis Sinalizados", value: validTargets.join(', '), inline: false },
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