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
    
    // Segurança: Só roda se o utilizador estiver logado
    if (!currentUser) {
        context.res = { status: 401, body: "Não autenticado" };
        return;
    }

    const { pictureUrl } = req.body;
    if (!pictureUrl) {
        context.res = { status: 400, body: "URL da foto não fornecida." };
        return;
    }

    const userId = currentUser.userDetails.toLowerCase();

    try {
        // ATUALIZAÇÃO CIRÚRGICA (PATCH): 
        // Em vez de ler e substituir o documento inteiro, dizemos ao Cosmos DB
        // para alterar APENAS o campo "picture". Assim, o Nome e Cargo ficam intactos!
        const { resource: updatedUser } = await usersContainer.item(userId, userId).patch({
            operations: [
                { op: 'set', path: '/picture', value: pictureUrl }
            ]
        });

        context.log(`Foto do utilizador ${userId} atualizada com sucesso via Patch.`);
        context.res = { body: updatedUser };

    } catch (error) {
        // O erro 404 significa que o utilizador ainda não existe na BD. 
        // Não fazemos nada, porque ele tem de ser criado pelo Admin primeiro.
        if (error.code === 404) {
            context.res = { status: 404, body: "Utilizador não encontrado no banco." };
        } else {
            context.log.error(`Erro ao atualizar foto do utilizador ${userId}: ${error.message}`);
            context.res = { status: 500, body: "Erro interno ao atualizar foto." };
        }
    }
};