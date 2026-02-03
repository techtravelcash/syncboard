const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const tasksContainer = database.container("Tasks");
const usersContainer = database.container("Users"); // Referência à tabela de usuários

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

        const userEmail = user.userDetails; // Geralmente é o email no SWA
        let userNameToRemove = userEmail;

        // 1. Tenta buscar o Nome Completo na coleção de Users usando o email
        try {
            // O ID na coleção Users é o email em minúsculas (baseado no api/addUser e api/getRoles)
            const { resource: userProfile } = await usersContainer.item(userEmail.toLowerCase(), userEmail.toLowerCase()).read();
            
            if (userProfile && userProfile.name) {
                userNameToRemove = userProfile.name;
                context.log(`Perfil encontrado. Nome resolvido de "${userEmail}" para "${userNameToRemove}"`);
            } else {
                context.log.warn(`Perfil não encontrado para ${userEmail}. Tentando usar claims ou o próprio email.`);
                // Fallback: Tenta pegar da claim 'name' se o perfil não existir no banco
                if (user.claims) {
                    const nameClaim = user.claims.find(c => c.typ === 'name');
                    if (nameClaim) userNameToRemove = nameClaim.val;
                }
            }
        } catch (dbError) {
            context.log.warn(`Erro ao buscar perfil do usuário: ${dbError.message}. Seguindo com valor padrão.`);
        }

        // 2. Busca a tarefa
        const { resource: existingTask } = await tasksContainer.item(taskId, taskId).read();
        
        if (!existingTask) {
            context.res = { status: 404, body: "Tarefa não encontrada." };
            return;
        }

        // 3. Verifica e remove o alerta
        if (existingTask.pendingAlerts && Array.isArray(existingTask.pendingAlerts)) {
            const originalLength = existingTask.pendingAlerts.length;
            
            // Tenta remover pelo Nome Completo (Prioridade)
            let newAlerts = existingTask.pendingAlerts.filter(name => name !== userNameToRemove);
            
            // Se não funcionou, tenta remover pelo email (Fallback de segurança)
            if (newAlerts.length === originalLength && userNameToRemove !== userEmail) {
                context.log(`Remoção por nome falhou. Tentando remover pelo email: ${userEmail}`);
                newAlerts = existingTask.pendingAlerts.filter(name => name !== userEmail);
            }

            existingTask.pendingAlerts = newAlerts;
            
            // Se houve alteração real na lista
            if (existingTask.pendingAlerts.length !== originalLength) {
                context.log(`Alerta removido com sucesso.`);
                
                const { resource: replaced } = await tasksContainer.item(taskId, taskId).replace(existingTask);
                
                context.bindings.signalRMessage = {
                    target: 'taskUpdated',
                    arguments: [replaced]
                };
                context.res = { body: replaced };
            } else {
                context.log(`AVISO: O usuário "${userNameToRemove}" (ou email) não estava na lista: ${JSON.stringify(existingTask.pendingAlerts)}`);
                // Retorna 200 com a tarefa atual para destravar o frontend, mesmo que não tenha removido nada
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