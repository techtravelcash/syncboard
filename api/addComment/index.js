const { CosmosClient } = require("@azure/cosmos");
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");
const usersContainer = database.container("Users");
const notificationsContainer = database.container("Notifications"); // Container correto
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

// --- FUNÇÃO AUXILIAR: LIMPEZA DE HTML PARA MARKDOWN ---
function formatHtmlToDiscord(html) {
    if (!html) return "";

    let text = html;

    // 1. Converte Menções (@Usuario)
    // A tag de menção possui o nome precedido por @ dentro do conteúdo do span
    text = text.replace(/<span[^>]*class="mention-tag"[^>]*>[\s\S]*?@([^<\n]+?)[\s]*<\/span>/g, '**@$1**');

    // 2. Converte Quebras de Linha e Parágrafos
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n'); 
    text = text.replace(/<p>/gi, '');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<div>/gi, '');

    // 3. Converte Formatação Básica
    text = text.replace(/<b>/gi, '**').replace(/<\/b>/gi, '**');
    text = text.replace(/<strong>/gi, '**').replace(/<\/strong>/gi, '**');
    text = text.replace(/<i>/gi, '*').replace(/<\/i>/gi, '*');
    text = text.replace(/<em>/gi, '*').replace(/<\/em>/gi, '*');
    text = text.replace(/<u>/gi, '__').replace(/<\/u>/gi, '__'); 

    // 4. Converte Listas
    text = text.replace(/<ul>/gi, '').replace(/<\/ul>/gi, '');
    text = text.replace(/<li>/gi, '• ').replace(/<\/li>/gi, '\n');

    // 5. Remove todas as outras tags HTML restantes
    text = text.replace(/<[^>]+>/g, '');

    // 6. Decodifica entidades HTML comuns
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');

    return text.trim();
}

function getUser(req) {
    const header = req.headers['x-ms-client-principal'];
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
        try {
            await database.containers.createIfNotExists({ id: "Notifications", partitionKey: { paths: ["/targetUserEmail"] } });
        } catch (e) { /* Ignora se já existir */ }

        const { resource: existingTask } = await container.item(taskId, taskId).read();
        if (!existingTask) {
            context.res = { status: 404, body: "Tarefa não encontrada." };
            return;
        }

        // 1. Adicionar o Comentário (SALVA O HTML ORIGINAL)
        const newComment = {
            id: uuidv4(),
            text: commentData.text,
            author: user.userDetails,
            userId: user.userId, 
            timestamp: new Date().toISOString()
        };

        if (!existingTask.comments) {
            existingTask.comments = [];
        } else if (!Array.isArray(existingTask.comments)) {
            existingTask.comments = [];
        }
        existingTask.comments.push(newComment);

        // 2. Lógica de Menção (@Nome) para Notificações Internas
        const { resources: allUsers } = await usersContainer.items.readAll().fetchAll();
        
        // Regex para extrair os e-mails mencionados nas tags <span ... data-email="EMAIL">
        const mentionRegex = /data-email="([^"]*)"/g;
        let match;
        const mentionedEmails = [];
        while ((match = mentionRegex.exec(commentData.text)) !== null) {
            mentionedEmails.push(match[1].toLowerCase());
        }

        // Filtra usuários pelo e-mail (resolvendo o problema)
        const mentionedUsers = allUsers.filter(u => u.email && mentionedEmails.includes(u.email.toLowerCase()));
        
        if (mentionedUsers.length > 0) {
            for (const mentionedUser of mentionedUsers) {
                const newNotification = {
                    id: uuidv4(),
                    targetUserEmail: mentionedUser.email, 
                    type: 'mention',
                    taskId: taskId,
                    taskTitle: existingTask.title,
                    message: `Você foi mencionado por ${user.userDetails}`,
                    commentPreview: formatHtmlToDiscord(commentData.text),
                    isRead: false,
                    createdAt: new Date().toISOString()
                };
                await notificationsContainer.items.create(newNotification);
            }
        }

        const { resource: replaced } = await container.item(taskId, taskId).replace(existingTask);

        // 3. Notificar Discord (USA A VERSÃO LIMPA / MARKDOWN)
        const discordMessage = formatHtmlToDiscord(newComment.text);

        await sendDiscordNotification({
            username: "SyncBoard",
            avatar_url: "https://i.imgur.com/AoaA8WI.png",
            content: `**💬 Novo Comentário de ${user.userDetails} na Tarefa [${taskId}]**`,
            embeds: [{
                description: discordMessage, 
                color: 0x9DB2BF,
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