const { CosmosClient } = require("@azure/cosmos");
const axios = require('axios');
const crypto = require('crypto');
const { reserveReviewer } = require('../shared/reviewerGuard');
const { decisionUpdate, recoveryUpdate, validateEntry, requireReviewer, responsibleEditUpdate, protectGenericUpdate, escapeHtml, homologatorEmail } = require('../shared/homologation');

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");
const notificationsContainer = database.container("Notifications");
const usersContainer = database.container("Users");
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
    let updatedData = req.body;
    context.log(`A atualizar tarefa com ID: ${taskId}`);

    try {
        if (!updatedData || typeof updatedData !== 'object' || Array.isArray(updatedData)) {
            context.res = {status: 400, body: 'Dados da tarefa inválidos.'};
            return;
        }
        const { resource: existingTask } = await container.item(taskId, taskId).read();
        if (!existingTask) {
            context.res = { status: 404, body: "Tarefa não encontrada." };
            return;
        }

        const oldStatus = existingTask.status;
        let decision = null;
        let responsibleEdit = null;
        let recovery = null;
        if (Object.prototype.hasOwnProperty.call(updatedData, 'homologationRecovery')) {
            recovery = await recoveryUpdate(existingTask, updatedData, req, usersContainer);
            updatedData = recovery.data;
        } else if (Object.prototype.hasOwnProperty.call(updatedData, 'homologationAction')) {
            decision = await decisionUpdate(existingTask, updatedData, req, usersContainer);
            updatedData = decision.data;
        } else {
            updatedData = {...updatedData};
            await validateEntry(existingTask, updatedData, usersContainer);
            responsibleEdit = await responsibleEditUpdate(existingTask, updatedData, req, usersContainer);
            protectGenericUpdate(existingTask, updatedData, !!responsibleEdit);
            updatedData = {...updatedData};
            if (responsibleEdit) updatedData.responsible = responsibleEdit.responsible;
            // Identity, audit and Cosmos metadata are server-owned, including generic saves.
            for (const key of ['id', 'history', '_etag', '_rid', '_self', '_attachments', '_ts',
                'actor', 'actorEmail', 'expectedStatus', 'expectedEtag', 'newResponsibleEmail']) delete updatedData[key];
            if (oldStatus === 'homologation') {
                await requireReviewer(existingTask.homologador, usersContainer);
                delete updatedData.homologador;
            }
        }

        if (recovery || (oldStatus !== 'homologation' && updatedData.status === 'homologation')) {
            await reserveReviewer(usersContainer, existingTask, homologatorEmail(updatedData.homologador));
        }

        // --- NOVO SISTEMA DE LOGS / HISTÓRICO ---
        existingTask.history = Array.isArray(existingTask.history) ? [...existingTask.history] : [];
        
        let changes = [];
        if (recovery) changes.push(`Homologador recuperado por administrador <span class="font-bold text-white">${escapeHtml(recovery.actor)}</span>`);
        if (responsibleEdit) {
            changes.push(`Responsáveis alterados por administrador <span class="font-bold text-white">${escapeHtml(responsibleEdit.actor)}</span>: ${responsibleEdit.responsible.map(user => escapeHtml(`${user.name} (${user.email})`)).join(', ')}`);
        }
        if (decision) {
            const label = {approve: 'Homologação aprovada', reject: 'Homologação reprovada', forward: 'Homologação encaminhada'}[decision.action];
            changes.push(`${label} por <span class="font-bold text-white">${escapeHtml(decision.actor)}</span>`);
            if (decision.action === 'forward') changes.push(`Novo responsável: <span class="font-bold text-white">${escapeHtml(updatedData.responsible[0].name)} (${escapeHtml(updatedData.responsible[0].email)})</span>`);
        }
        
        // 1. Mudança de Status
        if (updatedData.status && updatedData.status !== oldStatus) {
            changes.push(`Status alterado para <span class="font-bold text-white">${escapeHtml(statusLabels[updatedData.status] || updatedData.status)}</span>`);
        }

        // 2. Mudança de Homologador
        const oldHomolEmail = existingTask.homologador ? (typeof existingTask.homologador === 'object' ? existingTask.homologador.email : existingTask.homologador) : null;
        const newHomolEmail = updatedData.homologador ? (typeof updatedData.homologador === 'object' ? updatedData.homologador.email : updatedData.homologador) : null;
        if (newHomolEmail && newHomolEmail !== oldHomolEmail) {
            const homolName = typeof updatedData.homologador === 'object' ? updatedData.homologador.name : updatedData.homologador;
            changes.push(`Homologador designado: <span class="font-bold text-white">${escapeHtml(homolName)}</span>`);
        }

        // 3. Detecção de outros campos modificados
        const fieldsMap = {
            title: 'Título',
            description: 'Descrição',
            priority: 'Prioridade',
            dueDate: 'Prazo',
            project: 'Projeto',
            projectColor: 'Cor do Projeto'
        };

        let editedFields = [];
        for (const key in fieldsMap) {
            if (updatedData[key] !== undefined && updatedData[key] !== existingTask[key]) {
                editedFields.push(fieldsMap[key]);
            }
        }

        // Detecção em arrays complexos ou anexos
        if (updatedData.responsible && JSON.stringify(updatedData.responsible) !== JSON.stringify(existingTask.responsible)) {
            editedFields.push('Responsáveis');
        }
        if (updatedData.attachments && JSON.stringify(updatedData.attachments) !== JSON.stringify(existingTask.attachments)) {
            editedFields.push('Anexos');
        }

        if (editedFields.length > 0) {
            changes.push(`Editou: <span class="text-white/80">${editedFields.join(', ')}</span>`);
        }

        // Se encontrou alguma alteração que deve ir pro log
        if (changes.length > 0) {
            existingTask.history.push({
                action: 'edited',
                description: changes.join('<br>'),
                timestamp: new Date().toISOString()
            });
        }

        if (updatedData.attachments && !Array.isArray(updatedData.attachments)) {
            updatedData.attachments = [];
        }

        const taskToUpdate = { ...existingTask, ...updatedData };
        // A losing concurrent request must not append history or emit notifications.
        if (!existingTask._etag) throw new Error('ETag ausente na tarefa lida.');
        const { resource: replaced } = await container.item(taskId, taskId).replace(taskToUpdate, {
            accessCondition: {type: 'IfMatch', condition: existingTask._etag}
        });

        // --- GERAR NOTIFICAÇÃO PARA O HOMOLOGADOR ---
        try {
            const newStatus = updatedData.status || oldStatus;
            
            // Agora usamos o EMAIL como referência principal de troca e criação
            const oldHomologadorEmail = homologatorEmail(existingTask.homologador);
            const newHomologadorEmail = Object.prototype.hasOwnProperty.call(updatedData, 'homologador') ? homologatorEmail(updatedData.homologador) : oldHomologadorEmail;

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
        const status = error.httpStatus || (Number(error.code || error.statusCode) === 412 ? 409 : Number(error.code || error.statusCode) === 404 ? 404 : 500);
        context.res = { status, body: status === 409 ? 'A tarefa foi alterada. Atualize antes de decidir.' : error.httpStatus ? error.message : 'Erro ao atualizar tarefa.' };
    }
};
