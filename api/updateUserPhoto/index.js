const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const usersContainer = database.container("Users");

function getUser(request) {
    const header = request.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    return JSON.parse(decoded);
}

module.exports = async function (context, req) {
    const currentUser = getUser(req);
    
    // Segurança: Só roda se o usuário estiver logado
    if (!currentUser) {
        context.res = { status: 401, body: "Não autenticado" };
        return;
    }

    const { pictureUrl } = req.body;
    if (!pictureUrl) {
        context.res = { status: 400, body: "URL da foto não fornecida." };
        return;
    }

    // O ID do usuário no banco é o email em minúsculas (padrão do addUser)
    const userId = currentUser.userDetails.toLowerCase();

    try {
        // 1. Busca o usuário no banco
        const { resource: userDoc } = await usersContainer.item(userId, userId).read();

        if (!userDoc) {
            // Se o usuário logado não está na tabela Users, ignoramos (sem permissão)
            context.res = { status: 404, body: "Usuário não encontrado no banco." };
            return;
        }

        // 2. Verifica se precisa atualizar (Economiza banco de dados)
        if (userDoc.picture === pictureUrl) {
            context.res = { body: { message: "Foto já está atualizada." } };
            return;
        }

        // 3. Atualiza a foto
        userDoc.picture = pictureUrl;
        const { resource: updatedUser } = await usersContainer.item(userId, userId).replace(userDoc);

        context.log(`Foto do usuário ${userId} atualizada com sucesso.`);
        context.res = { body: updatedUser };

    } catch (error) {
        context.log.error(`Erro ao atualizar foto do usuário ${userId}: ${error.message}`);
        context.res = { status: 500, body: "Erro interno ao atualizar foto." };
    }
};